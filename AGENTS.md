## Mission

Build and maintain a WXT-based Chrome extension using **test-driven development (TDD)**. All changes begin with a failing test (unit or E2E), then code to pass, then refactor.

## Specifications

Here’s the up-to-date spec for your extension as it stands after the simplification pass.

### Core behavior

* **Rule format:** one rule per line in a single textarea.

  * Syntax: `[domain/path glob]|<css selector>|[mode]`
  * `glob` (optional): matched against `host + pathname`, `*` is a wildcard (e.g., `*.example.com`, `example.*/news*`).
  * `mode` (optional):

    * *absent* → log `outerHTML` (the element + its subtree).
    * `inner` → log `innerHTML`.
    * `inner:strip` → log text only (`textContent`).
    * `attr:NAME` → log the exact attribute value (skip element if missing).
  * Lines that are blank or start with `#` are ignored.
* **Matching & order:** For each active page run, process rules **top to bottom**; for each rule, log **every match on the page** in DOM order before moving to the next rule.
* **Output normalization:** Each logged entry has internal `\r?\n` collapsed to spaces and is trimmed. Each entry becomes **one line** in the log.

### UI (popup)

* **Rules textarea** – source of truth for all rules.
* **Run** button – executes rules on the current tab.
* **Clear Log** – clears the session log.
* **Skip pages already visited (this session)** – de-dupe runs per URL.
* **Reset session** – clears visited-URL set and refreshes the badge.
* **Auto-run on page load** – when enabled, background runs rules on each completed navigation that isn’t marked visited.
* **Optional file output** (Native Messaging):

  * Enable toggle + file path input.
  * **Test connection** button (pings native host).
* **Log textarea** – shows all collected lines; persists across popup opens for the current browser session.

### Background (service worker, MV3)

* **Auto-run:** Listens to `tabs.onUpdated(status==="complete")`; if Auto-run is on and URL not visited (when Skip is on), injects and runs the collector on that page.
* **Visited tracking & de-dup:** Keeps a session-scoped set of normalized URLs:

  * Normalization: `origin + pathname (+ search)`, no `#hash`, trailing slash trimmed (except at root). Distinct query strings count as different pages.
* **Badge:** Shows the count of **unique visited URLs** this session; clears when count is 0. Updates on install/startup and whenever the visited set changes.
* **Native file append:** If enabled and a path is provided, appends each run’s lines to the file via Native Messaging (flush per run).
* **Session log persistence:** Auto-run results are appended to the same session log the popup displays.

### Content execution

* The popup/background inject a tiny stub (`content.js`) and then a function that:

  * Parses each rule into `{glob, selector, mode}`.
  * Skips rule if `glob` doesn’t match the page.
  * `querySelectorAll(selector)`; for each element, emits a line according to `mode`.
  * Returns `{ result: string[] }` (or `{ error: string }` on failure).

### Error handling

* Invalid selectors add a log line like: `[selector error] <selector> :: <message>`.
* `attr:` without a name adds `[attr error] missing attribute name`.
* Unknown modes add `[mode error] unsupported mode "<mode>"`.
* If a rule’s `attr:NAME` is missing on a matched element, that element is silently skipped.
* Native host errors are surfaced in the popup status area; file writes are best-effort (UI still logs normally).

### Storage & keys

* **Config/state** (`chrome.storage.local`):

  * `selectorLoggerState` → `{ rulesText, enableNative, filePath, skipVisited, autoRun }`
* **Session data** (`chrome.storage.session` if available; fallback `.local`):

  * `selectorLoggerVisited` → `{ urls: string[] }`
  * `selectorLoggerLog` → `{ lines: string[] }` (bounded to the most recent \~5000 lines)

### Native messaging (optional file writes)

* **Host name:** `com.pfahlr.selectorlogger`
* **Python host:** `native_host/selector_logger.py` (append lines; flush per request)
* **Manifests:**

  * **Chrome:** `~/.config/google-chrome/NativeMessagingHosts/com.pfahlr.selectorlogger.json`

    * Uses `"allowed_origins": ["chrome-extension://<EXT_ID>/"]`
  * **Firefox:** `~/.mozilla/native-messaging-hosts/com.pfahlr.selectorlogger.json`

    * Requires a Gecko ID in your extension manifest:

      ```json
      "browser_specific_settings": { "gecko": { "id": "selectorlogger@pfahlr" } }
      ```
    * And host manifest uses `"allowed_extensions": ["selectorlogger@pfahlr"]`

### Manifest / permissions (current)

* **Manifest v3**
* `action.default_popup = "popup.html"`
* **Background:** `background.js` as a **service worker**
* **Permissions:** `"storage"`, `"scripting"`, `"activeTab"`
* **Host permissions:** `"<all_urls>"` (for page injection)
* **Optional permissions:** `"nativeMessaging"` (only needed if file output used)


Tech & Targets

* **Runtime:** Chrome (MV3) via **WXT**
* **Lang:** TypeScript (strict)
* **Unit Tests:** **Vitest**
* **E2E Tests:** **Puppeteer** (launches Chrome with the built extension)
* **Lint/Format:** ESLint + Prettier
* **Storage/API:** `chrome.*` APIs (mocked in unit tests)

## Project Commands

* Install deps: `pnpm install`
* Start dev (HMR): `pnpm dev`
* Type-check: `pnpm typecheck`
* Lint: `pnpm lint`
* Build extension: `pnpm build`
* Run all tests (CI default): `pnpm test`
* Unit tests only: `pnpm test:unit`
* E2E tests only: `pnpm test:e2e`

> CI must run: `pnpm install && pnpm build && pnpm test`

## Code Style

* TypeScript **strict** on
* Single quotes, **no semicolons**
* Functional-first; pure functions for business logic
* Small modules, no side effects at import time
* Keep Chrome API calls behind thin adapters (easy to mock)

## Definition of Done

* A failing test existed **before** implementation
* All tests green: unit + E2E
* Type-check clean; lint clean
* New/changed behavior covered by tests
* If UI/UX: at least one E2E that exercises the user workflow

---

## Testing Strategy (Pyramid)

### 1) Unit (fast, many) — **Vitest**

* Scope: pure logic, adapters, small utilities
* Chrome APIs **mocked** (provide `globalThis.chrome` stubs)
* Goal: >90% coverage on core modules

### 2) E2E (slower, few) — **Puppeteer**

* Scope: real Chrome, real extension build
* Launch Chrome with:

  * `--disable-extensions-except=<distDir>`
  * `--load-extension=<distDir>`
* Exercise critical user journeys (popup open, content script behavior, background message round-trips, storage updates)

> Keep E2E focused on acceptance criteria. Push logic into unit-tested modules.

---

## TDD Workflow (Non-negotiable)

1. **Write a failing test** (unit or E2E) that specifies the desired behavior.
2. **Run tests** and confirm the failure is for the right reason.
3. **Implement the minimum** to make it pass.
4. **Refactor** (improve design, readability, duplication).
5. **Commit** with message referencing the test and behavior.

---

## Playbooks

### Add a Feature

1. Write a **failing E2E** describing the user flow.
2. Write **failing unit tests** for any new logic.
3. Implement, pass unit tests, then pass E2E.
4. Refactor; ensure adapters isolate Chrome APIs.

### Fix a Bug

1. Reproduce with a **failing test** (unit if logic, E2E if workflow).
2. Implement fix; keep test.
3. Add regression tag to the test title.

### Refactor Safely

1. No behavior change: **no new tests** required, but **all** existing must stay green.
2. If behavior changes, treat as feature (see above).

---

## How to Run Tests

### Unit (Vitest)

```bash
pnpm test:unit
```

**Chrome API mocks** (example):

```ts
// test/setup/chrome-mock.ts
// Minimal mock; extend per test needs.
(globalThis as any).chrome = {
  storage: {
    local: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => undefined),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn() },
  },
} as unknown as typeof chrome;
```

Configure Vitest to include the setup file:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['test/setup/chrome-mock.ts'],
  },
});
```

### E2E (Puppeteer)

```bash
pnpm build            # build WXT -> dist
pnpm test:e2e         # runs puppeteer specs
```

**Puppeteer bootstrap** (loads the built extension):

```ts
// test/e2e/extension.launch.ts
import puppeteer, { Browser } from 'puppeteer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT_PATH = path.resolve(__dirname, '../../dist/chrome-mv3'); // adjust to your WXT output

export async function launchWithExtension(): Promise<Browser> {
  return await puppeteer.launch({
    headless: false, // headful for extension UI
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      '--no-sandbox',
    ],
    defaultViewport: null,
  });
}
```

**Example E2E test** (popup opens and shows expected text):

```ts
// test/e2e/popup.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { launchWithExtension } from './extension.launch';
import type { Browser, Page } from 'puppeteer';

let browser: Browser;
let page: Page;

describe('Popup', () => {
  beforeAll(async () => {
    browser = await launchWithExtension();

    // Find the extension ID by inspecting the targets
    const targets = await browser.targets();
    const background = targets.find(t => t.type() === 'background_page' || t.type() === 'service_worker');
    const url = background?.url() ?? '';
    const [, , , extensionId] = url.split('/');
    const popupUrl = `chrome-extension://${extensionId}/popup/index.html`; // adjust if your popup path differs

    page = await browser.newPage();
    await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });
  });

  afterAll(async () => {
    await browser.close();
  });

  it('renders the popup UI', async () => {
    const title = await page.$eval('#app', el => el.textContent || '');
    expect(title).toContain('Your Popup Title'); // replace with your real UI text
  });
});
```

> Adjust `dist/chrome-mv3` and popup path if your WXT output differs.

---

## Conventions for Testability

* **Adapters**: Wrap direct `chrome.*` calls in `src/adapters/*` so unit tests can mock them.
* **Message contracts**: Centralize message types in `src/messages.ts`.
* **Storage**: Encapsulate in `src/storage/*` with pure helpers; unit-test first.
* **Content script logic**: pure functions that accept input state and return mutations/commands; integration with DOM kept thin.
* **Background**: idempotent handlers; message routing unit-tested with mocks.

---

## Pull Requests

* PR must include tests for new/changed behavior.
* CI must pass (`build`, `lint`, `typecheck`, `test`).
* Update README if user-visible behavior changes.

---

## Troubleshooting E2E

* If popup URL changes, update E2E locator.
* If service worker target not found, ensure **build completed** and extension path is correct.
* Run Chrome **headful** (not headless) for debugging.
* Use `page.screenshot()` in failures to aid diagnosis.

---

## Quick Start for a New Feature (Checklist)

* [ ] Write failing **E2E** describing the user flow.
* [ ] Write failing **unit tests** for new logic.
* [ ] Implement minimal code to pass unit tests.
* [ ] Wire into UI/background/content; pass E2E.
* [ ] Refactor; keep tests green.
* [ ] Commit.

---

**Remember:** No feature merges without a failing test first.
