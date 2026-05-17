import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { Network, Link as LinkIcon } from 'lucide-react';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { PbxScreenHero } from '@/features/pbx/pbx-screen-hero';
import { Link } from '@tanstack/react-router';

export function PbxTerminationPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const orgId = useActiveOrganizationId(me);

  if (!orgId && me.role !== 'platform_admin') {
    return <p className="text-sm text-muted-foreground">{t('pbxScreen.pickOrg')}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PbxScreenHero
        gradient="bg-gradient-to-r from-slate-700 via-zinc-600 to-neutral-700"
        eyebrow={t('pbxScreen.trunkEyebrow')}
        title={t('nav.termination')}
        subtitle={t('pbxScreen.trunkSubtitle')}
      />
      <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
        <CardHeader className="flex flex-row items-center gap-2 border-b border-border bg-muted/20">
          <Network className="h-5 w-5 text-slate-600" />
          <CardTitle className="text-base">{t('pbxScreen.trunkTable')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-900/40">
            <Network className="h-8 w-8 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <p className="font-medium">Troncos SIP</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Configure a URL do PBX na empresa para monitorar troncos SIP em tempo real via AMI.
            </p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/organizations">
              <LinkIcon className="h-4 w-4" />
              Configurar empresa
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
