import { initializeApp, type FirebaseApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, type Auth } from 'firebase/auth';

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
  auth ??= getAuth(app);
  return auth;
}

export function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  // Always show the chooser, rather than silently reusing one Google session.
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}
