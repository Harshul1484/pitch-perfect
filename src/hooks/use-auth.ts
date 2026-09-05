import { useCallback, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth, googleProvider, isFirebaseConfigured } from '../lib/firebase';

export type AuthStatus =
  /** Still resolving whether a session exists. */
  | 'loading'
  | 'signed-out'
  | 'signing-in'
  | 'signed-in'
  /** No Firebase config, so signing in is not offered. */
  | 'unavailable';

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  error: string | null;
  signIn: () => void;
  signOut: () => void;
}

/** Turn a Firebase error code into something worth reading. */
export function describeAuthError(code: string): string | null {
  switch (code) {
    // The user shut the popup. Not an error worth shouting about.
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/popup-blocked':
      return 'The sign-in popup was blocked. Allow popups for this site.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled for this Firebase project.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorised in Firebase Authentication settings.';
    case 'auth/network-request-failed':
      return 'Network error reaching Firebase.';
    default:
      return 'Could not sign in.';
  }
}

function errorCodeOf(cause: unknown): string {
  return typeof cause === 'object' && cause !== null && 'code' in cause
    ? String((cause as { code: unknown }).code)
    : '';
}

export function useAuth(): AuthState {
  const [status, setStatus] = useState<AuthStatus>(
    isFirebaseConfigured ? 'loading' : 'unavailable',
  );
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setStatus(nextUser ? 'signed-in' : 'signed-out');
    });
  }, []);

  const signIn = useCallback(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;

    setStatus('signing-in');
    setError(null);

    signInWithPopup(auth, googleProvider())
      // onAuthStateChanged sets the signed-in state, so there is nothing to do
      // here on success.
      .catch((cause: unknown) => {
        setError(describeAuthError(errorCodeOf(cause)));
        setStatus('signed-out');
      });
  }, []);

  const signOut = useCallback(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;

    setError(null);
    void firebaseSignOut(auth);
  }, []);

  return { status, user, error, signIn, signOut };
}
