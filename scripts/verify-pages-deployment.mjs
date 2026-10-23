import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export async function verifyPagesDeployment({ commit, index, entryBytes, sitemap, robots,
  base = 'https://learn.aziral.com', attempts = 12, request = fetch, pause = delay, report = console.log }) {
  if (!/^[a-f\d]{40}$/.test(commit || '')) throw new Error('Expected a full Git commit SHA.');
  const origin = new URL(base);
  if (!['https:', 'http:'].includes(origin.protocol)) throw new Error('Expected an HTTP(S) site URL.');
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 12) throw new Error('Expected 1–12 verification attempts.');
  const entry = index.match(/\/assets\/index-[^"'\s]+\.js/)?.[0];
  if (!entry) throw new Error('The built site has no JavaScript entry.');
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const entryHash = hash(entryBytes);
  // Cloudflare appends the site's own file after its managed crawler policy.
  // Compare our portion without changing or disabling that account policy.
  const ownRobots = text => {
    const start = text.search(/^# BEGIN Cloudflare Managed content\s*$/im);
    const end = /^# END Cloudflare Managed Content[^\S\r\n]*\r?$/im.exec(text);
    return (start >= 0 && end && end.index > start ? text.slice(end.index + end[0].length) : text).trim();
  };
  const get = path => request(new URL(path, origin), { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  async function snapshot() {
    const stamp = await get(`/deployment.json?commit=${commit}`);
    if (stamp.status !== 200 || (await stamp.json()).commit !== commit) throw new Error('The source stamp does not match the expected commit.');
    const checks = [
      ...[['/', false], ['/study', false], ['/instructor', true], ['/profile', true], ['/courses/1/learn', true]].map(async ([path, privatePage]) => {
        const response = await get(path);
        if (response.status !== 200 || !(await response.text()).includes(entry)) throw new Error(`${path}: not serving the tested HTML entry.`);
        const noindex = /noindex/i.test(response.headers.get('x-robots-tag') || '');
        if (noindex !== privatePage) throw new Error(`${path}: incorrect indexing policy.`);
      }),
      (async () => {
        const response = await get(entry);
        if (response.status !== 200 || !/javascript/.test(response.headers.get('content-type') || '') || hash(new Uint8Array(await response.arrayBuffer())) !== entryHash) {
          throw new Error('The delivered JavaScript differs from the tested artifact.');
        }
      })(),
      ...[['/sitemap.xml', sitemap], ['/robots.txt', robots]].map(async ([path, content]) => {
        const response = await get(path);
        const actual = await response.text();
        const matches = path === '/robots.txt' ? ownRobots(actual) === content.trim() : actual === content;
        if (response.status !== 200 || !matches) throw new Error(`${path}: not serving the tested artifact.`);
      }),
      (async () => {
        const response = await get('/api/courses');
        if (response.status !== 200 || !Array.isArray(await response.json())) throw new Error('The public courses API is unavailable.');
      })(),
      (async () => {
        const response = await get('/api/auth/me');
        if (response.status !== 401) throw new Error('Anonymous auth must return 401; the Pages API proxy may be broken.');
      })(),
    ];
    const results = await Promise.allSettled(checks);
    const errors = results.filter(result => result.status === 'rejected').map(result => result.reason.message);
    if (errors.length) throw new Error(errors.join(' '));
  }
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await snapshot();
      report(`Verified ${commit} at ${origin.origin}: HTML, JavaScript, sitemap, robots, private noindex and API.`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        report(`Deployment not fully available (${attempt}/${attempts}): ${error.message} Retrying in 5s.`);
        await pause(5000);
      }
    }
  }
  throw new Error(`Could not verify ${commit} after ${attempts} attempts: ${lastError.message}`, { cause: lastError });
}

if (process.argv[1] && existsSync(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const index = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const entry = index.match(/\/assets\/index-[^"'\s]+\.js/)?.[0];
  if (!entry) throw new Error('The built site has no JavaScript entry.');
  await verifyPagesDeployment({ commit: process.argv[2], base: process.argv[3], index,
    entryBytes: readFileSync(new URL(`../dist${entry}`, import.meta.url)),
    sitemap: readFileSync(new URL('../dist/sitemap.xml', import.meta.url), 'utf8'),
    robots: readFileSync(new URL('../dist/robots.txt', import.meta.url), 'utf8'),
  });
}
