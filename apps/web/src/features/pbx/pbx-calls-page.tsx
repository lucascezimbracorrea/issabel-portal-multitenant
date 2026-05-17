import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { ArrowDownLeft, ArrowUpRight, Filter, PhoneCall } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import type { TelephonyOverview } from '@/shared/types/telephony';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { PbxScreenHero } from '@/features/pbx/pbx-screen-hero';

export function PbxCallsPage() {
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

  if (!orgId && me.role !== 'platform_admin') {
    return <p className="text-sm text-muted-foreground">{t('pbxScreen.pickOrg')}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PbxScreenHero
        gradient="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600"
        eyebrow={t('pbxScreen.isabelCallsEyebrow')}
        title={t('nav.pbxCalls')}
        subtitle={t('pbxScreen.isabelCallsSubtitle')}
      >
        <Button asChild size="sm" variant="outline" className="border-white/40 bg-white/15 text-white hover:bg-white/25">
          <Link to="/calls">{t('pbxScreen.isabelCallsPortalLink')}</Link>
        </Button>
      </PbxScreenHero>

      {tel.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : tel.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 border-l-4 border-l-teal-500 shadow-md ring-1 ring-border/50">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-200">
                {t('calls.card24h')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{tel.data.calls24h}</CardContent>
          </Card>
          <Card className="border-0 border-l-4 border-l-cyan-500 shadow-md ring-1 ring-border/50">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-200">
                {t('calls.cardInbound')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{tel.data.inboundPct}%</CardContent>
          </Card>
          <Card className="border-0 border-l-4 border-l-emerald-500 shadow-md ring-1 ring-border/50">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                {t('calls.cardAnswer')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{tel.data.answerRate}%</CardContent>
          </Card>
          <Card className="border-0 border-l-4 border-l-sky-500 shadow-md ring-1 ring-border/50">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
                {t('calls.cardAsr')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{tel.data.asrPct.toFixed(1)}%</CardContent>
          </Card>
        </div>
      ) : null}

      <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
        <CardHeader className="flex flex-col gap-3 border-b border-border bg-muted/25 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-teal-600" />
            <CardTitle className="text-base">{t('pbxScreen.isabelCallsTable')}</CardTitle>
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
                        <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-900 dark:bg-teal-950/80 dark:text-teal-100">
                          <ArrowDownLeft className="h-3 w-3" /> {t('calls.inbound')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-900 dark:bg-cyan-950/80 dark:text-cyan-100">
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
