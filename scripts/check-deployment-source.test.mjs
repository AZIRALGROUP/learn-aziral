import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDeploymentSource } from './check-deployment-source.mjs';

const commit = 'a'.repeat(40);
const options = { commit, repository: 'AZIRALGROUP/learn-aziral', token: 'fixture-token' };

test('only the current main commit can build or publish, with a fresh authenticated lookup', async () => {
  const result = await checkDeploymentSource({ ...options, request: async (url, init) => {
    assert.equal(url, 'https://api.github.com/repos/AZIRALGROUP/learn-aziral/git/ref/heads/main');
    assert.equal(init.headers.Authorization, 'Bearer fixture-token');
    assert.equal(init.headers['Cache-Control'], 'no-cache');
    assert.equal(init.cache, 'no-store');
    assert.ok(init.signal instanceof AbortSignal);
    return Response.json({ object: { sha: commit } });
  } });
  assert.deepEqual(result, { current: true, head: commit });
});

test('a delayed event or a new push during the build prevents the older publication', async () => {
  let head = commit;
  const request = async () => Response.json({ object: { sha: head } });
  assert.equal((await checkDeploymentSource({ ...options, request })).current, true);
  head = 'b'.repeat(40);
  assert.deepEqual(await checkDeploymentSource({ ...options, request }), { current: false, head });
});

for (const status of [401, 403, 429, 503]) {
  test(`HTTP ${status} fails closed instead of granting publication`, async () => {
    await assert.rejects(checkDeploymentSource({ ...options, request: async () => new Response('', { status }) }), /No publication is allowed/);
  });
}

test('network errors and malformed responses fail closed', async () => {
  await assert.rejects(checkDeploymentSource({ ...options, request: async () => { throw new Error('network down'); } }), /network down/);
  for (const body of [{}, { object: { sha: 'invalid' } }]) {
    await assert.rejects(checkDeploymentSource({ ...options, request: async () => Response.json(body) }), /No publication is allowed/);
  }
});

test('invalid inputs cannot make a network request', async () => {
  const request = async () => { assert.fail('Invalid input reached the network'); };
  await assert.rejects(checkDeploymentSource({ ...options, commit: '', request }), /commit SHA/);
  await assert.rejects(checkDeploymentSource({ ...options, repository: '../other/path', request }), /owner\/repository/);
  await assert.rejects(checkDeploymentSource({ ...options, token: '', request }), /GitHub token/);
});
