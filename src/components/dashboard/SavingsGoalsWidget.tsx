import { StyleSheet, Text, View } from 'react-native';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import { projectSavings } from '@/lib/savings/simulate';
import type { PeriodStats } from '@/hooks/use-period-stats';

export function SavingsGoalsWidget({ stats }: { stats: PeriodStats }) {
  return (
    <CollapsibleWidget
      accent={Palette.amber}
      header={<WidgetTitle icon="wallet-outline" title="Savings Goals" iconColor={Palette.amber} />}
      collapsedSummary={
        <Text style={styles.summary}>
          {stats.goals.length} goals · {formatAud(stats.totalSavingsAccumulated)} saved
        </Text>
      }>
      {stats.goals.length === 0 ? (
        <Text style={styles.empty}>No savings goals yet.</Text>
      ) : (
        stats.goals.map((goal) => {
          const progress = goal.target_aud > 0 ? Math.min(1, goal.current_aud / goal.target_aud) : 0;
          const color = goal.color || Palette.amber;
          let daysLeft: number | null = null;
          if (goal.deadline) {
            try {
              daysLeft = Math.max(
                0,
                differenceInCalendarDays(parseISO(`${goal.deadline}T12:00:00`), new Date())
              );
            } catch {
              daysLeft = null;
            }
          } else {
            const proj = projectSavings({
              target: goal.target_aud,
              current: goal.current_aud,
              contribution: goal.contribution_aud,
              frequency: goal.contribution_frequency,
              yieldMode: goal.yield_mode,
              annualRate: goal.annual_rate,
            });
            if (proj.reached) daysLeft = 0;
            else if (proj.weeks > 0) daysLeft = Math.round(proj.weeks * 7);
          }

          return (
            <View key={goal.id} style={styles.goal}>
              <Text style={styles.name}>{goal.name}</Text>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${Math.max(2, progress * 100)}%`, backgroundColor: color },
                  ]}
                />
              </View>
              <View style={styles.meta}>
                <Text style={styles.amounts}>
                  {formatAud(goal.current_aud)} of {formatAud(goal.target_aud)}
                </Text>
                {daysLeft != null ? (
                  <View style={styles.days}>
                    <Ionicons name="time-outline" size={12} color={Palette.textDim} />
                    <Text style={styles.daysText}>
                      {daysLeft === 0 ? 'Reached' : `${daysLeft} days remaining`}
                    </Text>
                  </View>
                ) : null}
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
  empty: { color: Palette.textMuted },
  goal: { gap: 8, marginBottom: Spacing.xs },
  name: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '700', fontSize: 14 },
  track: {
    height: 10,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: Radii.pill },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  amounts: { color: Palette.textMuted, fontSize: 12, flexShrink: 1 },
  days: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  daysText: { color: Palette.textDim, fontSize: 11 },
});
