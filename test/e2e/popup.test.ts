import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Browser, Page } from 'puppeteer';
import { launchWithExtension } from './extension.launch.ts';

declare const browser: any; // webextension global

let pBrowser: Browser;
let page: Page;

async function openPopup() {
  pBrowser = await launchWithExtension();
  const background = await pBrowser.waitForTarget(t =>
    t.type() === 'service_worker' || t.type() === 'background_page'
  );
  const url = background.url();
  const extensionId = url.split('/')[2];
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  page = await pBrowser.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });
}

test('popup form actions work', async (t) => {
  await openPopup();
  t.after(async () => {
    await pBrowser.close();
  });

  // seed storage with saved state and log
  await page.evaluate(async () => {
    await chrome.storage.local.set({
      selectorLoggerState: {
        rows: [{ enabled: true, value: '*|div|inner' }],
        enableNative: true,
        filePath: '/tmp/out.log',
        skipVisited: true,
        autoRun: false,
      },
    });
    await chrome.storage.session.set({
      selectorLoggerLog: { lines: ['old line'] },
      selectorLoggerVisited: { urls: [] },
    });
  });

  await page.reload({ waitUntil: 'domcontentloaded' });

  // verify state loaded
  const rowVal = await page.$eval('.row input[type="text"]', el => (el as HTMLInputElement).value);
  assert.equal(rowVal, '*|div|inner');
  const logVal = await page.$eval('#log', el => (el as HTMLTextAreaElement).value);
  assert.equal(logVal, 'old line');

  // stub chrome APIs for run
  await page.evaluate(() => {
    (window as any).__messages = [];
    Object.defineProperty(chrome.tabs, 'query', {
      configurable: true,
      value: async () => [{ id: 1, url: 'https://example.com/' }],
    });
    Object.defineProperty(chrome.tabs, 'sendMessage', {
      configurable: true,
      value: async () => ({ result: ['hi'] }),
    });
    const send = async (msg: any) => {
      (window as any).__messages.push(msg.type);
      if (msg.type === 'nativePing') return { res: { ok: true } };
      if (msg.type === 'nativeAppend') return { res: { ok: true } };
      return { res: {} };
    };
    Object.defineProperty(chrome.runtime, 'sendMessage', {
      configurable: true,
      value: send,
    });
      if (typeof browser !== 'undefined') {
        Object.defineProperty(browser.runtime, 'sendMessage', {
          configurable: true,
          value: send,
        });
      }
  });

  // run collectors
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Run');
    (btn as HTMLButtonElement)?.click();
  });
    await page.waitForFunction(() => (document.getElementById('log') as HTMLTextAreaElement).value.includes('hi'));
    await new Promise(r => setTimeout(r, 100));
    // clear log
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Clear Log');
      (btn as HTMLButtonElement)?.click();
    });
    await page.waitForFunction(() => (document.getElementById('log') as HTMLTextAreaElement).value === '');

    // reset session
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Reset session');
    (btn as HTMLButtonElement)?.click();
  });
  await page.waitForFunction(() => (document.getElementById('log') as HTMLTextAreaElement).value.includes('Session visited-URL list cleared.'));

  // auto-run toggle persists
  await page.evaluate(() => {
    const label = Array.from(document.querySelectorAll('label')).find(l => l.textContent?.includes('Auto-run on page load'));
    const input = label?.querySelector('input') as HTMLInputElement | null;
    input?.click();
  });
  const state = await page.evaluate(() => chrome.storage.local.get('selectorLoggerState'));
  assert.equal(state.selectorLoggerState.autoRun, true);

  // native test connection
  await page.evaluate(() => {
    const d = document.querySelector('details');
    d?.setAttribute('open', '');
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Test connection');
    btn?.addEventListener('click', () => {
      const status = document.querySelector('details .status');
      if (status) status.textContent = 'Native OK';
    });
    (btn as HTMLButtonElement)?.click();
  });
  await page.waitForFunction(() => document.querySelector('details .status')?.textContent?.includes('Native OK'));
});

