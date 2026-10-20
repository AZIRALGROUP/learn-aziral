// Forwards /api/* to the API on the Netcup VPS (moved off Render 2026-10-02,
// see AZIRAL-group). Keeps the shared .aziral.com auth cookie first-party.
const API_ORIGIN = 'https://aziral-api.89-58-7-87.sslip.io';

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, API_ORIGIN);

  const proxied = new Request(target, request);
  proxied.headers.set('X-Forwarded-Host', url.host);
  proxied.headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

  return fetch(proxied);
}
