import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, Radii, Spacing } from '@/constants/theme';

type Props = {
  /** Always visible header row content (left side). */
  header: ReactNode;
  /** Optional actions on the right, before the chevron (edit/delete…). */
  headerActions?: ReactNode;
  children: ReactNode;
  /** Compact preview under the header when collapsed. */
  collapsedSummary?: ReactNode;
  accent?: string;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  style?: StyleProp<ViewStyle>;
  /** Extra tap on header (besides toggle). */
  onHeaderPress?: () => void;
};

/**
 * Shared expand/collapse shell with chevron — used by Savings widgets.
 */
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
}: Props) {
  const [internal, setInternal] = useState(defaultExpanded);
  const expanded = controlled ?? internal;

  const toggle = () => {
    const next = !expanded;
    if (controlled === undefined) setInternal(next);
    onExpandedChange?.(next);
  };

  return (
    <View style={[styles.shell, { borderColor: `${accent}55` }, style]}>
      <View style={[styles.bar, { backgroundColor: accent }]} />
      <View style={styles.body}>
        <View style={styles.headRow}>
          <Pressable
            onPress={() => {
              onHeaderPress?.();
              toggle();
            }}
            style={({ pressed }) => [styles.headMain, pressed && { opacity: 0.9 }]}>
            {header}
          </Pressable>
          {headerActions}
          <Pressable
            onPress={toggle}
            hitSlop={8}
            style={({ pressed }) => [
              styles.chevronBtn,
              { backgroundColor: `${accent}18` },
              pressed && { opacity: 0.85 },
            ]}>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={accent}
            />
          </Pressable>
        </View>

        {!expanded && collapsedSummary ? (
          <Pressable onPress={toggle} style={styles.summary}>
            {collapsedSummary}
          </Pressable>
        ) : null}

        {expanded ? <View style={styles.content}>{children}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    backgroundColor: Palette.panel,
    borderRadius: Radii.xl,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  bar: { width: 4 },
  body: { flex: 1, padding: Spacing.md },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  chevronBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: { marginTop: Spacing.sm },
  content: { marginTop: Spacing.sm, gap: 8 },
});
