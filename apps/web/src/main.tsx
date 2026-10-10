import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, Navigate, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles/legacy.css';
import './styles/app.css';
import { Layout } from './Layout';
import { AuthProvider } from './auth/AuthProvider';
import { ProgressProvider } from './progress/ProgressProvider';
import { AuthPage } from './views/AuthPage';
import { ImportPage } from './views/ImportPage';
import { Dashboard } from './views/Dashboard';
import { KnowledgeBase } from './views/KnowledgeBase';
import { Quiz } from './views/Quiz';
import { Recall } from './views/Recall';

// Hash routes keep the legacy URLs (#/quiz/sql, #/kb/sql/sq-0/2) working and need no server rewrites.
const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/dash" replace /> },
      { path: 'dash', element: <Dashboard /> },
      { path: 'quiz/:sectionId?', element: <Quiz /> },
      { path: 'recall/:a?/:b?', element: <Recall /> },
      { path: 'kb/:topicId?/:chapterId?/:art?', element: <KnowledgeBase /> },
      { path: 'login', element: <AuthPage mode="login" /> },
      { path: 'register', element: <AuthPage mode="register" /> },
      { path: 'import', element: <ImportPage /> },
      { path: '*', element: <Navigate to="/dash" replace /> },
    ],
  },
]);

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProgressProvider>
          <RouterProvider router={router} />
        </ProgressProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
