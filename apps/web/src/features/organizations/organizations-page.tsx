import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { Building2, ChevronRight, Plus, Search } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { StatusBadge, UsageBar } from '@/shared/ui/status-badge';
import { OrgCreateModal } from './org-create-modal';

type OrgRow = {
  id: number;
  name: string;
  tradeName: string | null;
  active: boolean;
  logoUrl: string;
  spacesCount: number;
  extensionsCount: number;
  extensionsUsed: number;
  extensionsLimit: number | null;
  channelsLimit: number | null;
  channelsUsed: number;
  diskQuotaGb: number | null;
  orgKind: 'pabx' | 'dialer';
  onlineCallsEstimate: number;
  customDomain: string | null;
  issabelBaseUrl: string | null;
};

function domainSummary(o: OrgRow): string {
  if (o.customDomain) return o.customDomain;
  if (o.issabelBaseUrl) {
    try { return new URL(o.issabelBaseUrl).host; } catch { return o.issabelBaseUrl; }
  }
  return '—';
}

export function OrganizationsPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const [showCreate, setShowCreate] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 12;
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [orgKind, setOrgKind] = useState<'all' | 'pabx' | 'dialer'>('all');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q), 300);
    return () => window.clearTimeout(id);
  }, [q]);

  const list = useQuery({
    queryKey: qk.organizations({ page: pageIndex + 1, pageSize, sort: 'name:asc', q: debouncedQ, orgKind, status }),
    queryFn: () => {
      const sp = new URLSearchParams({ page: String(pageIndex + 1), pageSize: String(pageSize), sort: 'name:asc', q: debouncedQ });
      if (orgKind !== 'all') sp.set('orgKind', orgKind);
      if (status !== 'all') sp.set('status', status);
      return apiFetch<{ items: OrgRow[]; total: number; page: number; pageSize: number }>(`/organizations?${sp}`);
    },
    placeholderData: keepPreviousData,
    enabled: me.role === 'platform_admin' || me.role === 'org_admin',
  });

  if (me.role !== 'platform_admin' && me.role !== 'org_admin') {
    return <p className="text-sm text-muted-foreground">{t('orgs.forbidden')}</p>;
  }

  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-teal-300 dark:via-cyan-300 dark:to-sky-300">
            {t('orgs.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('orgs.subtitle')}</p>
        </div>
        {me.role === 'platform_admin' && (
          <Button className="gap-2 shadow-sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t('orgs.createBtn')}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t('orgs.search')}
            value={q}
            onChange={(e) => { setQ(e.target.value); setPageIndex(0); }}
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={orgKind}
          onChange={(e) => { setOrgKind(e.target.value as typeof orgKind); setPageIndex(0); }}
        >
          <option value="all">{t('orgs.filterAll')}</option>
          <option value="pabx">PABX</option>
          <option value="dialer">Dialer</option>
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={status}
          onChange={(e) => { setStatus(e.target.value as typeof status); setPageIndex(0); }}
        >
          <option value="all">{t('orgs.filterAll')}</option>
          <option value="active">{t('orgs.filterActive')}</option>
          <option value="inactive">{t('orgs.filterInactive')}</option>
        </select>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{total} {t('orgs.totalCount')}</span>
      </div>

      {/* Grid of org cards */}
      {list.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : (list.data?.items ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
          <Building2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">{t('orgs.empty')}</p>
          {me.role === 'platform_admin' && (
            <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              {t('orgs.createBtn')}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(list.data?.items ?? []).map((org) => (
            <OrgCard key={org.id} org={org} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t('orgs.pageOf', { page: pageIndex + 1, pages })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pageIndex <= 0} onClick={() => setPageIndex((p) => p - 1)}>
              {t('orgs.prev')}
            </Button>
            <Button variant="outline" size="sm" disabled={pageIndex + 1 >= pages} onClick={() => setPageIndex((p) => p + 1)}>
              {t('orgs.next')}
            </Button>
          </div>
        </div>
      )}

      {showCreate && <OrgCreateModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function OrgCard({ org }: { org: OrgRow }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/organizations/$orgId"
      params={{ orgId: String(org.id) }}
      className="group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      {/* Top row */}
      <div className="flex items-start gap-3">
        <img
          src={org.logoUrl}
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{org.tradeName ?? org.name}</p>
          {org.tradeName && <p className="truncate text-xs text-muted-foreground">{org.name}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <StatusBadge status={org.active ? 'active' : 'inactive'} label={org.active ? t('orgs.yes') : t('orgs.no')} />
            <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
              {org.orgKind}
            </span>
          </div>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>

      {/* Domain */}
      <p className="truncate font-mono text-[11px] text-muted-foreground">{domainSummary(org)}</p>

      {/* Usage bars */}
      <div className="space-y-2 border-t border-border pt-3">
        <UsageBar used={org.extensionsUsed} limit={org.extensionsLimit} label={t('orgs.colExtRatio')} />
        <UsageBar used={org.onlineCallsEstimate} limit={org.channelsLimit} label={t('orgs.colChanRatio')} />
        {org.diskQuotaGb != null && (
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{t('orgs.colDisk')}</span>
            <span className="tabular-nums">{org.diskQuotaGb} GB</span>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="flex gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
        <span><strong className="text-foreground">{org.spacesCount}</strong> {t('orgs.colSpaces').toLowerCase()}</span>
        <span><strong className="text-foreground">{org.extensionsCount}</strong> ramais</span>
      </div>
    </Link>
  );
}
