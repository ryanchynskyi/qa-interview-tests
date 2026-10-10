import { NavLink, Outlet } from 'react-router';
import { useQuery } from '@tanstack/react-query';

const VIEWS = [
  { to: '/dash', label: 'Дашборд' },
  { to: '/quiz', label: 'Тести' },
  { to: '/recall', label: 'Active Recall' },
  { to: '/kb', label: 'Knowledge Base' },
];

interface Health {
  status: string;
  db: string;
  content?: { questions: number; recallCards: number; articles: number };
}

export function Layout() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async (): Promise<Health> => {
      const res = await fetch('/api/health');
      return res.json();
    },
    retry: false,
  });

  return (
    <div className="wrap">
      <h1>QA Interview Hub</h1>
      <p className="sub">Тести, Active Recall і база знань для співбесіди Senior QA Automation.</p>
      <nav className="views" aria-label="Розділи">
        {VIEWS.map((v) => (
          // NavLink sets aria-current="page", which the legacy CSS already styles.
          <NavLink key={v.to} to={v.to}>
            {v.label}
          </NavLink>
        ))}
      </nav>
      <main>
        <Outlet />
      </main>
      <footer>
        <span className="note" data-testid="api-status">
          {health.isPending && 'API: перевірка…'}
          {health.isError && 'API: недоступний'}
          {health.data &&
            (health.data.db === 'up'
              ? `API: ok · ${health.data.content?.questions} питань, ${health.data.content?.recallCards} карток, ${health.data.content?.articles} статей`
              : 'API: база даних недоступна')}
        </span>
      </footer>
    </div>
  );
}
