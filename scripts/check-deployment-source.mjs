// Delayed push events must never publish an older main commit over a newer one.
import { appendFileSync, existsSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function checkDeploymentSource({ commit, repository, token, request = fetch }) {
  if (!/^[a-f\d]{40}$/.test(commit || '')) throw new Error('Expected a full Git commit SHA.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('Expected an owner/repository.');
  if (!token) throw new Error('Expected a GitHub token with contents read access.');
  const response = await request(`https://api.github.com/repos/${repository}/git/ref/heads/main`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Cache-Control': 'no-cache' },
    cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Cannot verify the current main commit (HTTP ${response.status}). No publication is allowed.`);
  const head = (await response.json()).object?.sha;
  if (!/^[a-f\d]{40}$/.test(head || '')) throw new Error('GitHub returned no valid main commit. No publication is allowed.');
  return { current: commit === head, head };
}

if (process.argv[1] && existsSync(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const { GITHUB_SHA: commit, GITHUB_REPOSITORY: repository, GH_TOKEN: token, GITHUB_OUTPUT, GITHUB_STEP_SUMMARY } = process.env;
  const { current, head } = await checkDeploymentSource({ commit, repository, token });
  appendFileSync(GITHUB_OUTPUT, `current=${current}\n`);
  if (current) {
    console.log(`Current main commit verified: ${commit}.`);
  } else {
    const message = `Superseded commit ${commit}; main is now ${head}. This run will not publish.`;
    console.log(message);
    if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, `${message}\n`);
  }
}
