import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import type { CdrHistoryRow } from '@/shared/types/telephony';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { CrmScreenPop } from '@/shared/components/crm-screen-pop';

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 16);
  return { from: fmt(from), to: fmt(to) };
}

export function CallsHistoryPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const activeOrg = useActiveOrganizationId(me);
  const [{ from, to }, setRange] = useState(defaultRange);
  const [src, setSrc] = useState('');
  const [dst, setDst] = useState('');
  const [page, setPage] = useState(1);

  const oid = me.role === 'platform_admin' ? activeOrg : activeOrg ?? me.organizationIds[0] ?? null;

  const params = useMemo(
    () => ({
      from: from.replace('T', ' '),
      to: to.replace('T', ' '),
      src: src.trim(),
      dst: dst.trim(),
      page,
      pageSize: 50,
      ...(oid != null ? { organizationId: oid } : {}),
    }),
    [from, to, src, dst, page, oid],
  );

  const q = useQuery({
    queryKey: qk.cdrHistory(params as Record<string, string | number>),
    queryFn: () => {
      const sp = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== '' && v != null) sp.set(k, String(v));
      });
      return apiFetch<{ items?: CdrHistoryRow[]; total?: number; error?: string }>(`/metrics/cdr/history?${sp.toString()}`);
    },
    enabled: me.role === 'platform_admin' ? true : oid != null,
  });

  if (me.role !== 'platform_admin' && !oid) {
    return <p className="text-sm text-muted-foreground">{t('calls.pickOrg')}</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('calls.historyTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('calls.historySubtitle')}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('calls.historyFilters')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-muted-foreground">
            {t('calls.historyFrom')}
            <Input type="datetime-local" value={from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="mt-1" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            {t('calls.historyTo')}
            <Input type="datetime-local" value={to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="mt-1" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            {t('calls.historySrc')}
            <Input value={src} onChange={(e) => setSrc(e.target.value)} className="mt-1" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            {t('calls.historyDst')}
            <Input value={dst} onChange={(e) => setDst(e.target.value)} className="mt-1" />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-4">
            <Button type="button" onClick={() => setPage(1)}>
              {t('calls.historyApply')}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          {q.isPending ? (
            <Skeleton className="m-6 h-48 w-full" />
          ) : q.data?.error === 'cdr_not_configured' ? (
            <p className="p-6 text-sm text-destructive">{t('calls.historyCdrMissing')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="p-2">{t('calls.historyColWhen')}</th>
                    <th className="p-2">{t('calls.historyColSrc')}</th>
                    <th className="p-2">{t('calls.historyColDst')}</th>
                    <th className="p-2">{t('calls.historyColBill')}</th>
                    <th className="p-2">{t('calls.historyColDisp')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(q.data?.items ?? []).map((r) => (
                    <tr key={r.uniqueid} className="border-b border-border/70">
                      <td className="p-2 font-mono text-xs">{r.calldate}</td>
                      <td className="p-2 font-mono text-xs">
                        {r.src}
                        {oid != null && <CrmScreenPop orgId={oid} phone={r.src} />}
                      </td>
                      <td className="p-2 font-mono text-xs">{r.dst}</td>
                      <td className="p-2 tabular-nums">{r.billsec}s</td>
                      <td className="p-2 capitalize">{r.disposition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {q.data && !q.isPending && (q.data.items?.length ?? 0) === 0 && !q.data.error ? (
            <p className="p-6 text-sm text-muted-foreground">{t('calls.historyEmpty')}</p>
          ) : null}
          {q.data && (q.data.total ?? 0) > (params.pageSize as number) ? (
            <div className="flex justify-end gap-2 border-t border-border p-3">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t('orgs.prev')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page * (params.pageSize as number) >= (q.data?.total ?? 0)}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('orgs.next')}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
