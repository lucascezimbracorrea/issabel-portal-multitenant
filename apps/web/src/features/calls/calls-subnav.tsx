import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';

const links = [
  { to: '/calls' as const, key: 'calls.nav.overview' },
  { to: '/calls/online' as const, key: 'calls.nav.online' },
  { to: '/calls/history' as const, key: 'calls.nav.history' },
];

export function CallsSubNav() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
      {links.map((l) => {
        const active =
          l.to === '/calls/online'
            ? pathname.startsWith('/calls/online')
            : l.to === '/calls/history'
              ? pathname.startsWith('/calls/history')
              : pathname === '/calls' || pathname === '/calls/';
        return (
          <Link
            key={l.to}
            to={l.to}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-teal-600 text-white shadow-sm' : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t(l.key)}
          </Link>
        );
      })}
    </nav>
  );
}
