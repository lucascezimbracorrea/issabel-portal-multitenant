import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { Hash, Link as LinkIcon } from 'lucide-react';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { PbxScreenHero } from '@/features/pbx/pbx-screen-hero';
import { Link } from '@tanstack/react-router';

export function PbxInboundNumbersPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const orgId = useActiveOrganizationId(me);

  if (!orgId && me.role !== 'platform_admin') {
    return <p className="text-sm text-muted-foreground">{t('pbxScreen.pickOrg')}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PbxScreenHero
        gradient="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600"
        eyebrow={t('pbxScreen.didEyebrow')}
        title={t('nav.inboundNumbers')}
        subtitle={t('pbxScreen.didSubtitle')}
      />
      <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
        <CardHeader className="flex flex-row items-center gap-2 border-b border-border bg-muted/20">
          <Hash className="h-5 w-5 text-violet-600" />
          <CardTitle className="text-base">{t('pbxScreen.didTable')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/30">
            <Hash className="h-8 w-8 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="font-medium">Números de entrada (DID)</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Configure a URL do PBX na empresa para visualizar e gerenciar DIDs e rotas de entrada.
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
