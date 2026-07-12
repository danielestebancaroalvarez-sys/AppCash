import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { MiniWeekBars } from '@/components/dashboard/charts';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import type { PeriodStats } from '@/hooks/use-period-stats';

export function MarketWidget({ stats }: { stats: PeriodStats }) {
  const router = useRouter();

  return (
    <CollapsibleWidget
      accent={Palette.cyan}
      header={<WidgetTitle icon="cart-outline" title="Market" />}
      headerActions={
        <Pressable onPress={() => router.push('/insights' as never)} hitSlop={8}>
          <Text style={styles.seeMore}>See more</Text>
        </Pressable>
      }
      collapsedSummary={
        <Text style={styles.summary}>
          This week {formatAud(stats.marketThisWeek)} · Avg {formatAud(stats.marketAverage)}
        </Text>
      }>
      <View style={styles.kpis}>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>This week</Text>
          <Text style={styles.kpiValue}>{formatAud(stats.marketThisWeek)}</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Average</Text>
          <Text style={styles.kpiValue}>{formatAud(stats.marketAverage)}</Text>
        </View>
      </View>

      <Text style={styles.section}>Weekly spending (last weeks)</Text>
      <MiniWeekBars values={stats.marketWeekBars} />

      <Text style={styles.section}>Top categories</Text>
      {stats.marketTopCategories.length === 0 ? (
        <Text style={styles.empty}>Scan grocery receipts to unlock breakdown.</Text>
      ) : (
        stats.marketTopCategories.map((c) => (
          <View key={c.label} style={styles.catRow}>
            <Text style={styles.catName}>{c.label}</Text>
            <Text style={styles.catAmt}>
              {formatAud(c.value)} ({c.pct}%)
            </Text>
          </View>
        ))
      )}

      <Pressable
        onPress={() => router.push('/insights' as never)}
        style={styles.linkRow}>
        <Text style={styles.link}>See full market analysis</Text>
        <Ionicons name="arrow-forward" size={14} color={Palette.cyan} />
      </Pressable>
    </CollapsibleWidget>
  );
}

const styles = StyleSheet.create({
  summary: { color: Palette.textDim, fontSize: 12 },
  seeMore: { color: Palette.cyan, fontSize: 12, fontWeight: '700' },
  kpis: { flexDirection: 'row', gap: 8 },
  kpi: {
    flex: 1,
    backgroundColor: Palette.panelElevated,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  kpiLabel: { color: Palette.textDim, fontSize: 11, marginBottom: 4 },
  kpiValue: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '800', fontSize: 18 },
  section: { color: Palette.textDim, fontSize: 11, marginTop: 8, marginBottom: 4 },
  empty: { color: Palette.textMuted, fontSize: 12 },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.stroke,
  },
  catName: { color: Palette.text, fontSize: 13, flex: 1 },
  catAmt: { color: Palette.textMuted, fontSize: 12, fontWeight: '600' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  link: { color: Palette.cyan, fontWeight: '700', fontSize: 13 },
});
