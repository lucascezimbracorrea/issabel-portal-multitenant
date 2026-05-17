import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useRouteContext } from '@tanstack/react-router';
import { toast } from 'sonner';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { canWriteExtensions } from '@/shared/lib/can';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';

type Ext = { id: number; number: string; displayName: string; source: string };

export function ExtensionsPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = canWriteExtensions(me.role);

  const list = useQuery({
    queryKey: qk.extensions(orgId ?? 0),
    queryFn: () => apiFetch<{ items: Ext[] }>(`/extensions?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch<{ ok: boolean }>(`/extensions/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success(t('extensions.deleted'));
      await qc.invalidateQueries({ queryKey: qk.extensions(orgId!) });
      await qc.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: () => toast.error(t('extensions.failed')),
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('extensions.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('extensions.subtitle')}</p>
        </div>
        {canWrite && (
          <Button
            type="button"
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => void navigate({ to: '/extensions/new' })}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t('extensions.new')}
          </Button>
        )}
      </div>

      {/* ── Extensions table ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('extensions.table')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {list.isPending ? (
            <div className="p-6">
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (list.data?.items ?? []).length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t('extensions.emptyIntro')}{' '}
              {canWrite && (
                <button
                  type="button"
                  className="font-medium text-teal-600 underline hover:text-teal-500"
                  onClick={() => void navigate({ to: '/extensions/new' })}
                >
                  {t('extensions.createFirstCta')}
                </button>
              )}
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-6 py-3 font-medium">{t('extensions.colNumber')}</th>
                  <th className="px-6 py-3 font-medium">{t('extensions.colName')}</th>
                  <th className="px-6 py-3 font-medium">{t('extensions.colSource')}</th>
                  {canWrite && (
                    <th className="px-6 py-3 font-medium text-right">{t('extensions.colActions')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {(list.data?.items ?? []).map((r) => {
                  const isPortal = r.source === 'portal';
                  const clickable = canWrite && isPortal;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => {
                        if (clickable) {
                          void navigate({ to: '/extensions/$extId', params: { extId: String(r.id) } });
                        }
                      }}
                      className={
                        clickable
                          ? 'cursor-pointer border-b border-border/80 transition-colors hover:bg-muted/50'
                          : 'border-b border-border/80'
                      }
                    >
                      <td className="px-6 py-3 align-middle font-mono">{r.number}</td>
                      <td className="px-6 py-3 align-middle">{r.displayName}</td>
                      <td className="px-6 py-3 align-middle">
                        <span
                          className={
                            isPortal
                              ? 'rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
                              : 'rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground'
                          }
                        >
                          {r.source === 'portal' || r.source === 'synced' || r.source === 'linked'
                            ? t(`extensions.source.${r.source}` as 'extensions.source.portal')
                            : r.source}
                        </span>
                      </td>
                      {canWrite && (
                        <td
                          className="px-6 py-3 align-middle text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!isPortal}
                              title={!isPortal ? t('extensions.onlyPortalHint') : undefined}
                              onClick={() =>
                                void navigate({
                                  to: '/extensions/$extId',
                                  params: { extId: String(r.id) },
                                })
                              }
                            >
                              {t('extensions.edit')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={remove.isPending || !isPortal}
                              title={!isPortal ? t('extensions.onlyPortalHint') : undefined}
                              onClick={() => {
                                if (!window.confirm(t('extensions.confirmDelete'))) return;
                                remove.mutate(r.id);
                              }}
                            >
                              {t('extensions.delete')}
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
