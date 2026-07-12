import { getSetting, setSetting } from '@/lib/db';
import { format } from 'date-fns';

const CACHE_KEY = 'fx_cop_aud_v1';

export type CopAudRate = {
  /** How many COP for 1 AUD */
  copPerAud: number;
  fetchedAt: string;
  source: string;
};

export async function loadCachedCopAud(): Promise<CopAudRate | null> {
  const raw = await getSetting(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CopAudRate;
  } catch {
    return null;
  }
}

async function saveCache(rate: CopAudRate): Promise<void> {
  await setSetting(CACHE_KEY, JSON.stringify(rate));
}

/**
 * Fetch AUD→COP via Frankfurter (ECB-based free API).
 * Falls back to last cached value on network failure.
 */
export async function fetchCopAudRate(force = false): Promise<CopAudRate | null> {
  const cached = await loadCachedCopAud();
  if (!force && cached) {
    const ageMs = Date.now() - new Date(cached.fetchedAt).getTime();
    if (ageMs < 6 * 60 * 60 * 1000) return cached;
  }

  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=AUD&to=COP');
    if (!res.ok) throw new Error(`FX HTTP ${res.status}`);
    const data = (await res.json()) as { rates?: { COP?: number }; date?: string };
    const cop = data.rates?.COP;
    if (!cop || !Number.isFinite(cop)) throw new Error('Missing COP rate');
    const rate: CopAudRate = {
      copPerAud: Math.round(cop * 100) / 100,
      fetchedAt: data.date ? `${data.date}T12:00:00.000Z` : new Date().toISOString(),
      source: 'frankfurter',
    };
    await saveCache(rate);
    return rate;
  } catch {
    return cached;
  }
}

export function formatRateDate(iso: string): string {
  try {
    return format(new Date(iso), 'MMMM d, yyyy');
  } catch {
    return iso.slice(0, 10);
  }
}
