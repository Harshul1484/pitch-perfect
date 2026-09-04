import { createBrowserRouter } from 'react-router';
import { RootLayout } from './routes/root-layout';
import { Dashboard } from './routes/dashboard';
import { NotFound } from './routes/not-found';

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
      { path: '*', element: <NotFound /> },
    ],
  },
]);
