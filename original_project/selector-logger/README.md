# Selector Logger (WebExtension)

Collects HTML/inner/attribute values from CSS selectors, with optional domain/path scoping, and logs them line-by-line.

## Build/Install

No build step; load as an unpacked extension.

### Chrome/Chromium
1. `chrome://extensions` → Enable **Developer Mode**
2. **Load unpacked** → select the `selector-logger` folder
3. Copy the extension ID if you plan to use native file append (to fill in the host JSON).

### Firefox
1. `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…**
2. Choose `manifest.json`

## Usage

- Each row:  
  `[domain/path glob]|<css selector>|[inner|inner:strip|attr:NAME]`
- Examples:
  - `*.example.com|article h2|inner`
  - `example.*/news*|a.headline|attr:href`
  - `div.post|inner:strip`
  - `#main > .card` (no domain glob, default logs `outerHTML`)

- Click **Run** to collect:
  - Entries appended to the textarea and `console.log`
  - Each match becomes one output line (internal newlines stripped)

- Session de-duplication:
  - When “Skip pages already visited (this session)” is enabled, the extension keeps a session-scoped set of normalized URLs (origin + path + query, no #hash, trailing slash normalized). If you refresh or navigate back to a URL already in the set, the run is skipped and a [SKIP] line appears in the log. Use Reset session to clear the set.
  
## Optional: Append to file

Browser extensions can’t write arbitrary files directly.

Enable **Native file append** in the popup and set a path. Then:

1. Install the native host:
   - Put `native_host/selector_logger.py` somewhere executable
   - Put `native_host/com.pfahlr.selectorlogger.json` in the per-browser config dir
   - Update the JSON:
     - `"path"` → absolute path to `selector_logger.py`
     - `"allowed_origins"` → include your extension ID for Chrome; Firefox allows `moz-extension://*` for temp loads
2. Click **Test connection** in the popup → “Native OK”
3. **Run** to append lines to your file (each write is flushed)

## Notes

- If a selector is invalid, the log shows `[selector error] …`
- If mode is `attr:` with no name, the log shows `[attr error] …`
- If mode is unknown, the log shows `[mode error] …`
- Domain/path glob is matched against `host + pathname`, e.g., `example.com/news/today`
  - `*` matches any chars, e.g., `*.example.com`, `example.*/news*`
