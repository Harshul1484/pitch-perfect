import { Suspense, lazy } from 'react';
import { createBrowserRouter } from 'react-router';
import { RootLayout } from './routes/root-layout';
import { Dashboard } from './routes/dashboard';
import { NotFound } from './routes/not-found';

/**
 * Notes is loaded on demand. It is the only page that touches Firestore, which
 * is a large dependency, and the tuner should not pay for it.
 */
const Notes = lazy(() =>
  import('./routes/notes').then((module) => ({ default: module.Notes })),
);

const loading = (
  <div className="flex h-screen items-center justify-center">
    <span className="mono-label">loading</span>
  </div>
);

/**
 * The route table. Adding a page means adding one entry here and one file
 * under `src/routes/`.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      {
        path: 'notes',
        element: (
          <Suspense fallback={loading}>
            <Notes />
          </Suspense>
        ),
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
