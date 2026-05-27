import { lazy, Suspense, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useRouteContext } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight, Phone, Workflow, AlertTriangle } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import type { PlatformOverview, TelephonyOverview } from '@/shared/types/telephony';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { PagePending } from '@/shared/ui/page-pending';
import { Skeleton } from '@/shared/ui/skeleton';

const BillingChart = lazy(async () => {
  const mod = await import('./billing-chart');
  return { default: mod.BillingChart };
});

const HourlyCallsChart = lazy(async () => {
  const mod = await import('./hourly-calls-chart');
  return { default: mod.HourlyCallsChart };
});

const CallVolumeBucketsChart = lazy(async () => {
  const mod = await import('./call-volume-buckets-chart');
  return { default: mod.CallVolumeBucketsChart };
});

export function DashboardPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const activeOrg = useActiveOrganizationId(me);
  const oid = activeOrg ?? me.organizationIds[0] ?? 0;

  const billing = useQuery({
    queryKey: qk.billingSummary(),
    queryFn: () =>
      apiFetch<{
        activeOrganizations: number;
        totalSpaces: number;
        pricePerClientUsd: number;
        mrrUsd: number;
      }>('/metrics/billing-summary'),
    enabled: me.role === 'platform_admin',
  });

  const tel = useQuery({
    queryKey: qk.telephonyOverview(oid),
    queryFn: () => apiFetch<TelephonyOverview>(`/metrics/telephony-overview?organizationId=${oid}`),
    enabled: me.role === 'platform_admin' ? true : oid > 0,
  });

  const platform = useQuery({
    queryKey: qk.platformOverview(),
    queryFn: () => apiFetch<PlatformOverview>('/metrics/platform-overview'),
    enabled: me.role === 'platform_admin',
  });

  const orgBilling = useQuery({
    queryKey: ['org-billing', oid],
    queryFn: () =>
      apiFetch<{
        extensionsCount: number;
        estimatedMrrUsd: number;
        billableMinutes30d: number;
        cdrSource: string;
        channelsLimit: number | null;
      }>(`/organizations/${oid}/billing-summary`),
    enabled: oid > 0,
  });

  const fmtUsd = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }),
    [],
  );

  const isDemo = tel.data?.source === 'demo';
  const recentPreview = isDemo ? [] : (tel.data?.recentCalls ?? []).slice(0, 5);
  const telephonyEnabled = me.role === 'platform_admin' || oid > 0;

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{t('dashboard.telephonyBadge')}</p>
        <h1 className="bg-gradient-to-r from-indigo-600 via-violet-600 to-rose-500 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-indigo-300 dark:via-violet-300 dark:to-rose-300">
          {t('dashboard.title')}
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('dashboard.subtitle')}</p>
      </div>

      {me.role !== 'platform_admin' && orgBilling.data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-0 border-l-4 border-l-violet-500 shadow-md ring-1 ring-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-300">
                Ramais
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{orgBilling.data.extensionsCount}</CardContent>
          </Card>
          <Card className="border-0 border-l-4 border-l-emerald-500 shadow-md ring-1 ring-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                Minutos (30d)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{orgBilling.data.billableMinutes30d}</CardContent>
          </Card>
          <Card className="border-0 border-l-4 border-l-indigo-500 shadow-md ring-1 ring-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-indigo-800 dark:text-indigo-300">
                Estimativa MRR
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{fmtUsd.format(orgBilling.data.estimatedMrrUsd)}</CardContent>
          </Card>
        </div>
      )}

      {me.role === 'platform_admin' ? (
        <>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-0 border-l-4 border-l-indigo-500 shadow-md ring-1 ring-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                {t('dashboard.activeClients')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold text-foreground">
              {billing.isPending ? <Skeleton className="h-9 w-16" /> : billing.data?.activeOrganizations ?? '—'}
            </CardContent>
          </Card>
          <Card className="border-0 border-l-4 border-l-amber-500 shadow-md ring-1 ring-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                {t('dashboard.totalSpaces')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold text-foreground">
              {billing.isPending ? <Skeleton className="h-9 w-16" /> : billing.data?.totalSpaces ?? '—'}
            </CardContent>
          </Card>
          <Card className="border-0 border-l-4 border-l-rose-500 shadow-md ring-1 ring-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                {t('dashboard.mrr')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold text-foreground">
              {billing.isPending ? <Skeleton className="h-9 w-24" /> : fmtUsd.format(billing.data?.mrrUsd ?? 0)}
            </CardContent>
          </Card>
          <Card className="overflow-hidden border-0 shadow-md ring-1 ring-border/50 md:col-span-3">
            <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-rose-500" />
            <CardHeader>
              <CardTitle className="text-base">{t('dashboard.mrrChart')}</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <Suspense fallback={<PagePending />}>
                {billing.data ? (
                  <BillingChart activeOrganizations={billing.data.activeOrganizations} mrrUsd={billing.data.mrrUsd} />
                ) : (
                  <PagePending />
                )}
              </Suspense>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{t('dashboard.platformSectionTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('dashboard.platformSectionSubtitle')}</p>
          {platform.isPending ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : platform.data ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-0 border-l-4 border-l-teal-500 shadow-md ring-1 ring-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300">
                    {t('dashboard.platformOrgs')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold">{platform.data.totalOrganizations}</CardContent>
              </Card>
              <Card className="border-0 border-l-4 border-l-violet-500 shadow-md ring-1 ring-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-300">
                    {t('dashboard.platformExtensions')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold">{platform.data.totalExtensions}</CardContent>
              </Card>
              <Card className="border-0 border-l-4 border-l-fuchsia-500 shadow-md ring-1 ring-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-fuchsia-800 dark:text-fuchsia-300">
                    {t('dashboard.platformDialer')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold tabular-nums">
                  {platform.data.dialerChannelsUsed} / {platform.data.dialerChannelsMax || '—'}
                </CardContent>
              </Card>
              <Card className="border-0 border-l-4 border-l-cyan-500 shadow-md ring-1 ring-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">
                    {t('dashboard.platformPabx')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold tabular-nums">
                  {platform.data.pabxChannelsUsed} / {platform.data.pabxChannelsMax || '—'}
                </CardContent>
              </Card>
            </div>
          ) : null}
          {platform.data?.disk ? (
            <Card className="overflow-hidden border-0 shadow-md ring-1 ring-border/50">
              <CardHeader>
                <CardTitle className="text-base">{t('dashboard.diskTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all"
                    style={{ width: `${Math.min(100, platform.data.disk.usedPct)}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.diskLine', {
                    pct: platform.data.disk.usedPct,
                    usedGb: (platform.data.disk.usedBytes / 1e9).toFixed(1),
                    totalGb: (platform.data.disk.totalBytes / 1e9).toFixed(0),
                  })}
                </p>
              </CardContent>
            </Card>
          ) : null}
          {tel.data?.simultaneousBuckets?.length ? (
            <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
              <CardHeader className="border-b border-border bg-muted/20">
                <CardTitle className="text-base">{t('dashboard.simultaneousVolumeTitle')}</CardTitle>
                <p className="text-xs text-muted-foreground">{t('dashboard.simultaneousVolumeHint')}</p>
              </CardHeader>
              <CardContent className="h-80 pt-4">
                <Suspense fallback={<PagePending />}>
                  <CallVolumeBucketsChart
                    buckets={tel.data.simultaneousBuckets}
                    bucketMinutes={tel.data.bucketMinutes ?? 5}
                    title=""
                  />
                </Suspense>
              </CardContent>
            </Card>
          ) : null}
        </div>
        </>
      ) : (
        <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
          <CardHeader>
            <CardTitle className="text-lg">{t('dashboard.orgWelcome')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>{t('dashboard.orgWelcomeBody')}</p>
            <p>{t('dashboard.orgTelephonyHint')}</p>
          </CardContent>
        </Card>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">{t('dashboard.telephonyTitle')}</h2>
              {tel.data?.source ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    tel.data.source === 'cdr' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-100' : 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-100'
                  }`}
                >
                  {tel.data.source === 'cdr' ? t('dashboard.telephonySourceCdr') : t('dashboard.telephonySourceDemo')}
                </span>
              ) : null}
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t('dashboard.telephonySubtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="default" className="bg-violet-600 hover:bg-violet-700">
              <Link to="/calls">{t('dashboard.viewAllCalls')}</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="border-indigo-300/60">
              <Link to="/integrations/flows">
                <Workflow className="mr-2 h-4 w-4" />
                {t('dashboard.flowLink')}
              </Link>
            </Button>
          </div>
        </div>

        {!telephonyEnabled ? (
          <p className="text-sm text-muted-foreground">{t('calls.pickOrg')}</p>
        ) : tel.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
            <Skeleton className="h-72 rounded-xl lg:col-span-5" />
          </div>
        ) : tel.isError ? (
          <p className="text-sm text-destructive">{t('dashboard.telephonyFail')}</p>
        ) : tel.data ? (
          <>
            {isDemo && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800/60 dark:bg-amber-950/30">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">{t('dashboard.demoBanner')}</p>
                  <p className="text-amber-800/80 dark:text-amber-300/80">{t('dashboard.demoBannerBody')}</p>
                </div>
              </div>
            )}
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

            <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
              <CardHeader className="border-b border-border bg-muted/20">
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  <CardTitle className="text-base">{t('dashboard.hourlyTitle')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="h-72 pt-4">
                <Suspense fallback={<PagePending />}>
                  <HourlyCallsChart hourly={tel.data.hourly} />
                </Suspense>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-muted/20">
                <CardTitle className="text-base">{t('dashboard.recentSnippet')}</CardTitle>
                {!isDemo && (
                  <Button asChild variant="ghost" className="h-auto p-0 text-indigo-600 hover:bg-transparent dark:text-indigo-400">
                    <Link to="/calls">{t('dashboard.viewAllCalls')}</Link>
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {isDemo ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <Phone className="h-8 w-8 text-muted-foreground/25" />
                    <p className="text-sm font-medium text-muted-foreground">{t('dashboard.demoNoCalls')}</p>
                  </div>
                ) : (
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
                        {recentPreview.map((r) => (
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
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t('calls.pickOrg')}</p>
        )}
      </section>
    </div>
  );
}
