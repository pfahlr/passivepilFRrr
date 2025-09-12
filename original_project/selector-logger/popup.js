// popup.js

/**
 * Global Variables
 */

const rowsEl = document.getElementById('rows');
const addRowBtn = document.getElementById('addRow');
const runBtn = document.getElementById('run');
const clearBtn = document.getElementById('clearLog');
const logEl = document.getElementById('log');

const skipVisitedEl = document.getElementById('skipVisited');
const resetSessionBtn = document.getElementById('resetSession');

const enableNativeEl = document.getElementById('enableNative');
const filePathEl = document.getElementById('filePath');
const testNativeBtn = document.getElementById('testNative');
const nativeStatusEl = document.getElementById('nativeStatus');

// Prefer session storage; fallback to local if unavailable
const ses = chrome.storage.session || null;
const sessGet = (keys) => (ses ? ses.get(keys) : chrome.storage.local.get(keys));
const sessSet = (obj)   => (ses ? ses.set(obj)    : chrome.storage.local.set(obj));

const STATE_KEY   = 'selectorLoggerState';
const VISITED_KEY = 'selectorLoggerVisited'; // { urls: string[] }
const LOG_KEY     = 'selectorLoggerLog';     // { lines: string[] }
const MAX_LOG_LINES = 5000;                  // keep things bounded

// in top-level bindings:
const autoRunEl = document.getElementById('autoRun');

// in persist():
const state = {
    rows,
    enableNative: enableNativeEl.checked,
    filePath: filePathEl.value.trim(),
    skipVisited: skipVisitedEl.checked,
    autoRun: !!autoRunEl.checked,
};

chrome.storage.local.set({ [STATE_KEY]: state });

// in restore():
autoRunEl.checked = !!state.autoRun;

// listeners:
autoRunEl.addEventListener('change', persist);


/**
 *  Utility Functions
 */

/** Normalize: origin + path (+ query), drop hash, trim trailing slash (except root) */
function normalizeUrl(raw) {
    try {
        const u = new URL(raw);
        let path = u.pathname || '/';
        if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
        const qs = u.search || '';
        return `${u.origin}${path}${qs}`;
    } catch {
        return (raw || '').replace(/#.*$/, '').replace(/\/+$/, '');
    }
}

/**
 *  Persistence Operations
 */

function persist() {
    const rows = Array.from(rowsEl.querySelectorAll('.row'))
    .map(r => ({
        enabled: r.querySelector('input[type="checkbox"]').checked,
               value: r.querySelector('input[type="text"]').value.trim()
    }));
    const state = {
        rows,
        enableNative: enableNativeEl.checked,
        filePath: filePathEl.value.trim(),
        skipVisited: skipVisitedEl.checked
    };
    chrome.storage.local.set({ [STATE_KEY]: state });
}

function appendLog(line) {
    if (!line) return;
    // Update textarea
    logEl.value += (logEl.value ? '\n' : '') + line;
    logEl.scrollTop = logEl.scrollHeight;
    // Persist
    persistLogAppend([line]);
}

async function persistLogAppend(newLines) {
    const bag = await sessGet(LOG_KEY);
    const lines = bag?.[LOG_KEY]?.lines ? bag[LOG_KEY].lines.slice() : [];
    for (const l of newLines) {
        lines.push(l);
    }
    // Trim to MAX_LOG_LINES
    if (lines.length > MAX_LOG_LINES) {
        lines.splice(0, lines.length - MAX_LOG_LINES);
    }
    await sessSet({ [LOG_KEY]: { lines } });
}

/** Add URL to session visited set and refresh badge */
async function markVisited(url) {
    const bag = await sessGet(VISITED_KEY);
    const visited = new Set(bag?.[VISITED_KEY]?.urls || []);
    visited.add(url);
    await sessSet({ [VISITED_KEY]: { urls: Array.from(visited) } });
    chrome.runtime.sendMessage({ type: 'updateBadge' });
}


/*
 * Restore log, config settings, list of urls already scanned and stored in log from local storage
 */

async function restore() {
    // restore UI state
    chrome.storage.local.get(STATE_KEY, ({ [STATE_KEY]: s }) => {
        const state = s || {};
        rowsEl.innerHTML = '';
        (state.rows || ['']).forEach(item => {
            const row = makeRow(typeof item === 'string' ? item : item.value);
            if (typeof item === 'object') {
                row.querySelector('input[type="checkbox"]').checked = !!item.enabled;
            }
            rowsEl.appendChild(row);
        });
        enableNativeEl.checked = !!state.enableNative;
        filePathEl.value = state.filePath || '';
        skipVisitedEl.checked = state.skipVisited !== false; // default true
    });

    // restore log
    const bag = await sessGet(LOG_KEY);
    const lines = bag?.[LOG_KEY]?.lines || [];
    logEl.value = lines.join('\n');
    logEl.scrollTop = logEl.scrollHeight;
}


/**
 *  Create row in config form
 */

function makeRow(value = '') {
    const row = document.createElement('div');
    row.className = 'row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'checkbox';
    cb.checked = true;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = "[domain/path glob]|<css selector>|[inner|inner:strip|attr:NAME]";
    input.value = value;

    const add = document.createElement('button');
    add.textContent = '+';
    add.title = 'Add another row';
    add.addEventListener('click', () => {
        alert('add config row');
        console.log('add config row');
        const newRow = makeRow();
        rowsEl.insertBefore(newRow, row.nextSibling);
        persist();
    });

    const del = document.createElement('button');
    del.textContent = '–';
    del.title = 'Remove this row';
    del.addEventListener('click', () => {
        row.remove();
        persist();
    });

    cb.addEventListener('change', persist);
    input.addEventListener('input', persist);

    row.append(cb, input, add, del);
    return row;
}

/**
 *  main extension operation - scan content for matches
 */

/** Runs in page context */
function runCollectors(rows) {
    try {
        const lines = [];
        for (const { value } of rows) {
            // Parse "domainGlob|selector|mode"
            const parts = value.split('|');
            let domainGlob = '', selector = '', mode = '';
            if (parts.length === 1) {
                selector = parts[0].trim();
            } else if (parts.length === 2) {
                domainGlob = parts[0].trim();
                selector = parts[1].trim();
            } else {
                domainGlob = parts[0].trim();
                selector = parts[1].trim();
                mode = parts.slice(2).join('|').trim(); // allow pipes in selector via join
            }

            // if no selector matched, restart loop on next config row
            if (!selector) continue;
            // same if domain pattern doesn't match, skip DOM querying.
            if (domainGlob && !urlMatches(domainGlob)) continue;

            let nodeList;
            // try DOM query, catch exception
            try {
                nodeList = document.querySelectorAll(selector);
            } catch (e) {
                lines.push(`[selector error] ${selector} :: ${e.message}`);
                continue;
            }

            //loop through matches, get content specified by 'mode' portion of config
            for (const el of nodeList) {
                let out = '';
                if (!mode || mode === '') {
                    out = el.outerHTML;
                } else if (mode === 'inner') {
                    out = el.innerHTML;
                } else if (mode === 'inner:strip') {
                    out = el.textContent || '';
                } else if (mode.startsWith('attr:')) {
                    const name = mode.slice(5).trim();
                    if (name) {
                        const v = el.getAttribute(name);
                        if (v != null) out = String(v);
                        else continue; // silently skip if attr missing
                    } else {
                        lines.push('[attr error] missing attribute name');
                        continue;
                    }
                    //fallback case, mode string does not match an operation... specify error... move on.
                    // TODO: this should go to a separate error log
                } else {
                    lines.push(`[mode error] unsupported mode "${mode}"`);
                    continue;
                }

                //remove unnecessary line breaks, so match result will be a single line making
                //information about *what* each match was implicitly available from log.
                out = String(out).replace(/\r?\n+/g, ' ').trim();
                lines.push(out);
            }
        }
        return { result: lines };
    } catch (e) {
        return { error: e.message };
    }

    /**
     *  Helper functions limited in scope to runCollectors parent function.
     */
    function urlMatches(glob) {
        const target = location.host + location.pathname;
        const re = globToRegex(glob);
        return re.test(target);
    }

    function globToRegex(glob) {
        const esc = s => s.replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&');
        let rx = '';
        for (const ch of glob) rx += (ch === '*') ? '.*' : esc(ch);
        return new RegExp('^' + rx + '$');
    }
}


/**
 *  Event Listeners
 */


addRowBtn.addEventListener('click', () => {
    rowsEl.appendChild(makeRow());
    persist();
});

runBtn.addEventListener('click', async () => {
    const rows = Array.from(rowsEl.querySelectorAll('.row')).map(r => ({
        enabled: r.querySelector('input[type="checkbox"]').checked,
                                                                       value: r.querySelector('input[type="text"]').value.trim()
    })).filter(r => r.enabled && r.value.length);

    if (!rows.length) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const url = normalizeUrl(tab.url || '');
    const skip = skipVisitedEl.checked;

    try {
        if (skip && url) {
            const bag = await sessGet(VISITED_KEY);
            const visited = new Set(bag?.[VISITED_KEY]?.urls || []);
            if (visited.has(url)) {
                appendLog(`[SKIP] Already visited this session: ${url}`);
                return;
            }
        }

        const state = {
            enableNative: enableNativeEl.checked,
            filePath: filePathEl.value.trim()
        };

        await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: false },
            files: ['content.js']
        });

        const inj = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: runCollectors,
            args: [rows, state]
        });

        // unwrap
        const payload = inj && inj[0] && inj[0].result ? inj[0].result : null;
        const error   = payload && payload.error ? payload.error : null;
        const lines   = (payload && Array.isArray(payload.result)) ? payload.result : [];

        if (error) {
            appendLog(`[ERROR] ${error}`);
            return;
        }

        for (const line of lines) {
            appendLog(line);
            console.log('[SelectorLogger]', line);
        }

        if (state.enableNative && state.filePath) {
            chrome.runtime.sendMessage({
                type: 'nativeAppend',
                path: state.filePath,
                lines
            }, resp => {
                if (chrome.runtime.lastError) {
                    nativeStatusEl.textContent = `Native error: ${chrome.runtime.lastError.message}`;
                } else if (resp?.ok) {
                    nativeStatusEl.textContent = `Appended ${lines.length} line(s)`;
                } else {
                    nativeStatusEl.textContent = resp?.error || 'Native append failed';
                }
            });
        }

        if (skip && url) {
            await markVisited(url);
        }
    } catch (e) {
        appendLog(`[ERROR] ${e.message}`);
    }
});


/**
 *  Reset the log. Running this will lose all the data you've collected this session.
 *  so hopefully you saved it somewhere if it was useful.
 */
clearBtn.addEventListener('click', async () => {
    logEl.value = '';
    await sessSet({ [LOG_KEY]: { lines: [] } });
});

/*
 * Reset list of visited urls. Running this without clearing out the log as well
 * might result in duplicated log*entries
 */

resetSessionBtn.addEventListener('click', async () => {
    await sessSet({ [VISITED_KEY]: { urls: [] } });
    appendLog('[INFO] Session visited-URL list cleared.');
    chrome.runtime.sendMessage({ type: 'updateBadge' });
});

/*
 *  Enable the parallel external python listener which should be writing all collected data to
 *  a backup text file. And could provide much more functionality.
 */

enableNativeEl.addEventListener('change', persist);
filePathEl.addEventListener('input', persist);
skipVisitedEl.addEventListener('change', persist);

testNativeBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'nativePing' }, resp => {
        nativeStatusEl.textContent = resp?.ok ? 'Native OK' : (resp?.error || 'No native host');
    });
});

document.addEventListener('DOMContentLoaded', restore);


