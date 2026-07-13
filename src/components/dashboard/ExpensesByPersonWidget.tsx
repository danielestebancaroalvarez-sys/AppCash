import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { categoryIonicon } from '@/constants/category-icons';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import type { PeriodStats } from '@/hooks/use-period-stats';

export function ExpensesByPersonWidget({ stats }: { stats: PeriodStats }) {
  const spentTotal = stats.byUser.reduce((a, u) => a + u.spent, 0);
  const total = spentTotal || 1;

  return (
    <CollapsibleWidget
      accent={Palette.violet}
      header={
        <WidgetTitle icon="people-outline" title="Expenses by Person" iconColor={Palette.violet} />
      }
      collapsedSummary={
        <Text style={styles.summary}>
          {stats.byUser.filter((u) => u.spent > 0).length} people · {formatAud(spentTotal)}
        </Text>
      }>
      <Text style={styles.legend}>Bar segments = category share (by colour)</Text>
      {stats.byUser.map((u) => {
        const pct = Math.round((u.spent / total) * 1000) / 10;
        const catTotal = u.categories.reduce((a, c) => a + c.value, 0) || u.spent || 1;
        return (
          <View key={u.id} style={styles.card}>
            <View style={styles.head}>
              <UserAvatar user={u.user} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{u.name}</Text>
                <Text style={styles.pct}>{pct}% of total</Text>
              </View>
              <Text style={styles.amt}>{formatAud(u.spent)}</Text>
            </View>

            <View style={styles.track}>
              {u.categories.length ? (
                u.categories.map((c) => (
                  <View
                    key={c.label}
                    style={[
                      styles.seg,
                      {
                        flex: Math.max(c.value, 0.01),
                        backgroundColor: c.color,
                        opacity: 0.9,
                      },
                    ]}
                  />
                ))
              ) : (
                <View style={[styles.seg, { flex: 1, backgroundColor: Palette.violet, opacity: 0.35 }]} />
              )}
            </View>

            {u.categories.length ? (
              <View style={styles.cats}>
                {u.categories.map((c) => {
                  const share = Math.round((c.value / catTotal) * 100);
                  return (
                    <View key={c.label} style={styles.catChip}>
                      <View style={[styles.catIcon, { backgroundColor: `${c.color}33` }]}>
                        <Ionicons name={categoryIonicon(c.icon)} size={12} color={c.color} />
                      </View>
                      <Text style={styles.catText} numberOfLines={1}>
                        {c.label}
                      </Text>
                      <Text style={[styles.catAmt, { color: c.color }]}>{formatAud(c.value)}</Text>
                      <Text style={styles.catPct}>{share}%</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyCats}>No expenses this period</Text>
            )}
          </View>
        );
      })}
    </CollapsibleWidget>
  );
}

const styles = StyleSheet.create({
  summary: { color: Palette.textDim, fontSize: 12 },
  legend: { color: Palette.textDim, fontSize: 11, marginBottom: 4 },
  card: {
    backgroundColor: Palette.panelElevated,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    gap: 8,
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '700', fontSize: 14 },
  pct: { color: Palette.textDim, fontSize: 11, marginTop: 2 },
  amt: { color: Palette.text, fontWeight: '800' },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  seg: { height: '100%' },
  cats: { gap: 6 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catText: { flex: 1, color: Palette.textMuted, fontSize: 12, fontWeight: '600' },
  catAmt: { fontSize: 12, fontWeight: '800' },
  catPct: { color: Palette.textDim, fontSize: 11, minWidth: 32, textAlign: 'right' },
  emptyCats: { color: Palette.textDim, fontSize: 11 },
});
