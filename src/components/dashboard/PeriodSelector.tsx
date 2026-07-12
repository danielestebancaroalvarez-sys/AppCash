import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { addWeeks, format, isSameDay, startOfWeek } from 'date-fns';
import { GlassPanel } from '@/components/ui/Primitives';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore, useWeekRange } from '@/stores/finance-store';
import { getWeekRange } from '@/lib/dates';

export function PeriodSelector() {
  const weekAnchor = useFinanceStore((s) => s.weekAnchor);
  const setWeekAnchor = useFinanceStore((s) => s.setWeekAnchor);
  const { start, end } = useWeekRange();

  const todayWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const prevWeekStart = addWeeks(todayWeekStart, -1);
  const selectedStart = startOfWeek(weekAnchor, { weekStartsOn: 1 });

  const recent = Array.from({ length: 6 }, (_, i) => addWeeks(todayWeekStart, -i));

  const chips: Array<{ key: string; label: string; date: Date }> = [
    { key: 'current', label: 'Current', date: todayWeekStart },
    { key: 'previous', label: 'Previous', date: prevWeekStart },
    ...recent.map((d, i) => ({
      key: `w-${i}`,
      label: format(d, 'd MMM'),
      date: d,
    })),
  ];

  // Deduplicate Current/Previous from recent list by date
  const seen = new Set<string>();
  const uniqueChips = chips.filter((c) => {
    const k = format(c.date, 'yyyy-MM-dd');
    if (c.key === 'current' || c.key === 'previous') {
      seen.add(k);
      return true;
    }
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return (
    <GlassPanel style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Period · {format(start, 'd MMM')}</Text>
        <Text style={styles.range}>
          {format(start, 'yyyy-MM-dd')} → {format(end, 'yyyy-MM-dd')}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {uniqueChips.map((c) => {
          const on = isSameDay(c.date, selectedStart);
          return (
            <Pressable
              key={c.key}
              onPress={() => setWeekAnchor(getWeekRange(c.date).start)}
              style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.sm, gap: 10, paddingVertical: 12 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  title: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '800', fontSize: 15 },
  range: { color: Palette.textDim, fontSize: 11, flexShrink: 1, textAlign: 'right' },
  chips: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    backgroundColor: Palette.panelElevated,
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  chipOn: { backgroundColor: Palette.teal, borderColor: Palette.teal },
  chipText: { color: Palette.textMuted, fontSize: 12, fontWeight: '600' },
  chipTextOn: { color: Palette.void },
});
