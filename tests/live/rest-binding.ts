import type { WorkersAiBinding } from '../../src/cartographer/workersai';

/**
 * A `WorkersAiBinding` backed by the Cloudflare REST API.
 *
 * The Worker itself uses the native `env.AI` binding; this adapter exists only so
 * the bakeoff can drive the exact same provider code from a test runner, where no
 * binding exists. It reads credentials from the environment and never logs them.
 *
 * Nothing in `src/` imports this file, so no credential path can reach the
 * browser bundle.
 */

export interface LiveCredentials {
  accountId: string;
  apiToken: string;
}

/** Credentials from the environment, or null when the live gate is closed. */
export function liveCredentials(): LiveCredentials | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN ?? process.env.CF_API_TOKEN;
  return accountId && apiToken ? { accountId, apiToken } : null;
}

export function restBinding(credentials: LiveCredentials): WorkersAiBinding {
  return {
    async run(model, input) {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/ai/run/${model}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${credentials.apiToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        // Status is included so `classifyProviderError` can discriminate, but the
        // token never appears in a message.
        throw new Error(`${response.status} ${text.slice(0, 400)}`);
      }

      const payload = await response.json() as { result?: unknown };
      return payload.result ?? payload;
    }
  };
}

/** List the models the authenticated account can actually reach. */
export async function listAccountModels(credentials: LiveCredentials): Promise<Array<{ name: string; description?: string }>> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/ai/models/search?task=Text%20Generation&per_page=200`,
    { headers: { authorization: `Bearer ${credentials.apiToken}` } }
  );
  if (!response.ok) throw new Error(`Model listing failed: ${response.status}`);
  const payload = await response.json() as { result?: Array<{ name: string; description?: string }> };
  return payload.result ?? [];
}
