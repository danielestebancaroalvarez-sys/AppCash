import { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton } from '@/components/ui/Primitives';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { createId } from '@/lib/id';
import { nowIso, todayIsoDate } from '@/lib/dates';
import { parseAmount } from '@/lib/money';
import { upsertReceipt, upsertTransaction } from '@/lib/db';
import { queueMutation } from '@/lib/sync/engine';
import { tryUploadReceiptPhoto } from '@/lib/google/drive';

/**
 * Manual receipt archive — store / date / total / who / optional photo.
 * No AI extraction; line items are not required.
 */
export default function NewReceiptScreen() {
  const router = useRouter();
  const users = useFinanceStore((s) => s.users);
  const categories = useFinanceStore((s) => s.categories);
  const activeUserId = useFinanceStore((s) => s.activeUserId);
  const session = useFinanceStore((s) => s.session);
  const refresh = useFinanceStore((s) => s.refresh);
  const { alert, Dialog } = useAppDialog();

  const [store, setStore] = useState('');
  const [date, setDate] = useState(todayIsoDate());
  const [total, setTotal] = useState('');
  const [note, setNote] = useState('');
  const [photoUri, setPhotoUri] = useState('');
  const [userId, setUserId] = useState(activeUserId || users[0]?.id || '');
  const [busy, setBusy] = useState(false);

  const pickPhoto = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert('Permission needed', 'Allow camera/photos to attach a receipt image.');
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: false });
    if (result.canceled || !result.assets[0]) return;
    setPhotoUri(result.assets[0].uri);
  };

  const persistPhoto = async (receiptId: string, uri: string): Promise<string> => {
    if (!uri) return '';
    if (uri.startsWith('http')) return uri;
    const dir = `${FileSystem.documentDirectory}receipts/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
    const dest = `${dir}${receiptId}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  };

  const save = async () => {
    if (!store.trim()) {
      alert('Store required', 'Enter the shop name (e.g. Kmart, Metro).');
      return;
    }
    if (!userId) {
      alert('Who paid?', 'Pick a household profile.');
      return;
    }
    const amount = parseAmount(total);
    if (!amount) {
      alert('Total required', 'Enter the receipt total in AUD.');
      return;
    }
    const dateIso = date.trim() || todayIsoDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
      alert('Date format', 'Use YYYY-MM-DD (e.g. 2026-07-13).');
      return;
    }

    setBusy(true);
    try {
      const receiptId = createId();
      const savedPhoto = await persistPhoto(receiptId, photoUri);
      const photoRef = await tryUploadReceiptPhoto(session?.accessToken, savedPhoto, receiptId);
      const grocery =
        categories.find((c) => c.name.toLowerCase() === 'groceries') ??
        categories.find((c) => c.type === 'expense');

      const receipt = {
        id: receiptId,
        user_id: userId,
        store: store.trim(),
        total_aud: amount,
        photo_uri_or_drive_id: photoRef || savedPhoto,
        purchased_at: `${dateIso}T12:00:00`,
        raw_gemini_json: note.trim() ? JSON.stringify({ note: note.trim(), manual: true }) : '',
        updated_at: nowIso(),
      };
      await upsertReceipt(receipt);
      await queueMutation('receipts', receipt);

      if (grocery) {
        const tx = {
          id: `tx_${receiptId}`,
          user_id: userId,
          type: 'expense_sporadic' as const,
          category_id: grocery.id,
          amount_aud: amount,
          date: dateIso,
          note: note.trim() || `Receipt ${store.trim()}`,
          merchant: store.trim(),
          receipt_id: receiptId,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        await upsertTransaction(tx);
        await queueMutation('transactions', tx);
      }

      await refresh();
      router.replace({ pathname: '/receipts/[id]' as never, params: { id: receiptId } });
    } catch (e) {
      alert('Error', e instanceof Error ? e.message : 'Could not save receipt');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen tabAware={false}>
      <Text style={styles.lead}>
        Archive a receipt with basic details only — no AI scan. Attach a photo if you want.
      </Text>

      <GlassPanel style={{ gap: Spacing.sm, marginBottom: Spacing.md }}>
        <Text style={styles.label}>Store / merchant</Text>
        <TextInput
          value={store}
          onChangeText={setStore}
          placeholder="Kmart, Metro, Woolworths…"
          placeholderTextColor={Palette.textDim}
          style={styles.input}
        />

        <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder={todayIsoDate()}
          placeholderTextColor={Palette.textDim}
          autoCapitalize="none"
          style={styles.input}
        />

        <Text style={styles.label}>Total AUD</Text>
        <TextInput
          value={total}
          onChangeText={setTotal}
          placeholder="0.00"
          placeholderTextColor={Palette.textDim}
          keyboardType="decimal-pad"
          style={styles.input}
        />

        <Text style={styles.label}>Note (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="What was this for?"
          placeholderTextColor={Palette.textDim}
          style={styles.input}
        />

        <Text style={styles.label}>Who paid</Text>
        <View style={styles.chips}>
          {users.map((u) => {
            const on = userId === u.id;
            return (
              <Pressable
                key={u.id}
                onPress={() => setUserId(u.id)}
                style={[styles.chip, on && styles.chipOn]}>
                <UserAvatar user={u} size={22} selected={on} />
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{u.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Photo (optional)</Text>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.preview} />
        ) : (
          <View style={styles.previewEmpty}>
            <Ionicons name="image-outline" size={28} color={Palette.textDim} />
            <Text style={styles.previewHint}>No photo attached</Text>
          </View>
        )}
        <View style={styles.photoRow}>
          <Pressable onPress={() => pickPhoto(true)} style={styles.photoBtn}>
            <Ionicons name="camera-outline" size={18} color={Palette.cyan} />
            <Text style={styles.photoBtnText}>Camera</Text>
          </Pressable>
          <Pressable onPress={() => pickPhoto(false)} style={styles.photoBtn}>
            <Ionicons name="images-outline" size={18} color={Palette.cyan} />
            <Text style={styles.photoBtnText}>Gallery</Text>
          </Pressable>
          {photoUri ? (
            <Pressable onPress={() => setPhotoUri('')} style={styles.photoBtn}>
              <Ionicons name="close-outline" size={18} color={Palette.coral} />
              <Text style={[styles.photoBtnText, { color: Palette.coral }]}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </GlassPanel>

      <PrimaryButton label={busy ? 'Saving…' : 'Save receipt'} onPress={save} disabled={busy} />
      <PrimaryButton label="Cancel" variant="ghost" onPress={() => router.back()} />
      {Dialog}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: {
    color: Palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  label: { color: Palette.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  input: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Palette.text,
    backgroundColor: Palette.panelElevated,
    fontFamily: Fonts.body,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: Palette.panelElevated,
  },
  chipOn: { borderColor: Palette.cyan, backgroundColor: `${Palette.cyan}22` },
  chipText: { color: Palette.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: Palette.text },
  preview: {
    width: '100%',
    height: 160,
    borderRadius: Radii.md,
    backgroundColor: Palette.panelElevated,
  },
  previewEmpty: {
    height: 100,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Palette.panelElevated,
  },
  previewHint: { color: Palette.textDim, fontSize: 12 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  photoBtnText: { color: Palette.cyan, fontWeight: '700', fontSize: 13 },
});
