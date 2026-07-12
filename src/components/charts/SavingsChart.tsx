import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { formatAud } from '@/lib/money';
import type { ProjectionPoint } from '@/lib/savings/simulate';

export function SavingsProjectionChart({
  points,
  accent = Palette.cyan,
  target,
}: {
  points: ProjectionPoint[];
  accent?: string;
  target?: number;
}) {
  const width = 300;
  const height = 120;
  const pad = 12;
  if (!points.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Enter a target to see the curve</Text>
      </View>
    );
  }

  const maxV = Math.max(...points.map((p) => p.value), target ?? 0, 1);
  const maxX = Math.max(...points.map((p) => p.monthIndex), 1);

  const coords = points.map((p) => {
    const x = pad + (p.monthIndex / maxX) * (width - pad * 2);
    const y = height - pad - (p.value / maxV) * (height - pad * 2);
    return { x, y, ...p };
  });

  const poly = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const area =
    `M ${coords[0].x} ${height - pad} ` +
    coords.map((c) => `L ${c.x} ${c.y}`).join(' ') +
    ` L ${coords[coords.length - 1].x} ${height - pad} Z`;

  const last = coords[coords.length - 1];

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line
          x1={pad}
          y1={height - pad}
          x2={width - pad}
          y2={height - pad}
          stroke={Palette.stroke}
          strokeWidth={1}
        />
        {target ? (
          <Line
            x1={pad}
            y1={height - pad - (target / maxV) * (height - pad * 2)}
            x2={width - pad}
            y2={height - pad - (target / maxV) * (height - pad * 2)}
            stroke={accent}
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.45}
          />
        ) : null}
        <Path d={area} fill={accent} opacity={0.15} />
        <Polyline points={poly} fill="none" stroke={accent} strokeWidth={2.5} />
        {coords.map((c, i) =>
          i === 0 || i === coords.length - 1 ? (
            <Circle key={i} cx={c.x} cy={c.y} r={4} fill={accent} />
          ) : null
        )}
      </Svg>
      <View style={styles.footer}>
        <Text style={styles.axis}>Now</Text>
        <Text style={[styles.axis, { color: accent }]}>
          {last ? formatAud(last.value) : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Palette.panelElevated,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Palette.stroke,
    padding: Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  axis: { color: Palette.textDim, fontSize: 11, fontFamily: Fonts.mono },
  empty: {
    padding: Spacing.md,
    borderRadius: Radii.md,
    backgroundColor: Palette.panelElevated,
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  emptyText: { color: Palette.textDim, fontSize: 13 },
});
