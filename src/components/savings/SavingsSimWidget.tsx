import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { SavingsProjectionChart } from '@/components/charts/SavingsChart';
import { SectionAccents, savingsKindMeta } from '@/constants/savings';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import {
  extraMonthlyToFrequency,
  formatDuration,
  projectSavings,
  toMonthly,
} from '@/lib/savings/simulate';
import type { SavingsGoal } from '@/types/models';

type Props = {
  goals: SavingsGoal[];
  selectedGoalId: string | null;
  onSelectGoal: (id: string) => void;
};

/**
 * Standalone savings simulation widget — pick a goal, see ETA + curve, what-if slider.
 */
export function SavingsSimWidget({ goals, selectedGoalId, onSelectGoal }: Props) {
  const [extraMonthly, setExtraMonthly] = useState(0);

  const goal = goals.find((g) => g.id === selectedGoalId) ?? goals[0] ?? null;
  const accent = goal ? goal.color || savingsKindMeta(goal.kind).color : SectionAccents.simulate;

  const baseMonthly = goal ? toMonthly(goal.contribution_aud, goal.contribution_frequency) : 0;

  const baseProjection = useMemo(() => {
    if (!goal) return null;
    return projectSavings({
      current: goal.current_aud,
      target: goal.target_aud,
      contribution: goal.contribution_aud,
      frequency: goal.contribution_frequency,
      yieldMode: goal.yield_mode,
      annualRate: goal.annual_rate,
    });
  }, [goal]);

  const boostedProjection = useMemo(() => {
    if (!goal) return null;
    const bump = extraMonthlyToFrequency(extraMonthly, goal.contribution_frequency);
    return projectSavings({
      current: goal.current_aud,
      target: goal.target_aud,
      contribution: Math.max(0, goal.contribution_aud + bump),
      frequency: goal.contribution_frequency,
      yieldMode: goal.yield_mode,
      annualRate: goal.annual_rate,
    });
  }, [goal, extraMonthly]);

  const sliderMax = Math.max(200, Math.ceil(baseMonthly / 10) * 10 + 300);

  if (!goals.length || !goal || !baseProjection || !boostedProjection) {
    return (
      <CollapsibleWidget
        accent={SectionAccents.simulate}
        defaultExpanded
        header={
          <>
            <Ionicons name="analytics-outline" size={20} color={SectionAccents.simulate} />
            <Text style={[styles.title, { color: SectionAccents.simulate }]}>Simulation</Text>
          </>
        }>
        <Text style={styles.empty}>Create a savings goal to unlock projections.</Text>
      </CollapsibleWidget>
    );
  }

  const monthsSaved =
    Number.isFinite(baseProjection.months) && Number.isFinite(boostedProjection.months)
      ? Math.max(0, baseProjection.months - boostedProjection.months)
      : 0;

  return (
    <CollapsibleWidget
      accent={accent}
      defaultExpanded
      header={
        <>
          <Ionicons name="analytics-outline" size={20} color={accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: accent }]}>Simulation</Text>
            <Text style={styles.hint}>What-if planner</Text>
          </View>
        </>
      }
      collapsedSummary={
        <Text style={styles.collapsedHint}>
          {goal.name} ·{' '}
          {Number.isFinite(baseProjection.months)
            ? formatDuration(baseProjection.months)
            : 'set contribution'}
        </Text>
      }>
      <Text style={styles.hintFull}>Does not change your real contributions</Text>

      <Text style={styles.pickLabel}>Goal</Text>
      <View style={styles.chips}>
        {goals.map((g) => {
          const on = g.id === goal.id;
          const c = g.color || savingsKindMeta(g.kind).color;
          return (
            <Pressable
              key={g.id}
              onPress={() => {
                onSelectGoal(g.id);
                setExtraMonthly(0);
              }}
              style={[styles.chip, on && { backgroundColor: c, borderColor: c }]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                {g.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Base plan</Text>
          <Text style={styles.statValue}>
            {Number.isFinite(baseProjection.months)
              ? formatDuration(baseProjection.months)
              : 'Set contribution'}
          </Text>
          {Number.isFinite(baseProjection.months) ? (
            <Text style={styles.statSub}>{baseProjection.arriveLabel}</Text>
          ) : null}
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>With boost</Text>
          <Text style={[styles.statValue, { color: accent }]}>
            {Number.isFinite(boostedProjection.months)
              ? formatDuration(boostedProjection.months)
              : '—'}
          </Text>
          {Number.isFinite(boostedProjection.months) ? (
            <Text style={styles.statSub}>{boostedProjection.arriveLabel}</Text>
          ) : null}
        </View>
      </View>

      <Text style={styles.planLine}>
        Plan {formatAud(goal.contribution_aud)}/{goal.contribution_frequency}
        {' · '}
        {formatAud(boostedProjection.monthlyEquivalent)}/mo equivalent
      </Text>

      <SavingsProjectionChart
        points={boostedProjection.points}
        accent={accent}
        target={goal.target_aud}
      />

      <Text style={styles.sliderLabel}>What if you add more per month?</Text>
      <Text style={[styles.sliderValue, { color: accent }]}>
        +{formatAud(extraMonthly)}/mo
        {monthsSaved > 0 ? ` · saves ~${formatDuration(monthsSaved)}` : ''}
      </Text>
      <Slider
        minimumValue={0}
        maximumValue={sliderMax}
        step={10}
        value={extraMonthly}
        onValueChange={setExtraMonthly}
        minimumTrackTintColor={accent}
        maximumTrackTintColor={Palette.stroke}
        thumbTintColor={accent}
      />
      <View style={styles.sliderEnds}>
        <Text style={styles.axis}>+$0</Text>
        <Text style={styles.axis}>+{formatAud(sliderMax)}</Text>
      </View>
    </CollapsibleWidget>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: Fonts.display, fontWeight: '800', fontSize: 16 },
  hint: { color: Palette.textDim, fontSize: 11, marginTop: 1 },
  hintFull: { color: Palette.textDim, fontSize: 12 },
  empty: { color: Palette.textMuted, fontSize: 13 },
  collapsedHint: { color: Palette.textMuted, fontSize: 13, fontWeight: '600' },
  pickLabel: { color: Palette.textMuted, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Palette.stroke,
    backgroundColor: Palette.panelElevated,
    maxWidth: '100%',
  },
  chipText: { color: Palette.textMuted, fontWeight: '600', fontSize: 12 },
  chipTextOn: { color: Palette.void },
  stats: { flexDirection: 'row', gap: 10, marginTop: 4 },
  stat: {
    flex: 1,
    backgroundColor: Palette.panelElevated,
    borderRadius: Radii.md,
    padding: 10,
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  statLabel: { color: Palette.textDim, fontSize: 11, marginBottom: 4 },
  statValue: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '800', fontSize: 16 },
  statSub: { color: Palette.textMuted, fontSize: 11, marginTop: 2 },
  planLine: { color: Palette.textDim, fontSize: 12 },
  sliderLabel: { color: Palette.textMuted, fontSize: 12, marginTop: 6 },
  sliderValue: { fontWeight: '800', fontSize: 14 },
  sliderEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  axis: { color: Palette.textDim, fontSize: 11 },
});
