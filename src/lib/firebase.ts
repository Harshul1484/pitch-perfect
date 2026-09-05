import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  type Auth,
} from 'firebase/auth';

/**
 * Firebase setup.
 *
 * The web config ships to the browser and is not secret — access is controlled
 * by Security Rules and authorised domains, not by hiding these values. They
 * come from the environment so the app can be pointed at another project
 * without editing code.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Which config keys are missing, if any. */
export function missingConfigKeys(
  values: Record<string, string | undefined> = config,
): string[] {
  return Object.entries(values)
    .filter(([, value]) => value === undefined || value === '')
    .map(([key]) => key);
}

export const isFirebaseConfigured = missingConfigKeys().length === 0;

/**
 * Point at the local emulators instead of the real project.
 *
 * Development only, and opt-in per page load, so an end-to-end test can drive
 * the full sign-in and save path with a throwaway user. The DEV check means
 * this cannot be switched on in a production build.
 */
export function emulatorsRequested(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('emulator') === '1';
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

/**
 * The Auth instance, created on first use. Returns null when the project is
 * not configured, so the app still runs — signing in is simply unavailable
 * rather than the whole page failing to mount.
 */
export function getFirebaseAuth(): Auth | null {
  if (!isFirebaseConfigured) return null;

  app ??= initializeApp(config);
  if (!auth) {
    auth = getAuth(app);
    if (emulatorsRequested()) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
  }
  return auth;
}

/** The shared app instance, for modules that add their own Firebase service. */
export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;

  app ??= initializeApp(config);
  return app;
}

export function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  // Always show the chooser, rather than silently reusing one Google session.
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}
