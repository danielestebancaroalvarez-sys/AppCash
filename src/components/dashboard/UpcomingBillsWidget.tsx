import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { Fonts, Palette } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import { formatDisplayDate } from '@/lib/dates';
import type { PeriodStats } from '@/hooks/use-period-stats';
import { useFinanceStore } from '@/stores/finance-store';

export function UpcomingBillsWidget({ stats }: { stats: PeriodStats }) {
  const router = useRouter();
  const categories = useFinanceStore((s) => s.categories);

  return (
    <CollapsibleWidget
      accent={Palette.coral}
      header={<WidgetTitle icon="alarm-outline" title="Upcoming Bills" iconColor={Palette.coral} />}
      collapsedSummary={
        <Text style={styles.summary}>
          {stats.upcomingBills.length
            ? `Next: ${stats.upcomingBills[0]?.name}`
            : 'No active fixed bills'}
        </Text>
      }>
      {stats.upcomingBills.length === 0 ? (
        <Text style={styles.empty}>Add fixed expenses to see upcoming dues.</Text>
      ) : (
        stats.upcomingBills.map((b) => {
          const cat = categories.find((c) => c.id === b.category_id);
          return (
            <Pressable
              key={b.id}
              onPress={() => router.push({ pathname: '/fixed/edit' as never, params: { id: b.id } })}
              style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{b.name}</Text>
                <Text style={styles.meta}>
                  {cat?.name ?? '—'} · due {formatDisplayDate(b.next_due)}
                </Text>
              </View>
              <Text style={styles.amt}>{formatAud(b.amount_aud)}</Text>
            </Pressable>
          );
        })
      )}
      <Pressable onPress={() => router.push('/fixed' as never)}>
        <Text style={styles.link}>Manage fixed items</Text>
      </Pressable>
    </CollapsibleWidget>
  );
}

const styles = StyleSheet.create({
  summary: { color: Palette.textDim, fontSize: 12 },
  empty: { color: Palette.textMuted, fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.stroke,
  },
  name: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '700' },
  meta: { color: Palette.textDim, fontSize: 11, marginTop: 2 },
  amt: { color: Palette.coral, fontWeight: '800' },
  link: { color: Palette.cyan, fontWeight: '700', fontSize: 13, marginTop: 8 },
});
