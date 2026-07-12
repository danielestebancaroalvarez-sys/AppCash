import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import { GlassPanel } from '@/components/ui/Primitives';

export function DonutChart({
  segments,
  centerLabel,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  centerLabel: string;
}) {
  const total = segments.reduce((a, b) => a + b.value, 0) || 1;
  const size = 160;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <GlassPanel style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.chartBox}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={stroke}
              fill="none"
            />
            {segments.map((s) => {
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
                  strokeLinecap="round"
                  rotation={-90}
                  origin={`${size / 2}, ${size / 2}`}
                />
              );
              offset += len;
              return el;
            })}
          </Svg>
          <View style={styles.center}>
            <Text style={styles.centerLabel}>{centerLabel}</Text>
            <Text style={styles.centerValue}>{formatAud(total)}</Text>
          </View>
        </View>
        <View style={styles.legend}>
          {segments.map((s) => (
            <View key={s.label} style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: s.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.legendLabel} numberOfLines={1}>
                  {s.label}
                </Text>
                <Text style={styles.legendValue}>{formatAud(s.value)}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </GlassPanel>
  );
}

export function BarWeek({
  values,
}: {
  values: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(...values.map((v) => v.value), 1);
  return (
    <GlassPanel>
      <Text style={styles.title}>Daily spend</Text>
      <View style={styles.bars}>
        {values.map((v) => {
          const h = Math.max(8, (v.value / max) * 110);
          return (
            <View key={v.label} style={styles.barCol}>
              <Svg width={28} height={120}>
                <Rect x={4} y={120 - h} width={20} height={h} rx={8} fill={Palette.cyan} opacity={0.85} />
              </Svg>
              <Text style={styles.barLabel}>{v.label}</Text>
            </View>
          );
        })}
      </View>
    </GlassPanel>
  );
}

export function ProgressRing({
  progress,
  label,
  sublabel,
}: {
  progress: number;
  label: string;
  sublabel: string;
}) {
  const size = 120;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <View style={styles.ringWrap}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={Palette.teal}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c * p} ${c * (1 - p)}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringPct}>{Math.round(p * 100)}%</Text>
      </View>
      <Text style={styles.ringLabel}>{label}</Text>
      <Text style={styles.ringSub}>{sublabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  chartBox: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center' },
  centerLabel: { color: Palette.textMuted, fontSize: 11 },
  centerValue: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '700', fontSize: 14 },
  legend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: Palette.text, fontSize: 12 },
  legendValue: { color: Palette.textMuted, fontSize: 11 },
  title: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  bars: { flexDirection: 'row', justifyContent: 'space-between' },
  barCol: { alignItems: 'center', width: 36 },
  barLabel: { color: Palette.textDim, fontSize: 10, marginTop: 4 },
  ringWrap: { alignItems: 'center', padding: Spacing.sm },
  ringCenter: { position: 'absolute', top: 44, alignItems: 'center' },
  ringPct: { color: Palette.text, fontFamily: Fonts.display, fontWeight: '700', fontSize: 20 },
  ringLabel: { color: Palette.text, marginTop: 8, fontWeight: '600' },
  ringSub: { color: Palette.textMuted, fontSize: 12, marginTop: 2 },
});
