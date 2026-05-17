import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  Puzzle,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Globe,
  Zap,
} from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import { EventPicker, EventBadgeI18n } from '@/features/webhooks/webhooks-page';
import type { EventId } from '@/shared/config/event-catalog';

type IntegrationRow = { id: number; type: string; status: string; config: Record<string, unknown> };

type HttpMethod = 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE';

const HTTP_METHODS: HttpMethod[] = ['POST', 'GET', 'PUT', 'PATCH', 'DELETE'];

const METHOD_COLORS: Record<HttpMethod, string> = {
  POST: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  GET: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  PUT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  PATCH: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  inactive: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

function IntegrationCard({ item, onToggle, onDelete, canEdit }: {
  item: IntegrationRow;
  onToggle: () => void;
  onDelete: () => void;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const isActive = item.status === 'active';
  const statusStyle = STATUS_STYLES[item.status] ?? STATUS_STYLES.inactive;
  const method = (item.config?.method as HttpMethod) ?? 'POST';
  const url = (item.config?.url as string) ?? '';
  const events = (item.config?.events as string[]) ?? [];

  return (
    <Card className="overflow-hidden border-0 shadow-md ring-1 ring-border/50 transition-shadow hover:shadow-lg">
      <div className={cn('h-1', isActive ? 'bg-gradient-to-r from-teal-500 to-emerald-500' : 'bg-muted')} />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Globe className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold capitalize">{item.type}</p>
              <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', statusStyle)}>
                {item.status}
              </span>
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onToggle}
                className="text-muted-foreground transition-colors hover:text-foreground"
                title={isActive ? t('webhooks.disable') : t('webhooks.enable')}
              >
                {isActive ? <ToggleRight className="h-5 w-5 text-emerald-600" /> : <ToggleLeft className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-xs text-muted-foreground">
        {url && (
          <div className="flex items-center gap-1.5">
            <span className={cn('rounded px-1.5 py-0.5 font-mono font-bold text-[10px]', METHOD_COLORS[method] ?? METHOD_COLORS.POST)}>
              {method}
            </span>
            <span className="truncate font-mono">{url}</span>
          </div>
        )}
        {events.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {events.map((e) => (
              <EventBadgeI18n key={e} eventId={e} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateIntegrationForm({ orgId, onSuccess }: { orgId: number; onSuccess: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('https://');
  const [method, setMethod] = useState<HttpMethod>('POST');
  const [events, setEvents] = useState<EventId[]>(['call.ended']);
  const [headers, setHeaders] = useState('');

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/integrations', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: orgId,
          type: name.trim() || 'custom',
          status: 'active',
          config: {
            url: url.trim(),
            method,
            events,
            headers: headers.trim() ? Object.fromEntries(
              headers.trim().split('\n').map((l) => l.split(':').map((s) => s.trim())).filter((p) => p.length === 2)
            ) : {},
          },
        }),
      }),
    onSuccess: async () => {
      toast.success(t('integrations.created'));
      onSuccess();
    },
    onError: () => toast.error(t('integrations.createFailed')),
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium">{t('integrations.fieldName')}</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('integrations.fieldNamePlaceholder')} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium">{t('integrations.fieldMethod')}</label>
          <div className="flex gap-1.5 flex-wrap">
            {HTTP_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-bold transition-all',
                  method === m ? METHOD_COLORS[m] + ' ring-2 ring-offset-1 ring-current' : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium">{t('integrations.fieldUrl')}</label>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.crm.com/webhook" />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium">{t('webhooks.eventsLabel')}</label>
        <EventPicker selected={events} onChange={setEvents} />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium">{t('integrations.fieldHeaders')}</label>
        <textarea
          value={headers}
          onChange={(e) => setHeaders(e.target.value)}
          placeholder={'Authorization: Bearer token123\nX-Custom-Header: value'}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-[10px] text-muted-foreground">{t('integrations.fieldHeadersHint')}</p>
      </div>
      <Button
        type="button"
        disabled={create.isPending || !url.startsWith('http') || events.length === 0}
        onClick={() => create.mutate()}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        {create.isPending ? t('integrations.creating') : t('integrations.createBtn')}
      </Button>
    </div>
  );
}

export function IntegrationsHubPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const [showCreate, setShowCreate] = useState(false);

  const canEdit = me.role === 'platform_admin' || me.role === 'org_admin';

  const list = useQuery({
    queryKey: qk.integrations(orgId ?? 0),
    queryFn: () => apiFetch<{ items: IntegrationRow[] }>(`/integrations?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const toggle = useMutation({
    mutationFn: (item: IntegrationRow) =>
      apiFetch(`/integrations/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: item.status === 'active' ? 'inactive' : 'active' }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.integrations(orgId!) });
    },
    onError: () => toast.error(t('integrations.updateFailed')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/integrations/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success(t('integrations.deleted'));
      await qc.invalidateQueries({ queryKey: qk.integrations(orgId!) });
    },
    onError: () => toast.error(t('integrations.deleteFailed')),
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('integrations.pickOrg')}</p>;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-md">
            <Puzzle className="h-5 w-5 text-white" />
          </div>
          <h1 className="bg-gradient-to-r from-teal-700 to-cyan-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent dark:from-teal-300 dark:to-cyan-300">
            {t('integrations.title')}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">{t('integrations.subtitle')}</p>
      </div>

      {/* Action */}
      {canEdit && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            className="gap-2"
            onClick={() => setShowCreate((v) => !v)}
          >
            <Plus className="h-4 w-4" />
            {showCreate ? t('actions.cancel') : t('integrations.createBtn')}
          </Button>
        </div>
      )}

      {showCreate && canEdit && (
        <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
          <div className="h-1 bg-gradient-to-r from-teal-500 to-cyan-500" />
          <CardHeader className="border-b border-border bg-muted/20">
            <CardTitle className="text-base">{t('integrations.createTitle')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('integrations.createHint')}</p>
          </CardHeader>
          <CardContent className="pt-5">
            <CreateIntegrationForm
              orgId={orgId}
              onSuccess={() => {
                setShowCreate(false);
                void qc.invalidateQueries({ queryKey: qk.integrations(orgId) });
              }}
            />
          </CardContent>
        </Card>
      )}

      {list.isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (list.data?.items ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Zap className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">{t('integrations.emptyTitle')}</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">{t('integrations.emptyBody')}</p>
          </div>
          {canEdit && (
            <Button type="button" size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              {t('integrations.createBtn')}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(list.data?.items ?? []).map((item) => (
            <IntegrationCard
              key={item.id}
              item={item}
              canEdit={canEdit}
              onToggle={() => toggle.mutate(item)}
              onDelete={() => {
                if (!window.confirm(t('integrations.confirmDelete'))) return;
                remove.mutate(item.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
