import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { categoryIonicon } from '@/constants/category-icons';
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
          const color = cat?.color || Palette.coral;
          return (
            <Pressable
              key={b.id}
              onPress={() => router.push({ pathname: '/fixed/edit' as never, params: { id: b.id } })}
              style={styles.row}>
              <View style={[styles.icon, { backgroundColor: `${color}28` }]}>
                <Ionicons name={categoryIonicon(cat?.icon ?? 'cube')} size={16} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{b.name}</Text>
                <Text style={[styles.meta, { color }]}>
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
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.stroke,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '700' },
  meta: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  amt: { color: Palette.coral, fontWeight: '800' },
  link: { color: Palette.cyan, fontWeight: '700', fontSize: 13, marginTop: 8 },
});
