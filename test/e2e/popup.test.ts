import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Browser, Page } from 'puppeteer';
import { launchWithExtension } from './extension.launch.ts';

let browser: Browser;
let page: Page;

async function openPopup() {
  browser = await launchWithExtension();
  const background = await browser.waitForTarget(t =>
    t.type() === 'service_worker' || t.type() === 'background_page'
  );
  const url = background.url();
  const extensionId = url.split('/')[2];
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  page = await browser.newPage();
  await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });
}

test('popup renders expected controls', async (t) => {
  await openPopup();
  t.after(async () => {
    await browser.close();
  });
  await page.waitForSelector('#app');
  const title = await page.title();
  assert.equal(title, 'Default Popup Title');
});
