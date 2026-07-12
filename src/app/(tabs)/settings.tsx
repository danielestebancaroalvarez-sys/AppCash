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
        Shortcuts for money setup. Sheet sync and AI keys live under Account (profile photo).
      </Text>

      <SectionTitle title="Money setup" />
      <GlassPanel style={styles.menu}>
        <MenuRow
          icon="receipt-outline"
          iconColor="#5B8CFF"
          title="Receipts"
          subtitle="Photos, dates, and line items"
          onPress={() => router.push('/receipts' as never)}
        />
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
          icon="notifications-outline"
          iconColor={Palette.amber}
          title="Payment reminders"
          subtitle="Schedule alerts for manual bills"
          onPress={onNotify}
        />
        <MenuRow
          icon="trending-up-outline"
          iconColor={Palette.teal}
          title="Market insights"
          subtitle="Predictions from grocery receipts"
          onPress={onInsights}
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

      <SectionTitle title="Account" />
      <GlassPanel style={styles.menu}>
        <MenuRow
          icon="person-circle-outline"
          iconColor={Palette.cyan}
          title="Open account"
          subtitle={
            session?.email
              ? `${session.email} · Sheets & AI tokens`
              : 'Profile, Google Sheets, receipt AI'
          }
          onPress={() => router.push('/profile' as never)}
        />
      </GlassPanel>

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
    backgroundColor: Palette.panelElevated,
    borderWidth: 1,
    borderColor: Palette.stroke,
    minWidth: 48,
    alignItems: 'center',
  },
  toggleOn: { backgroundColor: Palette.cyan, borderColor: Palette.cyan },
  toggleText: { color: Palette.textMuted, fontSize: 12, fontWeight: '700' },
  toggleTextOn: { color: Palette.void },
});
