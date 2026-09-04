# React + TypeScript Starter — Design

**Date:** 2026-09-05
**Status:** Approved
**Project:** `pitch`

## Purpose

A clean, unopinionated React + TypeScript single-page app scaffold. No product
domain baked in — routing, styling, testing, and linting are wired up and
verified, and the example content is meant to be deleted on day one.

This is deliberately *not* a framework starter. There is no SSR, no server
components, no file-based routing convention to learn. It is a client-rendered
SPA that builds to static assets.

## Decisions

### Bundler: Vite

Considered Parcel, Rspack, Next.js, and a hand-rolled esbuild setup.

- **Parcel** — genuine zero-config, but a much smaller community. Edge cases
  tend to have no existing answer.
- **Rspack** — fast and webpack-compatible, but requires hand-written config.
  Its strength is migrating existing webpack apps, not greenfield work.
- **Next.js** — a strong framework, but the wrong shape here. Server components,
  file routing, and a server-ish deploy story are large commitments to make
  before knowing what the app is.
- **esbuild alone** — would mean owning the dev server, HMR, CSS pipeline, and
  env-var loading by hand.

Vite wins on ecosystem size, is what the React docs point to now that Create
React App is deprecated and unmaintained, has a Rust bundler (Rolldown), and
lets Vitest drop in with no extra wiring.

### TypeScript: 6.0.3, not 7.x

TypeScript 7.0.2 is published and is the native compiler rewrite, but
`typescript-eslint@8.69.0` declares a peer range of `>=4.8.4 <6.1.0`. Adopting
TS 7 would break linting. 6.0.3 is the newest release inside the supported
range.

Revisit once `typescript-eslint` widens its peer range.

### Router: React Router 8, library mode

React Router 8 is current (v7 was named during design from a stale list). Used
in library mode via `createBrowserRouter` + `RouterProvider` — the SPA path,
not the framework/SSR path.

All routes live in a single table in `src/router.tsx`, so adding a page is one
edit in one known place.

### Styling: Tailwind CSS 4

Configured through the `@tailwindcss/vite` plugin with CSS-first configuration.
Tailwind 4 needs no `tailwind.config.js`; theme tokens are declared in
`src/index.css` under `@theme`.

## Stack

| Piece | Version |
|---|---|
| Vite | 8.2.2 |
| `@vitejs/plugin-react` | 6.1.1 |
| React / React DOM | 19.2.8 |
| TypeScript | 6.0.3 |
| React Router | 8.3.1 |
| Tailwind CSS + `@tailwindcss/vite` | 4.3.3 |
| Vitest | 5.0.0 |
| Testing Library (react / jest-dom) | 16.3.3 / 7.0.1 |
| jsdom | 30.0.1 |
| ESLint | 10.10.0 |
| typescript-eslint | 8.69.0 |
| Prettier | 3.9.6 |

## Structure

```
pitch/
├─ index.html            vite.config.ts     eslint.config.js
├─ package.json          tsconfig.json      .prettierrc
├─ vitest.setup.ts       .gitignore         README.md
├─ docs/superpowers/specs/
└─ src/
   ├─ main.tsx           # createRoot + RouterProvider
   ├─ router.tsx         # the route table
   ├─ index.css          # @import "tailwindcss" + @theme tokens
   ├─ vite-env.d.ts
   ├─ routes/
   │  ├─ root-layout.tsx # nav shell + <Outlet />
   │  ├─ home.tsx
   │  ├─ about.tsx
   │  └─ not-found.tsx
   └─ components/
      ├─ counter.tsx      # example stateful component
      └─ counter.test.tsx # example test
```

### Boundaries

- `main.tsx` — mounts React. Knows about the router, nothing else.
- `router.tsx` — the only place that maps paths to components.
- `routes/` — one file per page. Pages compose components; they hold no
  reusable logic.
- `components/` — reusable UI. Knows nothing about routing.

`Counter` and its test exist so `npm test` asserts against real rendered
output rather than a placeholder. Both are disposable.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run preview` | Serve the built output locally |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest in watch mode |
| `npm run lint` | ESLint over the repo |
| `npm run format` | Prettier, write mode |
| `npm run typecheck` | `tsc --noEmit` |

## Testing

Vitest in a `jsdom` environment, with `vitest.setup.ts` registering
`@testing-library/jest-dom` matchers. Component tests render through Testing
Library and assert on visible output, not implementation detail.

## Out of Scope

Deliberately excluded, to be added when a real need appears: state management
(Zustand/Redux), data fetching (TanStack Query), form libraries, component
libraries, CI configuration, Docker, and deployment config.

## Success Criteria

`npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` all pass
from a clean install, and `npm run dev` serves a navigable app.
