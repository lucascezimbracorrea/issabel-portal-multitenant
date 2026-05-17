import { useMemo, useState, useEffect } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { filterNav, navOrg, navPbx, navPlatform } from '@/shared/config/nav-config';
import type { NavItem } from '@/shared/config/nav-config';
import type { Me } from '@/shared/types/me';
import { cn } from '@/shared/lib/utils';
import { useUiStore } from '@/shared/stores/ui-store';
import { Button } from '@/shared/ui/button';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { ONE_PBX_LOGO_URL } from '@/shared/config/brand-assets';
import { SearchableSelect, type SearchableSelectOption } from '@/shared/ui/searchable-select';

type OrgListItem = {
  id: number;
  name: string;
  tradeName: string | null;
  logoUrl: string;
  spacesCount: number;
  extensionsCount: number;
};

function NavGroup({
  item,
  collapsed,
  pathname,
  onNavClick,
}: {
  item: NavItem;
  collapsed: boolean;
  pathname: string;
  onNavClick?: () => void;
}) {
  const { t } = useTranslation();
  const hasChildren = item.children && item.children.length > 0;

  // determine if this group or any child is active
  const selfActive = pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to + '/') && !hasChildren);
  const childActive = hasChildren && item.children!.some(
    (c) => pathname === c.to || pathname.startsWith(c.to + '/'),
  );
  const isActive = selfActive || childActive;

  const [open, setOpen] = useState(isActive);

  // auto-open when navigating to a child
  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  if (!hasChildren) {
    return (
      <li>
        <Link
          to={item.to}
          onClick={onNavClick}
          className={cn(
            'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors',
            isActive
              ? 'bg-white/14 font-medium text-white shadow-inner ring-1 ring-white/15'
              : 'text-teal-50/90 hover:bg-white/8 hover:text-white',
          )}
        >
          <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-cyan-200' : 'opacity-85')} />
          {!collapsed && <span>{t(item.i18nKey)}</span>}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors',
          isActive
            ? 'bg-white/14 font-medium text-white shadow-inner ring-1 ring-white/15'
            : 'text-teal-50/90 hover:bg-white/8 hover:text-white',
        )}
      >
        <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-cyan-200' : 'opacity-85')} />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{t(item.i18nKey)}</span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 opacity-60 transition-transform',
                open && 'rotate-180',
              )}
            />
          </>
        )}
      </button>
      {open && !collapsed && (
        <ul className="mt-0.5 space-y-0.5 pl-8">
          {item.children!.map((child) => {
            const cActive = pathname === child.to || (child.to !== '/' && pathname.startsWith(child.to + '/'));
            return (
              <li key={child.id}>
                <Link
                  to={child.to}
                  onClick={onNavClick}
                  className={cn(
                    'block rounded-md px-2.5 py-1.5 text-xs transition-colors',
                    cActive
                      ? 'bg-white/10 font-medium text-white'
                      : 'text-teal-100/70 hover:bg-white/6 hover:text-white',
                  )}
                >
                  {t(child.i18nKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export function AppSidebar({ me, onNavClick }: { me: Me; onNavClick?: () => void }) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const setCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const selectedOrg = useUiStore((s) => s.selectedOrganizationId);
  const setOrg = useUiStore((s) => s.setSelectedOrganizationId);

  const { data: orgs } = useQuery({
    queryKey: qk.organizations({ page: 1, pageSize: 100, sort: 'name:asc', q: '' }),
    queryFn: () => apiFetch<{ items: OrgListItem[] }>(`/organizations?page=1&pageSize=100&sort=name:asc`),
    enabled: me.role === 'platform_admin',
  });

  const orgOptions: SearchableSelectOption[] = useMemo(() => {
    const rows = orgs?.items ?? [];
    const rest: SearchableSelectOption[] = rows.map((o) => ({
      value: String(o.id),
      label: o.name,
      description: t('orgs.metaLine', { spaces: o.spacesCount, ext: o.extensionsCount }),
      keywords: [o.name, o.tradeName ?? '', String(o.id), String(o.spacesCount)],
      icon: (
        <img
          src={o.logoUrl}
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 rounded-md border border-white/20 object-cover"
          loading="lazy"
        />
      ),
    }));
    return [
      {
        value: '',
        label: t('nav.orgAll'),
        keywords: ['all', 'todos', 'todas'],
        description: t('nav.orgAll'),
      },
      ...rest,
    ];
  }, [orgs?.items, t]);

  const showReports = import.meta.env.VITE_FEATURE_REPORTS !== '0';
  const showWebhooksNav = import.meta.env.VITE_WEBHOOKS_UNDER_INTEGRATIONS !== '1';
  const showPbx = import.meta.env.VITE_FEATURE_PBX !== '0';

  const activeOrgId = me.role === 'platform_admin'
    ? selectedOrg
    : (me.organizationIds[0] ?? null);

  const pItems = (() => {
    if (me.role === 'platform_admin') {
      if (activeOrgId !== null) return [];
      return filterNav(navPlatform, me.role).filter((it) => {
        if (it.id === 'rep' && !showReports) return false;
        if (it.id === 'wh' && !showWebhooksNav) return false;
        return true;
      });
    }
    return filterNav(navOrg, me.role).filter((it) => {
      if (it.id === 'rep' && !showReports) return false;
      if (it.id === 'wh' && !showWebhooksNav) return false;
      return true;
    });
  })();

  const xItems = activeOrgId !== null
    ? filterNav(navPbx, me.role).filter(() => showPbx)
    : [];

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 flex-col border-r border-white/10 bg-sidebar text-sidebar-foreground shadow-xl transition-[width]',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-white/10 bg-black/10 px-2">
        <Link
          to="/"
          className={cn(
            'flex min-h-0 min-w-0 flex-1 items-center rounded-md py-1 outline-none focus-visible:ring-2 focus-visible:ring-teal-300/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--sidebar))]',
            collapsed ? 'justify-center' : 'justify-start pl-0.5',
          )}
          title="one PBX"
        >
          <img
            src={ONE_PBX_LOGO_URL}
            alt="one PBX"
            width={200}
            height={60}
            loading="eager"
            decoding="async"
            className={cn(
              'h-9 w-auto max-w-full object-contain object-left drop-shadow-sm',
              collapsed && 'h-8 max-w-[44px] object-center',
            )}
          />
        </Link>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 text-sidebar-foreground hover:bg-white/10"
          aria-label={t('nav.collapse')}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Org picker (platform_admin only) */}
      {me.role === 'platform_admin' && orgs?.items?.length ? (
        <div className="border-b border-white/10 p-2">
          {!collapsed && (
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-teal-200/80">
              {t('nav.orgPicker')}
            </label>
          )}
          <SearchableSelect
            tone="sidebar"
            options={orgOptions}
            value={selectedOrg != null ? String(selectedOrg) : ''}
            onValueChange={(v) => setOrg(v ? Number(v) : null)}
            placeholder={t('nav.orgAll')}
            searchPlaceholder={t('nav.orgSearch')}
            emptyText={t('nav.orgEmpty')}
            align="start"
            side="bottom"
          />
        </div>
      ) : null}

      {/* Back to Platform button — shown when platform_admin is inside an org */}
      {me.role === 'platform_admin' && activeOrgId !== null && (
        <div className="border-b border-white/10 px-2 py-2">
          <button
            type="button"
            onClick={() => setOrg(null)}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-teal-100/80 transition-colors hover:bg-white/10 hover:text-white',
              collapsed && 'justify-center',
            )}
            title={t('nav.backToPlatform')}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{t('nav.backToPlatform')}</span>}
          </button>
        </div>
      )}

      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2 pt-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        {/* Platform / General section */}
        {pItems.length > 0 && (
          <div className="mb-5">
            {!collapsed && (
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-teal-300/70">
                {me.role === 'platform_admin' ? t('nav.group.platform') : t('nav.group.general')}
              </p>
            )}
            <ul className="space-y-0.5">
              {pItems.map((item) => (
                <NavGroup key={item.id} item={item} collapsed={collapsed} pathname={pathname} onNavClick={onNavClick} />
              ))}
            </ul>
          </div>
        )}

        {/* PBX section */}
        {xItems.length > 0 && (
          <div>
            {!collapsed && (
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-teal-300/70">
                {t('nav.group.pbx')}
              </p>
            )}
            <ul className="space-y-0.5">
              {xItems.map((item) => (
                <NavGroup key={`pbx-${item.id}`} item={item} collapsed={collapsed} pathname={pathname} onNavClick={onNavClick} />
              ))}
            </ul>
          </div>
        )}
      </nav>
    </aside>
  );
}
