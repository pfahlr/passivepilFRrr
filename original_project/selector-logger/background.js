// background.js

const HOST_NAME   = "com.pfahlr.selectorlogger";
const VISITED_KEY = "selectorLoggerVisited"; // { urls: string[] }
const STATE_KEY   = "selectorLoggerState";

// ---- Native messaging ----
let nativePort = null;

/*
   Utility Functions

*/

function normalizeUrl(raw) {
    try {
        const u = new URL(raw);
        let path = u.pathname || "/";
        if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
        const qs = u.search || "";
        return `${u.origin}${path}${qs}`;
    } catch {
        return (raw || "").replace(/#.*$/, "").replace(/\/+$/, "");
    }
}

/**
 *  Asynchronous Functions
 */

async function getSessionStore() {
    return chrome.storage.session || chrome.storage.local;
}

async function updateBadge() {
    try {
        const ses = chrome.storage.session || chrome.storage.local;
        const bag = await ses.get(VISITED_KEY);
        const visited = new Set(bag?.[VISITED_KEY]?.urls || []);
        const count = visited.size;
        chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
    } catch {
        chrome.action.setBadgeText({ text: "" });
    }
}

// Connect (or reuse) native host
function tryConnectNative() {
    return new Promise((resolve, reject) => {
        if (nativePort) return resolve();

        try {
            nativePort = chrome.runtime.connectNative(HOST_NAME);
        } catch (e) {
            return reject(new Error(`Native host "${HOST_NAME}" not found or not permitted`));
        }

        // If the host disconnects immediately (e.g., bad manifest/path), surface a clear error
        let resolved = false;
        nativePort.onDisconnect.addListener(() => {
            nativePort = null;
            if (!resolved) {
                const err = chrome.runtime.lastError?.message || "Native host disconnected";
                reject(new Error(err));
            }
        });

        // Defer resolve to next tick to allow immediate disconnect errors to trigger
        setTimeout(() => {
            resolved = true;
            resolve();
        }, 0);
    });
}

// Send a JSON message to native host and await a JSON response (optional)
function nativeSend(obj) {
    return new Promise((resolve, reject) => {
        if (!nativePort) return reject(new Error("No native port"));
        let responded = false;

        function onMessage(resp) {
            responded = true;
            nativePort.onMessage.removeListener(onMessage);
            // Some hosts reply {ok:true} per command; if not, we just resolve.
            if (resp && resp.ok === false && resp.error) return reject(new Error(resp.error));
            resolve(resp || { ok: true });
        }

        nativePort.onMessage.addListener(onMessage);

        try {
            nativePort.postMessage(obj);
            // If the host doesn't send a response for this op, still resolve after a short grace
            setTimeout(() => {
                if (!responded) {
                    nativePort.onMessage.removeListener(onMessage);
                    resolve({ ok: true });
                }
            }, 250);
        } catch (e) {
            nativePort.onMessage.removeListener(onMessage);
            reject(e);
        }
    });
}

/*
 * The main execution operation of the extension... this is also implemented in content.js... this
 *  should probably follow a modular design.
 */

function runCollectorsBG(rows, _tabUrl) {

    try {
        const lines = [];
        for (const row of rows) {
            if (!row?.enabled) continue;
            const value = (typeof row === 'string') ? row : (row.value || '');
            if (!value) continue;

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
                mode = parts.slice(2).join('|').trim();
            }
            if (!selector) continue;
            if (domainGlob && !urlMatches(domainGlob)) continue;

            let nodeList;
            try { nodeList = document.querySelectorAll(selector); }
            catch (e) { lines.push(`[selector error] ${selector} :: ${e.message}`); continue; }

            for (const el of nodeList) {
                let out = '';
                if (!mode || mode === '') out = el.outerHTML;
                else if (mode === 'inner') out = el.innerHTML;
                else if (mode === 'inner:strip') out = el.textContent || '';
                else if (mode.startsWith('attr:')) {
                    const name = mode.slice(5).trim();
                    if (!name) { lines.push('[attr error] missing attribute name'); continue; }
                    const v = el.getAttribute(name);
                    if (v == null) continue;
                    out = String(v);
                } else { lines.push(`[mode error] unsupported mode "${mode}"`); continue; }

                out = String(out).replace(/\r?\n+/g, ' ').trim();
                lines.push(out);
            }
        }
        return { result: lines };
    } catch (e) {
        return { error: e.message };
    }

    function urlMatches(glob) {
        const target = location.host + location.pathname;
        const re = new RegExp('^' + glob.replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g,' .*'.trim()) + '$');
        return re.test(target);
    }
}

/**
 *  Event Listeners
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete" || !tab?.url) return;

    // Load state
    const { [STATE_KEY]: state } = await chrome.storage.local.get(STATE_KEY) || {};
    if (!state?.autoRun) return;

    const ses = await getSessionStore();
    const bag = await ses.get(VISITED_KEY);
    const visited = new Set(bag?.[VISITED_KEY]?.urls || []);
    const url = normalizeUrl(tab.url);

    // Skip if requested and already visited this session
    if (state.skipVisited !== false && url && visited.has(url)) return;

    try {
        // Ensure content script context exists
        await chrome.scripting.executeScript({
            target: { tabId, allFrames: false },
            files: ['content.js']
        });

        // Execute the same collector used by the popup
        const inj = await chrome.scripting.executeScript({
            target: { tabId },
            func: runCollectorsBG,
            args: [state.rows || [], tab.url]
        });

        const payload = inj && inj[0] && inj[0].result ? inj[0].result : null;
        const error   = payload && payload.error ? payload.error : null;
        const lines   = (payload && Array.isArray(payload.result)) ? payload.result : [];
        if (error) return;

        // Optional: append to file via native host
        if (state.enableNative && state.filePath && lines.length) {
            await tryConnectNative().then(() =>
            nativeSend({ op: "append", path: state.filePath, lines })
            ).catch(() => {});
        }

        // Mark visited and refresh badge
        if (state.skipVisited !== false && url) {
            visited.add(url);
            await ses.set({ [VISITED_KEY]: { urls: Array.from(visited) } });
            updateBadge();
        }
    } catch (e) {
        // swallow; page might block injection etc.
    }
});

// ---- Badge lifecycle ----
chrome.runtime.onInstalled.addListener(() => {
    chrome.action.setBadgeBackgroundColor({ color: "#666" });
    updateBadge();
});

chrome.runtime.onStartup.addListener(updateBadge);

// Update badge when the visited set changes (session or local fallback)
chrome.storage.onChanged.addListener((changes, area) => {
    if (changes[VISITED_KEY]) updateBadge();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    // Badge refresh request from popup
    if (msg?.type === "updateBadge") {
        updateBadge().then(() => sendResponse({ ok: true }));
        return true; // async
    }

    // Ping native helper
    if (msg?.type === "nativePing") {
        tryConnectNative()
        .then(() => sendResponse({ ok: true }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
        return true; // async
    }

    // Append lines to file through native helper
    if (msg?.type === "nativeAppend") {
        console.log('background.js::nativeAppend()');
        console.log(msg);
        const { path, lines } = msg;
        if (!path || !Array.isArray(lines)) {
            sendResponse({ ok: false, error: "Invalid payload (path/lines)" });
            return;
        }
        tryConnectNative()
        .then(() => nativeSend({ op: "append", path, lines }))
        .then(() => sendResponse({ ok: true }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
        return true; // async
    }
});


