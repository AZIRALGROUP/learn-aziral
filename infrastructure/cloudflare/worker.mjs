export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    if (incoming.hostname !== 'learn-bot.aziral.com') return new Response('Not found', { status: 404 });
    if (incoming.protocol !== 'https:') { incoming.protocol = 'https:'; return Response.redirect(incoming.href, 308); }
    if (!env.ORIGIN_TOKEN) return new Response('Temporarily unavailable', { status: 503 });
    const target = new URL(request.url);
    target.hostname = 'learn-bot-origin.89-58-7-87.sslip.io';
    const headers = new Headers(request.headers);
    for (const name of ['x-forwarded-for', 'x-learn-origin-token', 'x-learn-bridge-secret', 'x-learn-telegram-id', 'authorization', 'cookie']) headers.delete(name);
    headers.set('x-learn-origin-token', env.ORIGIN_TOKEN);
    try {
      const upstream = await fetch(new Request(target, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body, duplex: 'half', redirect: 'manual' }), { cache: 'no-store' });
      const response = new Response(upstream.body, upstream);
      if (incoming.pathname.startsWith('/api/') || incoming.pathname.startsWith('/telegram')) {
        for (const name of ['Cache-Control', 'CDN-Cache-Control', 'Cloudflare-CDN-Cache-Control']) response.headers.set(name, 'private, no-store');
      }
      return response;
    } catch { return new Response('Temporarily unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } }); }
  },
};
