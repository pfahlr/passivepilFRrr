  <div class="wrap">
    <h1>Selector Logger</h1>

    <div id="rows"></div>

    <div class="row controls">
      <button id="addRow" title="Add selector input">+</button>
      <button id="run">Run</button>
      <button id="clearLog">Clear Log</button>
    </div>

    <div class="row">
      <label style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="skipVisited" checked />
        <span>Skip pages already visited (this session)</span>
      </label>
      <button id="resetSession" title="Clear visited-URL list" style="margin-left:auto;">Reset session</button>
    </div>
    <div class="row">
    <label style="display:flex;align-items:center;gap:8px;">
        <input type="checkbox" id="autoRun" />
        <span>Auto-run on page load</span>
    </label>
    </div>
    <details>
      <summary>File output (optional)</summary>
      <label>
        <input type="checkbox" id="enableNative" />
        Enable native file append
      </label>
      <input id="filePath" type="text" placeholder="/path/to/output.log" />
      <button id="testNative">Test connection</button>
      <div id="nativeStatus" class="status"></div>
    </details>

    <label class="loglabel">Log</label>
    <textarea id="log" rows="10" spellcheck="false"></textarea>
  </div>
