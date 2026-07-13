import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { Screen } from '@/components/ui/Screen';
import { PrimaryButton } from '@/components/ui/Primitives';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { SavingsProjectionChart } from '@/components/charts/SavingsChart';
import { CATEGORY_ICON_OPTIONS } from '@/constants/category-icons';
import { SAVINGS_KINDS, SectionAccents, savingsKindMeta } from '@/constants/savings';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { createId } from '@/lib/id';
import { formatDisplayDate, nowIso } from '@/lib/dates';
import { formatAud, parseAmount } from '@/lib/money';
import { upsertSavingsGoal } from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';
import {
  formatDuration,
  projectSavings,
  requiredContribution,
} from '@/lib/savings/simulate';
import type {
  ContributionFrequency,
  SavingsGoal,
  SavingsGoalKind,
  SavingsPlanMode,
  SavingsYieldMode,
} from '@/types/models';

export default function SavingsEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const goals = useFinanceStore((s) => s.savingsGoals);
  const users = useFinanceStore((s) => s.users);
  const activeUserId = useFinanceStore((s) => s.activeUserId);
  const refresh = useFinanceStore((s) => s.refresh);
  const { alert, Dialog } = useAppDialog();

  const existing = goals.find((g) => g.id === id);
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<SavingsGoalKind>(
    existing?.kind === 'other' ? 'custom' : existing?.kind ?? 'emergency'
  );
  const [customIcon, setCustomIcon] = useState(existing?.icon || 'trophy');
  const [target, setTarget] = useState(existing ? String(existing.target_aud) : '');
  const [current, setCurrent] = useState(existing ? String(existing.current_aud) : '0');
  const [planMode, setPlanMode] = useState<SavingsPlanMode>(existing?.plan_mode ?? 'contribution');
  const [contribution, setContribution] = useState(
    existing ? String(existing.contribution_aud || '') : ''
  );
  const [frequency, setFrequency] = useState<ContributionFrequency>(
    existing?.contribution_frequency ?? 'monthly'
  );
  const [deadline, setDeadline] = useState(existing?.deadline || '');
  const [showDate, setShowDate] = useState(false);
  const [yieldMode, setYieldMode] = useState<SavingsYieldMode>(existing?.yield_mode ?? 'none');
  const [annualRate, setAnnualRate] = useState(
    existing?.annual_rate ? String(existing.annual_rate * 100) : '5'
  );
  const [reminder, setReminder] = useState(existing?.reminder ?? true);
  const [busy, setBusy] = useState(false);

  const kindMeta = savingsKindMeta(kind, customIcon);
  const targetN = parseAmount(target);
  const currentN = parseAmount(current) || 0;
  const contribN = parseAmount(contribution) || 0;
  const rateN = (parseAmount(annualRate) || 0) / 100;

  const effectiveContribution = useMemo(() => {
    if (planMode === 'deadline' && deadline && targetN) {
      return requiredContribution({
        current: currentN,
        target: targetN,
        deadlineIso: deadline,
        frequency,
      });
    }
    return contribN;
  }, [planMode, deadline, targetN, currentN, frequency, contribN]);

  const projection = useMemo(() => {
    if (!targetN) return null;
    return projectSavings({
      current: currentN,
      target: targetN,
      contribution: effectiveContribution,
      frequency,
      yieldMode,
      annualRate: rateN,
    });
  }, [targetN, currentN, effectiveContribution, frequency, yieldMode, rateN]);

  const save = async () => {
    const user = activeUserId || users[0]?.id;
    if (!name.trim() || !targetN || !user) {
      alert('Missing fields', 'Add a name and target amount.');
      return;
    }
    if (planMode === 'contribution' && !contribN) {
      alert('Contribution needed', 'Enter how much you can contribute each period.');
      return;
    }
    if (planMode === 'deadline' && !deadline) {
      alert('Deadline needed', 'Pick a target date for this goal.');
      return;
    }

    setBusy(true);
    try {
      const goal: SavingsGoal = {
        id: existing?.id ?? createId(),
        name: name.trim(),
        target_aud: targetN,
        current_aud: currentN,
        deadline: planMode === 'deadline' ? deadline : projection?.arriveDate || '',
        user_id: user,
        updated_at: nowIso(),
        kind,
        color: kind === 'custom' ? Palette.cyan : kindMeta.color,
        icon: kind === 'custom' ? customIcon : '',
        plan_mode: planMode,
        contribution_aud:
          planMode === 'deadline' ? Math.round(effectiveContribution * 100) / 100 : contribN,
        contribution_frequency: frequency,
        yield_mode: yieldMode,
        annual_rate: yieldMode === 'yield' ? rateN : 0,
        reminder,
      };
      await upsertSavingsGoal(goal);
      await queueMutation('savings_goals', goal);
      await refresh();
      router.back();
    } catch (e) {
      alert('Error', e instanceof Error ? e.message : 'Could not save goal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen tabAware={false}>
      <Text style={styles.title}>{existing ? 'Edit savings goal' : 'New savings goal'}</Text>

      <Section accent={SectionAccents.formName} title="Goal name" hint="What are you saving for?">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Vacation, Emergency fund"
          placeholderTextColor={Palette.textDim}
          style={styles.input}
        />
      </Section>

      <Section accent={SectionAccents.formKinds} title="Category" hint="Swipe for more · Custom picks any icon">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kindRow}>
          {SAVINGS_KINDS.map((k) => {
            const on = kind === k.id;
            return (
              <Pressable
                key={k.id}
                onPress={() => setKind(k.id)}
                style={[
                  styles.kindCard,
                  on && { borderColor: k.color, backgroundColor: `${k.color}22` },
                ]}>
                <View style={[styles.kindIcon, { backgroundColor: `${k.color}33` }]}>
                  <Ionicons name={k.ion} size={18} color={k.color} />
                </View>
                <Text style={[styles.kindLabel, on && { color: Palette.text }]} numberOfLines={1}>
                  {k.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {kind === 'custom' ? (
          <>
            <Text style={styles.fieldLabel}>Custom icon</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.iconRow}>
              {CATEGORY_ICON_OPTIONS.map((opt) => {
                const on = customIcon === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setCustomIcon(opt.id)}
                    style={[
                      styles.iconPick,
                      on && { borderColor: Palette.cyan, backgroundColor: `${Palette.cyan}22` },
                    ]}>
                    <Ionicons
                      name={opt.ion}
                      size={20}
                      color={on ? Palette.cyan : Palette.textMuted}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}
      </Section>

      <Section accent={SectionAccents.formMoney} title="Amounts" hint="Target and what you already have">
        <Text style={styles.fieldLabel}>Target</Text>
        <TextInput
          value={target}
          onChangeText={setTarget}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={Palette.textDim}
          style={styles.input}
        />
        <Text style={styles.fieldLabel}>Already saved</Text>
        <TextInput
          value={current}
          onChangeText={setCurrent}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={Palette.textDim}
          style={styles.input}
        />
      </Section>

      <Section accent={SectionAccents.formPlan} title="How do you want to plan?">
        <View style={styles.seg}>
          <Pressable
            onPress={() => setPlanMode('contribution')}
            style={[styles.segBtn, planMode === 'contribution' && styles.segBtnOnAmber]}>
            <Text style={[styles.segTitle, planMode === 'contribution' && styles.segTitleOn]}>
              I know my contribution
            </Text>
            <Text style={styles.segSub}>We calculate when you arrive</Text>
          </Pressable>
          <Pressable
            onPress={() => setPlanMode('deadline')}
            style={[styles.segBtn, planMode === 'deadline' && styles.segBtnOnAmber]}>
            <Text style={[styles.segTitle, planMode === 'deadline' && styles.segTitleOn]}>
              I have a deadline
            </Text>
            <Text style={styles.segSub}>We calculate the needed amount</Text>
          </Pressable>
        </View>

        {planMode === 'contribution' ? (
          <>
            <Text style={styles.fieldLabel}>Periodic contribution</Text>
            <TextInput
              value={contribution}
              onChangeText={setContribution}
              keyboardType="decimal-pad"
              placeholder="How much can you put aside?"
              placeholderTextColor={Palette.textDim}
              style={styles.input}
            />
          </>
        ) : (
          <>
            <Text style={styles.fieldLabel}>Deadline</Text>
            <Pressable style={styles.dateBtn} onPress={() => setShowDate(true)}>
              <Text style={styles.dateValue}>
                {deadline ? formatDisplayDate(deadline) : 'Pick a date'}
              </Text>
            </Pressable>
            {showDate ? (
              <DateTimePicker
                value={deadline ? parseISO(`${deadline}T12:00:00`) : new Date()}
                mode="date"
                minimumDate={new Date()}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                themeVariant="dark"
                onChange={(_e, d) => {
                  if (Platform.OS === 'android') setShowDate(false);
                  if (d) setDeadline(format(d, 'yyyy-MM-dd'));
                }}
              />
            ) : null}
            {Platform.OS === 'ios' && showDate ? (
              <PrimaryButton label="Done" variant="ghost" onPress={() => setShowDate(false)} />
            ) : null}
            {effectiveContribution > 0 ? (
              <Text style={styles.hintCalc}>
                Needed ~{formatAud(effectiveContribution)} / {frequency}
              </Text>
            ) : null}
          </>
        )}

        <Text style={styles.fieldLabel}>Frequency</Text>
        <View style={styles.row}>
          {(['weekly', 'fortnightly', 'monthly'] as ContributionFrequency[]).map((f) => (
            <Pressable key={f} onPress={() => setFrequency(f)}>
              <Text style={[styles.chip, frequency === f && styles.chipOn]}>{f}</Text>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section accent={SectionAccents.formYield} title="Growth">
        <View style={styles.seg}>
          <Pressable
            onPress={() => setYieldMode('none')}
            style={[styles.segBtn, yieldMode === 'none' && styles.segBtnOnViolet]}>
            <Text style={[styles.segTitle, yieldMode === 'none' && styles.segTitleOn]}>No interest</Text>
            <Text style={styles.segSub}>Cash under the mattress</Text>
          </Pressable>
          <Pressable
            onPress={() => setYieldMode('yield')}
            style={[styles.segBtn, yieldMode === 'yield' && styles.segBtnOnViolet]}>
            <Text style={[styles.segTitle, yieldMode === 'yield' && styles.segTitleOn]}>With returns</Text>
            <Text style={styles.segSub}>Simple annual yield</Text>
          </Pressable>
        </View>
        {yieldMode === 'yield' ? (
          <>
            <Text style={styles.fieldLabel}>Annual rate %</Text>
            <TextInput
              value={annualRate}
              onChangeText={setAnnualRate}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholderTextColor={Palette.textDim}
            />
          </>
        ) : null}
        <View style={styles.switchRow}>
          <Text style={styles.fieldLabel}>Contribution reminder</Text>
          <Switch value={reminder} onValueChange={setReminder} trackColor={{ true: Palette.cyan }} />
        </View>
      </Section>

      <Section accent={SectionAccents.simulate} title="Simulation" hint="Live preview">
        {projection && Number.isFinite(projection.months) ? (
          <>
            <Text style={styles.simLine}>
              ETA {formatDuration(projection.months)} · ~{projection.arriveLabel}
            </Text>
            <Text style={styles.simSub}>
              {formatAud(projection.monthlyEquivalent)}/mo equivalent · remaining{' '}
              {formatAud(projection.remaining)}
            </Text>
            <SavingsProjectionChart
              points={projection.points}
              accent={kindMeta.color}
              target={targetN}
            />
          </>
        ) : (
          <Text style={styles.simSub}>Enter a target amount to see the simulation.</Text>
        )}
      </Section>

      <View style={styles.actions}>
        <PrimaryButton label="Cancel" variant="ghost" onPress={() => router.back()} />
        <PrimaryButton label={busy ? 'Saving…' : existing ? 'Save' : 'Create goal'} onPress={save} disabled={busy} />
      </View>
      {Dialog}
    </Screen>
  );
}

function Section({
  title,
  hint,
  accent,
  children,
}: {
  title: string;
  hint?: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <View style={[styles.section, { borderColor: `${accent}55` }]}>
      <View style={[styles.sectionBar, { backgroundColor: accent }]} />
      <View style={styles.sectionBody}>
        <Text style={[styles.sectionTitle, { color: accent }]}>{title}</Text>
        {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
        <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: Spacing.md,
  },
  section: {
    flexDirection: 'row',
    backgroundColor: Palette.panel,
    borderRadius: Radii.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  sectionBar: { width: 4 },
  sectionBody: { flex: 1, padding: Spacing.md },
  sectionTitle: { fontFamily: Fonts.display, fontWeight: '800', fontSize: 15 },
  sectionHint: { color: Palette.textDim, fontSize: 12, marginTop: 2 },
  fieldLabel: { color: Palette.textMuted, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: Palette.text,
    backgroundColor: Palette.panelElevated,
    fontSize: 16,
  },
  kindRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  kindCard: {
    width: 84,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Palette.stroke,
    backgroundColor: Palette.panelElevated,
    padding: 10,
    alignItems: 'center',
    gap: 6,
  },
  kindIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindLabel: { color: Palette.textMuted, fontSize: 11, fontWeight: '600' },
  iconRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  iconPick: {
    width: 42,
    height: 42,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Palette.stroke,
    backgroundColor: Palette.panelElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seg: { gap: 8 },
  segBtn: {
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Palette.stroke,
    backgroundColor: Palette.panelElevated,
    padding: Spacing.md,
  },
  segBtnOnAmber: { borderColor: Palette.amber, backgroundColor: 'rgba(255,200,87,0.12)' },
  segBtnOnViolet: { borderColor: Palette.violet, backgroundColor: 'rgba(139,124,255,0.12)' },
  segTitle: { color: Palette.textMuted, fontWeight: '700' },
  segTitleOn: { color: Palette.text },
  segSub: { color: Palette.textDim, fontSize: 12, marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    color: Palette.textMuted,
    backgroundColor: Palette.panelElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    overflow: 'hidden',
    textTransform: 'capitalize',
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  chipOn: { color: Palette.void, backgroundColor: Palette.cyan, borderColor: Palette.cyan },
  dateBtn: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.md,
    padding: 12,
    backgroundColor: Palette.panelElevated,
  },
  dateValue: { color: Palette.text, fontWeight: '700' },
  hintCalc: { color: Palette.amber, fontWeight: '700', fontSize: 13 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  simLine: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '800', fontSize: 16 },
  simSub: { color: Palette.textDim, fontSize: 12, marginBottom: 8 },
  actions: { gap: Spacing.sm, marginBottom: Spacing.xl },
});
