import { getSetting, setSetting } from '@/lib/db';
import { format } from 'date-fns';

const CACHE_KEY = 'fx_cop_aud_v1';
const MANUAL_KEY = 'fx_cop_aud_manual';

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

export async function saveManualCopAud(copPerAud: number): Promise<CopAudRate> {
  const rate: CopAudRate = {
    copPerAud: Math.round(copPerAud * 100) / 100,
    fetchedAt: new Date().toISOString(),
    source: 'manual',
  };
  await setSetting(MANUAL_KEY, String(rate.copPerAud));
  await saveCache(rate);
  return rate;
}

type FetchResult = { cop: number; date?: string; source: string } | null;

async function tryOpenErApi(): Promise<FetchResult> {
  const res = await fetch('https://open.er-api.com/v6/latest/AUD');
  if (!res.ok) return null;
  const data = (await res.json()) as {
    result?: string;
    rates?: { COP?: number };
    time_last_update_utc?: string;
  };
  const cop = data.rates?.COP;
  if (!cop || !Number.isFinite(cop)) return null;
  return { cop, date: data.time_last_update_utc, source: 'open.er-api' };
}

async function tryFloatRates(): Promise<FetchResult> {
  const res = await fetch('https://www.floatrates.com/daily/aud.json');
  if (!res.ok) return null;
  const data = (await res.json()) as { cop?: { rate?: number; date?: string } };
  const cop = data.cop?.rate;
  if (!cop || !Number.isFinite(cop)) return null;
  return { cop, date: data.cop?.date, source: 'floatrates' };
}

/**
 * Fetch AUD→COP. Frankfurter has no COP — use open.er-api / floatrates.
 * Falls back to cache, then last manual rate.
 */
export async function fetchCopAudRate(force = false): Promise<CopAudRate | null> {
  const cached = await loadCachedCopAud();
  if (!force && cached) {
    const ageMs = Date.now() - new Date(cached.fetchedAt).getTime();
    if (ageMs < 6 * 60 * 60 * 1000) return cached;
  }

  const sources = [tryOpenErApi, tryFloatRates];
  for (const src of sources) {
    try {
      const hit = await src();
      if (!hit) continue;
      const rate: CopAudRate = {
        copPerAud: Math.round(hit.cop * 100) / 100,
        fetchedAt: hit.date ? new Date(hit.date).toISOString() : new Date().toISOString(),
        source: hit.source,
      };
      if (Number.isNaN(new Date(rate.fetchedAt).getTime())) {
        rate.fetchedAt = new Date().toISOString();
      }
      await saveCache(rate);
      return rate;
    } catch {
      // try next
    }
  }

  if (cached) return cached;

  const manual = await getSetting(MANUAL_KEY);
  if (manual) {
    const n = Number(manual);
    if (Number.isFinite(n) && n > 0) {
      return {
        copPerAud: n,
        fetchedAt: new Date().toISOString(),
        source: 'manual',
      };
    }
  }

  return null;
}

export function formatRateDate(iso: string): string {
  try {
    return format(new Date(iso), 'MMMM d, yyyy');
  } catch {
    return iso.slice(0, 10);
  }
}
