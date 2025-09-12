<script lang="ts">
  import { onMount } from 'svelte';
  import { stateItem, logItem, visitedItem } from '~/lib/utils/storage';
  import { normalizeUrl } from '~/lib/utils/normalizeUrl';
  import { messaging } from '~/lib/messaging';

  interface Row { enabled: boolean; value: string }
  const MAX_LOG_LINES = 5000;

  let rows: Row[] = [];
  let enableNative = false;
  let filePath = '';
  let skipVisited = true;
  let autoRun = false;
  let log = '';
  let nativeStatus = '';

  onMount(async () => {
    const state = await stateItem.getValue();
    rows = state.rows?.length ? state.rows : [{ enabled: true, value: '' }];
    enableNative = state.enableNative;
    filePath = state.filePath;
    skipVisited = state.skipVisited;
    autoRun = state.autoRun;

    const logData = await logItem.getValue();
    log = logData.lines.join('\n');
  });

  function persist() {
    stateItem.setValue({ rows, enableNative, filePath, skipVisited, autoRun });
  }

  function addRow(i?: number) {
    const row: Row = { enabled: true, value: '' };
    if (i == null) rows.push(row);
    else rows.splice(i + 1, 0, row);
    persist();
  }

  function removeRow(i: number) {
    rows.splice(i, 1);
    if (!rows.length) rows.push({ enabled: true, value: '' });
    persist();
  }

  function appendLog(line: string) {
    if (!line) return;
    log += (log ? '\n' : '') + line;
    let lines = log.split('\n');
    if (lines.length > MAX_LOG_LINES) {
      lines = lines.slice(-MAX_LOG_LINES);
      log = lines.join('\n');
    }
    logItem.setValue({ lines });
  }

  async function clearLog() {
    log = '';
    await logItem.setValue({ lines: [] });
  }

  async function resetSession() {
    await visitedItem.setValue({ urls: [] });
    appendLog('[INFO] Session visited-URL list cleared.');
    messaging.sendMessage('updateBadge');
  }

  async function testNative() {
    const resp = await messaging.sendMessage('nativePing');
    nativeStatus = resp.ok ? 'Native OK' : (resp.error || 'No native host');
  }

  async function run() {
    persist();
    const activeRows = rows.filter(r => r.enabled && r.value.trim());
    if (!activeRows.length) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) return;
    const url = normalizeUrl(tab.url);

    if (skipVisited) {
      const visited = new Set((await visitedItem.getValue()).urls);
      if (visited.has(url)) {
        appendLog(`[SKIP] Already visited this session: ${url}`);
        return;
      }
    }

    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'runCollectors', rows: activeRows });
      if (resp?.error) {
        appendLog(`[ERROR] ${resp.error}`);
        return;
      }
      const lines: string[] = resp?.result ?? [];
      for (const line of lines) appendLog(line);

      if (enableNative && filePath) {
        const result = await messaging.sendMessage('nativeAppend', { path: filePath, lines });
        nativeStatus = result.ok ? `Appended ${lines.length} line(s)` : (result.error || 'Native append failed');
      }

      if (skipVisited) {
        const visited = new Set((await visitedItem.getValue()).urls);
        visited.add(url);
        await visitedItem.setValue({ urls: Array.from(visited) });
        messaging.sendMessage('updateBadge');
      }
    } catch (e: any) {
      appendLog(`[ERROR] ${e.message}`);
    }
  }
</script>

<div class="wrap">
  <h1>Selector Logger</h1>

  {#each rows as row, i}
    <div class="row">
      <input type="checkbox" class="checkbox" bind:checked={row.enabled} on:change={persist} />
      <input
        type="text"
        bind:value={row.value}
        placeholder="[domain/path glob]|<css selector>|[inner|inner:strip|attr:NAME]"
        on:input={persist}
      />
      <button on:click={() => addRow(i)} title="Add another row">+</button>
      <button on:click={() => removeRow(i)} title="Remove this row">–</button>
    </div>
  {/each}

  <div class="row controls">
    <button on:click={() => addRow()} title="Add selector input">+</button>
    <button on:click={run}>Run</button>
    <button on:click={clearLog}>Clear Log</button>
  </div>

  <div class="row">
    <label style="display:flex;align-items:center;gap:8px;">
      <input type="checkbox" bind:checked={skipVisited} on:change={persist} />
      <span>Skip pages already visited (this session)</span>
    </label>
    <button on:click={resetSession} title="Clear visited-URL list" style="margin-left:auto;">Reset session</button>
  </div>
  <div class="row">
    <label style="display:flex;align-items:center;gap:8px;">
      <input type="checkbox" bind:checked={autoRun} on:change={persist} />
      <span>Auto-run on page load</span>
    </label>
  </div>
  <details>
    <summary>File output (optional)</summary>
    <label>
      <input type="checkbox" bind:checked={enableNative} on:change={persist} />
      Enable native file append
    </label>
    <input type="text" bind:value={filePath} placeholder="/path/to/output.log" on:input={persist} />
    <button on:click={testNative}>Test connection</button>
    <div class="status">{nativeStatus}</div>
  </details>

  <label class="loglabel">Log</label>
  <textarea rows="10" spellcheck="false" bind:value={log} readonly></textarea>
</div>

