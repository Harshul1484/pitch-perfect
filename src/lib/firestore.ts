import {
  connectFirestoreEmulator,
  getFirestore,
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
export function getDb(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) return null;

  if (!db) {
    db = getFirestore(app);
    if (emulatorsRequested()) {
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
  }
  return db;
}
