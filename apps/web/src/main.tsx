import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles/legacy.css';
import { Layout } from './Layout';
import { Placeholder } from './views/Placeholder';

// Hash routes keep the legacy URLs (#/quiz/sql, #/kb/sql/sq-0) working and need no server rewrites.
const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Placeholder title="Дашборд" /> },
      { path: 'dash', element: <Placeholder title="Дашборд" /> },
      { path: 'quiz/*', element: <Placeholder title="Тести" /> },
      { path: 'recall/*', element: <Placeholder title="Active Recall" /> },
      { path: 'kb/*', element: <Placeholder title="Knowledge Base" /> },
    ],
  },
]);

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
