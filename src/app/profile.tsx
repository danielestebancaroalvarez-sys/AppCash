import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, PrimaryButton, SectionTitle } from '@/components/ui/Primitives';
import { AppModal } from '@/components/ui/AppModal';
import { MenuRow } from '@/components/ui/MenuRow';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { createId } from '@/lib/id';
import { nowIso } from '@/lib/dates';
import { deleteUser, upsertUser } from '@/lib/db';
import { queueMutation, wipeLocalFinanceData } from '@/lib/sync/engine';
import type { AppUser } from '@/types/models';

export default function ProfileScreen() {
  const router = useRouter();
  const session = useFinanceStore((s) => s.session);
  const users = useFinanceStore((s) => s.users);
  const activeUserId = useFinanceStore((s) => s.activeUserId);
  const lastSyncAt = useFinanceStore((s) => s.lastSyncAt);
  const setActiveUser = useFinanceStore((s) => s.setActiveUser);
  const refresh = useFinanceStore((s) => s.refresh);
  const logout = useFinanceStore((s) => s.logout);
  const { alert, confirm, Dialog } = useAppDialog();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberPhoto, setMemberPhoto] = useState('');
  const [savingMember, setSavingMember] = useState(false);

  const owner = useMemo(
    () =>
      users.find(
        (u) => u.email && session?.email && u.email.toLowerCase() === session.email.toLowerCase()
      ) ||
      users.find((u) => u.role === 'owner') ||
      users[0],
    [users, session?.email]
  );

  const openCreateMember = () => {
    setEditing(null);
    setMemberName('');
    setMemberPhoto('');
    setFormOpen(true);
  };

  const openEditMember = (u: AppUser) => {
    setEditing(u);
    setMemberName(u.name);
    setMemberPhoto(u.avatar_url || '');
    setFormOpen(true);
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      alert('Permission needed', 'Allow photos to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    setMemberPhoto(result.assets[0].uri);
  };

  const persistPhoto = async (userId: string, uri: string): Promise<string> => {
    if (!uri) return '';
    if (uri.startsWith('http')) return uri;
    const dir = `${FileSystem.documentDirectory}avatars/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
    const dest = `${dir}${userId}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  };

  const saveMember = async () => {
    if (!memberName.trim()) {
      alert('Name required', 'Enter a name for this person.');
      return;
    }
    setSavingMember(true);
    try {
      const id = editing?.id ?? createId();
      const photo = await persistPhoto(id, memberPhoto);
      const user: AppUser = {
        id,
        name: memberName.trim(),
        email: editing?.email ?? '',
        avatar_url: photo,
        role: editing?.role === 'owner' ? 'owner' : 'member',
        updated_at: nowIso(),
      };
      await upsertUser(user);
      await queueMutation('users', user);
      setFormOpen(false);
      await refresh();
    } catch (e) {
      alert('Error', e instanceof Error ? e.message : 'Could not save person');
    } finally {
      setSavingMember(false);
    }
  };

  const removeMember = (u: AppUser) => {
    if (u.role === 'owner') {
      alert('Cannot remove', 'The owner profile stays with the Google account.');
      return;
    }
    confirm(
      'Remove person?',
      `“${u.name}” will be removed from this household on this phone.`,
      async () => {
        await deleteUser(u.id);
        await queueMutation('users', { id: u.id, deleted: true });
        if (activeUserId === u.id && owner) setActiveUser(owner.id);
        await refresh();
      },
      { confirmLabel: 'Remove', tone: 'danger' }
    );
  };

  const onLogout = async () => {
    setBusy(true);
    try {
      await logout();
      setSignOutOpen(false);
      router.replace('/login' as never);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen tabAware={false}>
      <GlassPanel glow style={styles.hero}>
        <UserAvatar
          user={owner}
          photoUrl={session?.photoUrl || owner?.avatar_url}
          name={session?.name || owner?.name}
          size={84}
        />
        <Text style={styles.name}>
          {session?.name || users.find((u) => u.id === activeUserId)?.name || 'AppCash'}
        </Text>
        <Text style={styles.email}>{session?.email || 'Not connected to Google'}</Text>
        <View style={styles.badges}>
          <View style={styles.badge}>
            <Ionicons
              name={session?.spreadsheetId ? 'link' : 'link-outline'}
              size={12}
              color={session?.spreadsheetId ? Palette.teal : Palette.amber}
            />
            <Text style={styles.badgeText}>
              {session?.spreadsheetId ? 'Sheet linked' : 'No sheet'}
            </Text>
          </View>
          <View style={styles.badge}>
            <Ionicons name="time-outline" size={12} color={Palette.textDim} />
            <Text style={styles.badgeText}>
              Sync {lastSyncAt ? new Date(lastSyncAt).toLocaleDateString() : 'never'}
            </Text>
          </View>
        </View>
      </GlassPanel>

      <SectionTitle
        title="Connections"
        subtitle="Purchase sheet is optional — categories & bills stay on this phone"
      />
      <GlassPanel style={styles.menu}>
        <MenuRow
          icon="grid-outline"
          iconColor={Palette.teal}
          title="Purchase sheet"
          subtitle={
            session?.spreadsheetId
              ? 'Sync Compras list with your partner'
              : 'Optional Google Sheet for purchases only'
          }
          onPress={() => router.push('/account/sheets' as never)}
        />
        <MenuRow
          icon="sparkles-outline"
          iconColor={Palette.violet}
          title="Receipt AI"
          subtitle="Provider and API tokens"
          onPress={() => router.push('/account/ai' as never)}
        />
      </GlassPanel>

      <View style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <SectionTitle
            title="Household"
            subtitle="Add people manually · tap photo to edit · long-press to remove"
          />
        </View>
        <Pressable onPress={openCreateMember} style={styles.addBtn}>
          <Ionicons name="person-add-outline" size={18} color={Palette.void} />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      {users.map((u) => {
        const on = activeUserId === u.id;
        return (
          <Pressable
            key={u.id}
            onPress={() => setActiveUser(u.id)}
            onLongPress={() => removeMember(u)}>
            <GlassPanel style={[styles.user, on && styles.userOn]}>
              <View style={styles.userRow}>
                <Pressable onPress={() => openEditMember(u)} hitSlop={6}>
                  <UserAvatar user={u} size={44} selected={on} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{u.name}</Text>
                  <Text style={styles.userMeta}>
                    {u.role}
                    {u.email ? ` · ${u.email}` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => openEditMember(u)} hitSlop={8} style={styles.editBtn}>
                  <Ionicons name="pencil-outline" size={16} color={Palette.textMuted} />
                </Pressable>
                {on ? <Ionicons name="checkmark-circle" size={22} color={Palette.cyan} /> : null}
              </View>
            </GlassPanel>
          </Pressable>
        );
      })}

      <PrimaryButton label="Sign out" variant="danger" onPress={() => setSignOutOpen(true)} />

      <PrimaryButton
        label="Wipe phone data"
        variant="ghost"
        onPress={() =>
          confirm(
            'Wipe all phone data?',
            'Deletes expenses, bills, savings and categories on this phone. Google account stays signed in if connected. This cannot be undone.',
            async () => {
              setBusy(true);
              try {
                await wipeLocalFinanceData();
                await refresh();
                alert('Cleared', 'Local finance data wiped. You can start fresh offline.');
              } catch (e) {
                alert('Error', e instanceof Error ? e.message : 'Could not wipe data');
              } finally {
                setBusy(false);
              }
            },
            { confirmLabel: 'Wipe everything', tone: 'danger', cancelLabel: 'Cancel' }
          )
        }
      />

      <AppModal
        visible={formOpen}
        title={editing ? 'Edit person' : 'Add person'}
        confirmLabel={savingMember ? 'Saving…' : 'Save'}
        cancelLabel="Cancel"
        confirmDisabled={savingMember}
        onCancel={() => setFormOpen(false)}
        onRequestClose={() => setFormOpen(false)}
        onConfirm={saveMember}>
        <Pressable onPress={pickPhoto} style={styles.photoPick}>
          <UserAvatar
            name={memberName || 'P'}
            photoUrl={memberPhoto}
            size={72}
          />
          <Text style={styles.photoHint}>Tap to add photo</Text>
        </Pressable>
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={memberName}
          onChangeText={setMemberName}
          placeholder="e.g. Partner, Alex…"
          placeholderTextColor={Palette.textDim}
          style={styles.input}
          autoFocus
        />
      </AppModal>

      <AppModal
        visible={signOutOpen}
        title="Sign out?"
        message="Disconnects Google. Your finances stay on this phone. You can keep using AppCash offline and link a purchase sheet again later."
        confirmLabel={busy ? 'Signing out…' : 'Disconnect Google'}
        cancelLabel="Stay connected"
        tone="danger"
        confirmDisabled={busy}
        onCancel={() => setSignOutOpen(false)}
        onConfirm={onLogout}
      />
      {Dialog}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: Spacing.md, gap: 6 },
  name: { color: Palette.text, fontFamily: Fonts.display, fontSize: 22, fontWeight: '800' },
  email: { color: Palette.textMuted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, justifyContent: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Palette.panelElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Palette.stroke,
  },
  badgeText: { color: Palette.textMuted, fontSize: 11, fontWeight: '600' },
  menu: { paddingVertical: 4, marginBottom: Spacing.sm },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Palette.cyan,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    marginTop: 4,
  },
  addBtnText: { color: Palette.void, fontWeight: '800', fontSize: 13 },
  user: { marginBottom: Spacing.sm },
  userOn: { borderColor: Palette.cyan },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userName: { color: Palette.text, fontWeight: '700', fontSize: 16 },
  userMeta: { color: Palette.textDim, fontSize: 12, marginTop: 2 },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.panelElevated,
  },
  photoPick: { alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  photoHint: { color: Palette.cyan, fontSize: 12, fontWeight: '700' },
  label: { color: Palette.textMuted, fontSize: 12, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: Palette.stroke,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: Palette.text,
    backgroundColor: Palette.panelElevated,
    fontSize: 16,
    marginTop: 6,
  },
});
