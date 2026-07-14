import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  body,
  actionLabel,
  onAction,
  illustration,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: ImageSourcePropType;
}) {
  return (
    <View style={styles.wrap}>
      {illustration ? (
        <View style={styles.illustrationFrame}>
          <Image
            source={illustration}
            style={styles.illustration}
            contentFit="cover"
            transition={180}
          />
        </View>
      ) : (
        <Ionicons name={icon} size={28} color={Palette.cyan} />
      )}
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

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  illustrationFrame: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.glassStroke,
    backgroundColor: Palette.glassFillStrong,
  },
  illustration: {
    width: '100%',
    height: '100%',
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
});
