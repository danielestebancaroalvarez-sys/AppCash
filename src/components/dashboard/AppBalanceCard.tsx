import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import type { PeriodStats } from '@/hooks/use-period-stats';

export function AppBalanceCard({ stats }: { stats: PeriodStats }) {
  const positive = stats.flow >= 0;
  const tone = positive ? Palette.cyan : Palette.coral;

  return (
    <CollapsibleWidget
      accent={Palette.cyan}
      defaultExpanded
      header={<WidgetTitle icon="card-outline" title="App Balance" iconColor={Palette.cyan} />}
      collapsedSummary={
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryAmt, { color: tone }]}>{formatAud(stats.flow)}</Text>
          <Text style={styles.summaryMeta}>Free {formatAud(stats.free)}</Text>
        </View>
      }>
      <LinearGradient
        colors={positive ? ['#0B3A4A', '#124E63', '#0D6B7A'] : ['#4A1520', '#6B2030', '#3D1018']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}>
        <View style={styles.cardShine} />
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.cardBrand}>APPCASH</Text>
            <Text style={styles.cardChipLabel}>Household balance</Text>
          </View>
          <View style={styles.chipRow}>
            <View style={styles.chipGold} />
            <Ionicons name="wifi" size={18} color="rgba(255,255,255,0.55)" style={styles.nfc} />
          </View>
        </View>

        <Text style={styles.cardLabel}>Available flow</Text>
        <Text style={styles.cardAmount}>{formatAud(stats.flow)}</Text>

        <View style={styles.cardMid}>
          <View>
            <Text style={styles.cardTiny}>FREE TO SPEND</Text>
            <Text style={styles.cardMidVal}>{formatAud(stats.free)}</Text>
          </View>
          <View style={styles.cardMidRight}>
            <Ionicons
              name={positive ? 'trending-up' : 'trending-down'}
              size={16}
              color={positive ? Palette.mint : Palette.coral}
            />
            <Text style={[styles.cardStatus, { color: positive ? Palette.mint : Palette.coral }]}>
              {positive ? 'Surplus' : 'Deficit'}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Foot label="Income" value={formatAud(stats.incomeTotal)} />
          <Foot label="Expenses" value={formatAud(stats.expenseTotal)} />
          <Foot label="Saved" value={formatAud(stats.savingsContrib ?? 0)} />
        </View>
      </LinearGradient>
    </CollapsibleWidget>
  );
}

function Foot({ label, value }: { label: string; value: string }) {
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
  card: {
    borderRadius: Radii.xl,
    padding: Spacing.md,
    overflow: 'hidden',
    minHeight: 188,
    borderWidth: 1,
    borderColor: 'rgba(61,231,255,0.22)',
  },
  cardShine: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(61,231,255,0.12)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  cardBrand: {
    color: Palette.cyan,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 2,
  },
  cardChipLabel: { color: 'rgba(244,247,255,0.55)', fontSize: 11, marginTop: 2 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chipGold: {
    width: 34,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#E8C872',
    borderWidth: 1,
    borderColor: '#C9A44A',
  },
  nfc: { transform: [{ rotate: '90deg' }] },
  cardLabel: {
    color: 'rgba(244,247,255,0.55)',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  cardAmount: {
    color: Palette.white,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 32,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  cardMid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
  },
  cardTiny: { color: 'rgba(244,247,255,0.45)', fontSize: 10, letterSpacing: 0.8 },
  cardMidVal: { color: Palette.white, fontWeight: '800', fontSize: 16, marginTop: 2 },
  cardMidRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardStatus: { fontWeight: '700', fontSize: 12 },
  cardFooter: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 12,
  },
  footCol: { flex: 1 },
  footLabel: { color: 'rgba(244,247,255,0.45)', fontSize: 10, marginBottom: 2 },
  footValue: { color: Palette.white, fontWeight: '700', fontSize: 12 },
});
