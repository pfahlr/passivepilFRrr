import { stateItem, visitedItem } from '~/utils/storage';
import { normalizeUrl } from '~/utils/normalizeUrl';
import { messaging } from '~/messaging';

document.addEventListener('DOMContentLoaded', () => {
  const runBtn = document.getElementById('run') as HTMLButtonElement | null;
  const logEl = document.getElementById('log') as HTMLTextAreaElement | null;
  if (!runBtn) return;

  runBtn.addEventListener('click', async () => {
    const state = await stateItem.getValue();
    const rows = (state.rows || []).filter((r: any) => r.enabled && r.value);
    if (!rows.length) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) return;

    const url = normalizeUrl(tab.url);
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'runCollectors', rows });
    const lines: string[] = resp?.result ?? [];
    if (logEl) {
      for (const line of lines) {
        logEl.value += (logEl.value ? '\n' : '') + line;
      }
    }

    if (state.enableNative && state.filePath) {
      await messaging.sendMessage('nativeAppend', { path: state.filePath, lines });
    }

    const visited = new Set((await visitedItem.getValue()).urls);
    visited.add(url);
    await visitedItem.setValue({ urls: Array.from(visited) });
    messaging.sendMessage('updateBadge');
  });
});
