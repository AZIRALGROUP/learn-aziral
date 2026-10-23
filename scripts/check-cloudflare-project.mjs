import { existsSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function checkCloudflareProject({ account, token, request = fetch }) {
  if (!/^[a-f\d]{32}$/.test(account || '') || !token) {
    throw new Error('Configure CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in repository Actions secrets.');
  }
  const response = await request(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/learn-aziral`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Cloudflare authorization failed (HTTP ${response.status}). Check the token's Pages Edit permission and account.`);
  const data = await response.json();
  if (!data.success || data.result?.name !== 'learn-aziral' || data.result?.production_branch !== 'main') {
    throw new Error('Expected the existing Pages project learn-aziral with production branch main.');
  }
  console.log('Cloudflare access verified: learn-aziral, production branch main.');
}

if (process.argv[1] && existsSync(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  await checkCloudflareProject({ account: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN });
}
