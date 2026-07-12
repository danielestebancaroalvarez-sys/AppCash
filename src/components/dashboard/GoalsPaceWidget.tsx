import { StyleSheet, Text, View } from 'react-native';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { Fonts, Palette, Radii } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import { projectSavings, toMonthly } from '@/lib/savings/simulate';
import type { PeriodStats } from '@/hooks/use-period-stats';

export function GoalsPaceWidget({ stats }: { stats: PeriodStats }) {
  return (
    <CollapsibleWidget
      accent={Palette.mint}
      header={<WidgetTitle icon="speedometer-outline" title="Goals Pace" iconColor={Palette.mint} />}
      collapsedSummary={
        <Text style={styles.summary}>{stats.goals.length} goals tracked</Text>
      }>
      {stats.goals.length === 0 ? (
        <Text style={styles.empty}>Create a savings goal to track pace.</Text>
      ) : (
        stats.goals.map((goal) => {
          const proj = projectSavings({
            target: goal.target_aud,
            current: goal.current_aud,
            contribution: goal.contribution_aud,
            frequency: goal.contribution_frequency,
            yieldMode: goal.yield_mode,
            annualRate: goal.annual_rate,
          });
          const monthly = toMonthly(goal.contribution_aud, goal.contribution_frequency);
          const pct = goal.target_aud > 0 ? Math.round((goal.current_aud / goal.target_aud) * 100) : 0;
          const status = proj.reached
            ? 'Reached'
            : monthly <= 0
              ? 'No plan'
              : proj.months <= 24
                ? 'On track'
                : 'Behind';
          const tone =
            status === 'Reached' || status === 'On track'
              ? Palette.teal
              : status === 'Behind'
                ? Palette.coral
                : Palette.textMuted;

          return (
            <View key={goal.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{goal.name}</Text>
                <Text style={styles.meta}>
                  {pct}% · {formatAud(monthly)}/mo plan
                  {proj.arriveLabel ? ` · ~${proj.arriveLabel}` : ''}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: `${tone}22` }]}>
                <Text style={[styles.badgeText, { color: tone }]}>{status}</Text>
              </View>
            </View>
          );
        })
      )}
    </CollapsibleWidget>
  );
}

const styles = StyleSheet.create({
  summary: { color: Palette.textDim, fontSize: 12 },
  empty: { color: Palette.textMuted, fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.stroke,
  },
  name: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '700' },
  meta: { color: Palette.textDim, fontSize: 11, marginTop: 2 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
