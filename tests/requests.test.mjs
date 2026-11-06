import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { fetchWithDeadline, readAllPages } from '../src/lib/requests.ts'
import { errorMessage, mutationErrorMessage } from '../src/lib/errors.ts'

test('loads every permitted row beyond the default API limit, including a lower server cap', async () => {
  const records = Array.from({ length: 1103 }, (_, id) => ({ id }))
  const result = await readAllPages(async (from, to) => ({
    data: records.slice(from, Math.min(to + 1, from + 100)), count: records.length, error: null,
  }))
  assert.deepEqual(result, records)
})
test('a failed later page rejects the list rather than showing partial counts', async () => {
  const failure = new Error('network unavailable')
  await assert.rejects(readAllPages(async from => from ? { data: null, count: null, error: failure }
    : { data: [1, 2], count: 10, error: null }), failure)
})
test('empty data and failed data remain different states', async () => {
  assert.deepEqual(await readAllPages(async () => ({ data: [], count: 0, error: null })), [])
  await assert.rejects(readAllPages(async () => ({ data: null, count: null, error: new Error('offline') })), /offline/)
})
test('errors never expose raw server messages, SQL details or malformed fields', () => {
  for (const value of [null, 'private detail', { message: 42, code: false }, { message: 'secret SQL stack trace' }]) {
    assert.equal(errorMessage(value), 'Не удалось выполнить действие. Проверьте соединение и попробуйте ещё раз.')
  }
  assert.match(errorMessage({ message: 'STALE_TASK', code: 'PT409' }), /уже изменилась/)
  assert.match(errorMessage({ code: '42501' }), /недоступно/)
  assert.match(errorMessage({ status: 429 }), /много запросов/)
})
test('an uncertain mutation directs the user to check persisted state before retrying', () => {
  assert.match(mutationErrorMessage(new TypeError('fetch failed')), /Перед повторной попыткой обновите/)
  assert.match(mutationErrorMessage({ message: 'COMMENT_REQUIRED' }), /укажите причину/)
})
test('JSON transport preserves successful and error status, headers, and empty responses', async () => {
  for (const status of [200, 409, 204]) {
    const response = await fetchWithDeadline('https://example.test', {}, 1000,
      async () => new Response(status === 204 ? null : '{"ok":true}', { status, headers: { 'x-result': 'preserved' } }))
    assert.equal(response.status, status)
    assert.equal(response.headers.get('x-result'), 'preserved')
    assert.equal(await response.text(), status === 204 ? '' : '{"ok":true}')
  }
})
test('transport respects an existing cancellation signal', async () => {
  const controller = new AbortController()
  controller.abort(new DOMException('cancelled', 'AbortError'))
  await assert.rejects(fetchWithDeadline('https://example.test', { signal: controller.signal }, 1000, async (_url, init) => {
    init.signal.throwIfAborted()
    return new Response('unexpected')
  }), { name: 'AbortError' })
})
test('deadline covers a stalled response body, not only its headers', async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.write('{')
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    await assert.rejects(fetchWithDeadline(`http://127.0.0.1:${server.address().port}`, {}, 150))
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})

test('Supabase does not repeat a timed-out read behind the manual retry UI', async () => {
  let attempts = 0
  const client = createClient('https://example.test', 'test-public-key', {
    db: { retry: false },
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetchWithDeadline(input, init, 10, async (_url, options) => {
      attempts++
      return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }))
    }) },
  })
  const { error } = await client.from('objects').select('*')
  assert.ok(error)
  assert.equal(attempts, 1)
})
