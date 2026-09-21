import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import { getDb } from '../lib/firestore';
import { isScoreData, type ScoreData } from '../lib/score';

export interface Composition {
  id: string;
  title: string;
  /** Notation in the compact text form, see lib/composition.ts. */
  notation: string;
  /** Pitch class treated as Sa. */
  tonic: number;
  /**
   * The engraved score, where the piece has one. Absent on every piece
   * written before sheet music existed, and on every piece typed by hand,
   * so nothing may assume it is there.
   */
  score?: ScoreData;
  updatedAt: Date | null;
}

export type CompositionsStatus = 'signed-out' | 'loading' | 'ready' | 'error';

export interface CompositionsState {
  status: CompositionsStatus;
  items: Composition[];
  error: string | null;
  /**
   * A new piece. An import arrives with its notation and score already in
   * hand, and they go in the same write as the title: a piece that exists
   * for a moment with a score and no notes is a piece a reload can find.
   */
  create: (
    title: string,
    tonic: number,
    contents?: { notation?: string; score?: ScoreData },
  ) => Promise<string | null>;
  save: (
    id: string,
    changes: { title?: string; notation?: string; tonic?: number; score?: ScoreData },
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const NO_ITEMS: Composition[] = [];

/** Firestore timestamps arrive as Timestamp, or null while a write is pending. */
function toDate(value: unknown): Date | null {
  return value && typeof value === 'object' && 'toDate' in value
    ? (value as Timestamp).toDate()
    : null;
}

/**
 * Live list of the signed-in user's compositions.
 *
 * Documents live under `users/{uid}/compositions`, so ownership is structural
 * and the security rules are a single uid comparison rather than a field check.
 *
 * onSnapshot keeps the list live, which also means a save needs no local
 * patching: the write goes up, the snapshot comes back down.
 */
export function useCompositions(uid: string | null): CompositionsState {
  const path = useMemo(() => (uid ? `users/${uid}/compositions` : null), [uid]);

  /**
   * Only what the snapshot tells us is stored. Signed-out and loading are
   * derived below, so the effect never calls setState synchronously — which
   * would otherwise cascade a render every time the subscription is rebuilt.
   *
   * The path is recorded alongside, so a result belonging to a previous user
   * is never shown as if it were the current one.
   */
  const [result, setResult] = useState<{
    path: string;
    items: Composition[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    const db = getDb();
    if (!db || !path) return;

    const q = query(collection(db, path), orderBy('updatedAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        setResult({
          path,
          error: null,
          items: snapshot.docs.map((entry) => {
            const data = entry.data();
            return {
              id: entry.id,
              title: typeof data.title === 'string' ? data.title : 'Untitled',
              notation: typeof data.notation === 'string' ? data.notation : '',
              tonic: typeof data.tonic === 'number' ? data.tonic : 0,
              // Checked rather than cast: a document is whatever is in it,
              // not necessarily what this build last wrote.
              score: isScoreData(data.score) ? data.score : undefined,
              updatedAt: toDate(data.updatedAt),
            };
          }),
        });
      },
      (cause) => setResult({ path, items: [], error: cause.message }),
    );
  }, [path]);

  const fresh = result !== null && result.path === path;

  const status: CompositionsStatus =
    path === null ? 'signed-out' : !fresh ? 'loading' : result.error ? 'error' : 'ready';

  const items = fresh && result.error === null ? result.items : NO_ITEMS;
  const error = fresh ? result.error : null;

  const create = useCallback(
    async (
      title: string,
      tonic: number,
      contents?: { notation?: string; score?: ScoreData },
    ) => {
      const db = getDb();
      if (!db || !path) return null;

      const created = await addDoc(collection(db, path), {
        title,
        notation: contents?.notation ?? '',
        tonic,
        // Spread rather than set: Firestore rejects an explicit undefined,
        // and a piece without a score should have no such field at all.
        ...(contents?.score ? { score: contents.score } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return created.id;
    },
    [path],
  );

  const save = useCallback(
    async (
      id: string,
      changes: { title?: string; notation?: string; tonic?: number; score?: ScoreData },
    ) => {
      const db = getDb();
      if (!db || !path) return;

      await updateDoc(doc(db, path, id), { ...changes, updatedAt: serverTimestamp() });
    },
    [path],
  );

  const remove = useCallback(
    async (id: string) => {
      const db = getDb();
      if (!db || !path) return;

      await deleteDoc(doc(db, path, id));
    },
    [path],
  );

  return { status, items, error, create, save, remove };
}
