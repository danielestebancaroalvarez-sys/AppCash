import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as SecureStore from 'expo-secure-store';
import type { GoogleSession } from '@/types/models';

const SESSION_KEY = 'appcash_google_session';

/** Release keystore SHA-1 (credentials/android/appcash.jks) — must match Google Cloud Android OAuth client. */
export const ANDROID_RELEASE_SHA1 = '5A:E2:53:7E:BA:1E:27:75:66:8F:3B:D6:11:C8:B0:73:CB:8A:92:6C';
/** Debug keystore SHA-1 (android/app/debug.keystore). */
export const ANDROID_DEBUG_SHA1 = '5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

export function getGoogleClientIds() {
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    googleWebClientId?: string;
    googleAndroidClientId?: string;
  };
  return {
    webClientId: (
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
      extra.googleWebClientId ??
      ''
    ).trim(),
    androidClientId: (
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ??
      extra.googleAndroidClientId ??
      ''
    ).trim(),
  };
}

/**
 * Native Google Sign-In needs the Web client ID for token exchange,
 * and an Android OAuth client (package + SHA-1) registered in the same Cloud project.
 */
export function isGoogleConfigured(): boolean {
  const { webClientId, androidClientId } = getGoogleClientIds();
  if (Platform.OS === 'android') {
    // Android OAuth client must exist in Cloud Console; ID string is also required here
    // so misconfigured release builds fail early with a clear message.
    return Boolean(webClientId && androidClientId);
  }
  return Boolean(webClientId);
}

let configured = false;

export function configureGoogleSignIn(): void {
  if (configured) return;
  const { webClientId } = getGoogleClientIds();
  if (!webClientId) return;

  GoogleSignin.configure({
    webClientId,
    scopes: GOOGLE_SCOPES,
    offlineAccess: false,
    forceCodeForRefreshToken: false,
  });
  configured = true;
}

export async function loadGoogleSession(): Promise<GoogleSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GoogleSession;
  } catch {
    return null;
  }
}

export async function saveGoogleSession(session: GoogleSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearGoogleSession(): Promise<void> {
  try {
    configureGoogleSignIn();
    const current = await GoogleSignin.getCurrentUser();
    if (current) {
      await GoogleSignin.signOut();
    }
  } catch {
    // ignore native sign-out errors
  }
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function fetchGoogleProfile(accessToken: string): Promise<{
  email: string;
  name: string;
  photoUrl?: string;
}> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to load Google profile');
  const data = (await res.json()) as { email: string; name: string; picture?: string };
  return { email: data.email, name: data.name, photoUrl: data.picture };
}

export async function createSessionFromToken(
  accessToken: string,
  extras?: Partial<GoogleSession>
): Promise<GoogleSession> {
  const profile = await fetchGoogleProfile(accessToken);
  const session: GoogleSession = {
    accessToken,
    email: profile.email,
    name: profile.name,
    photoUrl: profile.photoUrl,
    ...extras,
  };
  await saveGoogleSession(session);
  return session;
}

export type GoogleSignInResult =
  | { ok: true; session: GoogleSession }
  | { ok: false; cancelled?: boolean; message: string };

/**
 * Native Google Sign-In (Play Services). Avoids the blocked custom-scheme browser OAuth flow.
 */
export async function signInWithGoogleNative(): Promise<GoogleSignInResult> {
  if (!isGoogleConfigured()) {
    return {
      ok: false,
      message:
        'Missing Google Client IDs. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID to .env, then rebuild the app.',
    };
  }

  configureGoogleSignIn();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      return { ok: false, cancelled: true, message: 'Sign-in was cancelled.' };
    }

    try {
      // May prompt again if Sheets/Drive were not granted on first consent
      await GoogleSignin.addScopes({ scopes: GOOGLE_SCOPES });
    } catch {
      // continue — getTokens still works if scopes were already approved
    }

    const tokens = await GoogleSignin.getTokens();
    if (!tokens.accessToken) {
      return { ok: false, message: 'Google did not return an access token.' };
    }

    const user = response.data.user;
    const session: GoogleSession = {
      accessToken: tokens.accessToken,
      email: user.email,
      name: user.name ?? user.email,
      photoUrl: user.photo ?? undefined,
    };
    await saveGoogleSession(session);
    return { ok: true, session };
  } catch (error) {
    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          return { ok: false, cancelled: true, message: 'Sign-in was cancelled.' };
        case statusCodes.IN_PROGRESS:
          return { ok: false, message: 'Sign-in already in progress.' };
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          return { ok: false, message: 'Google Play Services is not available on this device.' };
        case 'DEVELOPER_ERROR':
          return {
            ok: false,
            message:
              'DEVELOPER_ERROR: Android OAuth SHA-1 does not match this APK.\n\n' +
              'Google Cloud → Credentials → Android OAuth client:\n' +
              'Package: com.deco2449584.appcash\n' +
              `Release SHA-1: ${ANDROID_RELEASE_SHA1}\n` +
              `Debug SHA-1: ${ANDROID_DEBUG_SHA1}\n\n` +
              'Add BOTH fingerprints (or create two Android clients), wait a few minutes, reinstall the app.',
          };
        default:
          return { ok: false, message: error.message || `Google error (${error.code})` };
      }
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unknown Google Sign-In error',
    };
  }
}
