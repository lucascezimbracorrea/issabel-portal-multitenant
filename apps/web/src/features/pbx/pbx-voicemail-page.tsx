import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { Inbox, Link as LinkIcon } from 'lucide-react';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { PbxScreenHero } from '@/features/pbx/pbx-screen-hero';
import { Link } from '@tanstack/react-router';

export function PbxVoicemailPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const orgId = useActiveOrganizationId(me);

  if (!orgId && me.role !== 'platform_admin') {
    return <p className="text-sm text-muted-foreground">{t('pbxScreen.pickOrg')}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PbxScreenHero
        gradient="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700"
        eyebrow={t('pbxScreen.vmEyebrow')}
        title={t('nav.voicemail')}
        subtitle={t('pbxScreen.vmSubtitle')}
      />

      <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
        <CardHeader className="flex flex-row items-center gap-2 border-b border-border bg-muted/20">
          <Inbox className="h-5 w-5 text-sky-600" />
          <CardTitle className="text-base">{t('pbxScreen.vmTableTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-100 dark:bg-sky-900/30">
            <Inbox className="h-8 w-8 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <p className="font-medium">Integração com caixa postal</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Configure a URL do PBX na aba de informações da empresa para visualizar as caixas postais em tempo real.
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
