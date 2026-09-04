# pitch

A clean React + TypeScript single-page app starter. No product domain baked in —
routing, styling, testing, and linting are wired up, and the example content is
meant to be deleted.

## Getting started

```bash
npm install
npm run dev
```

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

## Stack

Vite 8 · React 19 · TypeScript 6 · React Router 8 (library mode) ·
Tailwind CSS 4 · Vitest 5 + Testing Library · ESLint 10 · Prettier 3

TypeScript is pinned to 6.0.3 rather than 7.x because `typescript-eslint`
peers on `>=4.8.4 <6.1.0`. Revisit when that range widens.

## Layout

```
src/
├─ main.tsx      # mounts React
├─ router.tsx    # the route table — add pages here
├─ index.css     # Tailwind import + theme tokens
├─ routes/       # one file per page
└─ components/   # reusable UI, knows nothing about routing
```

`components/counter.tsx` and its test exist so `npm test` asserts against real
rendered output. Both are disposable.

## Design notes

See [`docs/superpowers/specs/`](docs/superpowers/specs/) for the design spec and
the reasoning behind the toolchain choices.
