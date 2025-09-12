import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { storage } from '../../../test/stubs/imports.ts'
import { visitedItem, stateItem } from '../../lib/utils/storage.ts'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

let onUpdated: any
let sendCount: number

function setupChrome() {
  sendCount = 0
  globalThis.chrome = {
    tabs: {
      onUpdated: { addListener: (cb: any) => { onUpdated = cb } },
      sendMessage: async () => { sendCount++ },
    },
    action: {
      setBadgeText: () => {},
      setBadgeBackgroundColor: () => {},
    },
    runtime: {
      id: 'x',
      connectNative: () => ({
        onDisconnect: { addListener: () => {} },
        onMessage: { addListener: () => {} },
        postMessage: () => {},
      }),
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} },
      lastError: undefined,
    },
    storage: { onChanged: { addListener: () => {} } },
  } as any
  ;(globalThis as any).browser = { runtime: { id: 'x' } }
  ;(globalThis as any).defineBackground = (fn: any) => fn()
}

beforeEach(() => {
  storage._store.clear()
  setupChrome()
})

  test('autoRun runs collectors when enabled', async () => {
  const messagingMod = await import('../../lib/messaging.ts')
  messagingMod.messaging.sendMessage = async () => ({ ok: true })
  messagingMod.messaging.onMessage = () => () => {}

  // state: autoRun enabled
    await stateItem.setValue({
      rows: [{ enabled: true, value: '.a' }],
      autoRun: true,
      skipVisited: true,
      enableNative: false,
      filePath: '',
    })
  await visitedItem.setValue({ urls: [] })

  const src = fs
    .readFileSync(path.join(process.cwd(), 'src/entrypoints/background/index.ts'), 'utf8')
    .replace(/from '~\/([^']+)'/g, (_m, p) => `from '${pathToFileURL(path.join(process.cwd(), 'src', p + '.ts')).href}'`)
  const temp = path.join(tmpdir(), 'background.test.tmp.ts')
  fs.writeFileSync(temp, src)
  await import(pathToFileURL(temp).href)
  fs.unlinkSync(temp)
  await onUpdated(1, { status: 'complete' }, { id: 1, url: 'https://a.com' })
  assert.equal(sendCount, 1)

    // disable autoRun
    await stateItem.setValue({
      rows: [],
      autoRun: false,
      skipVisited: true,
      enableNative: false,
      filePath: '',
    })
  await onUpdated(2, { status: 'complete' }, { id: 2, url: 'https://b.com' })
  assert.equal(sendCount, 1)

})
