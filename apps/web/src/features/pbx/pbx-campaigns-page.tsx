import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { Megaphone, Link as LinkIcon } from 'lucide-react';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { PbxScreenHero } from '@/features/pbx/pbx-screen-hero';
import { Link } from '@tanstack/react-router';

export function PbxCampaignsPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const orgId = useActiveOrganizationId(me);

  if (!orgId && me.role !== 'platform_admin') {
    return <p className="text-sm text-muted-foreground">{t('pbxScreen.pickOrg')}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PbxScreenHero
        gradient="bg-gradient-to-r from-orange-600 via-rose-600 to-red-600"
        eyebrow={t('pbxScreen.campEyebrow')}
        title={t('nav.campaigns')}
        subtitle={t('pbxScreen.campSubtitle')}
      />
      <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
        <CardHeader className="flex flex-row items-center gap-2 border-b border-border bg-muted/20">
          <Megaphone className="h-5 w-5 text-orange-600" />
          <CardTitle className="text-base">{t('pbxScreen.campTable')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-900/30">
            <Megaphone className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="font-medium">Módulo de campanhas</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Configure a URL do PBX para visualizar e controlar campanhas de discagem em tempo real.
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
