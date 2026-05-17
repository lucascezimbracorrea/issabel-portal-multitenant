import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { SlidersHorizontal } from 'lucide-react';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { PbxScreenHero } from '@/features/pbx/pbx-screen-hero';

const FEATURE_DEFS = [
  { code: '*34', descKey: 'pbxScreen.featCallFwd' },
  { code: '*52', descKey: 'pbxScreen.featDnd' },
  { code: '*70', descKey: 'pbxScreen.featPickup' },
  { code: '*8', descKey: 'pbxScreen.featPark' },
  { code: '*11', descKey: 'pbxScreen.featRecord' },
];

export function PbxFeaturesPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const orgId = useActiveOrganizationId(me);

  if (!orgId && me.role !== 'platform_admin') {
    return <p className="text-sm text-muted-foreground">{t('pbxScreen.pickOrg')}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PbxScreenHero
        gradient="bg-gradient-to-r from-amber-500 via-yellow-500 to-lime-600"
        eyebrow={t('pbxScreen.featEyebrow')}
        title={t('nav.pbxFeatures')}
        subtitle={t('pbxScreen.featSubtitle')}
      />

      <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
        <CardHeader className="flex flex-row items-center gap-2 border-b border-border bg-muted/20">
          <SlidersHorizontal className="h-5 w-5 text-amber-600" />
          <CardTitle className="text-base">{t('pbxScreen.featTable')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="p-3">{t('pbxScreen.featColCode')}</th>
                  <th className="p-3">{t('pbxScreen.featColDesc')}</th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_DEFS.map((f) => (
                  <tr key={f.code} className="border-b border-border/70 hover:bg-muted/30">
                    <td className="p-3 font-mono font-semibold">{f.code}</td>
                    <td className="p-3 text-muted-foreground">{t(f.descKey)}</td>
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
