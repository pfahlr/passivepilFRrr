import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const file = fs.readFileSync(path.join(process.cwd(), 'src/lib/MatchForm.svelte'), 'utf8')

test('popup displays configuration form', () => {
  assert.match(file, /<h1>Selector Logger<\/h1>/)
  assert.match(file, />Run<\/button>/)
  assert.match(file, /Auto-run on page load/)
})
