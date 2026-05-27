import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { Inbox } from 'lucide-react';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { apiFetch } from '@/shared/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { PbxScreenHero } from '@/features/pbx/pbx-screen-hero';

type MailboxRow = {
  extension: string;
  displayName: string;
  newMessages: number;
  oldMessages: number;
  source: 'ami' | 'unavailable';
};

export function PbxVoicemailPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const orgId = useActiveOrganizationId(me);

  const q = useQuery({
    queryKey: ['voicemail-mailboxes', orgId],
    queryFn: () =>
      apiFetch<{ source: string; items: MailboxRow[] }>(`/organizations/${orgId}/voicemail/mailboxes`),
    enabled: !!orgId,
  });

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
        <CardContent className="p-0">
          {q.isLoading && <p className="p-8 text-center text-sm text-muted-foreground">A carregar…</p>}
          {q.data?.source === 'unconfigured' && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Configure AMI na empresa (amiHost, amiUser, amiSecret) para contadores MWI em tempo real.
            </p>
          )}
          {q.data && q.data.items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Ramal</th>
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">Novas</th>
                    <th className="px-4 py-3 font-medium">Antigas</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.items.map((row) => (
                    <tr key={row.extension} className="border-b border-border/60">
                      <td className="px-4 py-3 font-mono">{row.extension}</td>
                      <td className="px-4 py-3">{row.displayName}</td>
                      <td className="px-4 py-3">{row.newMessages}</td>
                      <td className="px-4 py-3">{row.oldMessages}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {q.data && q.data.source === 'ami' && q.data.items.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">Nenhum ramal encontrado.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
