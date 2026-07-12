import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Fonts, Palette } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import type { AppUser } from '@/types/models';

export function resolveUserPhotoUrl(
  user: AppUser | null | undefined,
  sessionPhotoUrl?: string | null,
  sessionEmail?: string | null
): string | undefined {
  if (!user) return sessionPhotoUrl || undefined;
  if (user.avatar_url?.trim()) return user.avatar_url.trim();
  if (
    sessionPhotoUrl &&
    sessionEmail &&
    user.email &&
    user.email.toLowerCase() === sessionEmail.toLowerCase()
  ) {
    return sessionPhotoUrl;
  }
  if (sessionPhotoUrl && user.role === 'owner') return sessionPhotoUrl;
  return undefined;
}

type AvatarProps = {
  user?: AppUser | null;
  name?: string;
  photoUrl?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
  selectedColor?: string;
};

/**
 * User photo when available, otherwise initial letter.
 */
export function UserAvatar({
  user,
  name,
  photoUrl,
  size = 28,
  style,
  selected,
  selectedColor = Palette.cyan,
}: AvatarProps) {
  const session = useFinanceStore((s) => s.session);
  const uri =
    photoUrl?.trim() ||
    resolveUserPhotoUrl(user, session?.photoUrl, session?.email) ||
    undefined;
  const label = (user?.name || name || '?').trim().slice(0, 1).toUpperCase() || '?';
  const radius = size / 2;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth: selected ? 2 : 1,
            borderColor: selected ? selectedColor : Palette.stroke,
          },
          style as object,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderColor: selected ? selectedColor : Palette.stroke,
          backgroundColor: selected ? selectedColor : Palette.panelElevated,
        },
        style,
      ]}>
      <Text
        style={[
          styles.letter,
          { fontSize: Math.max(10, size * 0.38), color: selected ? Palette.void : Palette.cyan },
        ]}>
        {label}
      </Text>
    </View>
  );
}

type NameProps = {
  user?: AppUser | null;
  name?: string;
  size?: number;
  textStyle?: object;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
};

/** Avatar + name row used wherever a person is shown. */
export function UserName({ user, name, size = 24, textStyle, style, selected }: NameProps) {
  const label = user?.name || name || 'User';
  return (
    <View style={[styles.nameRow, style]}>
      <UserAvatar user={user} name={label} size={size} selected={selected} />
      <Text style={[styles.nameText, textStyle]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  letter: { fontFamily: Fonts.display, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  nameText: { color: Palette.text, fontWeight: '600', flexShrink: 1 },
});
