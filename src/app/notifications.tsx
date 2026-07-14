import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, SectionTitle } from '@/components/ui/Primitives';
import { UserName } from '@/components/ui/UserAvatar';
import { Fonts, Palette, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { upsertNotification } from '@/lib/db';
import { nowIso, formatDisplayDate } from '@/lib/dates';
import { queueMutation } from '@/lib/sync/engine';

export default function NotificationsScreen() {
  const notifications = useFinanceStore((s) => s.notifications);
  const users = useFinanceStore((s) => s.users);
  const refresh = useFinanceStore((s) => s.refresh);

  const markRead = async (id: string) => {
    const n = notifications.find((x) => x.id === id);
    if (!n) return;
    const updated = { ...n, status: 'read' as const, updated_at: nowIso() };
    await upsertNotification(updated);
    await queueMutation('notifications', updated);
    await refresh();
  };

  return (
    <Screen tabAware={false}>
      <Text style={styles.title}>Notification tray</Text>
      <SectionTitle title="Reminders & alerts" subtitle="Manual bills, goals, sync notes" />
      {notifications.length === 0 ? (
        <GlassPanel>
          <Text style={styles.empty}>No notifications yet.</Text>
        </GlassPanel>
      ) : (
        notifications.map((n) => {
          const user = users.find((u) => u.id === n.user_id);
          return (
            <Pressable key={n.id} onPress={() => markRead(n.id)}>
              <GlassPanel style={[styles.row, n.status === 'read' ? styles.read : null]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{n.title}</Text>
                  <Text style={styles.body}>{n.body}</Text>
                  <View style={styles.metaRow}>
                    {user ? (
                      <UserName user={user} size={16} textStyle={styles.meta} />
                    ) : (
                      <Text style={styles.meta}>Household</Text>
                    )}
                    <Text style={styles.meta}>
                      · due {formatDisplayDate(n.due_at)} · {n.status}
                    </Text>
                  </View>
                </View>
              </GlassPanel>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: Spacing.sm,
  },
  row: { marginBottom: Spacing.sm },
  read: { opacity: 0.55 },
  name: { color: Palette.text, fontWeight: '700' },
  body: { color: Palette.textMuted, marginTop: 4 },
  meta: { color: Palette.textDim, fontSize: 11 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  empty: { color: Palette.textMuted },
});
