import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { Fonts, Palette, Spacing } from '@/constants/theme';
import { formatAud } from '@/lib/money';

type Seg = { label: string; value: number; color: string };

/** Centered donut with amount above label + horizontal legend — for dashboard widgets. */
export function DashboardDonut({
  segments,
  centerAmount,
  centerLabel,
  size = 168,
}: {
  segments: Seg[];
  centerAmount: number;
  centerLabel: string;
  size?: number;
}) {
  const total = segments.reduce((a, b) => a + b.value, 0) || 1;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const visible = segments.filter((s) => s.value > 0);

  return (
    <View style={styles.donutWrap}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
            fill="none"
          />
          {(visible.length ? visible : [{ label: '_', value: 1, color: 'rgba(255,255,255,0.08)' }]).map(
            (s) => {
              const len = (s.value / total) * c;
              const el = (
                <Circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={s.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  rotation={-90}
                  origin={`${size / 2}, ${size / 2}`}
                />
              );
              offset += len;
              return el;
            }
          )}
        </Svg>
        <View style={styles.donutCenter}>
          <Text style={styles.donutAmt}>{formatAud(centerAmount)}</Text>
          <Text style={styles.donutLabel}>{centerLabel}</Text>
        </View>
      </View>
      <View style={styles.hLegend}>
        {segments.map((s) => (
          <View key={s.label} style={styles.hLegendItem}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.hLegendText}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function CategoryBars({
  items,
}: {
  items: Array<{ label: string; value: number; color: string }>;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <View style={styles.catList}>
      {items.map((item) => (
        <View key={item.label} style={styles.catRow}>
          <View style={styles.catHead}>
            <Text style={styles.catLabel}>{item.label}</Text>
            <Text style={styles.catAmt}>{formatAud(item.value)}</Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max(4, (item.value / max) * 100)}%`,
                  backgroundColor: item.color,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

export function TrendGroupedBars({
  weeks,
}: {
  weeks: Array<{ label: string; income: number; expenses: number }>;
}) {
  const max = Math.max(...weeks.flatMap((w) => [w.income, w.expenses]), 1);
  const chartH = 120;

  const short = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return String(Math.round(n));
  };

  return (
    <View>
      <View style={styles.trendLegend}>
        <View style={styles.hLegendItem}>
          <View style={[styles.dot, { backgroundColor: Palette.teal }]} />
          <Text style={styles.hLegendText}>Income</Text>
        </View>
        <View style={styles.hLegendItem}>
          <View style={[styles.dot, { backgroundColor: Palette.coral }]} />
          <Text style={styles.hLegendText}>Expenses</Text>
        </View>
      </View>
      <View style={styles.trendRow}>
        {weeks.map((w) => {
          const ih = Math.max(4, (w.income / max) * chartH);
          const eh = Math.max(4, (w.expenses / max) * chartH);
          return (
            <View key={w.label} style={styles.trendCol}>
              <View style={styles.trendBars}>
                <View style={styles.trendBarWrap}>
                  <Text style={styles.trendTip}>{short(w.income)}</Text>
                  <Svg width={18} height={chartH}>
                    <Rect x={0} y={chartH - ih} width={18} height={ih} rx={6} fill={Palette.teal} />
                  </Svg>
                </View>
                <View style={styles.trendBarWrap}>
                  <Text style={styles.trendTip}>{short(w.expenses)}</Text>
                  <Svg width={18} height={chartH}>
                    <Rect x={0} y={chartH - eh} width={18} height={eh} rx={6} fill={Palette.coral} />
                  </Svg>
                </View>
              </View>
              <Text style={styles.trendLabel}>{w.label}</Text>
              <Text style={styles.trendIncome}>{short(w.income)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function MiniWeekBars({ values }: { values: Array<{ label: string; value: number }> }) {
  const max = Math.max(...values.map((v) => v.value), 1);
  return (
    <View style={styles.miniBars}>
      {values.map((v, i) => {
        const h = v.value > 0 ? Math.max(6, (v.value / max) * 48) : 3;
        return (
          <View key={`${v.label}-${i}`} style={styles.miniCol}>
            <View style={[styles.miniBar, { height: h, opacity: v.value > 0 ? 1 : 0.35 }]} />
            <Text style={styles.miniLabel}>{v.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function PlainDailyBars({ values }: { values: Array<{ label: string; value: number }> }) {
  const max = Math.max(...values.map((v) => v.value), 1);
  return (
    <View style={styles.dailyBars}>
      {values.map((v) => {
        const h = Math.max(6, (v.value / max) * 100);
        return (
          <View key={v.label} style={styles.dailyCol}>
            <Svg width={28} height={110}>
              <Rect x={4} y={110 - h} width={20} height={h} rx={8} fill={Palette.cyan} opacity={0.85} />
            </Svg>
            <Text style={styles.miniLabel}>{v.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  donutWrap: { alignItems: 'center', gap: 12 },
  donutCenter: { position: 'absolute', alignItems: 'center', paddingHorizontal: 8 },
  donutAmt: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 18,
  },
  donutLabel: { color: Palette.textMuted, fontSize: 12, marginTop: 2 },
  hLegend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  hLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hLegendText: { color: Palette.textMuted, fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  catList: { gap: 12 },
  catRow: { gap: 6 },
  catHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catLabel: { color: Palette.text, fontWeight: '600', fontSize: 13 },
  catAmt: { color: Palette.text, fontWeight: '700', fontSize: 13 },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4 },
  trendLegend: { flexDirection: 'row', gap: 14, marginBottom: Spacing.sm },
  trendRow: { flexDirection: 'row', justifyContent: 'space-around', gap: 4 },
  trendCol: { alignItems: 'center', flex: 1 },
  trendBars: { flexDirection: 'row', gap: 4, alignItems: 'flex-end' },
  trendBarWrap: { alignItems: 'center' },
  trendTip: { color: Palette.textDim, fontSize: 9, marginBottom: 2 },
  trendLabel: { color: Palette.textMuted, fontSize: 11, marginTop: 6 },
  trendIncome: { color: Palette.teal, fontSize: 10, fontWeight: '700', marginTop: 2 },
  miniBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 64,
    gap: 2,
  },
  miniCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  miniBar: {
    width: '70%',
    maxWidth: 14,
    borderRadius: 4,
    backgroundColor: Palette.cyan,
    marginBottom: 4,
  },
  miniLabel: { color: Palette.textDim, fontSize: 9 },
  dailyBars: { flexDirection: 'row', justifyContent: 'space-between' },
  dailyCol: { alignItems: 'center', width: 36 },
});
