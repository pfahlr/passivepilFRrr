import { runCollectors } from '~/lib/utils/collectors';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'runCollectors') {
        const rows = message.rows || [];
        const result = runCollectors(rows, location.href);
        sendResponse(result);
      }
    });
  },
});
