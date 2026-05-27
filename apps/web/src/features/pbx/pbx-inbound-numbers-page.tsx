import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Hash, Plus, Trash2, Pencil, Download, Upload, PhoneIncoming, Activity, CheckCircle2, XCircle } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';

type InboundNumber = {
  id: number;
  number: string;
  routeType: 'none' | 'ura' | 'queue' | 'extension' | 'call_flow';
  destinationId: number | null;
  destinationLabel?: string | null;
  maxConcurrentCalls: number;
  registerEnabled: boolean;
  recordCalls: boolean;
  active: boolean;
  description: string | null;
};

const ROUTE_TYPE_COLORS: Record<string, string> = {
  none: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  ura: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  queue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  extension: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  call_flow: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
};

export function PbxInboundNumbersPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = me.role === 'platform_admin' || me.role === 'org_admin' || me.role === 'org_operator';

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const list = useQuery({
    queryKey: qk.inboundNumbers(orgId ?? 0),
    queryFn: () => apiFetch<{ items: InboundNumber[] }>(`/inbound-numbers?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/inbound-numbers/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success(t('inbound.deleted'));
      await qc.invalidateQueries({ queryKey: qk.inboundNumbers(orgId ?? 0) });
      setDeletingId(null);
    },
    onError: () => toast.error(t('inbound.failed')),
  });

  if (!orgId) {
    return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;
  }

  const items = list.data?.items ?? [];
  const total = items.length;
  const active = items.filter((n) => n.active).length;
  const withUra = items.filter((n) => n.routeType === 'ura').length;
  const withQueue = items.filter((n) => n.routeType === 'queue').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('nav.inboundNumbers')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pbxScreen.didSubtitle')}</p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button asChild className="gap-2">
              <Link to="/pbx/inbound-numbers/new">
                <Plus className="h-4 w-4" />
                {t('inbound.new')}
              </Link>
            </Button>
            <Button variant="outline" disabled title={t('inbound.exportDisabled')} className="gap-2">
              <Download className="h-4 w-4" />
              {t('actions.export')}
            </Button>
            <Button variant="outline" disabled title={t('inbound.importDisabled')} className="gap-2">
              <Upload className="h-4 w-4" />
              {t('actions.import')}
            </Button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t('inbound.kpi.total'), value: total, icon: Hash, color: 'text-violet-600' },
          { label: t('inbound.kpi.active'), value: active, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: t('inbound.kpi.ura'), value: withUra, icon: Activity, color: 'text-rose-600' },
          { label: t('inbound.kpi.queue'), value: withQueue, icon: PhoneIncoming, color: 'text-blue-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-sm ring-1 ring-border/50">
            <CardContent className="flex items-center gap-3 p-4">
              <Icon className={cn('h-6 w-6 shrink-0', color)} />
              <div>
                <p className="text-2xl font-bold tabular-nums">{list.isPending ? '—' : value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="p-0">
          {list.isPending ? (
            <Skeleton className="m-6 h-32 w-full" />
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Hash className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('inbound.empty')}</p>
              {canWrite && (
                <Button asChild size="sm" variant="outline">
                  <Link to="/pbx/inbound-numbers/new">
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {t('inbound.new')}
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="p-3">{t('inbound.colNumber')}</th>
                  <th className="p-3">{t('inbound.colRouteType')}</th>
                  <th className="p-3">{t('inbound.colDestination')}</th>
                  <th className="p-3">{t('inbound.colStatus')}</th>
                  {canWrite && <th className="p-3 text-right">{t('extensions.colActions')}</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((num) => (
                  <tr key={num.id} className="border-b border-border/70 hover:bg-muted/20">
                    <td className="p-3">
                      <span className="font-mono font-bold">{num.number}</span>
                      {num.description && (
                        <p className="text-xs text-muted-foreground">{num.description}</p>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={cn('rounded px-2 py-0.5 text-[10px] font-medium uppercase', ROUTE_TYPE_COLORS[num.routeType] ?? ROUTE_TYPE_COLORS.none)}>
                        {t(`routing.routeType.${num.routeType}`)}
                      </span>
                    </td>
                    <td className="p-3 text-xs">
                      {num.routeType === 'ura' && num.destinationId ? (
                        <Link
                          to="/pbx/features/uras/$uraId"
                          params={{ uraId: String(num.destinationId) }}
                          className="text-rose-600 underline-offset-2 hover:underline dark:text-rose-400"
                        >
                          {num.destinationLabel ?? `URA #${num.destinationId}`}
                        </Link>
                      ) : num.destinationLabel ? (
                        <span>{num.destinationLabel}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        {num.active ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-slate-400" />
                        )}
                        <span className={cn('text-xs', num.active ? 'text-emerald-600' : 'text-muted-foreground')}>
                          {num.active ? t('trunk.status.active') : t('trunk.status.inactive')}
                        </span>
                      </div>
                    </td>
                    {canWrite && (
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-7 px-2" asChild>
                            <Link to="/pbx/inbound-numbers/$inboundId" params={{ inboundId: String(num.id) }}>
                              <Pencil className="h-3 w-3" />
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            disabled={deletingId === num.id && remove.isPending}
                            onClick={() => {
                              if (window.confirm(t('inbound.confirmDelete'))) {
                                setDeletingId(num.id);
                                remove.mutate(num.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    )}
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
