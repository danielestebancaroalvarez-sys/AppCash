import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Palette, Radii, Spacing } from '@/constants/theme';

type Props = {
  header: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  collapsedSummary?: ReactNode;
  accent?: string;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  style?: StyleProp<ViewStyle>;
  onHeaderPress?: () => void;
  /** Spoken label for expand control */
  accessibilityLabel?: string;
};

export function CollapsibleWidget({
  header,
  headerActions,
  children,
  collapsedSummary,
  accent = Palette.cyan,
  defaultExpanded = true,
  expanded: controlled,
  onExpandedChange,
  style,
  onHeaderPress,
  accessibilityLabel = 'Expand or collapse section',
}: Props) {
  const [internal, setInternal] = useState(defaultExpanded);
  const expanded = controlled ?? internal;

  const toggle = () => {
    const next = !expanded;
    if (controlled === undefined) setInternal(next);
    onExpandedChange?.(next);
  };

  return (
    <Animated.View layout={LinearTransition.duration(220)} style={[styles.shell, style]}>
      <View style={[styles.bar, { backgroundColor: accent }]} />
      <View style={styles.body}>
        <View style={styles.headRow}>
          <Pressable
            onPress={() => {
              onHeaderPress?.();
              toggle();
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={accessibilityLabel}
            style={({ pressed }) => [styles.headMain, pressed && { opacity: 0.9 }]}>
            {header}
          </Pressable>
          {headerActions}
          <Pressable
            onPress={toggle}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Collapse' : 'Expand'}
            accessibilityState={{ expanded }}
            style={({ pressed }) => [styles.chevronBtn, pressed && { opacity: 0.75 }]}>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={Palette.textDim}
            />
          </Pressable>
        </View>

        {!expanded && collapsedSummary ? (
          <Pressable
            onPress={toggle}
            style={styles.summary}
            accessibilityRole="button"
            accessibilityLabel="Show details">
            {collapsedSummary}
          </Pressable>
        ) : null}

        {expanded ? (
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
            style={styles.content}>
            {children}
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    backgroundColor: Palette.panel,
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.stroke,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  bar: { width: 2 },
  body: { flex: 1, paddingHorizontal: Spacing.md, paddingVertical: 12 },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  chevronBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: { marginTop: 6 },
  content: { marginTop: Spacing.xs, gap: 8 },
});
