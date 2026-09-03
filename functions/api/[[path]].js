// Forwards /api/* to the API service on Render — see AZIRAL-group for the
// service itself. Keeps the shared .aziral.com auth cookie first-party.
const API_ORIGIN = 'https://aziral-api.onrender.com';

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, API_ORIGIN);

  const proxied = new Request(target, request);
  proxied.headers.set('X-Forwarded-Host', url.host);
  proxied.headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

  return fetch(proxied);
}
