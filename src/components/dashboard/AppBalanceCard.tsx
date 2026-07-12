import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import type { PeriodStats } from '@/hooks/use-period-stats';

export function AppBalanceCard({ stats }: { stats: PeriodStats }) {
  return (
    <LinearGradient
      colors={['#1A9B8A', '#2EE6A6', '#3DE7FF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}>
      <View style={styles.top}>
        <View style={styles.labelRow}>
          <Ionicons name="wallet-outline" size={16} color="rgba(7,11,20,0.75)" />
          <Text style={styles.label}>APP BALANCE</Text>
        </View>
      </View>

      <Text style={styles.amount}>{formatAud(stats.flow)}</Text>

      <View style={styles.badges}>
        <View style={styles.badge}>
          <Ionicons
            name={stats.flow >= 0 ? 'arrow-up' : 'arrow-down'}
            size={12}
            color={Palette.void}
          />
          <Text style={styles.badgeText}>Flow {formatAud(stats.flow)}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Free {formatAud(stats.free)}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <FootCol label="Income" value={formatAud(stats.incomeTotal)} />
        <FootCol label="Expenses" value={formatAud(stats.expenseTotal)} />
        <FootCol label="Adjustments" value="—" />
      </View>
    </LinearGradient>
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
  card: {
    borderRadius: Radii.xl,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: {
    color: 'rgba(7,11,20,0.72)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  amount: {
    color: Palette.void,
    fontFamily: Fonts.display,
    fontSize: 36,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 12,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(7,11,20,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.pill,
  },
  badgeText: { color: Palette.void, fontSize: 12, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(7,11,20,0.22)',
    paddingTop: 12,
  },
  footCol: { flex: 1 },
  footLabel: { color: 'rgba(7,11,20,0.65)', fontSize: 11, marginBottom: 2 },
  footValue: { color: Palette.void, fontWeight: '800', fontSize: 13 },
});
