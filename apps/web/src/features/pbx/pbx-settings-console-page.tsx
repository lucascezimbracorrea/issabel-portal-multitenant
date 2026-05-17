import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { Bell, Moon, Volume2 } from 'lucide-react';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { PbxScreenHero } from '@/features/pbx/pbx-screen-hero';

export function PbxSettingsConsolePage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const orgId = useActiveOrganizationId(me);

  if (!orgId && me.role !== 'platform_admin') {
    return <p className="text-sm text-muted-foreground">{t('pbxScreen.pickOrg')}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PbxScreenHero
        gradient="bg-gradient-to-r from-stone-600 via-neutral-700 to-slate-800"
        eyebrow={t('pbxScreen.setEyebrow')}
        title={t('pbxScreen.setTitle')}
        subtitle={t('pbxScreen.setSubtitle')}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-0 border-t-4 border-t-indigo-500 shadow-md ring-1 ring-border/50">
          <CardHeader>
            <Volume2 className="mb-1 h-6 w-6 text-indigo-600" />
            <CardTitle className="text-sm font-semibold">{t('pbxScreen.setMoh')}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{t('pbxScreen.setMohBody')}</CardContent>
        </Card>
        <Card className="border-0 border-t-4 border-t-amber-500 shadow-md ring-1 ring-border/50">
          <CardHeader>
            <Bell className="mb-1 h-6 w-6 text-amber-600" />
            <CardTitle className="text-sm font-semibold">{t('pbxScreen.setAlerts')}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{t('pbxScreen.setAlertsBody')}</CardContent>
        </Card>
        <Card className="border-0 border-t-4 border-t-slate-500 shadow-md ring-1 ring-border/50">
          <CardHeader>
            <Moon className="mb-1 h-6 w-6 text-slate-600" />
            <CardTitle className="text-sm font-semibold">{t('pbxScreen.setQuiet')}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{t('pbxScreen.setQuietBody')}</CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-lg ring-1 ring-border/60">
        <CardHeader>
          <CardTitle className="text-base">{t('pbxScreen.setNoteTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>{t('pbxScreen.setNoteBody')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
