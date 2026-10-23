import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCloudflareProject } from './check-cloudflare-project.mjs';

const options = { account: 'e'.repeat(32), token: 'fixture-token' };
const project = { success: true, result: { name: 'learn-aziral', production_branch: 'main' } };

test('checks Pages access in the expected account without requesting wider permissions', async () => {
  await checkCloudflareProject({ ...options, request: async (url, init) => {
    assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${options.account}/pages/projects/learn-aziral`);
    assert.equal(init.headers.Authorization, 'Bearer fixture-token');
    assert.ok(init.signal instanceof AbortSignal);
    return Response.json(project);
  } });
});

test('missing credentials fail before a network request', async () => {
  for (const change of [{ token: '' }, { account: '' }, { account: '../other' }]) {
    await assert.rejects(checkCloudflareProject({ ...options, ...change, request: () => assert.fail('Unexpected network request') }), /Configure CLOUDFLARE/);
  }
});

test('invalid or expired credentials fail without logging the token or response body', async () => {
  for (const status of [401, 403, 429, 503]) {
    await assert.rejects(checkCloudflareProject({ ...options, request: async () => new Response('private diagnostic', { status }) }), error => {
      assert.match(error.message, new RegExp(`HTTP ${status}`));
      assert.ok(!error.message.includes(options.token));
      assert.ok(!error.message.includes('private diagnostic'));
      return true;
    });
  }
});

test('another project, a changed production branch or an unsuccessful response blocks publication', async () => {
  for (const data of [{ success: false }, { ...project, result: { ...project.result, name: 'aziral-web' } }, { ...project, result: { ...project.result, production_branch: 'staging' } }]) {
    await assert.rejects(checkCloudflareProject({ ...options, request: async () => Response.json(data) }), /existing Pages project/);
  }
});
