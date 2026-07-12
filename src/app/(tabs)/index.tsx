import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { format, eachDayOfInterval } from 'date-fns';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { AmountText, GlassPanel, SectionTitle } from '@/components/ui/Primitives';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { BarWeek, DonutChart } from '@/components/charts/FinanceCharts';
import { Fonts, FinanceColors, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore, useWeekRange } from '@/stores/finance-store';
import { useSheetRefresh } from '@/hooks/use-sheet-refresh';
import { formatAud } from '@/lib/money';
import { inRange } from '@/lib/dates';
import { recommendUpcoming, recomputeProductStats } from '@/lib/insights/market';

export default function DashboardScreen() {
  const router = useRouter();
  const transactions = useFinanceStore((s) => s.transactions);
  const fixedItems = useFinanceStore((s) => s.fixedItems);
  const categories = useFinanceStore((s) => s.categories);
  const users = useFinanceStore((s) => s.users);
  const productStats = useFinanceStore((s) => s.productStats);
  const shiftWeekBy = useFinanceStore((s) => s.shiftWeekBy);
  const syncMessage = useFinanceStore((s) => s.syncMessage);
  const session = useFinanceStore((s) => s.session);
  const { start, end, label } = useWeekRange();
  const { refreshing, onRefresh } = useSheetRefresh(async () => {
    await recomputeProductStats();
  });

  const stats = useMemo(() => {
    const weekTx = transactions.filter((t) => inRange(t.date, start, end));
    const incomeSporadic = weekTx
      .filter((t) => t.type === 'income_sporadic')
      .reduce((a, t) => a + t.amount_aud, 0);
    const expenseVariable = weekTx
      .filter((t) => t.type === 'expense_sporadic' || t.type === 'variable')
      .reduce((a, t) => a + t.amount_aud, 0);
    const incomeFixed = fixedItems
      .filter((f) => f.active && f.direction === 'in')
      .reduce((a, f) => a + prorateWeekly(f.amount_aud, f.period), 0);
    const expenseFixed = fixedItems
      .filter((f) => f.active && f.direction === 'out')
      .reduce((a, f) => a + prorateWeekly(f.amount_aud, f.period), 0);

    const byCat = new Map<string, number>();
    for (const t of weekTx.filter((x) => x.type !== 'income_sporadic' && x.type !== 'savings_contrib')) {
      byCat.set(t.category_id, (byCat.get(t.category_id) ?? 0) + t.amount_aud);
    }
    const segments = [...byCat.entries()]
      .map(([id, value]) => {
        const cat = categories.find((c) => c.id === id);
        return { label: cat?.name ?? 'Other', value, color: cat?.color ?? Palette.violet };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const days = eachDayOfInterval({ start, end });
    const bars = days.map((d) => {
      const key = format(d, 'yyyy-MM-dd');
      const value = weekTx
        .filter((t) => t.date === key && t.type !== 'income_sporadic')
        .reduce((a, t) => a + t.amount_aud, 0);
      return { label: format(d, 'EEE').slice(0, 2), value };
    });

    const byUser = users.map((u) => ({
      id: u.id,
      name: u.name,
      user: u,
      spent: weekTx
        .filter((t) => t.user_id === u.id && t.type !== 'income_sporadic')
        .reduce((a, t) => a + t.amount_aud, 0),
    }));

    const net = incomeFixed + incomeSporadic - expenseFixed - expenseVariable;
    return { incomeFixed, incomeSporadic, expenseFixed, expenseVariable, net, segments, bars, byUser };
  }, [transactions, fixedItems, categories, users, start, end]);

  const upcoming = recommendUpcoming(productStats, 14).slice(0, 4);
  const trackedCount = productStats.length;

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.kicker}>{session?.email ?? 'AppCash'}</Text>
          <Text style={styles.title}>Weekly pulse</Text>
        </View>
        <AmountText
          value={formatAud(stats.net)}
          tone={stats.net >= 0 ? 'income' : 'expense'}
          size="lg"
        />
      </View>

      <GlassPanel style={styles.weekNav}>
        <Pressable onPress={() => shiftWeekBy(-1)} style={styles.navBtn}>
          <Text style={styles.navTxt}>‹</Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.weekLabel}>{label}</Text>
          <Text style={styles.weekHint}>Tap arrows to shift weeks</Text>
        </View>
        <Pressable onPress={() => shiftWeekBy(1)} style={styles.navBtn}>
          <Text style={styles.navTxt}>›</Text>
        </Pressable>
      </GlassPanel>

      <View style={styles.kpiGrid}>
        <Kpi label="Fixed in" value={stats.incomeFixed} tone="income" />
        <Kpi label="Sporadic in" value={stats.incomeSporadic} tone="income" />
        <Kpi label="Fixed out" value={stats.expenseFixed} tone="expense" />
        <Kpi label="Variable out" value={stats.expenseVariable} tone="expense" />
      </View>

      <SectionTitle title="Market prediction" subtitle="From your receipt history" />
      <Pressable onPress={() => router.push('/insights' as never)}>
        <GlassPanel style={styles.marketCard}>
          <View style={styles.marketHead}>
            <View style={styles.marketIcon}>
              <Ionicons name="trending-up-outline" size={22} color={Palette.cyan} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.marketTitle}>Likely to buy soon</Text>
              <Text style={styles.weekHint}>
                {trackedCount
                  ? `${trackedCount} products tracked · tap for full list`
                  : 'Scan receipts to unlock predictions'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Palette.textDim} />
          </View>
          {upcoming.length ? (
            upcoming.map((p) => (
              <View key={p.id} style={styles.marketRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.personName}>{p.product_name_normalized}</Text>
                  <Text style={styles.weekHint}>
                    every ~{p.buy_frequency_days}d · avg {formatAud(p.avg_price)}
                  </Text>
                </View>
                <Text style={styles.marketPrice}>{formatAud(p.avg_price)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>No predictions yet — scan a few grocery receipts.</Text>
          )}
        </GlassPanel>
      </Pressable>

      <SectionTitle title="Spend mix" subtitle="Categories this week" />
      {stats.segments.length ? (
        <DonutChart segments={stats.segments} centerLabel="Spend" />
      ) : (
        <GlassPanel>
          <Text style={styles.empty}>No variable spend in this week yet.</Text>
        </GlassPanel>
      )}

      <SectionTitle title="Rhythm" subtitle="Day-by-day outflow" />
      <BarWeek values={stats.bars} />

      <SectionTitle title="By person" />
      <GlassPanel>
        {stats.byUser.map((u) => (
          <View key={u.id} style={styles.personRow}>
            <UserAvatar user={u.user} size={32} />
            <Text style={[styles.personName, { flex: 1 }]}>{u.name}</Text>
            <Text style={styles.personAmt}>{formatAud(u.spent)}</Text>
          </View>
        ))}
      </GlassPanel>

      {syncMessage ? <Text style={styles.sync}>{syncMessage}</Text> : null}
    </Screen>
  );
}

function prorateWeekly(amount: number, period: string): number {
  switch (period) {
    case 'weekly':
      return amount;
    case 'fortnightly':
      return amount / 2;
    case 'yearly':
      return amount / 52;
    case 'monthly':
    default:
      return (amount * 12) / 52;
  }
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'income' | 'expense';
}) {
  return (
    <GlassPanel style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <AmountText value={formatAud(value)} tone={tone} size="md" />
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
  },
  kicker: { color: Palette.cyan, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: Palette.text, fontFamily: Fonts.display, fontSize: 28, fontWeight: '800' },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.panelElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTxt: { color: Palette.cyan, fontSize: 24, fontWeight: '700' },
  weekLabel: { color: Palette.text, fontWeight: '700' },
  weekHint: { color: Palette.textDim, fontSize: 11, marginTop: 2 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  kpi: { width: '48%', flexGrow: 1 },
  kpiLabel: { color: Palette.textMuted, fontSize: 12, marginBottom: 6 },
  marketCard: { marginBottom: Spacing.md, gap: 4 },
  marketHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  marketIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    backgroundColor: 'rgba(61,231,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketTitle: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '800', fontSize: 16 },
  marketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.stroke,
  },
  marketPrice: { color: Palette.cyan, fontWeight: '800' },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.stroke,
  },
  personName: { color: Palette.text, fontWeight: '600', textTransform: 'capitalize' },
  personAmt: { color: FinanceColors.expense, fontWeight: '700' },
  empty: { color: Palette.textMuted },
  sync: { color: Palette.textDim, fontSize: 11, marginTop: Spacing.md, textAlign: 'center' },
});
