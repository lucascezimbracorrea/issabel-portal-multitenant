import type { LucideIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Building2, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { useRouteContext } from '@tanstack/react-router';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { cn } from '@/shared/lib/utils';

type OrgDetail = { id: number; issabelBaseUrl: string | null };

export function PbxPlaceholderPage({
  titleKey,
  subtitleKey,
  icon: Icon,
  iconBg,
  iconColor,
  pbxPath,
}: {
  titleKey: string;
  subtitleKey: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  pbxPath?: string;
}) {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const orgId = useActiveOrganizationId(me);

  const org = useQuery({
    queryKey: qk.organization(orgId ?? 0),
    queryFn: () => apiFetch<OrgDetail>(`/organizations/${orgId}`),
    enabled: !!orgId,
  });

  const baseUrl = org.data?.issabelBaseUrl?.replace(/\/$/, '');
  const externalUrl = baseUrl && pbxPath ? `${baseUrl}${pbxPath}` : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t(titleKey)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(subtitleKey)}</p>
      </div>

      <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
        <CardContent className="flex flex-col items-center gap-5 py-16 text-center">
          <div className={cn('flex h-20 w-20 items-center justify-center rounded-2xl', iconBg)}>
            <Icon className={cn('h-10 w-10', iconColor)} />
          </div>
          <div className="max-w-md">
            <p className="font-semibold text-foreground">{t(titleKey)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t(subtitleKey)}</p>
          </div>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            {externalUrl && (
              <Button asChild className="gap-2">
                <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  {t('pbx.openExternal')}
                </a>
              </Button>
            )}
            {!orgId && (
              <Button asChild variant="outline" className="gap-2">
                <Link to="/organizations">
                  <Building2 className="h-4 w-4" />
                  {t('pbx.configureOrg')}
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
