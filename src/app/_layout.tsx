import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFinanceStore } from '@/stores/finance-store';
import { Palette, Fonts } from '@/constants/theme';
import { flushPendingPurchasesSync, syncNow } from '@/lib/sync/engine';

const queryClient = new QueryClient();

function AuthGate({ children }: { children: ReactNode }) {
  const ready = useFinanceStore((s) => s.ready);
  const booting = useFinanceStore((s) => s.booting);
  const session = useFinanceStore((s) => s.session);
  const localMode = useFinanceStore((s) => s.localMode);
  const bootstrap = useFinanceStore((s) => s.bootstrap);
  const refresh = useFinanceStore((s) => s.refresh);
  const router = useRouter();
  const segments = useSegments();
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!ready) return;
    const root = String(segments[0] ?? '');
    const inAuth = root === 'login';
    const allowed = localMode || Boolean(session);
    if (!allowed && !inAuth) {
      router.replace('/login' as never);
    } else if (allowed && inAuth) {
      router.replace('/(tabs)' as never);
    }
  }, [ready, session, localMode, segments, router]);

  useEffect(() => {
    // Background purchase sync only when Google + sheet are linked
    if (!ready || !session?.spreadsheetId || !session.accessToken) return;
    let alive = true;
    const tick = async () => {
      if (!alive || syncing) return;
      setSyncing(true);
      try {
        const result = await syncNow({ force: false, push: true, pull: true });
        if (result.mode === 'sheets') await refresh();
      } finally {
        if (alive) setSyncing(false);
      }
    };
    const boot = setTimeout(tick, 8000);
    const id = setInterval(tick, 120000);
    return () => {
      alive = false;
      clearTimeout(boot);
      clearInterval(id);
    };
  }, [ready, session?.spreadsheetId, session?.accessToken, refresh]);

  useEffect(() => {
    // Returning to the app: one forced retry (resets pause after max attempts)
    if (!ready || !session?.spreadsheetId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void (async () => {
        const result = await flushPendingPurchasesSync({ force: true });
        if (result.ok && result.mode === 'sheets') await refresh();
        else if (result.message) {
          useFinanceStore.setState({ syncMessage: result.message });
        }
      })();
    });
    return () => sub.remove();
  }, [ready, session?.spreadsheetId, refresh]);

  if (!ready || booting) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={Palette.cyan} size="large" />
        <Text style={styles.bootText}>AppCash</Text>
        <Text style={styles.bootSub}>Loading your ledger…</Text>
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <AuthGate>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: Palette.deep },
            headerTintColor: Palette.text,
            headerTitleStyle: { fontFamily: Fonts.display, fontWeight: '700' },
            contentStyle: { backgroundColor: Palette.void },
            headerShadowVisible: false,
          }}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications', presentation: 'modal' }} />
          <Stack.Screen name="profile" options={{ title: 'Account', presentation: 'modal' }} />
          <Stack.Screen name="account/sheets" options={{ title: 'Purchase sheet', presentation: 'modal' }} />
          <Stack.Screen name="account/ai" options={{ title: 'Receipt AI', presentation: 'modal' }} />
          <Stack.Screen name="receipt/review" options={{ title: 'Review receipt', presentation: 'modal' }} />
          <Stack.Screen name="receipts/index" options={{ title: 'Receipts' }} />
          <Stack.Screen name="receipts/new" options={{ title: 'Add receipt', presentation: 'modal' }} />
          <Stack.Screen name="receipts/[id]" options={{ title: 'Receipt', presentation: 'modal' }} />
          <Stack.Screen name="fixed/index" options={{ title: 'Fixed income & bills' }} />
          <Stack.Screen name="fixed/edit" options={{ title: 'Edit fixed item', presentation: 'modal' }} />
          <Stack.Screen name="categories" options={{ title: 'Categories' }} />
          <Stack.Screen name="insights" options={{ title: 'Market prediction' }} />
          <Stack.Screen name="savings/edit" options={{ title: 'Savings goal', presentation: 'modal' }} />
          <Stack.Screen name="transaction/edit" options={{ title: 'Edit entry', presentation: 'modal' }} />
        </Stack>
      </AuthGate>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: Palette.void,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  bootText: {
    color: Palette.cyan,
    fontFamily: Fonts.display,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bootSub: { color: Palette.textMuted },
});
