import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { toast } from 'sonner';
import { CheckCircle2, Webhook } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { canCreateWebhooks } from '@/shared/lib/can';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import { EVENT_CATALOG, type EventId } from '@/shared/config/event-catalog';

type Wh = { id: number; url: string; enabled: boolean; eventTypes: string[] };

export function EventBadge({ eventId }: { eventId: string }) {
  const ev = EVENT_CATALOG.find((e) => e.id === eventId);
  if (!ev) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{eventId}</span>;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', ev.bg, ev.border, ev.color)}>
      <ev.icon className="h-3 w-3" />
      {ev.labelKey}
    </span>
  );
}

export function EventBadgeI18n({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const ev = EVENT_CATALOG.find((e) => e.id === eventId);
  if (!ev) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{eventId}</span>;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', ev.bg, ev.border, ev.color)}>
      <ev.icon className="h-3 w-3" />
      {t(ev.labelKey)}
    </span>
  );
}

export function EventPicker({
  selected,
  onChange,
  disabled,
}: {
  selected: EventId[];
  onChange: (ids: EventId[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  function toggle(id: EventId) {
    if (disabled) return;
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {EVENT_CATALOG.map((ev) => {
        const active = selected.includes(ev.id);
        return (
          <button
            key={ev.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(ev.id)}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-3 text-left transition-all',
              active
                ? cn('ring-2 ring-offset-1', ev.border, ev.bg)
                : 'border-border bg-card hover:bg-muted/50',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <div className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border', ev.bg, ev.border)}>
              <ev.icon className={cn('h-4 w-4', ev.color)} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn('text-xs font-semibold leading-tight', active ? ev.color : 'text-foreground')}>{t(ev.labelKey)}</p>
              <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{t(ev.descKey)}</p>
            </div>
            {active && <CheckCircle2 className={cn('mt-0.5 h-4 w-4 shrink-0', ev.color)} />}
          </button>
        );
      })}
    </div>
  );
}

function errBody(e: unknown): { error?: string } | undefined {
  if (e && typeof e === 'object' && 'body' in e) return (e as { body?: { error?: string } }).body;
  return undefined;
}

export function WebhooksPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);

  const [url, setUrl] = useState('https://');
  const [secret, setSecret] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<EventId[]>(['call.ended']);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editEvents, setEditEvents] = useState<EventId[]>([]);

  const list = useQuery({
    queryKey: qk.webhooks(orgId ?? 0),
    queryFn: () => apiFetch<{ items: Wh[] }>(`/webhooks/endpoints?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/webhooks/endpoints', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: orgId,
          url,
          secret: secret || undefined,
          eventTypes: selectedEvents,
          enabled: true,
        }),
      }),
    onSuccess: async () => {
      toast.success(t('webhooks.created'));
      setUrl('https://');
      setSecret('');
      setSelectedEvents(['call.ended']);
      await qc.invalidateQueries({ queryKey: qk.webhooks(orgId!) });
    },
    onError: () => toast.error(t('webhooks.createFailed')),
  });

  const patch = useMutation({
    mutationFn: (p: { id: number; url?: string; eventTypes?: string[]; enabled?: boolean }) =>
      apiFetch(`/webhooks/endpoints/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...(p.url !== undefined ? { url: p.url } : {}),
          ...(p.eventTypes !== undefined ? { eventTypes: p.eventTypes } : {}),
          ...(p.enabled !== undefined ? { enabled: p.enabled } : {}),
        }),
      }),
    onSuccess: async () => {
      toast.success(t('webhooks.updated'));
      setEditingId(null);
      await qc.invalidateQueries({ queryKey: qk.webhooks(orgId!) });
    },
    onError: () => toast.error(t('webhooks.updateFailed')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch<{ ok: boolean }>(`/webhooks/endpoints/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success(t('webhooks.deleted'));
      await qc.invalidateQueries({ queryKey: qk.webhooks(orgId!) });
    },
    onError: (e) => {
      void errBody(e);
      toast.error(t('webhooks.deleteFailed'));
    },
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('webhooks.pickOrg')}</p>;

  const canCreate = canCreateWebhooks(me.role);
  const items = list.data?.items ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-md">
              <Webhook className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{t('webhooks.title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t('webhooks.subtitle')}</p>
        </div>
      </div>

      {canCreate && (
        <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
          <div className="h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
          <CardHeader className="border-b border-border bg-muted/20">
            <CardTitle className="text-base">{t('webhooks.create')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('webhooks.createHint')}</p>
          </CardHeader>
          <CardContent className="space-y-6 pt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{t('webhooks.urlLabel')}</label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.empresa.com/hook" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{t('webhooks.secretLabel')}</label>
                <Input
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={t('webhooks.secretPlaceholder')}
                  type="password"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">
                {t('webhooks.eventsLabel')}{' '}
                <span className="text-muted-foreground">
                  ({selectedEvents.length} {t('webhooks.selected')})
                </span>
              </label>
              <EventPicker selected={selectedEvents} onChange={setSelectedEvents} />
            </div>
            <Button
              type="button"
              disabled={create.isPending || !url.startsWith('http') || selectedEvents.length === 0}
              onClick={() => create.mutate()}
              className="gap-2"
            >
              <Webhook className="h-4 w-4" />
              {create.isPending ? t('webhooks.creating') : t('webhooks.submit')}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
        <CardHeader className="border-b border-border bg-muted/20">
          <CardTitle className="text-base">
            {t('webhooks.list')}
            {items.length > 0 && (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {items.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {list.isPending ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Webhook className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{t('webhooks.empty')}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((w) => (
                <div key={w.id} className="p-4">
                  {editingId === w.id ? (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">{t('webhooks.urlLabel')}</label>
                        <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium">{t('webhooks.eventsLabel')}</label>
                        <EventPicker selected={editEvents} onChange={setEditEvents} />
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          {t('actions.cancel')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={patch.isPending}
                          onClick={() => patch.mutate({ id: w.id, url: editUrl.trim(), eventTypes: editEvents })}
                        >
                          {t('actions.save')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className={cn('h-2 w-2 rounded-full', w.enabled ? 'bg-emerald-500' : 'bg-slate-400')} />
                          <span className="break-all text-sm font-medium">{w.url}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {w.eventTypes.map((ev) => (
                            <EventBadgeI18n key={ev} eventId={ev} />
                          ))}
                        </div>
                      </div>
                      {canCreate && (
                        <div className="flex shrink-0 gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={patch.isPending}
                            onClick={() => patch.mutate({ id: w.id, enabled: !w.enabled })}
                            className="text-xs"
                          >
                            {w.enabled ? t('webhooks.disable') : t('webhooks.enable')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(w.id);
                              setEditUrl(w.url);
                              setEditEvents(
                                (w.eventTypes as EventId[]).filter((e) => EVENT_CATALOG.some((c) => c.id === e)),
                              );
                            }}
                          >
                            {t('extensions.edit')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={remove.isPending}
                            onClick={() => {
                              if (!window.confirm(t('webhooks.confirmDelete'))) return;
                              remove.mutate(w.id);
                            }}
                          >
                            {t('extensions.delete')}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
