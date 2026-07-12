import { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';

export type AppModalTone = 'default' | 'danger' | 'accent';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: AppModalTone;
  dismissOnBackdrop?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  onRequestClose?: () => void;
  confirmDisabled?: boolean;
  /** Hide the cancel / secondary button (e.g. OK-only alerts). */
  hideCancel?: boolean;
  style?: ViewStyle;
};

/**
 * Reusable confirmation / content modal for AppCash.
 * Use for sign-out, deletes, quick confirms, and custom forms via `children`.
 */
export function AppModal({
  visible,
  title,
  message,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  dismissOnBackdrop = true,
  onConfirm,
  onCancel,
  onRequestClose,
  confirmDisabled,
  hideCancel = false,
  style,
}: Props) {
  const insets = useSafeAreaInsets();
  const close = onRequestClose ?? onCancel;

  const confirmColor =
    tone === 'danger' ? Palette.coral : tone === 'accent' ? Palette.cyan : Palette.cyan;
  const confirmTextColor = tone === 'danger' ? Palette.void : Palette.void;
  const showCancel = !hideCancel && Boolean(onCancel || close);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}>
      <Pressable
        style={styles.backdrop}
        onPress={dismissOnBackdrop ? close : undefined}>
        <Pressable
          style={[styles.sheet, { marginBottom: Math.max(insets.bottom, Spacing.md) }, style]}
          onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {children}

          <View style={styles.actions}>
            {showCancel ? (
              <Pressable
                onPress={onCancel ?? close}
                style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}>
                <Text style={styles.btnGhostText}>{cancelLabel}</Text>
              </Pressable>
            ) : null}
            {onConfirm ? (
              <Pressable
                disabled={confirmDisabled}
                onPress={() => void onConfirm()}
                style={({ pressed }) => [
                  styles.btn,
                  { backgroundColor: confirmColor },
                  (pressed || confirmDisabled) && styles.pressed,
                ]}>
                <Text style={[styles.btnConfirmText, { color: confirmTextColor }]}>
                  {confirmLabel}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Palette.overlay,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.md,
  },
  sheet: {
    backgroundColor: Palette.panelElevated,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Palette.stroke,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  title: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontSize: 20,
    fontWeight: '800',
  },
  message: {
    color: Palette.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  btnGhostText: {
    color: Palette.textMuted,
    fontFamily: Fonts.display,
    fontWeight: '700',
  },
  btnConfirmText: {
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 15,
  },
  pressed: { opacity: 0.85 },
});
