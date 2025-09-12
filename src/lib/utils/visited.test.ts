import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { visitedItem } from './storage.ts'

beforeEach(async () => {
  await visitedItem.setValue({ urls: [] })
})

test('visited storage records unique urls', async () => {
  const url = 'https://example.com'
  await visitedItem.setValue({ urls: [url] })
  const v1 = await visitedItem.getValue()
  assert.deepEqual(v1.urls, [url])
})
