/**
 * Local client access credential management.
 *
 * Stored strictly in browser localStorage under a dedicated key,
 * completely isolated from Dexie IndexedDB and CampaignState.
 * The access secret NEVER enters campaign exports, imports, or state transitions.
 */

const STORAGE_KEY = 'atlas_access_secret';

export function getAccessSecret(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const val = window.localStorage.getItem(STORAGE_KEY);
    return val && val.trim() ? val.trim() : null;
  } catch {
    return null;
  }
}

export function setAccessSecret(secret: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const trimmed = secret.trim();
    if (trimmed) {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function clearAccessSecret(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function getAccessHeaders(): Record<string, string> {
  const secret = getAccessSecret();
  return secret ? { 'x-atlas-access-secret': secret } : {};
}
