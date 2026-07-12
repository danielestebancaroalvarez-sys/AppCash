import { StyleSheet, Text, View } from 'react-native';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { UserAvatar } from '@/components/ui/UserAvatar';
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
      <Text style={styles.legend}>Dark bar = extra spend · Light = planned / fixed</Text>
      {stats.byUser.map((u) => {
        const pct = Math.round((u.spent / total) * 1000) / 10;
        const plannedPct = u.spent > 0 ? (u.planned / u.spent) * 100 : 0;
        const extraPct = u.spent > 0 ? (u.extra / u.spent) * 100 : 0;
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
              <View style={[styles.fillLight, { width: `${plannedPct}%` }]} />
              <View style={[styles.fillDark, { width: `${extraPct}%` }]} />
            </View>
            {u.categories.length ? (
              <View style={styles.cats}>
                {u.categories.map((c) => (
                  <Text key={c.label} style={styles.catChip}>
                    · {c.label} {formatAud(c.value)}
                  </Text>
                ))}
              </View>
            ) : null}
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
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  fillLight: { height: '100%', backgroundColor: 'rgba(139,124,255,0.45)' },
  fillDark: { height: '100%', backgroundColor: Palette.violet },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  catChip: { color: Palette.textMuted, fontSize: 11 },
});
