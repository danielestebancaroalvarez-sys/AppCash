import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, SectionTitle } from '@/components/ui/Primitives';
import { Fonts, Palette, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { formatAud } from '@/lib/money';
import { recommendUpcoming } from '@/lib/insights/market';
import { formatDisplayDate } from '@/lib/dates';

export default function InsightsScreen() {
  const productStats = useFinanceStore((s) => s.productStats);
  const upcoming = recommendUpcoming(productStats, 14);

  return (
    <Screen>
      <Text style={styles.title}>Market prediction</Text>
      <Text style={styles.sub}>
        Frequency and shelf-life estimates from your scanned receipt history.
      </Text>

      <SectionTitle title="Due soon" subtitle="Products likely to run out within ~2 weeks" />
      {upcoming.length ? (
        upcoming.map((p) => (
          <GlassPanel key={p.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.product_name_normalized}</Text>
              <Text style={styles.meta}>
                lasts ~{p.buy_frequency_days} days · bought {p.purchase_count}x · last{' '}
                {formatDisplayDate(p.last_seen)}
              </Text>
            </View>
            <Text style={styles.price}>{formatAud(p.avg_price)}</Text>
          </GlassPanel>
        ))
      ) : (
        <GlassPanel>
          <Text style={styles.meta}>Scan a few Woolworths/Aldi receipts to unlock predictions.</Text>
        </GlassPanel>
      )}

      <SectionTitle title="All tracked products" />
      {productStats.map((p) => (
        <GlassPanel key={p.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{p.product_name_normalized}</Text>
            <Text style={styles.meta}>
              every {p.buy_frequency_days}d · {p.purchase_count} purchases
            </Text>
          </View>
          <Text style={styles.price}>{formatAud(p.avg_price)}</Text>
        </GlassPanel>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: Palette.text, fontFamily: Fonts.display, fontSize: 28, fontWeight: '800' },
  sub: { color: Palette.textMuted, marginBottom: Spacing.md, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: 10 },
  name: { color: Palette.text, fontWeight: '700', textTransform: 'capitalize' },
  meta: { color: Palette.textDim, fontSize: 12, marginTop: 3 },
  price: { color: Palette.cyan, fontWeight: '800' },
});
