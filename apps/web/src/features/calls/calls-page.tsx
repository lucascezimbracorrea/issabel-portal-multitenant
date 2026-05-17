import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { ArrowDownLeft, ArrowUpRight, Filter, Phone } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import type { TelephonyOverview } from '@/shared/types/telephony';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';

export function CallsPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const orgId = useActiveOrganizationId(me);
  const oid = orgId ?? me.organizationIds[0] ?? 0;
  const [q, setQ] = useState('');

  const tel = useQuery({
    queryKey: qk.telephonyOverview(oid),
    queryFn: () => apiFetch<TelephonyOverview>(`/metrics/telephony-overview?organizationId=${oid}`),
    enabled: me.role === 'platform_admin' ? true : oid > 0,
  });

  const filtered = useMemo(() => {
    const rows = tel.data?.recentCalls ?? [];
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.from.toLowerCase().includes(s) || r.to.toLowerCase().includes(s) || r.disposition.includes(s));
  }, [tel.data?.recentCalls, q]);

  if (!oid && me.role !== 'platform_admin') {
    return <p className="text-sm text-muted-foreground">{t('calls.pickOrg')}</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="bg-gradient-to-r from-indigo-600 via-violet-600 to-rose-500 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-indigo-300 dark:via-violet-300 dark:to-rose-300">
            {t('calls.title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('calls.subtitle')}</p>
        </div>
        <Button asChild variant="outline" className="w-fit border-indigo-300/60 shadow-sm">
          <Link to="/integrations/flows">{t('calls.linkFlows')}</Link>
        </Button>
      </div>

      {tel.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : tel.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="border-0 border-l-4 border-l-indigo-500 shadow-md ring-1 ring-border/50">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                {t('calls.card24h')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{tel.data.calls24h}</CardContent>
          </Card>
          <Card className="border-0 border-l-4 border-l-amber-500 shadow-md ring-1 ring-border/50">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                {t('calls.cardInbound')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{tel.data.inboundPct}%</CardContent>
          </Card>
          <Card className="border-0 border-l-4 border-l-rose-500 shadow-md ring-1 ring-border/50">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                {t('calls.cardAnswer')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{tel.data.answerRate}%</CardContent>
          </Card>
          <Card className="border-0 border-l-4 border-l-cyan-500 shadow-md ring-1 ring-border/50">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">
                {t('calls.cardAsr')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{tel.data.asrPct.toFixed(1)}%</CardContent>
          </Card>
          <Card className="border-0 border-l-4 border-l-purple-500 shadow-md ring-1 ring-border/50">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-purple-800 dark:text-purple-300">
                {t('calls.cardAvg')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{tel.data.avgDurationSec}s</CardContent>
          </Card>
        </div>
      ) : null}

      <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
        <CardHeader className="flex flex-col gap-3 border-b border-border bg-muted/25 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <CardTitle className="text-base">{t('calls.recentTitle')}</CardTitle>
          </div>
          <div className="relative max-w-xs">
            <Filter className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder={t('calls.filter')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="p-3">{t('calls.colDir')}</th>
                  <th className="p-3">{t('calls.colFrom')}</th>
                  <th className="p-3">{t('calls.colTo')}</th>
                  <th className="p-3">{t('calls.colDuration')}</th>
                  <th className="p-3">{t('calls.colDisposition')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/70 hover:bg-muted/30">
                    <td className="p-3">
                      {r.direction === 'inbound' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-900 dark:bg-indigo-950/80 dark:text-indigo-100">
                          <ArrowDownLeft className="h-3 w-3" /> {t('calls.inbound')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-900 dark:bg-rose-950/80 dark:text-rose-100">
                          <ArrowUpRight className="h-3 w-3" /> {t('calls.outbound')}
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs">{r.from}</td>
                    <td className="p-3 font-mono text-xs">{r.to}</td>
                    <td className="p-3">{r.durationSec}s</td>
                    <td className="p-3 capitalize text-muted-foreground">{r.disposition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
