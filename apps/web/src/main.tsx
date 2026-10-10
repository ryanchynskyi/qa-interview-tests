import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, Navigate, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles/legacy.css';
import './styles/app.css';
import { Layout } from './Layout';
import { AuthProvider } from './auth/AuthProvider';
import { ProgressProvider } from './progress/ProgressProvider';

// Views load on demand so the first paint only needs the shell (layout, providers, router).
const views = {
  dash: () => import('./views/Dashboard').then((m) => ({ Component: m.Dashboard })),
  quiz: () => import('./views/Quiz').then((m) => ({ Component: m.Quiz })),
  recall: () => import('./views/Recall').then((m) => ({ Component: m.Recall })),
  kb: () => import('./views/KnowledgeBase').then((m) => ({ Component: m.KnowledgeBase })),
  login: () => import('./views/AuthPage').then((m) => ({ element: <m.AuthPage mode="login" /> })),
  register: () =>
    import('./views/AuthPage').then((m) => ({ element: <m.AuthPage mode="register" /> })),
  googleDone: () => import('./views/AuthPage').then((m) => ({ Component: m.GoogleDone })),
  import: () => import('./views/ImportPage').then((m) => ({ Component: m.ImportPage })),
  profile: () => import('./views/Profile').then((m) => ({ Component: m.Profile })),
};

// Hash routes keep the legacy URLs (#/quiz/sql, #/kb/sql/sq-0/2) working and need no server rewrites.
const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/dash" replace /> },
      { path: 'dash', lazy: views.dash },
      { path: 'quiz/:sectionId?', lazy: views.quiz },
      { path: 'recall/:a?/:b?', lazy: views.recall },
      { path: 'kb/:topicId?/:chapterId?/:art?', lazy: views.kb },
      { path: 'login', lazy: views.login },
      { path: 'register', lazy: views.register },
      { path: 'auth/google', lazy: views.googleDone },
      { path: 'import', lazy: views.import },
      { path: 'profile', lazy: views.profile },
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
