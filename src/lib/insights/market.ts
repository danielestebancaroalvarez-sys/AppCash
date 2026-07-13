import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { daysBetween, nowIso, todayIsoDate, addDaysIso } from '@/lib/dates';
import { createId } from '@/lib/id';
import { listReceiptItems, listReceipts, listProductStats, upsertProductStat } from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';
import type { ProductStat, Receipt, ReceiptItem } from '@/types/models';
import {
  categorizeProduct,
  marketCategoryColor,
  type MarketCategory,
  MARKET_CATEGORIES,
} from '@/lib/insights/categories';
import { isReceiptNoiseLine } from '@/lib/purchases/filter';

export type ProductInsight = {
  id: string;
  name: string;
  nameNormalized: string;
  category: MarketCategory;
  avgPrice: number;
  totalSpent: number;
  purchaseCount: number;
  /** Average days between purchases; estimated when only 1 buy. */
  buyFrequencyDays: number;
  /** True when frequency is a default estimate (single purchase). */
  frequencyEstimated: boolean;
  /** Measured gaps between consecutive buys (empty if <2). */
  gapsDays: number[];
  lastSeen: string;
  firstSeen: string;
  daysSinceLast: number;
  /** Days until next expected buy (negative = overdue). */
  daysUntilDue: number;
  nextDueDate: string;
};

export type CategoryInsight = {
  category: MarketCategory;
  color: string;
  productCount: number;
  totalSpent: number;
  avgFrequencyDays: number | null;
  topProduct: string | null;
};

export type MarketDashboard = {
  products: ProductInsight[];
  categories: CategoryInsight[];
  spendByCategory: Array<{ label: string; value: number; color: string }>;
  topBySpend: ProductInsight[];
  topByFrequency: ProductInsight[]; /** shortest measured cycle */
  longestLasting: ProductInsight[]; /** longest measured cycle among repeats */
  dueSoon: ProductInsight[];
  predictiveList: ProductInsight[];
  totalSpent: number;
  trackedCount: number;
  repeatCount: number;
};

function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function displayName(raw: string): string {
  return raw
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
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
    if (isReceiptNoiseLine(item.name)) continue;
    const key = normalizeProductName(item.name);
    if (!key || isReceiptNoiseLine(key)) continue;
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
    if (s.purchase_count < 2) return false;
    const last = new Date(`${s.last_seen}T12:00:00`);
    const due = new Date(last.getTime() + s.buy_frequency_days * 86400000);
    const diff = (due.getTime() - today.getTime()) / 86400000;
    return diff <= withinDays;
  });
}

/** Build full market analytics from local receipts (no DB write). */
export function buildMarketDashboard(
  receipts: Receipt[],
  items: ReceiptItem[],
  withinDays = 14
): MarketDashboard {
  const receiptDate = new Map(receipts.map((r) => [r.id, r.purchased_at.slice(0, 10)]));
  const today = todayIsoDate();

  type Acc = {
    display: string;
    prices: number[];
    lineTotals: number[];
    dates: string[];
    guesses: string[];
  };

  const groups = new Map<string, Acc>();
  for (const item of items) {
    if (isReceiptNoiseLine(item.name)) continue;
    const key = normalizeProductName(item.name);
    if (!key || isReceiptNoiseLine(key)) continue;
    const date = receiptDate.get(item.receipt_id) ?? item.updated_at.slice(0, 10);
    const g =
      groups.get(key) ??
      ({
        display: item.name,
        prices: [],
        lineTotals: [],
        dates: [],
        guesses: [],
      } satisfies Acc);
    g.prices.push(item.unit_price_aud || item.line_total_aud);
    g.lineTotals.push(item.line_total_aud || item.unit_price_aud || 0);
    g.dates.push(date);
    if (item.category_guess) g.guesses.push(item.category_guess);
    groups.set(key, g);
  }

  const products: ProductInsight[] = [];

  for (const [key, g] of groups) {
    const uniqueDates = [...new Set(g.dates)].sort();
    const gapsDays: number[] = [];
    for (let i = 1; i < uniqueDates.length; i++) {
      gapsDays.push(daysBetween(uniqueDates[i - 1], uniqueDates[i]));
    }
    const frequencyEstimated = gapsDays.length === 0;
    const buyFrequencyDays = frequencyEstimated
      ? 30
      : Math.round((gapsDays.reduce((a, b) => a + b, 0) / gapsDays.length) * 10) / 10;

    const lastSeen = uniqueDates[uniqueDates.length - 1];
    const firstSeen = uniqueDates[0];
    const daysSinceLast = daysBetween(lastSeen, today);
    const daysUntilDue = Math.round(buyFrequencyDays - daysSinceLast);
    const nextDueDate = addDaysIso(lastSeen, Math.round(buyFrequencyDays));
    const avgPrice =
      Math.round((g.prices.reduce((a, b) => a + b, 0) / g.prices.length) * 100) / 100;
    const totalSpent = Math.round(g.lineTotals.reduce((a, b) => a + b, 0) * 100) / 100;
    const guessMode = mode(g.guesses) ?? '';
    const category = categorizeProduct(g.display, guessMode);

    products.push({
      id: key,
      name: displayName(g.display),
      nameNormalized: key,
      category,
      avgPrice,
      totalSpent,
      purchaseCount: uniqueDates.length,
      buyFrequencyDays,
      frequencyEstimated,
      gapsDays,
      lastSeen,
      firstSeen,
      daysSinceLast,
      daysUntilDue,
      nextDueDate,
    });
  }

  products.sort((a, b) => b.totalSpent - a.totalSpent);

  const catMap = new Map<MarketCategory, ProductInsight[]>();
  for (const p of products) {
    const list = catMap.get(p.category) ?? [];
    list.push(p);
    catMap.set(p.category, list);
  }

  const categories: CategoryInsight[] = MARKET_CATEGORIES.map((category, i) => {
    const list = catMap.get(category) ?? [];
    const totalSpent = list.reduce((a, b) => a + b.totalSpent, 0);
    const measured = list.filter((p) => !p.frequencyEstimated);
    const avgFrequencyDays =
      measured.length > 0
        ? Math.round(
            (measured.reduce((a, b) => a + b.buyFrequencyDays, 0) / measured.length) * 10
          ) / 10
        : null;
    const top = [...list].sort((a, b) => b.totalSpent - a.totalSpent)[0];
    return {
      category,
      color: marketCategoryColor(category, i),
      productCount: list.length,
      totalSpent: Math.round(totalSpent * 100) / 100,
      avgFrequencyDays,
      topProduct: top?.name ?? null,
    };
  })
    .filter((c) => c.productCount > 0)
    .sort((a, b) => b.totalSpent - a.totalSpent);

  const spendByCategory = categories.map((c) => ({
    label: c.category,
    value: c.totalSpent,
    color: c.color,
  }));

  const repeats = products.filter((p) => !p.frequencyEstimated);
  const topBySpend = [...products].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 8);
  const topByFrequency = [...repeats]
    .sort((a, b) => a.buyFrequencyDays - b.buyFrequencyDays)
    .slice(0, 8);
  const longestLasting = [...repeats]
    .sort((a, b) => b.buyFrequencyDays - a.buyFrequencyDays)
    .slice(0, 8);

  const dueSoon = products
    .filter((p) => !p.frequencyEstimated && p.daysUntilDue <= withinDays)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  const predictiveList = [
    ...dueSoon,
    ...products.filter(
      (p) => p.frequencyEstimated && p.daysSinceLast >= 21 && p.purchaseCount >= 1
    ),
  ]
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  return {
    products,
    categories,
    spendByCategory,
    topBySpend,
    topByFrequency,
    longestLasting,
    dueSoon,
    predictiveList,
    totalSpent: Math.round(products.reduce((a, b) => a + b.totalSpent, 0) * 100) / 100,
    trackedCount: products.length,
    repeatCount: repeats.length,
  };
}

function mode(values: string[]): string | null {
  if (!values.length) return null;
  const counts = new Map<string, number>();
  for (const v of values) {
    const k = v.trim().toLowerCase();
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  for (const [k, c] of counts) {
    if (c > n) {
      best = k;
      n = c;
    }
  }
  return best;
}

export async function exportPredictiveListCsv(list: ProductInsight[]): Promise<void> {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const header = [
    'product',
    'category',
    'avg_price_aud',
    'buy_every_days',
    'last_bought',
    'next_due',
    'days_until_due',
    'purchase_count',
    'total_spent_aud',
  ];
  const lines = [
    header.join(','),
    ...list.map((p) =>
      [
        escape(p.name),
        escape(p.category),
        String(p.avgPrice),
        String(p.buyFrequencyDays),
        p.lastSeen,
        p.nextDueDate,
        String(p.daysUntilDue),
        String(p.purchaseCount),
        String(p.totalSpent),
      ].join(',')
    ),
  ];
  const path = `${FileSystem.cacheDirectory}appcash-shopping-list-${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(path, lines.join('\n'), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'text/csv',
      dialogTitle: 'Predictive shopping list',
      UTI: 'public.comma-separated-values-text',
    });
  }
}
