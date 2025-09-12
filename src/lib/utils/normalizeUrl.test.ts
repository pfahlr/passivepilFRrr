import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeUrl } from './normalizeUrl.ts'

test('returns origin and path without trailing slash', () => {
  const url = normalizeUrl('https://example.com/one/')
  assert.equal(url, 'https://example.com/one')
})

test('falls back for invalid urls', () => {
  const url = normalizeUrl('not a url/#hash')
  assert.equal(url, 'not a url')
})
