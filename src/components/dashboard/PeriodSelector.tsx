import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { addWeeks, format, isSameDay, startOfWeek } from 'date-fns';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore, useWeekRange } from '@/stores/finance-store';
import { getWeekRange } from '@/lib/dates';

/** Compact period chips — sits flush under the tab header. */
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
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Period · {format(start, 'd MMM')}</Text>
        <Text style={styles.range} numberOfLines={1}>
          {format(start, 'MM/dd')}–{format(end, 'MM/dd')}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.sm, gap: 6 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  title: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '800', fontSize: 14 },
  range: { color: Palette.textDim, fontSize: 11, flexShrink: 1 },
  chips: { flexDirection: 'row', gap: 6, paddingRight: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: Palette.glassFillStrong,
    borderWidth: 1,
    borderColor: Palette.glassStroke,
  },
  chipOn: { backgroundColor: Palette.cyan, borderColor: Palette.cyan },
  chipText: { color: Palette.textMuted, fontSize: 12, fontWeight: '600' },
  chipTextOn: { color: Palette.void },
});
