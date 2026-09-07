import { describe, expect, it } from 'vitest';
import { compileContext } from '../../src/cartographer/context';
import { createInitialCampaign } from '../../src/game/engine';

describe('live workerd runtime probe', () => {
  const base = 'http://127.0.0.1:8787';

  it('probes /api/health and /api/turn on live worker', async (ctx) => {
    let healthRes: Response;
    try {
      healthRes = await fetch(`${base}/api/health`);
    } catch {
      ctx.skip();
      return;
    }
    expect(healthRes.status).toBe(200);
    const healthJson = await healthRes.json() as any;
    expect(healthJson.ok).toBe(true);
    expect(healthJson.service).toBe('atlas-of-one');

    // 2. /api/turn with valid compiled context
    const state = createInitialCampaign();
    const context = compileContext(
      state,
      { territoryId: 'identity', dimension: 'self-description', question: 'Synthetic question?' },
      'Curious, mostly patient.'
    );
    const turnRes = await fetch(`${base}/api/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context)
    });
    const turnJson = await turnRes.json() as any;
    // In live dev without upstream cloudflare credentials, the binding network call returns 502 typed failure
    expect([200, 502, 503]).toContain(turnRes.status);
    expect(turnJson.ok === false ? ['network', 'binding-missing'].includes(turnJson.code) : true).toBe(true);

    // 3. /api/turn with malformed input (never echoes body back)
    const badRes = await fetch(`${base}/api/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ not: 'a valid context', secretCanary: 'CANARY_98765' })
    });
    expect(badRes.status).toBe(400);
    const badText = await badRes.text();
    expect(badText).not.toContain('CANARY_98765');
    const badJson = JSON.parse(badText) as Record<string, any>;
    expect(badJson.ok).toBe(false);
    expect(badJson.code).toBe('bad-request');

    // 4. GET /api/turn method not allowed
    const getTurnRes = await fetch(`${base}/api/turn`);
    expect(getTurnRes.status).toBe(405);

    // 5. /api/nope 404
    const notFoundRes = await fetch(`${base}/api/nope`);
    expect(notFoundRes.status).toBe(404);

    // 6. SPA shell at /
    const spaRes = await fetch(`${base}/`);
    expect(spaRes.status).toBe(200);
    const spaText = await spaRes.text();
    expect(spaText).toContain('<div id="root"></div>');
  });
});
