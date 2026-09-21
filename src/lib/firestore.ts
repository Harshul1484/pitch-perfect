import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { emulatorsRequested, getFirebaseApp } from './firebase';

/**
 * Firestore lives in its own module so that importing it is a deliberate act.
 *
 * The tuner needs auth but never the database, and Firestore is by far the
 * larger dependency. Keeping it out of `firebase.ts` is what lets the notes
 * route be code-split away from the main bundle.
 */
let db: Firestore | null = null;

/** The Firestore instance, or null when the project is not configured. */
/**
 * Firestore with its cache kept on disk, so the notes a player has already
 * opened are there when the app is opened without a network — which, as an
 * installed app, it now can be. Writes made offline are queued and sent when
 * the network returns. Multiple tabs share the one cache rather than each
 * refusing to open it. Where the browser will not allow a persistent cache —
 * a private window, say — Firestore falls back to memory and the app runs as
 * it always did.
 */
function openWithLocalCache(app: Parameters<typeof getFirestore>[0]): Firestore {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    return getFirestore(app);
  }
}

export function getDb(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) return null;

  if (!db) {
    db = openWithLocalCache(app);
    if (emulatorsRequested()) {
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
  }
  return db;
}
