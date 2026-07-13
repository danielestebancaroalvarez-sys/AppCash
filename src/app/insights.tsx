import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton } from '@/components/ui/Primitives';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { DonutChart } from '@/components/charts/FinanceCharts';
import { CategoryBars } from '@/components/dashboard/charts';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { formatAud } from '@/lib/money';
import { formatDisplayDate } from '@/lib/dates';
import {
  buildMarketDashboard,
  exportPredictiveListCsv,
  recomputeProductStats,
  type ProductInsight,
} from '@/lib/insights/market';
import { MARKET_CATEGORIES, type MarketCategory } from '@/lib/insights/categories';

type Filter = 'all' | MarketCategory;

export default function InsightsScreen() {
  const receipts = useFinanceStore((s) => s.receipts);
  const receiptItems = useFinanceStore((s) => s.receiptItems);
  const refresh = useFinanceStore((s) => s.refresh);
  const { alert, Dialog } = useAppDialog();
  const [filter, setFilter] = useState<Filter>('all');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void (async () => {
      await recomputeProductStats();
      await refresh();
    })();
  }, [refresh, receipts.length, receiptItems.length]);

  const dash = useMemo(
    () => buildMarketDashboard(receipts, receiptItems, 14),
    [receipts, receiptItems]
  );

  const filteredProducts = useMemo(() => {
    const list = filter === 'all' ? dash.products : dash.products.filter((p) => p.category === filter);
    return list;
  }, [dash.products, filter]);

  const grouped = useMemo(() => {
    const map = new Map<MarketCategory, ProductInsight[]>();
    for (const p of filteredProducts) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return MARKET_CATEGORIES.map((c) => ({ category: c, items: map.get(c) ?? [] })).filter(
      (g) => g.items.length > 0
    );
  }, [filteredProducts]);

  const onExport = async () => {
    const list = dash.predictiveList.length ? dash.predictiveList : dash.dueSoon;
    if (!list.length) {
      alert('Nothing to export', 'Scan more receipts so we can predict what to buy next.');
      return;
    }
    setExporting(true);
    try {
      await exportPredictiveListCsv(list);
    } catch (e) {
      alert('Export failed', e instanceof Error ? e.message : 'Could not share CSV');
    } finally {
      setExporting(false);
    }
  };

  if (!dash.trackedCount) {
    return (
      <Screen>
        <Text style={styles.title}>Market prediction</Text>
        <Text style={styles.sub}>
          Frequency, spend and shelf-life estimates from scanned receipt history.
        </Text>
        <GlassPanel>
          <Text style={styles.meta}>
            Scan a few Woolworths / Aldi / Coles receipts to unlock categories, charts and a
            predictive shopping list.
          </Text>
        </GlassPanel>
        {Dialog}
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>Market prediction</Text>
      <Text style={styles.sub}>
        How often you buy each item, how long it lasts, where money goes, and what to buy next.
      </Text>

      <View style={styles.kpiRow}>
        <Kpi label="Tracked" value={String(dash.trackedCount)} />
        <Kpi label="Repeats" value={String(dash.repeatCount)} />
        <Kpi label="Spent" value={formatAud(dash.totalSpent)} />
      </View>

      <CollapsibleWidget
        accent={Palette.teal}
        defaultExpanded
        header={<WidgetTitle icon="download-outline" title="Shopping list" iconColor={Palette.teal} />}
        collapsedSummary={
          <Text style={styles.summary}>
            {dash.predictiveList.length || dash.dueSoon.length} items ready to export
          </Text>
        }>
        <Text style={styles.hint}>
          CSV with products due soon (category, price, days between buys, next due).
        </Text>
        <PrimaryButton
          label={exporting ? 'Preparing…' : 'Download shopping list'}
          onPress={onExport}
          disabled={exporting}
        />
      </CollapsibleWidget>

      {dash.spendByCategory.length > 0 ? (
        <CollapsibleWidget
          accent={Palette.cyan}
          defaultExpanded={false}
          header={
            <WidgetTitle icon="pie-chart-outline" title="Spend by category" iconColor={Palette.cyan} />
          }
          collapsedSummary={
            <Text style={styles.summary}>
              {dash.spendByCategory
                .slice(0, 3)
                .map((c) => `${c.label} ${formatAud(c.value)}`)
                .join(' · ')}
            </Text>
          }>
          <DonutChart segments={dash.spendByCategory.slice(0, 6)} centerLabel="Market" />
          <CategoryBars items={dash.spendByCategory} />
        </CollapsibleWidget>
      ) : null}

      <CollapsibleWidget
        accent={Palette.amber}
        defaultExpanded
        header={<WidgetTitle icon="alarm-outline" title="Due soon" iconColor={Palette.amber} />}
        collapsedSummary={
          <Text style={styles.summary}>
            {dash.dueSoon.length
              ? `${dash.dueSoon.length} product${dash.dueSoon.length === 1 ? '' : 's'} within ~2 weeks`
              : 'Need 2+ buys of the same product'}
          </Text>
        }>
        {dash.dueSoon.length ? (
          dash.dueSoon.slice(0, 10).map((p) => <ProductRow key={p.id} product={p} highlight />)
        ) : (
          <Text style={styles.meta}>
            Need at least 2 purchases of the same product to estimate when it runs out.
          </Text>
        )}
      </CollapsibleWidget>

      <CollapsibleWidget
        accent={Palette.coral}
        defaultExpanded={false}
        header={
          <WidgetTitle icon="flash-outline" title="Bought most often" iconColor={Palette.coral} />
        }
        collapsedSummary={
          <Text style={styles.summary}>
            {dash.topByFrequency[0]
              ? `${dash.topByFrequency[0].name} every ~${dash.topByFrequency[0].buyFrequencyDays}d`
              : 'No repeat purchases yet'}
          </Text>
        }>
        {dash.topByFrequency.length ? (
          dash.topByFrequency.map((p) => <ProductRow key={p.id} product={p} showGaps />)
        ) : (
          <Text style={styles.meta}>Buy the same item twice to unlock frequency stats.</Text>
        )}
      </CollapsibleWidget>

      <CollapsibleWidget
        accent={Palette.violet}
        defaultExpanded={false}
        header={
          <WidgetTitle icon="time-outline" title="Lasts the longest" iconColor={Palette.violet} />
        }
        collapsedSummary={
          <Text style={styles.summary}>
            {dash.longestLasting[0]
              ? `${dash.longestLasting[0].name} ~${dash.longestLasting[0].buyFrequencyDays}d`
              : 'No repeat data'}
          </Text>
        }>
        {dash.longestLasting.length ? (
          dash.longestLasting.map((p) => <ProductRow key={p.id} product={p} showGaps />)
        ) : (
          <Text style={styles.meta}>Need repeat purchases to measure shelf life.</Text>
        )}
      </CollapsibleWidget>

      <CollapsibleWidget
        accent={Palette.mint}
        defaultExpanded={false}
        header={
          <WidgetTitle icon="cash-outline" title="Highest spend" iconColor={Palette.mint} />
        }
        collapsedSummary={
          <Text style={styles.summary}>
            {dash.topBySpend[0]
              ? `${dash.topBySpend[0].name} ${formatAud(dash.topBySpend[0].totalSpent)}`
              : 'No spend yet'}
          </Text>
        }>
        {dash.topBySpend.map((p) => (
          <ProductRow key={p.id} product={p} showSpend />
        ))}
      </CollapsibleWidget>

      <CollapsibleWidget
        accent={Palette.cyan}
        defaultExpanded={false}
        header={
          <WidgetTitle icon="grid-outline" title="By category" iconColor={Palette.cyan} />
        }
        collapsedSummary={
          <Text style={styles.summary}>
            {dash.categories.length} categories · filter and browse products
          </Text>
        }>
        <View style={styles.chips}>
          <Chip label="All" on={filter === 'all'} onPress={() => setFilter('all')} />
          {dash.categories.map((c) => (
            <Chip
              key={c.category}
              label={`${c.category} (${c.productCount})`}
              on={filter === c.category}
              onPress={() => setFilter(c.category)}
              color={c.color}
            />
          ))}
        </View>

        {dash.categories
          .filter((c) => filter === 'all' || filter === c.category)
          .map((c) => (
            <View key={c.category} style={styles.catCard}>
              <View style={styles.catHead}>
                <View style={[styles.catDot, { backgroundColor: c.color }]} />
                <Text style={styles.catTitle}>{c.category}</Text>
                <Text style={styles.catAmt}>{formatAud(c.totalSpent)}</Text>
              </View>
              <Text style={styles.meta}>
                {c.productCount} product{c.productCount === 1 ? '' : 's'}
                {c.avgFrequencyDays != null
                  ? ` · avg every ~${c.avgFrequencyDays}d`
                  : ' · need repeats for frequency'}
                {c.topProduct ? ` · top: ${c.topProduct}` : ''}
              </Text>
            </View>
          ))}

        {grouped.map((g) => (
          <View key={g.category} style={styles.groupBlock}>
            <Text style={styles.groupTitle}>{g.category}</Text>
            {g.items.map((p) => (
              <ProductRow key={p.id} product={p} showGaps showSpend />
            ))}
          </View>
        ))}
      </CollapsibleWidget>

      {Dialog}
    </Screen>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Chip({
  label,
  on,
  onPress,
  color,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        on && { borderColor: color ?? Palette.cyan, backgroundColor: `${color ?? Palette.cyan}22` },
      ]}>
      <Text style={[styles.chipText, on && { color: Palette.text }]}>{label}</Text>
    </Pressable>
  );
}

function ProductRow({
  product,
  highlight,
  showGaps,
  showSpend,
}: {
  product: ProductInsight;
  highlight?: boolean;
  showGaps?: boolean;
  showSpend?: boolean;
}) {
  const dueLabel =
    product.daysUntilDue < 0
      ? `${Math.abs(product.daysUntilDue)}d overdue`
      : product.daysUntilDue === 0
        ? 'due today'
        : `due in ${product.daysUntilDue}d`;

  return (
    <View style={[styles.row, highlight && styles.rowHighlight]}>
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>
          <Text style={styles.catTag}>{product.category}</Text>
        </View>
        <Text style={styles.meta}>
          {product.frequencyEstimated
            ? `bought once · last ${formatDisplayDate(product.lastSeen)}`
            : `every ~${product.buyFrequencyDays}d · ${product.purchaseCount}x · last ${formatDisplayDate(product.lastSeen)}`}
          {highlight ? ` · ${dueLabel}` : ''}
        </Text>
        {showGaps && product.gapsDays.length > 0 ? (
          <Text style={styles.meta}>
            Gaps: {product.gapsDays.map((d) => `${d}d`).join(' → ')} (avg {product.buyFrequencyDays}
            d)
          </Text>
        ) : null}
        {showSpend ? (
          <Text style={styles.meta}>
            Total {formatAud(product.totalSpent)} · avg {formatAud(product.avgPrice)}
          </Text>
        ) : null}
      </View>
      <Text style={styles.price}>{formatAud(product.avgPrice)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: Palette.text, fontFamily: Fonts.display, fontSize: 28, fontWeight: '800' },
  sub: { color: Palette.textMuted, marginBottom: Spacing.md, marginTop: 4, lineHeight: 18 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  kpi: {
    flex: 1,
    backgroundColor: Palette.panelElevated,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  kpiLabel: { color: Palette.textDim, fontSize: 11, marginBottom: 4 },
  kpiValue: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 16,
  },
  summary: { color: Palette.textDim, fontSize: 12 },
  hint: { color: Palette.textDim, fontSize: 12, lineHeight: 16, marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Palette.panelElevated,
  },
  chipText: { color: Palette.textMuted, fontSize: 12, fontWeight: '700' },
  catCard: {
    gap: 4,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.stroke,
  },
  catHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catTitle: { color: Palette.text, fontWeight: '800', flex: 1 },
  catAmt: { color: Palette.cyan, fontWeight: '800' },
  groupBlock: { marginTop: 4 },
  groupTitle: {
    color: Palette.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.stroke,
  },
  rowHighlight: {
    backgroundColor: `${Palette.amber}14`,
    borderRadius: Radii.md,
    paddingHorizontal: 8,
    borderBottomWidth: 0,
  },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  name: { color: Palette.text, fontWeight: '700', flex: 1 },
  catTag: {
    color: Palette.textDim,
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: Palette.panelElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  meta: { color: Palette.textDim, fontSize: 12, marginTop: 3, lineHeight: 16 },
  price: { color: Palette.cyan, fontWeight: '800', marginTop: 2 },
});
