# Google Sign-In — Design

**Date:** 2026-09-05
**Status:** Built

## Purpose

Sign in with Google, via Firebase Authentication. First step toward per-user
data; the database comes later.

## Firebase project

`pitchperfect-e6070`, project number 117543678655.

No web app existed, so one was created with the CLI:

```
firebase apps:create WEB "pitch" --project pitchperfect-e6070
```

App ID `1:117543678655:web:cd98f7e0120995b3694c0a`. Config read back with
`firebase apps:sdkconfig WEB <appId>`.

## Config lives in the environment

`.env.local`, which `.gitignore` already excludes, with a committed
`.env.example` documenting the keys.

The Firebase web config is **not secret** — it ships to every browser that
loads the app, and access is controlled by Security Rules and authorised
domains, not by hiding these values. It is in the environment so the app can
be pointed at a different Firebase project without editing code, not to keep
it private.

Because the values are absent on a fresh clone, `isFirebaseConfigured` gates
everything: `getFirebaseAuth()` returns null and the account control renders
nothing. The app still runs; signing in is simply unavailable. An inert
sign-in button would be worse than no button.

## Popup, not redirect

`signInWithPopup`. This is a desktop practice tool, and a popup keeps the
running app — a live microphone stream, a sounding drone — alive, where a
redirect would tear the page down and lose it.

The provider asks for `prompt: 'select_account'`, so it always shows the
chooser rather than silently reusing whichever Google session the browser
happens to hold.

## Errors are translated, and silence is a valid outcome

Firebase error codes are mapped to sentences. Closing the popup returns
**null** rather than an error string: the user cancelling is not a failure and
should not leave a red message behind.

| Code | Shown |
|---|---|
| `popup-closed-by-user`, `cancelled-popup-request` | nothing |
| `popup-blocked` | allow popups for this site |
| `operation-not-allowed` | Google sign-in is not enabled for this project |
| `unauthorized-domain` | domain not authorised in Firebase settings |
| `network-request-failed` | network error reaching Firebase |
| anything else | "Could not sign in." |

The mapping is a pure function and is unit tested; the fallback exists so a
raw `auth/...` code never reaches the interface.

## Session state

`onAuthStateChanged` is the single source of truth. `signIn` does not set the
signed-in state on success — the listener does — so a session restored on page
load and a fresh sign-in follow exactly the same path.

Status is explicit: `loading`, `signed-out`, `signing-in`, `signed-in`,
`unavailable`. The `loading` state matters because Firebase resolves an
existing session asynchronously, and without it the header would flash "sign
in" at someone who is already signed in.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `eslint .` | pass |
| `vitest run` | 90 tests pass |
| `vite build` | pass |
| Live popup | reaches Google's account chooser |

The popup check is the one that matters: it drives the real button against the
real project and confirms the popup lands on `accounts.google.com` with the
title "Sign in - Google Accounts". That would fail with
`auth/operation-not-allowed` if the Google provider were switched off.

**Not verified:** completing a sign-in, which needs real Google credentials.
So the signed-in header state, the avatar fallback and sign-out have not been
exercised against a live session.

## Known noise

- Chrome logs "Cross-Origin-Opener-Policy policy would block the
  window.closed call" twice per sign-in. This is Firebase polling the popup;
  it is benign and does not affect the flow.
- `/favicon.ico` 404s, because `index.html` declares no icon.

## Out of Scope

Firestore and any per-user data, other providers, email link sign-in, account
linking, protecting routes behind auth, and server-side session verification.
