import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { BarChart3, Clock, PieChart } from 'lucide-react';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { PbxScreenHero } from '@/features/pbx/pbx-screen-hero';

const tiles = [
  { id: 'q', icon: PieChart, color: 'from-violet-600 to-fuchsia-500', titleKey: 'pbxScreen.rptQueues', descKey: 'pbxScreen.rptQueuesDesc' },
  { id: 'a', icon: BarChart3, color: 'from-sky-600 to-indigo-600', titleKey: 'pbxScreen.rptAgents', descKey: 'pbxScreen.rptAgentsDesc' },
  { id: 't', icon: Clock, color: 'from-orange-600 to-rose-500', titleKey: 'pbxScreen.rptTrunks', descKey: 'pbxScreen.rptTrunksDesc' },
];

export function PbxReportsConsolePage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const orgId = useActiveOrganizationId(me);

  if (!orgId && me.role !== 'platform_admin') {
    return <p className="text-sm text-muted-foreground">{t('pbxScreen.pickOrg')}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PbxScreenHero
        gradient="bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-700"
        eyebrow={t('pbxScreen.rptEyebrow')}
        title={t('pbxScreen.rptTitle')}
        subtitle={t('pbxScreen.rptSubtitle')}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.id} className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
            <div className={`h-2 bg-gradient-to-r ${tile.color}`} />
            <CardHeader className="flex flex-row items-start gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${tile.color} text-white shadow-md`}>
                <tile.icon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{t(tile.titleKey)}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{t(tile.descKey)}</p>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" type="button">
                {t('pbxScreen.rptRun')}
              </Button>
              <Button size="sm" variant="outline" type="button" disabled>
                {t('pbxScreen.rptSchedule')}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
