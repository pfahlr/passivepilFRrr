import puppeteer, { Browser } from 'puppeteer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT_PATH = path.resolve(__dirname, '../../.output/chrome-mv3');
const executablePath = puppeteer.executablePath();

export async function launchWithExtension(): Promise<Browser> {
  return await puppeteer.launch({
    headless: 'new' as any,
    executablePath,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      '--no-sandbox',
    ],
    defaultViewport: null,
  });
}
