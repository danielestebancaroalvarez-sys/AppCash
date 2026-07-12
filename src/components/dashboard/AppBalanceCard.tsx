import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { Fonts, Palette, Radii } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import type { PeriodStats } from '@/hooks/use-period-stats';

export function AppBalanceCard({ stats }: { stats: PeriodStats }) {
  const tone = stats.flow >= 0 ? Palette.cyan : Palette.coral;

  return (
    <CollapsibleWidget
      accent={Palette.cyan}
      defaultExpanded={false}
      header={<WidgetTitle icon="wallet-outline" title="App Balance" iconColor={Palette.cyan} />}
      collapsedSummary={
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryAmt, { color: tone }]}>{formatAud(stats.flow)}</Text>
          <Text style={styles.summaryMeta}>Free {formatAud(stats.free)}</Text>
        </View>
      }>
      <Text style={[styles.amount, { color: tone }]}>{formatAud(stats.flow)}</Text>

      <View style={styles.badges}>
        <View style={styles.badge}>
          <Ionicons
            name={stats.flow >= 0 ? 'arrow-up' : 'arrow-down'}
            size={12}
            color={tone}
          />
          <Text style={[styles.badgeText, { color: tone }]}>Flow {formatAud(stats.flow)}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeTextMuted}>Free {formatAud(stats.free)}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <FootCol label="Income" value={formatAud(stats.incomeTotal)} />
        <FootCol label="Expenses" value={formatAud(stats.expenseTotal)} />
        <FootCol label="Adjustments" value="—" />
      </View>
    </CollapsibleWidget>
  );
}

function FootCol({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.footCol}>
      <Text style={styles.footLabel}>{label}</Text>
      <Text style={styles.footValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  summaryAmt: { fontFamily: Fonts.display, fontWeight: '800', fontSize: 18 },
  summaryMeta: { color: Palette.textDim, fontSize: 12 },
  amount: {
    fontFamily: Fonts.display,
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 10,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Palette.panelElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextMuted: { color: Palette.textMuted, fontSize: 12, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.stroke,
    paddingTop: 12,
  },
  footCol: { flex: 1 },
  footLabel: { color: Palette.textDim, fontSize: 11, marginBottom: 2 },
  footValue: { color: Palette.text, fontWeight: '800', fontSize: 13 },
});
