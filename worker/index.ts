import { cartographerTurnSchema } from '../src/cartographer/schema';

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return Response.json({ ok: true, service: 'atlas-of-one', cartographer: 'mock-client' });
    if (url.pathname === '/api/turn' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      const parsed = cartographerTurnSchema.safeParse(body);
      if (!parsed.success) return Response.json({ ok: false, code: 'MOCK_ONLY', message: 'Phase 1 uses the local MockCartographer; no paid AI provider is connected.' }, { status: 501 });
      return Response.json({ ok: true, validated: true, turn: parsed.data });
    }
    if (url.pathname.startsWith('/api/')) return Response.json({ ok: false, code: 'NOT_IMPLEMENTED' }, { status: 404 });
    return new Response(null, { status: 404 });
  }
};
