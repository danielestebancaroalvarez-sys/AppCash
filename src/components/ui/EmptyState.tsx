import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={28} color={Palette.cyan} />
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SyncBanner({
  message,
  pendingCount,
  paused,
  onPress,
}: {
  message?: string;
  pendingCount?: number;
  paused?: boolean;
  onPress?: () => void;
}) {
  if (!message && !pendingCount) return null;
  const tone = paused ? Palette.amber : pendingCount ? Palette.cyan : Palette.textDim;
  const text =
    message ||
    (paused
      ? 'Purchase sync paused — tap to retry'
      : pendingCount
        ? `${pendingCount} purchase change(s) waiting to sync`
        : '');

  const inner = (
    <View style={[styles.banner, { borderColor: `${tone}55` }]}>
      <Ionicons
        name={paused ? 'warning-outline' : pendingCount ? 'cloud-upload-outline' : 'cloud-done-outline'}
        size={16}
        color={tone}
      />
      <Text style={[styles.bannerText, { color: tone }]} numberOfLines={2}>
        {text}
      </Text>
      {onPress ? <Ionicons name="chevron-forward" size={14} color={tone} /> : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={text}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  title: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontSize: 16,
    textAlign: 'center',
  },
  body: {
    color: Palette.textMuted,
    fontFamily: Fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  btn: {
    marginTop: 4,
    backgroundColor: Palette.cyan,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radii.md,
  },
  btnText: { color: Palette.void, fontFamily: Fonts.display, fontSize: 14 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: Palette.panelElevated,
    marginBottom: Spacing.sm,
  },
  bannerText: { flex: 1, fontFamily: Fonts.body, fontSize: 12, lineHeight: 16 },
});
