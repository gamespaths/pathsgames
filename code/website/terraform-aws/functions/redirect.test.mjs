// v0.42.0 — node --test for redirect.js, rendered as Terraform templatefile renders it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('./redirect.js', import.meta.url), 'utf8')
  .replaceAll('${target_host}', 'paths.games')
  .replaceAll('${old_domain}', 'pathsgames.com')
const context = {}
vm.runInNewContext(source, context)
const handler = context.handler

const event = (host, uri = '/', querystring = {}) => ({ request: { uri, querystring, headers: host ? { host: { value: host } } : {} } })

test('apex of the old domain: 301 to https://paths.games', () => {
  const res = handler(event('pathsgames.com'))
  assert.equal(res.statusCode, 301)
  assert.equal(res.headers.location.value, 'https://paths.games/')
})

test('www of the old domain (any case): 301 to https://paths.games', () => {
  const res = handler(event('WWW.PathsGames.com'))
  assert.equal(res.statusCode, 301)
  assert.equal(res.headers.location.value, 'https://paths.games/')
})

test('path and query string are kept, multi-values and empty values included', () => {
  const res = handler(event('www.pathsgames.com', '/game/42', {
    policy: { value: 'privacy' },
    tag: { value: 'a', multiValue: [{ value: 'a' }, { value: 'b%20c' }] },
    flag: { value: '' },
  }))
  assert.equal(res.headers.location.value, 'https://paths.games/game/42?policy=privacy&tag=a&tag=b%20c&flag')
})

test('missing querystring object: no question mark', () => {
  const ev = event('pathsgames.com', '/x')
  delete ev.request.querystring
  assert.equal(handler(ev).headers.location.value, 'https://paths.games/x')
})

test('paths.games is untouched', () => {
  const ev = event('paths.games', '/a', { q: { value: '1' } })
  assert.equal(handler(ev), ev.request)
})

test('other hosts and a missing host header are untouched', () => {
  for (const host of ['www.paths.games', 'test.paths.games', 'evilpathsgames.com', 'pathsgames.com.evil.io', null]) {
    const ev = event(host)
    assert.equal(handler(ev), ev.request)
  }
})
