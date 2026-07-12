import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { AmountText, GlassPanel, PrimaryButton, SectionTitle } from '@/components/ui/Primitives';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { ProgressRing } from '@/components/charts/FinanceCharts';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { formatAud, parseAmount } from '@/lib/money';
import { createId } from '@/lib/id';
import { nowIso, todayIsoDate } from '@/lib/dates';
import { upsertSavingsGoal, upsertSavingsSim, upsertTransaction } from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';

export default function SavingsScreen() {
  const goals = useFinanceStore((s) => s.savingsGoals);
  const activeUserId = useFinanceStore((s) => s.activeUserId);
  const users = useFinanceStore((s) => s.users);
  const categories = useFinanceStore((s) => s.categories);
  const refresh = useFinanceStore((s) => s.refresh);
  const { alert, Dialog } = useAppDialog();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [weekly, setWeekly] = useState('100');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [contribute, setContribute] = useState('');

  const selected = goals.find((g) => g.id === (selectedGoalId || goals[0]?.id));

  const sim = useMemo(() => {
    if (!selected) return null;
    const remaining = Math.max(0, selected.target_aud - selected.current_aud);
    const w = parseAmount(weekly) || 1;
    const weeks = Math.ceil(remaining / w);
    return { remaining, weeks, w };
  }, [selected, weekly]);

  const createGoal = async () => {
    const user = activeUserId || users[0]?.id;
    const t = parseAmount(target);
    if (!name.trim() || !t || !user) return;
    const goal = {
      id: createId(),
      name: name.trim(),
      target_aud: t,
      current_aud: 0,
      deadline: '',
      user_id: user,
      updated_at: nowIso(),
    };
    await upsertSavingsGoal(goal);
    await queueMutation('savings_goals', goal);
    setName('');
    setTarget('');
    await refresh();
  };

  const runSim = async () => {
    if (!selected || !sim) return;
    const row = {
      id: createId(),
      goal_id: selected.id,
      weekly_amount: sim.w,
      result_weeks: sim.weeks,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await upsertSavingsSim(row);
    alert('Simulation', `At ${formatAud(sim.w)}/week you reach the goal in ~${sim.weeks} weeks.`);
  };

  const addContribution = async () => {
    if (!selected) return;
    const amount = parseAmount(contribute);
    if (!amount) return;
    const updated = {
      ...selected,
      current_aud: selected.current_aud + amount,
      updated_at: nowIso(),
    };
    await upsertSavingsGoal(updated);
    await queueMutation('savings_goals', updated);

    const savingsCat = categories.find((c) => c.type === 'savings') ?? categories[0];
    if (savingsCat) {
      const tx = {
        id: createId(),
        user_id: selected.user_id,
        type: 'savings_contrib' as const,
        category_id: savingsCat.id,
        amount_aud: amount,
        date: todayIsoDate(),
        note: `Contribution to ${selected.name}`,
        merchant: 'Savings',
        receipt_id: '',
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      await upsertTransaction(tx);
      await queueMutation('transactions', tx);
    }
    setContribute('');
    await refresh();
  };

  return (
    <Screen>
      <Text style={styles.title}>Savings plans</Text>
      <Text style={styles.sub}>Goals, contributions, and weekly projections.</Text>

      {selected ? (
        <GlassPanel glow style={{ alignItems: 'center', marginBottom: Spacing.md }}>
          <ProgressRing
            progress={selected.current_aud / Math.max(selected.target_aud, 1)}
            label={selected.name}
            sublabel={`${formatAud(selected.current_aud)} / ${formatAud(selected.target_aud)}`}
          />
        </GlassPanel>
      ) : null}

      <SectionTitle title="Your goals" />
      {goals.map((g) => (
        <GlassPanel
          key={g.id}
          onPress={() => setSelectedGoalId(g.id)}
          style={[styles.goal, selected?.id === g.id ? styles.goalOn : null]}>
          <Text style={styles.goalName}>{g.name}</Text>
          <AmountText value={formatAud(g.current_aud)} tone="accent" size="sm" />
        </GlassPanel>
      ))}

      <SectionTitle title="Simulator" subtitle="If I save this every week…" />
      <GlassPanel style={{ gap: Spacing.sm }}>
        <TextInput
          value={weekly}
          onChangeText={setWeekly}
          keyboardType="decimal-pad"
          placeholder="Weekly AUD"
          placeholderTextColor={Palette.textDim}
          style={styles.input}
        />
        {sim ? (
          <Text style={styles.simResult}>
            Remaining {formatAud(sim.remaining)} · ~{sim.weeks} weeks
          </Text>
        ) : null}
        <PrimaryButton label="Save simulation" onPress={runSim} />
      </GlassPanel>

      <SectionTitle title="Add contribution" />
      <GlassPanel style={{ gap: Spacing.sm }}>
        <TextInput
          value={contribute}
          onChangeText={setContribute}
          keyboardType="decimal-pad"
          placeholder="Amount AUD"
          placeholderTextColor={Palette.textDim}
          style={styles.input}
        />
        <PrimaryButton label="Record contribution" onPress={addContribution} />
      </GlassPanel>

      <SectionTitle title="New goal" />
      <GlassPanel style={{ gap: Spacing.sm }}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Goal name"
          placeholderTextColor={Palette.textDim}
          style={styles.input}
        />
        <TextInput
          value={target}
          onChangeText={setTarget}
          keyboardType="decimal-pad"
          placeholder="Target AUD"
          placeholderTextColor={Palette.textDim}
          style={styles.input}
        />
        <PrimaryButton label="Create goal" onPress={createGoal} variant="ghost" />
      </GlassPanel>
      {Dialog}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontSize: 28,
    fontWeight: '800',
  },
  sub: { color: Palette.textMuted, marginBottom: Spacing.md, marginTop: 4 },
  goal: { marginBottom: Spacing.sm, flexDirection: 'row', justifyContent: 'space-between' },
  goalOn: { borderColor: Palette.cyan },
  goalName: { color: Palette.text, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Palette.text,
    backgroundColor: Palette.panelElevated,
  },
  simResult: { color: Palette.teal, fontWeight: '700' },
});
