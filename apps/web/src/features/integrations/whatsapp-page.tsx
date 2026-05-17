import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useRouteContext } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MessageCircle, Workflow, Settings, Plug2, Pencil, Trash2, CheckCircle2, XCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/shared/api/client';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

const waGatewaySchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  url: z.string().url('URL inválida (ex: http://servidor:3000)'),
  token: z.string().min(1, 'Token obrigatório'),
  phone: z.string().max(32).optional().default(''),
  messageTemplate: z.string().max(2000).optional().default(''),
  isDefault: z.boolean().optional().default(false),
});
type WaGatewayForm = z.infer<typeof waGatewaySchema>;

type WaGateway = {
  id: number;
  name: string;
  url: string;
  phone: string;
  messageTemplate: string;
  isDefault: boolean;
  status: string;
  enabled: boolean;
  createdAt: string;
};

type WaStatus = {
  gateway: { connected: boolean };
  logsCount: number;
  extensionsCount: number;
  activeCount: number;
};

// ─── Form Panel ───────────────────────────────────────────────────────────────

function WaGatewayFormPanel({
  orgId,
  editGateway,
  onSuccess,
  onCancel,
}: {
  orgId: number;
  editGateway: WaGateway | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!editGateway;
  const { register, handleSubmit, formState: { errors } } = useForm<WaGatewayForm>({
    resolver: zodResolver(waGatewaySchema),
    defaultValues: editGateway
      ? { name: editGateway.name, url: editGateway.url, token: '', phone: editGateway.phone, messageTemplate: editGateway.messageTemplate, isDefault: editGateway.isDefault }
      : {},
  });

  const save = useMutation({
    mutationFn: (d: WaGatewayForm) => isEdit
      ? apiFetch(`/whatsapp/gateways/${editGateway!.id}`, { method: 'PATCH', body: JSON.stringify({ ...d, token: d.token || undefined }) })
      : apiFetch('/whatsapp/gateways', { method: 'POST', body: JSON.stringify({ organizationId: orgId, ...d }) }),
    onSuccess: () => { toast.success(t('whatsapp.configSaved')); onSuccess(); },
    onError: () => toast.error(t('whatsapp.configFailed')),
  });

  return (
    <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{t('whatsapp.fieldName')} *</label>
          <Input {...register('name')} placeholder="Gateway principal" />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">{t('whatsapp.fieldPhone')}</label>
          <Input {...register('phone')} placeholder="+55 11 99999-9999" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">{t('whatsapp.fieldUrl')} *</label>
          <Input {...register('url')} placeholder="http://seu-servidor:3000" />
          {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t('whatsapp.fieldToken')}{isEdit ? ` (${t('whatsapp.tokenEditHint')})` : ' *'}
          </label>
          <Input
            {...register('token')}
            type="password"
            placeholder={isEdit ? '••••••••  (deixe vazio para manter)' : '••••••••••••'}
          />
          {errors.token && <p className="text-xs text-destructive">{errors.token.message}</p>}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">{t('whatsapp.fieldTemplate')}</label>
          <textarea
            {...register('messageTemplate')}
            rows={3}
            placeholder={t('whatsapp.fieldTemplatePlaceholder')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" id="wa-isDefault" {...register('isDefault')} className="h-4 w-4 rounded border-border" />
          <label htmlFor="wa-isDefault" className="text-sm text-muted-foreground">{t('whatsapp.fieldDefault')}</label>
        </div>
      </div>
      <div className="flex gap-2 border-t border-border pt-4">
        <Button type="submit" disabled={save.isPending} className="gap-2">
          <Plug2 className="h-4 w-4" />
          {save.isPending ? t('loading') : isEdit ? t('actions.save') : t('whatsapp.connect')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>{t('actions.cancel')}</Button>
      </div>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function WhatsappPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const activeOrg = useActiveOrganizationId(me);
  const orgId = activeOrg ?? me.organizationIds[0] ?? 0;
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WaGateway | null>(null);

  const statusQ = useQuery({
    queryKey: ['whatsapp-status', orgId],
    queryFn: () => apiFetch<WaStatus>(`/whatsapp/status?organizationId=${orgId}`),
    enabled: orgId > 0,
    retry: false,
  });

  const gwQ = useQuery({
    queryKey: ['whatsapp-gateways', orgId],
    queryFn: () => apiFetch<{ items: WaGateway[] }>(`/whatsapp/gateways?organizationId=${orgId}`),
    enabled: orgId > 0,
    retry: false,
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch(`/whatsapp/gateways/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success(t('whatsapp.disconnected')); invalidate(); },
    onError: () => toast.error(t('whatsapp.disconnectFailed')),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['whatsapp-status', orgId] });
    void qc.invalidateQueries({ queryKey: ['whatsapp-gateways', orgId] });
    setFormOpen(false);
    setEditing(null);
  };

  const status = statusQ.data;
  const gateways = gwQ.data?.items ?? [];
  const showForm = formOpen || !!editing;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="bg-gradient-to-r from-emerald-600 via-green-600 to-lime-500 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-emerald-300 dark:via-green-300 dark:to-lime-200">
          {t('whatsapp.title')}
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('whatsapp.subtitle')}</p>
      </div>

      {orgId === 0 ? (
        <p className="text-sm text-muted-foreground">{t('pbxScreen.pickOrg')}</p>
      ) : (
        <>
          {/* Status cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-0 border-t-4 border-t-emerald-500 shadow-md ring-1 ring-border/50">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                {(status?.activeCount ?? 0) > 0
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  : <XCircle className="h-5 w-5 text-muted-foreground" />
                }
                <CardTitle className="text-sm font-semibold">{t('whatsapp.cardChannel')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {statusQ.isPending ? <Skeleton className="h-7 w-16" /> : (
                  <>
                    <p className={cn('text-2xl font-bold tabular-nums', (status?.activeCount ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground')}>
                      {status?.activeCount ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('whatsapp.cardChannelBody')}</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 border-t-4 border-t-sky-500 shadow-md ring-1 ring-border/50">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <MessageCircle className="h-5 w-5 text-sky-600" />
                <CardTitle className="text-sm font-semibold">{t('whatsapp.cardLogs')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-bold text-sky-700 dark:text-sky-300">
                  {statusQ.isPending ? '…' : (status?.logsCount ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">{t('whatsapp.cardLogsBody')}</p>
              </CardContent>
            </Card>

            <Card className="border-0 border-t-4 border-t-violet-500 shadow-md ring-1 ring-border/50">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <MessageCircle className="h-5 w-5 text-violet-600" />
                <CardTitle className="text-sm font-semibold">{t('whatsapp.cardExtensions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">
                  {statusQ.isPending ? '…' : (status?.extensionsCount ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">{t('whatsapp.cardExtensionsBody')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Gateways list */}
          <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
            <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500" />
            <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">{t('whatsapp.gatewayList')}</CardTitle>
              </div>
              {!showForm && (
                <Button size="sm" className="gap-1.5" onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" />{t('whatsapp.newGateway')}
                </Button>
              )}
            </CardHeader>

            {showForm && (
              <div className="border-b border-border bg-muted/10 p-6">
                <h3 className="mb-4 text-sm font-semibold text-foreground">
                  {editing ? t('whatsapp.editGateway') : t('whatsapp.newGateway')}
                </h3>
                <WaGatewayFormPanel
                  orgId={orgId}
                  editGateway={editing}
                  onSuccess={invalidate}
                  onCancel={() => { setFormOpen(false); setEditing(null); }}
                />
              </div>
            )}

            <CardContent className="p-0">
              {gwQ.isPending ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : gateways.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <MessageCircle className="h-10 w-10 text-muted-foreground/25" />
                  <p className="text-sm text-muted-foreground">{t('whatsapp.noGateways')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="p-3">{t('whatsapp.fieldName')}</th>
                        <th className="p-3">{t('whatsapp.fieldUrl')}</th>
                        <th className="p-3">{t('whatsapp.fieldPhone')}</th>
                        <th className="p-3">{t('whatsapp.fieldDefault')}</th>
                        <th className="p-3">{t('orgs.colActive')}</th>
                        <th className="p-3">{t('extensions.colActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gateways.map((gw) => (
                        <tr key={gw.id} className="border-b border-border/70 hover:bg-muted/30">
                          <td className="p-3 font-medium">{gw.name}</td>
                          <td className="p-3 font-mono text-xs text-muted-foreground">{gw.url}</td>
                          <td className="p-3 text-muted-foreground">{gw.phone || '—'}</td>
                          <td className="p-3">
                            {gw.isDefault && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                                {t('orgs.yes')}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', gw.status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-muted text-muted-foreground')}>
                              {gw.status === 'active' ? t('webhooks.enabled') : gw.status}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 px-2 text-xs"
                                onClick={() => { setEditing(gw); setFormOpen(false); }}
                              >
                                <Pencil className="h-3 w-3" />{t('extensions.edit')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                disabled={del.isPending}
                                onClick={() => { if (confirm(t('whatsapp.confirmDisconnect'))) del.mutate(gw.id); }}
                              >
                                <Trash2 className="h-3 w-3" />{t('extensions.delete')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Flow integration card */}
          <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
            <div className="h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-violet-500" />
            <CardHeader className="flex flex-col gap-4 border-b border-border bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">{t('whatsapp.flowTitle')}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{t('whatsapp.flowBody')}</p>
              </div>
              <Button asChild className="gap-2">
                <Link to="/integrations/flows">
                  <Workflow className="h-4 w-4" />
                  {t('whatsapp.openFlows')}
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              <ul className="list-inside list-disc space-y-2">
                <li>{t('whatsapp.bullet1')}</li>
                <li>{t('whatsapp.bullet2')}</li>
                <li>{t('whatsapp.bullet3')}</li>
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
