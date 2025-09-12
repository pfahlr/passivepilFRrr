import { storage } from '#imports';

function makeStorageItem<T>(key: string, defaultValue: T) {
  return storage.defineItem<T>(key, {
    fallback: defaultValue,
  });
}
export const MAX_LOG_LINES = 5000;
export const STATE_KEY = 'selectorLoggerState';
export const VISITED_KEY = 'selectorLoggerVisited';
export const LOG_KEY = 'selectorLoggerLog';

export const stateItem = makeStorageItem(`local:${STATE_KEY}`, {
  autoRun: false,
  rows: [] as Array<{ enabled: boolean; value: string }>,
  enableNative: false,
  filePath: '',
  skipVisited: true,
});

export const visitedItem = makeStorageItem(`session:${VISITED_KEY}`, {
  urls: [] as string[],
});

export const logItem = makeStorageItem(`session:${LOG_KEY}`, {
  lines: [] as string[],
});

export { makeStorageItem };


