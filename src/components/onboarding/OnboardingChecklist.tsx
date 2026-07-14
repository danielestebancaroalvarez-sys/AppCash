import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { getSetting, setSetting } from '@/lib/db';
import { useFinanceStore } from '@/stores/finance-store';
import { useEffect, useState } from 'react';

export const ONBOARDING_KEY = 'onboarding_checklist_v1';

type Checks = {
  profile: boolean;
  expense: boolean;
  sheet: boolean;
  dismissed: boolean;
};

const DEFAULT: Checks = { profile: false, expense: false, sheet: false, dismissed: false };

export function OnboardingChecklist() {
  const router = useRouter();
  const users = useFinanceStore((s) => s.users);
  const transactions = useFinanceStore((s) => s.transactions);
  const session = useFinanceStore((s) => s.session);
  const [checks, setChecks] = useState<Checks | null>(null);

  useEffect(() => {
    void (async () => {
      const raw = await getSetting(ONBOARDING_KEY);
      let saved = DEFAULT;
      if (raw) {
        try {
          saved = { ...DEFAULT, ...(JSON.parse(raw) as Partial<Checks>) };
        } catch {
          saved = DEFAULT;
        }
      }
      const next: Checks = {
        ...saved,
        profile: saved.profile || users.length > 0,
        expense: saved.expense || transactions.some((t) => t.type.includes('expense') || t.type === 'variable'),
        sheet: saved.sheet || Boolean(session?.spreadsheetId),
      };
      if (JSON.stringify(next) !== JSON.stringify(saved)) {
        await setSetting(ONBOARDING_KEY, JSON.stringify(next));
      }
      setChecks(next);
    })();
  }, [users.length, transactions.length, session?.spreadsheetId]);

  if (!checks || checks.dismissed) return null;
  const done = [checks.profile, checks.expense, checks.sheet].filter(Boolean).length;
  if (done >= 3) {
    void setSetting(ONBOARDING_KEY, JSON.stringify({ ...checks, dismissed: true }));
    return null;
  }

  const steps: Array<{
    key: keyof Checks;
    label: string;
    done: boolean;
    onPress?: () => void;
  }> = [
    {
      key: 'profile',
      label: 'Household ready',
      done: checks.profile,
      onPress: () => router.push('/profile' as never),
    },
    {
      key: 'expense',
      label: 'Add your first expense',
      done: checks.expense,
      onPress: () => router.push('/(tabs)/add' as never),
    },
    {
      key: 'sheet',
      label: 'Optional: link purchase sheet',
      done: checks.sheet,
      onPress: () => router.push('/account/sheets' as never),
    },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Getting started</Text>
        <Pressable
          onPress={async () => {
            const next = { ...checks, dismissed: true };
            await setSetting(ONBOARDING_KEY, JSON.stringify(next));
            setChecks(next);
          }}
          hitSlop={8}
          accessibilityLabel="Dismiss checklist">
          <Ionicons name="close" size={18} color={Palette.textDim} />
        </Pressable>
      </View>
      <Text style={styles.sub}>{done} of 3 · app works offline; sheet is optional</Text>
      {steps.map((s) => (
        <Pressable
          key={s.key}
          onPress={s.done ? undefined : s.onPress}
          style={styles.row}
          accessibilityRole="button"
          accessibilityState={{ checked: s.done }}>
          <Ionicons
            name={s.done ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={s.done ? Palette.teal : Palette.textDim}
          />
          <Text style={[styles.rowText, s.done && styles.rowDone]}>{s.label}</Text>
          {!s.done ? <Ionicons name="chevron-forward" size={14} color={Palette.textDim} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.panel,
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.stroke,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: 8,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: Palette.text, fontFamily: Fonts.display, fontSize: 16 },
  sub: { color: Palette.textDim, fontFamily: Fonts.body, fontSize: 12, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  rowText: { flex: 1, color: Palette.text, fontFamily: Fonts.body, fontSize: 13 },
  rowDone: { color: Palette.textMuted, textDecorationLine: 'line-through' },
});
