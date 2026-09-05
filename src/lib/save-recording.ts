import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDb } from './firestore';

/**
 * Write a recording to the signed-in user's notes.
 *
 * This lives on its own so the tuner can reach it with a dynamic import.
 * Firestore is the largest dependency in the app and the tuner otherwise never
 * touches it; pulling it into the main bundle just to have a save button would
 * cost every visitor who never records anything.
 */
export async function saveRecording(
  uid: string,
  title: string,
  notation: string,
  tonic: number,
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  await addDoc(collection(db, `users/${uid}/compositions`), {
    title,
    notation,
    tonic,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return true;
}
