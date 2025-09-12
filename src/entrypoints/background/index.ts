import { messaging } from '~/lib/messaging';
import { stateItem, visitedItem, logItem, VISITED_KEY, MAX_LOG_LINES } from '~/lib/utils/storage';
import { normalizeUrl } from '~/lib/utils/normalizeUrl';
import * as fs from 'fs';

export default defineBackground(() => {
  const HOST_NAME = 'com.pfahlr.selectorlogger';
  let nativePort: chrome.runtime.Port | null = null;

  async function updateBadge() {
    const { urls } = await visitedItem.getValue();
    const count = new Set(urls).size;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  }

  function tryConnectNative(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (nativePort) return resolve();
      try {
        nativePort = chrome.runtime.connectNative(HOST_NAME);
      } catch (e) {
        return reject(new Error(`Native host "${HOST_NAME}" not found or not permitted`));
      }
      let resolved = false;
      nativePort.onDisconnect.addListener(() => {
        nativePort = null;
        if (!resolved) {
          const err = chrome.runtime.lastError?.message || 'Native host disconnected';
          reject(new Error(err));
        }
      });
      setTimeout(() => {
        resolved = true;
        resolve();
      }, 0);
    });
  }

  function nativeSend(obj: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!nativePort) return reject(new Error('No native port'));
      let responded = false;
      function onMessage(resp: any) {
        responded = true;
        nativePort!.onMessage.removeListener(onMessage);
        if (resp && resp.ok === false && resp.error) return reject(new Error(resp.error));
        resolve(resp || { ok: true });
      }
      nativePort.onMessage.addListener(onMessage);
      try {
        nativePort.postMessage(obj);
        setTimeout(() => {
          if (!responded) {
            nativePort!.onMessage.removeListener(onMessage);
            resolve({ ok: true });
          }
        }, 250);
      } catch (e) {
        nativePort.onMessage.removeListener(onMessage);
        reject(e);
      }
    });
  }

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {

    //console.log('tab update');
    if (changeInfo.status !== 'complete' || !tab.url) return;
    //console.log('tab update complete');
    const state = await stateItem.getValue();

    if (!state.autoRun) return;

    let log = '';
    const { lines } = await logItem.getValue();
    //set log to cumulative log value
    log = lines.join('\n');
    function appendLog(line: string) {
      if (!line) return;
      //add a line break to the end of log if log is not empty, then add new line
      log += (log ? '\n' : '') + line;
      //split log into lines to count them
      let lines = log.split('\n');
      //set log back to a line break delimited string
      if (lines.length > MAX_LOG_LINES) {
        lines = lines.slice(-MAX_LOG_LINES);
        log = lines.join('\n');
      }
      //set storage 'logItem' to array of lines.
      logItem.setValue({ lines });
    }
    async function clearLog() {
      log = '';
      await logItem.setValue({ lines: [] });
    }
    const visited = new Set((await visitedItem.getValue()).urls);
    const url = normalizeUrl(tab.url);
    if (state.skipVisited !== false && visited.has(url)) return;

    try {
      const resp = await chrome.tabs.sendMessage(tabId, { type: 'runCollectors', rows: state.rows });
      const newlines: string[] = resp?.result ?? [];

      for (const line of newlines) appendLog(line);

      await messaging.sendMessage('updateForm', { updatedLog: log, lines });

      console.log(log);

      if (state.enableNative && state.filePath && lines.length) {
        await messaging.sendMessage('nativeAppend', { path: state.filePath, lines });
      }
      if (state.skipVisited !== false && url) {
        visited.add(url);
        await visitedItem.setValue({ urls: Array.from(visited) });
        updateBadge();
      }
    } catch {
      // ignore injection errors
    }
  });

  chrome.runtime.onInstalled.addListener(() => {
    chrome.action.setBadgeBackgroundColor({ color: '#666' });
    updateBadge();
  });

  chrome.runtime.onStartup.addListener(updateBadge);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes[VISITED_KEY]) updateBadge();
  });

  messaging.onMessage('updateBadge', async () => {
    await updateBadge();
  });

  messaging.onMessage('nativePing', async () => {
    try {
      await tryConnectNative();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  messaging.onMessage('nativeAppend', async (message) => {
    const { path, lines } = message.data;
    if (!path || !Array.isArray(lines)) {
      return { ok: false, error: 'Invalid payload (path/lines)' };
    }
    try {
      await tryConnectNative();
      await nativeSend({ op: 'append', path, lines });
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });
});
