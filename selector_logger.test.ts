import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'

function sendAndWait(proc: any, obj: any) {
  return new Promise(resolve => {
    proc.stdout.once('readable', () => {
      const len = proc.stdout.read(4).readUInt32LE(0)
      const resp = proc.stdout.read(len)
      resolve(JSON.parse(resp.toString()))
    })
    const body = Buffer.from(JSON.stringify(obj))
    const header = Buffer.alloc(4)
    header.writeUInt32LE(body.length, 0)
    proc.stdin.write(Buffer.concat([header, body]))
  })
}

test('selector_logger appends lines to file', async () => {
  const proc = spawn('python3', ['selector_logger.py'])
  const logPath = path.join(tmpdir(), 'selector_logger_test.log')
  await fs.rm(logPath, { force: true })
  await sendAndWait(proc, { op: 'append', path: logPath, lines: ['a', 'b'] })
  proc.kill()
  const content = await fs.readFile(logPath, 'utf8')
  assert.equal(content.trim(), 'a\nb')
})
