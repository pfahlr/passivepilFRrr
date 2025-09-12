import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { runCollectors, type CollectorRow } from './collectors.ts'

beforeEach(() => {
  const dom = new JSDOM(`
    <div class="a" data-id="one">first</div>
    <div class="a" data-id="two">second</div>
  `, { url: 'https://example.com/page' })
  globalThis.document = dom.window.document
  globalThis.location = dom.window.location
})

test('collects outerHTML by default', () => {
  const rows: CollectorRow[] = [{ enabled: true, value: '.a' }]
  const { result } = runCollectors(rows)
  assert.deepEqual(result, [
    '<div class="a" data-id="one">first</div>',
    '<div class="a" data-id="two">second</div>'
  ])
})

test('respects domain glob', () => {
  const rows: CollectorRow[] = [
    { enabled: true, value: 'example.com*|.a|inner:strip' },
    { enabled: true, value: 'other.com*|.a|inner:strip' }
  ]
  const { result } = runCollectors(rows)
  assert.deepEqual(result, ['first', 'second'])
})

test('extracts attribute values', () => {
  const rows: CollectorRow[] = [{ enabled: true, value: '|.a|attr:data-id' }]
  const { result } = runCollectors(rows)
  assert.deepEqual(result, ['one', 'two'])
})
