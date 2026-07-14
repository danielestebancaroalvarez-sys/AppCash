import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { GlassPanel, SectionTitle } from '@/components/ui/Primitives';
import { MenuRow } from '@/components/ui/MenuRow';
import { useAppDialog } from '@/components/ui/useAppDialog';
import { CollapsibleWidget } from '@/components/ui/CollapsibleWidget';
import { WidgetTitle } from '@/components/dashboard/WidgetTitle';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useFinanceStore } from '@/stores/finance-store';
import { useSheetRefresh } from '@/hooks/use-sheet-refresh';
import { useWidgetPrefs } from '@/hooks/use-widget-prefs';
import { DASHBOARD_WIDGETS } from '@/lib/dashboard/widgets';
import { recomputeProductStats } from '@/lib/insights/market';
import { scheduleFixedItemReminders } from '@/lib/notifications/schedule';

export default function MoreScreen() {
  const router = useRouter();
  const session = useFinanceStore((s) => s.session);
  const pendingSyncCount = useFinanceStore((s) => s.pendingSyncCount);
  const syncPaused = useFinanceStore((s) => s.syncPaused);
  const refresh = useFinanceStore((s) => s.refresh);
  const { alert, Dialog } = useAppDialog();
  const { refreshing, onRefresh } = useSheetRefresh();
  const { prefs, setEnabled } = useWidgetPrefs();

  const onInsights = async () => {
    await recomputeProductStats();
    await refresh();
    router.push('/insights' as never);
  };

  const onNotify = async () => {
    const n = await scheduleFixedItemReminders();
    await refresh();
    alert('Reminders', `Scheduled ${n} manual payment reminders.`);
  };

  const enabledCount = DASHBOARD_WIDGETS.filter((w) => prefs[w.id] !== false).length;

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <Text style={styles.kicker}>AppCash</Text>
      <Text style={styles.title}>More</Text>
      <Text style={styles.sub}>
        Money tools stay on this phone. Optional purchase sheet for your partner is under Account.
      </Text>

      <SectionTitle title="Money" subtitle="Day-to-day tracking" />
      <GlassPanel style={styles.menu}>
        <MenuRow
          icon="calendar-outline"
          iconColor={Palette.coral}
          title="Fixed income & bills"
          subtitle="Recurring money in and out"
          onPress={() => router.push('/fixed' as never)}
        />
        <MenuRow
          icon="pricetags-outline"
          iconColor={Palette.violet}
          title="Categories"
          subtitle="Labels for expenses and income"
          onPress={() => router.push('/categories' as never)}
        />
        <MenuRow
          icon="folder-open-outline"
          iconColor="#5B8CFF"
          title="Receipt archive"
          subtitle="Browse saved receipts — scan with AI from Add"
          onPress={() => router.push('/receipts' as never)}
        />
        <MenuRow
          icon="trending-up-outline"
          iconColor={Palette.teal}
          title="Market prediction"
          subtitle="What to buy next from grocery history"
          onPress={onInsights}
        />
        <MenuRow
          icon="notifications-outline"
          iconColor={Palette.amber}
          title="Payment reminders"
          subtitle="Alerts for manual bills"
          onPress={onNotify}
        />
      </GlassPanel>

      <SectionTitle title="Setup" subtitle="Account and optional purchase sheet" />
      <GlassPanel style={styles.menu}>
        <MenuRow
          icon="person-circle-outline"
          iconColor={Palette.cyan}
          title="Account"
          subtitle={
            session?.email
              ? `${session.email} · household & Google`
              : 'Profiles · link Google for purchase sheet'
          }
          onPress={() => router.push('/profile' as never)}
        />
        <MenuRow
          icon="grid-outline"
          iconColor={Palette.mint}
          title="Purchase sheet"
          subtitle={
            syncPaused
              ? 'Sync paused — tap to retry'
              : pendingSyncCount > 0
                ? `${pendingSyncCount} change(s) waiting to sync`
                : 'Optional Google Sheet for Fixed, Savings & purchases'
          }
          badge={pendingSyncCount}
          onPress={() => router.push('/account/sheets' as never)}
        />
        <MenuRow
          icon="sparkles-outline"
          iconColor={Palette.amber}
          title="Receipt AI"
          subtitle="Gemini / NVIDIA / OpenRouter keys"
          onPress={() => router.push('/account/ai' as never)}
        />
      </GlassPanel>

      <SectionTitle title="Home screen" subtitle="Toggle which dashboard cards you see" />
      <CollapsibleWidget
        accent={Palette.cyan}
        defaultExpanded={false}
        header={<WidgetTitle icon="apps-outline" title="Dashboard widgets" />}
        collapsedSummary={
          <Text style={styles.widgetSummary}>
            {enabledCount} of {DASHBOARD_WIDGETS.length} visible
          </Text>
        }>
        {DASHBOARD_WIDGETS.map((w) => {
          const on = prefs[w.id] !== false;
          return (
            <Pressable
              key={w.id}
              onPress={() => setEnabled(w.id, !on)}
              style={styles.widgetRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.widgetLabel}>{w.label}</Text>
                <Text style={styles.widgetHint}>{w.hint}</Text>
              </View>
              <View style={[styles.toggle, on && styles.toggleOn]}>
                <Text style={[styles.toggleText, on && styles.toggleTextOn]}>
                  {on ? 'On' : 'Off'}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </CollapsibleWidget>

      <View style={{ height: Spacing.lg }} />
      {Dialog}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: Palette.cyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: Palette.text,
    fontFamily: Fonts.display,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 2,
  },
  sub: {
    color: Palette.textMuted,
    fontSize: 13,
    marginTop: 6,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  menu: { paddingVertical: 2, marginBottom: Spacing.sm },
  widgetSummary: { color: Palette.textDim, fontSize: 12 },
  widgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.stroke,
  },
  widgetLabel: { color: Palette.text, fontWeight: '700', fontSize: 14 },
  widgetHint: { color: Palette.textDim, fontSize: 11, marginTop: 2 },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: Palette.glassFillStrong,
    borderWidth: 1,
    borderColor: Palette.glassStroke,
    minWidth: 48,
    alignItems: 'center',
  },
  toggleOn: { backgroundColor: Palette.cyan, borderColor: Palette.cyan },
  toggleText: { color: Palette.textMuted, fontSize: 12, fontWeight: '700' },
  toggleTextOn: { color: Palette.void },
});
