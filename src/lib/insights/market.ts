import { daysBetween, nowIso } from '@/lib/dates';
import { createId } from '@/lib/id';
import { listReceiptItems, listReceipts, listProductStats, upsertProductStat } from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';
import type { ProductStat } from '@/types/models';

function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function recomputeProductStats(): Promise<ProductStat[]> {
  const receipts = await listReceipts();
  const items = await listReceiptItems();
  const receiptDate = new Map(receipts.map((r) => [r.id, r.purchased_at.slice(0, 10)]));

  const groups = new Map<
    string,
    { prices: number[]; dates: string[]; display: string }
  >();

  for (const item of items) {
    const key = normalizeProductName(item.name);
    if (!key) continue;
    const date = receiptDate.get(item.receipt_id) ?? item.updated_at.slice(0, 10);
    const g = groups.get(key) ?? { prices: [], dates: [], display: item.name };
    g.prices.push(item.unit_price_aud || item.line_total_aud);
    g.dates.push(date);
    groups.set(key, g);
  }

  const existing = await listProductStats();
  const byName = new Map(existing.map((p) => [p.product_name_normalized, p]));
  const result: ProductStat[] = [];

  for (const [key, g] of groups) {
    const uniqueDates = [...new Set(g.dates)].sort();
    let freq = 30;
    if (uniqueDates.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < uniqueDates.length; i++) {
        gaps.push(daysBetween(uniqueDates[i - 1], uniqueDates[i]));
      }
      freq = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    }
    const avg = g.prices.reduce((a, b) => a + b, 0) / g.prices.length;
    const prev = byName.get(key);
    const stat: ProductStat = {
      id: prev?.id ?? createId(),
      product_name_normalized: key,
      avg_price: Math.round(avg * 100) / 100,
      buy_frequency_days: Math.round(freq * 10) / 10,
      last_seen: uniqueDates[uniqueDates.length - 1],
      purchase_count: uniqueDates.length,
      updated_at: nowIso(),
    };
    await upsertProductStat(stat);
    await queueMutation('product_stats', stat);
    result.push(stat);
  }

  return result.sort((a, b) => a.buy_frequency_days - b.buy_frequency_days);
}

export function recommendUpcoming(stats: ProductStat[], withinDays = 7): ProductStat[] {
  const today = new Date();
  return stats.filter((s) => {
    if (!s.last_seen || !s.buy_frequency_days) return false;
    const last = new Date(`${s.last_seen}T12:00:00`);
    const due = new Date(last.getTime() + s.buy_frequency_days * 86400000);
    const diff = (due.getTime() - today.getTime()) / 86400000;
    return diff <= withinDays;
  });
}
