import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, SectionTitle } from '@/components/ui/Primitives';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { useSheetRefresh } from '@/hooks/use-sheet-refresh';
import { formatAud } from '@/lib/money';
import { formatDisplayDate } from '@/lib/dates';

export default function SearchScreen() {
  const transactions = useFinanceStore((s) => s.transactions);
  const users = useFinanceStore((s) => s.users);
  const categories = useFinanceStore((s) => s.categories);
  const [q, setQ] = useState('');
  const [userFilter, setUserFilter] = useState<string>('all');
  const { refreshing, onRefresh } = useSheetRefresh();

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return transactions.filter((t) => {
      if (userFilter !== 'all' && t.user_id !== userFilter) return false;
      if (!query) return true;
      const user = users.find((u) => u.id === t.user_id)?.name ?? '';
      const cat = categories.find((c) => c.id === t.category_id)?.name ?? '';
      return [t.note, t.merchant, t.type, user, cat, String(t.amount_aud)]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [transactions, q, userFilter, users, categories]);

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <Text style={styles.title}>Search ledger</Text>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Merchant, note, category, person…"
        placeholderTextColor={Palette.textDim}
        style={styles.input}
      />

      <View style={styles.chips}>
        <Chip label="Everyone" active={userFilter === 'all'} onPress={() => setUserFilter('all')} />
        {users.map((u) => (
          <Chip
            key={u.id}
            label={u.name}
            active={userFilter === u.id}
            onPress={() => setUserFilter(u.id)}
          />
        ))}
      </View>

      <SectionTitle title={`${rows.length} records`} subtitle="Who logged each entry" />
      {rows.map((t) => {
        const user = users.find((u) => u.id === t.user_id);
        const cat = categories.find((c) => c.id === t.category_id);
        const isIncome = t.type.includes('income') || t.type === 'savings_contrib';
        return (
          <GlassPanel key={t.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t.merchant || cat?.name || t.type}</Text>
              <Text style={styles.rowMeta}>
                {formatDisplayDate(t.date)} · {user?.name ?? 'Unknown'} · {cat?.name ?? '—'}
              </Text>
              {t.note ? <Text style={styles.note}>{t.note}</Text> : null}
            </View>
            <Text style={[styles.amt, { color: isIncome ? Palette.teal : Palette.coral }]}>
              {isIncome ? '+' : '-'}
              {formatAud(t.amount_aud)}
            </Text>
          </GlassPanel>
        );
      })}
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: Spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    backgroundColor: Palette.panel,
    borderRadius: Radii.md,
    color: Palette.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: Spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.sm },
  chip: {
    color: Palette.textMuted,
    backgroundColor: Palette.panelElevated,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Palette.stroke,
    fontSize: 12,
  },
  chipActive: { color: Palette.void, backgroundColor: Palette.cyan, borderColor: Palette.cyan },
  row: { flexDirection: 'row', gap: 12, marginBottom: Spacing.sm, alignItems: 'center' },
  rowTitle: { color: Palette.text, fontWeight: '700' },
  rowMeta: { color: Palette.textDim, fontSize: 12, marginTop: 3 },
  note: { color: Palette.textMuted, fontSize: 12, marginTop: 4 },
  amt: { fontWeight: '800' },
});
