import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { useState } from 'react';

type OnlineRow = { organizationId: number; name: string; onlineCalls: number; channelsMax: number };

export function CallsOnlinePage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const orgId = useActiveOrganizationId(me);
  const [auto, setAuto] = useState(true);

  const qs =
    me.role === 'platform_admin' && orgId != null
      ? `?organizationId=${orgId}`
      : me.role === 'platform_admin'
        ? ''
        : orgId != null
          ? `?organizationId=${orgId}`
          : '';

  const q = useQuery({
    queryKey: qk.callsOnline(orgId),
    queryFn: () => apiFetch<{ items: OnlineRow[] }>(`/metrics/calls-online${qs}`),
    refetchInterval: auto ? 5000 : false,
    enabled: me.role === 'platform_admin' ? true : orgId != null,
  });

  if (me.role !== 'platform_admin' && !orgId) {
    return <p className="text-sm text-muted-foreground">{t('calls.pickOrg')}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('calls.onlineTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('calls.onlineSubtitle')}</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 rounded border-border" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          {t('calls.autoRefresh')}
        </label>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('calls.onlineTableTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {q.isPending ? (
            <Skeleton className="m-6 h-40 w-full" />
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="p-3">{t('calls.onlineColCompany')}</th>
                  <th className="p-3">{t('calls.onlineColRatio')}</th>
                </tr>
              </thead>
              <tbody>
                {(q.data?.items ?? []).map((r) => (
                  <tr key={r.organizationId} className="border-b border-border/70">
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3 tabular-nums">
                      {r.onlineCalls} / {r.channelsMax || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!q.isPending && (q.data?.items?.length ?? 0) === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t('calls.onlineEmpty')}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
