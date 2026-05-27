import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Mic, Plus, Trash2, Pencil, ExternalLink } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';

type Ura = {
  id: number;
  name: string;
  extensionNumber: string;
  repetitions: number;
  allowDirectDial: boolean;
  scheduleEnabled: boolean;
  active: boolean;
  uraMode?: 'classic' | 'ai';
};

export function UrasListPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = me.role === 'platform_admin' || me.role === 'org_admin' || me.role === 'org_operator';

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const list = useQuery({
    queryKey: qk.uras(orgId ?? 0),
    queryFn: () => apiFetch<{ items: Ura[] }>(`/uras?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/uras/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success(t('ura.deleted'));
      await qc.invalidateQueries({ queryKey: qk.uras(orgId ?? 0) });
      setDeletingId(null);
    },
    onError: () => toast.error(t('ura.failed')),
  });

  if (!orgId) {
    return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;
  }

  const items = list.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pbx.uras')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pbx.urasBody')}</p>
        </div>
        {canWrite && (
          <Button asChild className="w-fit gap-2">
            <Link to="/pbx/features/uras/new">
              <Plus className="h-4 w-4" />
              {t('ura.new')}
            </Link>
          </Button>
        )}
      </div>

      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="p-0">
          {list.isPending ? (
            <Skeleton className="m-6 h-32 w-full" />
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Mic className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('ura.empty')}</p>
              {canWrite && (
                <Button asChild size="sm" variant="outline">
                  <Link to="/pbx/features/uras/new">
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {t('ura.new')}
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="p-3">{t('ura.colName')}</th>
                  <th className="p-3">{t('routing.ura.colExtension')}</th>
                  <th className="p-3">{t('routing.ura.colMode')}</th>
                  <th className="p-3">{t('ura.colSchedule')}</th>
                  <th className="p-3">{t('extensions.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((ura) => (
                  <tr key={ura.id} className="border-b border-border/70 hover:bg-muted/20">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/40">
                          <Mic className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                        </div>
                        <span className="font-medium">{ura.name}</span>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs font-bold">{ura.extensionNumber}</td>
                    <td className="p-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium',
                          ura.uraMode === 'ai'
                            ? 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                        )}
                      >
                        {ura.uraMode === 'ai'
                          ? t('routing.ura.modeAiBadge')
                          : t('routing.ura.modeClassicBadge')}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        ura.scheduleEnabled
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                      )}>
                        {ura.scheduleEnabled ? t('ura.scheduleOn') : t('ura.scheduleOff')}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 px-2" asChild>
                          <Link to="/pbx/features/uras/$uraId" params={{ uraId: String(ura.id) }}>
                            <Pencil className="h-3 w-3" />
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2" asChild title={t('ura.openFlow')}>
                          <Link to="/pbx/features/uras/$uraId/flow" params={{ uraId: String(ura.id) }}>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </Button>
                        {canWrite && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            disabled={deletingId === ura.id && remove.isPending}
                            onClick={() => {
                              if (window.confirm(t('ura.confirmDelete'))) {
                                setDeletingId(ura.id);
                                remove.mutate(ura.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
