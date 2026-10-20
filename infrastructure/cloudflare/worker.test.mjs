import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

test('gateway rejects other hosts, enforces HTTPS and fails closed without the origin secret', async () => {
  assert.equal((await worker.fetch(new Request('https://other.example/'), {})).status, 404);
  const redirect = await worker.fetch(new Request('http://learn-bot.aziral.com/telegram?start=tests'), {});
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), 'https://learn-bot.aziral.com/telegram?start=tests');
  assert.equal((await worker.fetch(new Request('https://learn-bot.aziral.com/'), {})).status, 503);
});

test('gateway preserves Telegram credentials and bodies, strips forged internal headers and disables API caching', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (req, options) => {
      assert.equal(req.url, 'https://learn-bot-origin.89-58-7-87.sslip.io/api/telegram/duels?check=1');
      assert.equal(req.headers.get('x-learn-origin-token'), 'trusted-origin-test');
      assert.equal(req.headers.get('x-learn-bridge-secret'), null);
      assert.equal(req.headers.get('x-learn-telegram-id'), null);
      assert.equal(req.headers.get('cookie'), null);
      assert.equal(req.headers.get('authorization'), null);
      assert.equal(req.headers.get('x-telegram-init-data'), 'signed-data');
      assert.equal(await req.text(), '{"testId":"site-1"}');
      assert.equal(options.cache, 'no-store');
      return Response.json({ ok: true });
    };
    const response = await worker.fetch(new Request('https://learn-bot.aziral.com/api/telegram/duels?check=1', {
      method: 'POST', headers: { 'x-learn-origin-token': 'forged', 'x-learn-bridge-secret': 'forged', 'x-learn-telegram-id': '1', 'cookie': 'private-cookie', 'authorization': 'private-auth', 'x-telegram-init-data': 'signed-data' }, body: '{"testId":"site-1"}',
    }), { ORIGIN_TOKEN: 'trusted-origin-test' });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('Cache-Control'), /no-store/);
    assert.match(response.headers.get('Cloudflare-CDN-Cache-Control'), /no-store/);
  } finally { globalThis.fetch = original; }
});
