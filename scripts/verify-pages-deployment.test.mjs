import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyPagesDeployment } from './verify-pages-deployment.mjs';

const commit = 'a'.repeat(40);
const entry = '/assets/index-current.js';
const index = `<script type="module" src="${entry}"></script>`;
const entryBytes = Buffer.from('console.log("current");');
const sitemap = '<urlset>current</urlset>', robots = 'User-agent: *';
function fixture(change = () => {}) {
  let round = 0;
  const pauses = [], calls = [], reports = [];
  const request = async (url, options) => {
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    const path = url.pathname;
    if (path === '/deployment.json') round++;
    calls.push({ path, round });
    const privatePage = ['/instructor', '/profile', '/courses/1/learn'].includes(path);
    const headers = path === entry ? { 'content-type': 'application/javascript' } : privatePage ? { 'x-robots-tag': 'noindex, nofollow' } : {};
    const status = path === '/api/auth/me' ? 401 : 200;
    const body = path === '/deployment.json' ? JSON.stringify({ commit }) : path === entry ? entryBytes :
      path === '/sitemap.xml' ? sitemap : path === '/robots.txt' ? robots : path === '/api/courses' ? '[]' : index;
    const patch = change({ path, round, body, status, headers });
    return new Response(patch?.body ?? body, { status: patch?.status ?? status, headers: patch?.headers ?? headers });
  };
  const verify = (attempts = 3) => verifyPagesDeployment({ commit, base: 'http://fixture.test', index, entryBytes, sitemap, robots,
    attempts, request, pause: async ms => pauses.push(ms), report: message => reports.push(message) });
  return { verify, pauses, calls, reports };
}

test('the full tested artifact and both API contracts pass once', async () => {
  const f = fixture(); await f.verify();
  assert.equal(f.calls.length, 11);
  assert.equal(f.pauses.length, 0);
  assert.match(f.reports.at(-1), /Verified/);
});

test('a current stamp cannot hide old HTML or a partially propagated sitemap', async () => {
  const f = fixture(({ path, round, body }) => {
    if (path === '/' && round === 1) return { body: body.replace('index-current', 'index-old') };
    if (path === '/sitemap.xml' && round < 3) return { body: 'old sitemap' };
  });
  await f.verify(); assert.deepEqual(f.pauses, [5000, 5000]);
});

test('temporary API and network failures recover within the bounded verifier', async () => {
  const f = fixture(({ path, round }) => {
    if (path === '/study' && round === 1) throw new Error('network unavailable');
    if (path === '/api/courses' && round === 2) return { status: 502 };
  });
  await f.verify(); assert.deepEqual(f.pauses, [5000, 5000]);
});

test('the wrong source commit never succeeds', async () => {
  const f = fixture(({ path }) => path === '/deployment.json' ? { body: JSON.stringify({ commit: 'b'.repeat(40) }) } : undefined);
  await assert.rejects(f.verify(), /source stamp/); assert.equal(f.calls.length, 3);
});

const managedRobots = '# Provider notice\n# BEGIN Cloudflare Managed content\nUser-agent: GPTBot\nDisallow: /\n# END Cloudflare Managed Content\n\n';
test('Cloudflare managed robots policies may precede the unmodified site file', async () => {
  const f = fixture(({ path }) => path === '/robots.txt' ? { body: managedRobots + robots + '\n' } : undefined);
  await f.verify(); assert.equal(f.pauses.length, 0);
});

test('a managed prefix cannot hide changed site directives or a missing start marker', async () => {
  for (const body of [managedRobots + 'wrong site robots', '# END Cloudflare Managed Content\n' + robots]) {
    const f = fixture(({ path }) => path === '/robots.txt' ? { body } : undefined);
    await assert.rejects(f.verify(1), /robots.txt/);
  }
});

for (const [name, change, error] of [
  ['old entry', ({ path, body }) => path === '/' ? { body: body.replace('index-current', 'index-old') } : undefined, /tested HTML/],
  ['changed JavaScript bytes', ({ path }) => path === entry ? { body: 'old JavaScript' } : undefined, /JavaScript differs/],
  ['SPA response for JavaScript', ({ path }) => path === entry ? { headers: { 'content-type': 'text/html' } } : undefined, /JavaScript differs/],
  ['missing sitemap', ({ path }) => path === '/sitemap.xml' ? { status: 404 } : undefined, /sitemap.xml/],
  ['stale robots', ({ path }) => path === '/robots.txt' ? { body: 'old robots' } : undefined, /robots.txt/],
  ['indexable private page', ({ path }) => path === '/instructor' ? { headers: {} } : undefined, /indexing policy/],
  ['blocked public root', ({ path }) => path === '/' ? { headers: { 'x-robots-tag': 'noindex' } } : undefined, /indexing policy/],
  ['broken API proxy', ({ path }) => path === '/api/auth/me' ? { status: 200 } : undefined, /auth must return 401/],
  ['invalid courses payload', ({ path }) => path === '/api/courses' ? { body: '{}' } : undefined, /courses API/],
]) {
  test(`permanent ${name} fails without weakening the check`, async () => {
    const f = fixture(change); await assert.rejects(f.verify(2), error);
    assert.deepEqual(f.pauses, [5000]); assert.equal(f.reports.some(message => message.startsWith('Verified')), false);
  });
}

test('the CLI reads the actual artifact and checks an HTTP server', async () => {
  const root = mkdtempSync(join(tmpdir(), 'learn-pages-check-'));
  mkdirSync(join(root, 'scripts')); mkdirSync(join(root, 'dist/assets'), { recursive: true });
  const script = join(root, 'scripts/verify-pages-deployment.mjs');
  copyFileSync(new URL('./verify-pages-deployment.mjs', import.meta.url), script);
  for (const [name, content] of [['index.html', index], ['assets/index-current.js', entryBytes], ['sitemap.xml', sitemap], ['robots.txt', robots]]) writeFileSync(join(root, 'dist', name), content);
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://fixture.test').pathname;
    const privatePage = ['/instructor', '/profile', '/courses/1/learn'].includes(path);
    res.writeHead(path === '/api/auth/me' ? 401 : 200, path === entry ? { 'content-type': 'application/javascript' } : privatePage ? { 'x-robots-tag': 'noindex' } : {});
    res.end(path === '/deployment.json' ? JSON.stringify({ commit }) : path === entry ? entryBytes : path === '/sitemap.xml' ? sitemap : path === '/robots.txt' ? robots : path === '/api/courses' ? '[]' : index);
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { stdout } = await promisify(execFile)(process.execPath, [script, commit, `http://127.0.0.1:${server.address().port}`], { timeout: 10000 });
    assert.match(stdout, /Verified/);
  } finally {
    await new Promise(resolve => server.close(resolve)); rmSync(root, { recursive: true, force: true });
  }
});
