import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { AppModal } from '@/components/ui/AppModal';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { SavingsSimWidget } from '@/components/savings/SavingsSimWidget';
import { resolveSavingsCardColor, SectionAccents, savingsKindMeta } from '@/constants/savings';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { UiImages } from '@/constants/ui-images';
import { useFinanceStore } from '@/stores/finance-store';
import { useSheetRefresh } from '@/hooks/use-sheet-refresh';
import { formatAud, parseAmount } from '@/lib/money';
import { createId } from '@/lib/id';
import { nowIso, todayIsoDate } from '@/lib/dates';
import { deleteSavingsGoal, upsertSavingsGoal, upsertTransaction } from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';
import { projectSavings } from '@/lib/savings/simulate';
import type { SavingsGoal } from '@/types/models';

export default function SavingsScreen() {
  const router = useRouter();
  const goals = useFinanceStore((s) => s.savingsGoals);
  const categories = useFinanceStore((s) => s.categories);
  const refresh = useFinanceStore((s) => s.refresh);
  const { alert, confirm, Dialog } = useAppDialog();
  const { refreshing, onRefresh } = useSheetRefresh();

  const [focusGoalId, setFocusGoalId] = useState<string | null>(null);
  const [contributeGoal, setContributeGoal] = useState<SavingsGoal | null>(null);
  const [contributeAmt, setContributeAmt] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedSimGoalId = focusGoalId ?? goals[0]?.id ?? null;

  const addContribution = async () => {
    if (!contributeGoal) return;
    const amount = parseAmount(contributeAmt);
    if (!amount) {
      alert('Amount needed', 'Enter how much you contributed.');
      return;
    }
    setBusy(true);
    try {
      const updated: SavingsGoal = {
        ...contributeGoal,
        current_aud: contributeGoal.current_aud + amount,
        updated_at: nowIso(),
      };
      await upsertSavingsGoal(updated);
      await queueMutation('savings_goals', updated);

      const savingsCat = categories.find((c) => c.type === 'savings') ?? categories[0];
      if (savingsCat) {
        const tx = {
          id: createId(),
          user_id: contributeGoal.user_id,
          type: 'savings_contrib' as const,
          category_id: savingsCat.id,
          amount_aud: amount,
          date: todayIsoDate(),
          note: `Contribution to ${contributeGoal.name}`,
          merchant: 'Savings',
          receipt_id: '',
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        await upsertTransaction(tx);
        await queueMutation('transactions', tx);
      }
      setContributeGoal(null);
      setContributeAmt('');
      setFocusGoalId(updated.id);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const removeGoal = (goal: SavingsGoal) => {
    confirm(
      `Delete “${goal.name}”?`,
      'This removes the goal from the phone and next Sheets sync.',
      async () => {
        await deleteSavingsGoal(goal.id);
        await queueMutation('savings_goals', { id: goal.id, deleted: true });
        if (focusGoalId === goal.id) setFocusGoalId(null);
        await refresh();
      },
      { confirmLabel: 'Delete', tone: 'danger' }
    );
  };

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Household</Text>
          <Text style={styles.title}>Savings</Text>
          <Text style={styles.sub}>Goals & progress · pull to sync Sheet</Text>
        </View>
        <Pressable
          onPress={() => router.push('/savings/edit' as never)}
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}>
          <Ionicons name="add" size={28} color={Palette.void} />
        </Pressable>
      </View>

      {!goals.length ? (
        <EmptyState
          illustration={UiImages.emptySavings}
          icon="wallet-outline"
          title="No goals yet"
          body="Create your first savings goal — vacation, house, emergency…"
          actionLabel="New goal"
          onAction={() => router.push('/savings/edit' as never)}
        />
      ) : (
        <>
          {(() => {
            const used = new Set<string>();
            return goals.map((goal, index) => {
              const accent = resolveSavingsCardColor(goal, index, used);
              return (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  accent={accent}
                  focused={focusGoalId === goal.id}
                  onFocus={() => setFocusGoalId(goal.id)}
                  onContribute={() => {
                    setContributeGoal(goal);
                    setContributeAmt('');
                    setFocusGoalId(goal.id);
                  }}
                  onEdit={() =>
                    router.push({ pathname: '/savings/edit' as never, params: { id: goal.id } })
                  }
                  onDelete={() => removeGoal(goal)}
                />
              );
            });
          })()}

          <Text style={styles.sectionLabel}>Simulation</Text>
          <SavingsSimWidget
            goals={goals}
            selectedGoalId={selectedSimGoalId}
            onSelectGoal={setFocusGoalId}
          />
        </>
      )}

      <AppModal
        visible={Boolean(contributeGoal)}
        title="Record contribution"
        message={contributeGoal ? `Add money toward “${contributeGoal.name}”.` : undefined}
        confirmLabel={busy ? 'Saving…' : 'Add'}
        cancelLabel="Cancel"
        tone="accent"
        confirmDisabled={busy}
        onCancel={() => setContributeGoal(null)}
        onRequestClose={() => setContributeGoal(null)}
        onConfirm={addContribution}>
        <TextInput
          value={contributeAmt}
          onChangeText={setContributeAmt}
          keyboardType="decimal-pad"
          placeholder="Amount AUD"
          placeholderTextColor={Palette.textDim}
          style={styles.input}
          autoFocus
        />
      </AppModal>

      {Dialog}
    </Screen>
  );
}

function GoalCard({
  goal,
  accent,
  focused,
  onFocus,
  onContribute,
  onEdit,
  onDelete,
}: {
  goal: SavingsGoal;
  accent: string;
  focused: boolean;
  onFocus: () => void;
  onContribute: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = savingsKindMeta(goal.kind, goal.icon);
  const progress = Math.min(1, goal.current_aud / Math.max(goal.target_aud, 1));
  const pct = Math.round(progress * 100);

  const eta = useMemo(
    () =>
      projectSavings({
        current: goal.current_aud,
        target: goal.target_aud,
        contribution: goal.contribution_aud,
        frequency: goal.contribution_frequency,
        yieldMode: goal.yield_mode,
        annualRate: goal.annual_rate,
      }),
    [goal]
  );

  return (
    <CollapsibleWidget
      accent={accent}
      defaultExpanded
      style={focused ? { borderColor: accent, backgroundColor: `${accent}12` } : undefined}
      onHeaderPress={onFocus}
      header={
        <>
          <View style={[styles.iconBubble, { backgroundColor: `${accent}28` }]}>
            <Ionicons name={meta.ion} size={22} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.goalName}>{goal.name}</Text>
            <View style={styles.badgeRow}>
              {goal.reminder ? (
                <View style={[styles.badge, { backgroundColor: `${accent}22` }]}>
                  <Ionicons name="notifications-outline" size={12} color={accent} />
                  <Text style={[styles.badgeText, { color: accent }]}>Reminder</Text>
                </View>
              ) : null}
              <Text style={[styles.metaTiny, { color: `${accent}CC` }]}>{meta.label}</Text>
            </View>
          </View>
        </>
      }
      headerActions={
        <>
          <Pressable onPress={onEdit} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="pencil-outline" size={18} color={accent} />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={18} color={accent} />
          </Pressable>
        </>
      }
      collapsedSummary={
        <View style={styles.collapsedRow}>
          <Text style={styles.collapsedAmt}>
            {formatAud(goal.current_aud)}
            <Text style={styles.amountsOf}> / {formatAud(goal.target_aud)}</Text>
          </Text>
          <Text style={[styles.pct, { color: accent }]}>{pct}%</Text>
        </View>
      }>
      <Text style={styles.amounts}>
        {formatAud(goal.current_aud)}
        <Text style={styles.amountsOf}> of {formatAud(goal.target_aud)}</Text>
      </Text>

      <View style={[styles.track, { backgroundColor: `${accent}22` }]}>
        <View style={[styles.fill, { width: `${pct}%` as `${number}%`, backgroundColor: accent }]} />
      </View>
      <Text style={[styles.pct, { color: accent }]}>{pct}% complete</Text>

      {Number.isFinite(eta.months) && eta.months > 0 ? (
        <View style={[styles.etaBox, { backgroundColor: `${accent}18`, borderColor: `${accent}55` }]}>
          <Ionicons name="time-outline" size={20} color={accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.etaLabel, { color: accent }]}>Estimated arrival</Text>
            <Text style={styles.etaText}>{eta.arriveLabel}</Text>
          </View>
        </View>
      ) : eta.reached ? (
        <View style={[styles.etaBox, { backgroundColor: `${accent}18`, borderColor: `${accent}55` }]}>
          <Ionicons name="checkmark-circle" size={20} color={accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.etaLabel, { color: accent }]}>Status</Text>
            <Text style={styles.etaText}>Goal reached</Text>
          </View>
        </View>
      ) : null}

      <Text style={[styles.contribMeta, { color: `${accent}BB` }]}>
        {formatAud(goal.contribution_aud)} {goal.contribution_frequency}
        {goal.reminder ? ' · reminder on' : ''}
      </Text>

      <Pressable
        onPress={onContribute}
        style={({ pressed }) => [
          styles.contributeBtn,
          { backgroundColor: accent },
          pressed && { opacity: 0.9 },
        ]}>
        <Ionicons name="add" size={18} color={Palette.void} />
        <Text style={styles.contributeLabel}>Record real contribution</Text>
      </Pressable>
    </CollapsibleWidget>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  kicker: {
    color: Palette.cyan,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  title: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontSize: 30,
    fontWeight: '800',
  },
  sub: { color: Palette.textMuted, marginTop: 2, fontSize: 13 },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Palette.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    color: SectionAccents.simulate,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    backgroundColor: Palette.panel,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  emptyTitle: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '800', fontSize: 18 },
  emptySub: { color: Palette.textMuted, textAlign: 'center', marginBottom: Spacing.sm },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalName: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 18,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radii.pill,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  metaTiny: { fontSize: 11, fontWeight: '600' },
  iconBtn: { padding: 6 },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapsedAmt: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '700',
    fontSize: 14,
  },
  amounts: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 18,
  },
  amountsOf: { color: Palette.textMuted, fontWeight: '600', fontSize: 14 },
  track: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 999 },
  pct: { fontSize: 12, fontWeight: '700' },
  etaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  etaLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  etaText: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 16,
  },
  contribMeta: { fontSize: 12, fontWeight: '600' },
  contributeBtn: {
    height: 48,
    borderRadius: Radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  contributeLabel: {
    color: Palette.void,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: Palette.text,
    backgroundColor: Palette.panelElevated,
    fontSize: 16,
    marginTop: Spacing.sm,
  },
});
