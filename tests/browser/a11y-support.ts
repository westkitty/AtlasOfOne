import type { Page } from 'playwright-core';

/** Q10/Q11 shared probes. Pure DOM measurement; nothing here changes app state. */

export interface SurfaceAudit {
  surface: string;
  overflow: number;
  smallTargets: string[];
  clipped: string[];
  unnamed: string[];
}

const INTERACTIVE = 'button, a[href], input:not([type="hidden"]), textarea, select, [role="button"], [tabindex]:not([tabindex="-1"])';

export async function auditSurface(page: Page, surface: string, root: string): Promise<SurfaceAudit> {
  const result = await page.evaluate(([rootSel, interactive]) => {
    const describe = (el: Element) => {
      const id = el.getAttribute('data-testid') ?? el.className?.toString().split(' ')[0] ?? '';
      return `${el.tagName.toLowerCase()}[${id}] "${(el.textContent ?? '').trim().slice(0, 24)}"`;
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const accessibleName = (el: Element) => {
      const label = el.getAttribute('aria-label')?.trim();
      if (label) return label;
      const by = el.getAttribute('aria-labelledby');
      if (by) return by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        const labels = [...(el.labels ?? [])].map((l) => l.textContent ?? '').join(' ').trim();
        return labels || el.getAttribute('title')?.trim() || el.getAttribute('placeholder')?.trim() || '';
      }
      const text = [...el.childNodes].map((node) =>
        node instanceof Element && node.getAttribute('aria-hidden') === 'true' ? '' : node.textContent ?? ''
      ).join('').trim();
      return text || el.getAttribute('title')?.trim() || '';
    };
    const root = document.querySelector(rootSel);
    const vw = document.documentElement.clientWidth;
    const clipped: string[] = [];
    const smallTargets: string[] = [];
    const unnamed: string[] = [];
    if (!root) return { overflow: -1, clipped: [`missing root ${rootSel}`], smallTargets, unnamed };
    const rr = root.getBoundingClientRect();
    if (rr.left < -1 || rr.right > vw + 1) clipped.push(`root ${rootSel} spans ${Math.round(rr.left)}..${Math.round(rr.right)} of ${vw}`);
    for (const el of root.querySelectorAll(interactive)) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.left < -1 || r.right > vw + 1) clipped.push(`${describe(el)} ${Math.round(r.left)}..${Math.round(r.right)}`);
      if (r.width < 44 || r.height < 44) smallTargets.push(`${describe(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (!accessibleName(el)) unnamed.push(describe(el));
    }
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      clipped, smallTargets, unnamed
    };
  }, [root, INTERACTIVE] as const);
  return { surface, ...result };
}

export async function persistedState(page: Page) {
  return page.evaluate(async () => {
    const open = indexedDB.open('atlas-of-one');
    return new Promise<any>((resolve, reject) => {
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const request = open.result.transaction('campaigns', 'readonly').objectStore('campaigns').get('active');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result?.state ?? null);
      };
    });
  });
}

export async function resetProfile(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = await indexedDB.databases?.() ?? [];
    for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
  });
  await page.reload({ waitUntil: 'load' });
}
