import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';

const links = [
  { to: '/security/blocklist' as const, key: 'security.nav.blocklist' },
  { to: '/security/auto-config' as const, key: 'security.nav.auto' },
  { to: '/security/logs' as const, key: 'security.nav.logs' },
  { to: '/security/trustlist' as const, key: 'security.nav.trustlist' },
];

export function SecuritySubNav() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
      {links.map((l) => {
        const active = pathname === l.to;
        return (
          <Link
            key={l.to}
            to={l.to}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-rose-600 text-white shadow-sm' : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t(l.key)}
          </Link>
        );
      })}
    </nav>
  );
}
