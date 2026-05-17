import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { ArrowRight, Megaphone, PhoneCall, UserRound, Voicemail } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { cn } from '@/shared/lib/utils';
import type { TelephonyOverview } from '@/shared/types/telephony';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { PbxScreenHero } from '@/features/pbx/pbx-screen-hero';

const shortcuts = [
  { to: '/pbx/voicemail' as const, i18n: 'pbxScreen.scVoicemail', icon: Voicemail, color: 'from-sky-500 to-indigo-600' },
  { to: '/pbx/campaigns' as const, i18n: 'pbxScreen.scCampaigns', icon: Megaphone, color: 'from-orange-500 to-rose-600' },
  { to: '/extensions' as const, i18n: 'pbxScreen.scExtensions', icon: UserRound, color: 'from-emerald-500 to-teal-600' },
  { to: '/pbx/calls' as const, i18n: 'pbxScreen.scCalls', icon: PhoneCall, color: 'from-violet-500 to-fuchsia-600' },
];

export function PbxConsolePage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const orgId = useActiveOrganizationId(me);
  const oid = orgId ?? me.organizationIds[0] ?? 0;

  const tel = useQuery({
    queryKey: qk.telephonyOverview(oid),
    queryFn: () => apiFetch<TelephonyOverview>(`/metrics/telephony-overview?organizationId=${oid}`),
    enabled: me.role === 'platform_admin' ? true : oid > 0,
  });

  const ext = useQuery({
    queryKey: qk.extensions(orgId ?? 0),
    queryFn: () => apiFetch<{ items: unknown[] }>(`/extensions?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const kpis = useMemo(() => {
    if (!tel.data) return null;
    return [
      { label: t('calls.card24h'), value: String(tel.data.calls24h), accent: 'border-l-indigo-500 text-indigo-800 dark:text-indigo-200' },
      { label: t('calls.cardAnswer'), value: `${tel.data.answerRate}%`, accent: 'border-l-rose-500 text-rose-800 dark:text-rose-200' },
      {
        label: t('extensions.title'),
        value: orgId ? String(ext.data?.items?.length ?? 0) : '—',
        accent: 'border-l-emerald-500 text-emerald-800 dark:text-emerald-200',
      },
    ];
  }, [tel.data, ext.data?.items?.length, orgId, t]);

  if (!orgId && me.role !== 'platform_admin') {
    return <p className="text-sm text-muted-foreground">{t('pbxScreen.pickOrg')}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PbxScreenHero
        gradient="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500"
        eyebrow={t('pbxScreen.consoleEyebrow')}
        title={t('nav.pbxConsole')}
        subtitle={t('pbxScreen.consoleSubtitle')}
      />

      {tel.isPending ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : tel.data && kpis ? (
        <div className="grid gap-4 md:grid-cols-3">
          {kpis.map((k) => (
            <Card key={k.label} className={cn('border-0 border-l-4 shadow-md ring-1 ring-border/50', k.accent)}>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide">{k.label}</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">{k.value}</CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">{t('pbxScreen.consoleShortcuts')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shortcuts.map((s) => (
            <Link key={s.to} to={s.to}>
              <Card className="h-full border-0 shadow-md ring-1 ring-border/60 transition-all hover:ring-2 hover:ring-indigo-400/40">
                <div className={cn('h-1.5 rounded-t-xl bg-gradient-to-r', s.color)} />
                <CardContent className="flex items-center justify-between gap-2 pt-5">
                  <div className="flex items-center gap-3">
                    <s.icon className="h-8 w-8 text-muted-foreground" />
                    <span className="font-medium">{t(s.i18n)}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Card className="border-0 shadow-lg ring-1 ring-border/60">
        <CardHeader>
          <CardTitle className="text-base">{t('pbxScreen.consoleActivity')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="list-inside list-disc space-y-2">
            <li>{t('pbxScreen.consoleBullet1')}</li>
            <li>{t('pbxScreen.consoleBullet2')}</li>
            <li>{t('pbxScreen.consoleBullet3')}</li>
          </ul>
          <Button asChild className="mt-4" variant="outline">
            <Link to="/calls">{t('pbxScreen.consoleOpenCalls')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
