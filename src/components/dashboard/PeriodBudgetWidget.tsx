import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { FinanceColors, Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import { loadCategoryBudgets, setCategoryBudget, type CategoryBudgets } from '@/lib/budgets/category';
import type { PeriodStats } from '@/hooks/use-period-stats';
import { useFinanceStore } from '@/stores/finance-store';

export function PeriodBudgetWidget({ stats }: { stats: PeriodStats }) {
  const categories = useFinanceStore((s) => s.categories);
  const transactions = useFinanceStore((s) => s.transactions);
  const weekAnchor = useFinanceStore((s) => s.weekAnchor);
  const [budgets, setBudgets] = useState<CategoryBudgets>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    void loadCategoryBudgets().then(setBudgets);
  }, []);

  const spentByCat = useMemo(() => {
    const map = new Map<string, number>();
    const start = new Date(weekAnchor);
    // use period stats segments if available
    for (const seg of stats.segments) {
      const cat = categories.find((c) => c.name === seg.label);
      if (cat) map.set(cat.id, seg.value);
    }
    return map;
  }, [stats.segments, categories, weekAnchor, transactions]);

  const expenseCats = categories.filter((c) => c.type === 'expense').slice(0, 8);
  const alerts = expenseCats
    .map((c) => {
      const cap = budgets[c.id];
      if (!cap) return null;
      const spent = spentByCat.get(c.id) ?? 0;
      const over = spent > cap;
      const pct = cap > 0 ? Math.round((spent / cap) * 100) : 0;
      return { cat: c, cap, spent, over, pct };
    })
    .filter(Boolean) as Array<{
    cat: (typeof expenseCats)[0];
    cap: number;
    spent: number;
    over: boolean;
    pct: number;
  }>;

  const saveCap = async (id: string) => {
    const n = Number.parseFloat(draft.replace(',', '.'));
    const next = await setCategoryBudget(id, Number.isFinite(n) ? n : 0);
    setBudgets(next);
    setEditingId(null);
    setDraft('');
  };

  return (
    <CollapsibleWidget
      accent={FinanceColors.fixed}
      accessibilityLabel="Period budget"
      header={
        <WidgetTitle icon="pie-chart-outline" title="Period Budget" iconColor={FinanceColors.fixed} />
      }
      collapsedSummary={
        <Text style={styles.summary}>
          Income {formatAud(stats.incomeTotal)} · Free {formatAud(stats.free)}
          {alerts.some((a) => a.over) ? ' · over budget' : ''}
        </Text>
      }>
      <View style={styles.grid}>
        <View style={styles.col}>
          <Text style={[styles.big, { color: FinanceColors.income }]}>
            ↑ {formatAud(stats.incomeTotal)}
          </Text>
          <Text style={[styles.line, { color: FinanceColors.variable }]}>
            Variable: {formatAud(stats.expenseVariable)}
          </Text>
          <Text style={styles.line}>Free: {formatAud(stats.free)}</Text>
        </View>
        <View style={styles.col}>
          <Text style={[styles.big, { color: FinanceColors.fixed }]}>
            ↓ {formatAud(stats.expenseFixed)} fixed
          </Text>
          <Text style={[styles.line, { color: FinanceColors.savings }]}>
            Savings: {formatAud(stats.savingsContrib)}
          </Text>
        </View>
      </View>

      <Text style={styles.section}>Category caps (this week)</Text>
      <Text style={styles.hint}>Tap a category to set a weekly AUD limit. Local only.</Text>
      {expenseCats.map((c) => {
        const cap = budgets[c.id];
        const spent = spentByCat.get(c.id) ?? 0;
        const over = cap != null && spent > cap;
        const isEdit = editingId === c.id;
        return (
          <View key={c.id} style={styles.budgetRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.catName}>{c.name}</Text>
              <Text style={[styles.catMeta, over && { color: FinanceColors.expense }]}>
                {formatAud(spent)}
                {cap != null ? ` / ${formatAud(cap)}` : ' · no cap'}
                {over ? ' · over' : ''}
              </Text>
            </View>
            {isEdit ? (
              <View style={styles.editRow}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={Palette.textDim}
                  style={styles.input}
                  autoFocus
                />
                <Text style={styles.save} onPress={() => void saveCap(c.id)}>
                  Save
                </Text>
              </View>
            ) : (
              <Text
                style={styles.set}
                onPress={() => {
                  setEditingId(c.id);
                  setDraft(cap != null ? String(cap) : '');
                }}>
                {cap != null ? 'Edit' : 'Set cap'}
              </Text>
            )}
          </View>
        );
      })}
    </CollapsibleWidget>
  );
}

const styles = StyleSheet.create({
  summary: { color: Palette.textDim, fontSize: 12 },
  grid: { flexDirection: 'row', gap: 12 },
  col: { flex: 1, gap: 4 },
  big: { fontFamily: Fonts.display, fontSize: 15 },
  line: { color: Palette.textMuted, fontSize: 12 },
  section: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontSize: 13,
    marginTop: Spacing.sm,
  },
  hint: { color: Palette.textDim, fontSize: 11, marginBottom: 4 },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.stroke,
  },
  catName: { color: Palette.text, fontFamily: Fonts.body, fontSize: 13, fontWeight: '600' },
  catMeta: { color: Palette.textDim, fontSize: 11, marginTop: 2 },
  set: { color: Palette.cyan, fontWeight: '700', fontSize: 12 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    width: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.stroke,
    borderRadius: Radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: Palette.text,
    backgroundColor: Palette.panelElevated,
  },
  save: { color: Palette.teal, fontWeight: '700', fontSize: 12 },
});
