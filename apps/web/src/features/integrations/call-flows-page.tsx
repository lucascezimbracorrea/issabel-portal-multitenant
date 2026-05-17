import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { toast } from 'sonner';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { canWriteCallFlows } from '@/shared/lib/can';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { EventPicker, EventBadgeI18n } from '@/features/webhooks/webhooks-page';
import type { EventId } from '@/shared/config/event-catalog';

type Flow = { id: number; name: string; graph: Record<string, unknown> };

type Rule = {
  id: number;
  eventType: string;
  enabled: boolean;
  actionKind: string;
  urlTemplate: string | null;
  priority: number;
};

export function CallFlowsPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = canWriteCallFlows(me.role);
  const [newFlowName, setNewFlowName] = useState('');
  const [editingFlowId, setEditingFlowId] = useState<number | null>(null);
  const [editFlowName, setEditFlowName] = useState('');
  const [ruleEvents, setRuleEvents] = useState<EventId[]>(['call.ended']);
  const [ruleUrl, setRuleUrl] = useState('https://');

  const flows = useQuery({
    queryKey: qk.callFlows(orgId ?? 0),
    queryFn: () => apiFetch<{ items: Flow[] }>(`/call-flows?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const rules = useQuery({
    queryKey: qk.callRules(orgId ?? 0),
    queryFn: () => apiFetch<{ items: Rule[] }>(`/call-reaction-rules?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const createFlow = useMutation({
    mutationFn: () =>
      apiFetch<Flow>('/call-flows', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: orgId,
          name: newFlowName.trim(),
          graph: { nodes: [], edges: [] },
        }),
      }),
    onSuccess: async () => {
      toast.success(t('callflow.created'));
      setNewFlowName('');
      await qc.invalidateQueries({ queryKey: qk.callFlows(orgId!) });
    },
    onError: () => toast.error(t('callflow.failed')),
  });

  const patchFlow = useMutation({
    mutationFn: (p: { id: number; name: string }) =>
      apiFetch<Flow>(`/call-flows/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: p.name }),
      }),
    onSuccess: async () => {
      toast.success(t('callflow.updated'));
      setEditingFlowId(null);
      await qc.invalidateQueries({ queryKey: qk.callFlows(orgId!) });
    },
    onError: () => toast.error(t('callflow.failed')),
  });

  const deleteFlow = useMutation({
    mutationFn: (id: number) => apiFetch<{ ok: boolean }>(`/call-flows/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success(t('callflow.deleted'));
      await qc.invalidateQueries({ queryKey: qk.callFlows(orgId!) });
    },
    onError: () => toast.error(t('callflow.failed')),
  });

  const createRule = useMutation({
    mutationFn: (eventType: EventId) =>
      apiFetch('/call-reaction-rules', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: orgId,
          eventType,
          actionKind: 'http_request',
          httpMethod: 'POST',
          urlTemplate: ruleUrl.trim(),
          bodyTemplate: '{}',
        }),
      }),
    onSuccess: async () => {
      toast.success(t('callflow.ruleCreated'));
      await qc.invalidateQueries({ queryKey: qk.callRules(orgId!) });
    },
    onError: () => toast.error(t('callflow.failed')),
  });

  const patchRule = useMutation({
    mutationFn: (p: { id: number; enabled: boolean }) =>
      apiFetch(`/call-reaction-rules/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: p.enabled }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.callRules(orgId!) });
    },
    onError: () => toast.error(t('callflow.failed')),
  });

  const deleteRule = useMutation({
    mutationFn: (id: number) => apiFetch<{ ok: boolean }>(`/call-reaction-rules/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success(t('callflow.ruleDeleted'));
      await qc.invalidateQueries({ queryKey: qk.callRules(orgId!) });
    },
    onError: () => toast.error(t('callflow.failed')),
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('integrations.pickOrg')}</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('callflow.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('callflow.subtitle')}</p>
      </div>

      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('callflow.newFlow')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <Input
              className="max-w-md"
              value={newFlowName}
              onChange={(e) => setNewFlowName(e.target.value)}
              placeholder={t('callflow.namePlaceholder')}
            />
            <Button type="button" disabled={createFlow.isPending || !newFlowName.trim()} onClick={() => createFlow.mutate()}>
              {t('callflow.create')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('callflow.list')}</CardTitle>
        </CardHeader>
        <CardContent>
          {flows.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <ul className="space-y-2 text-sm">
              {(flows.data?.items ?? []).map((f) => (
                <li key={f.id} className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    {editingFlowId === f.id ? (
                      <Input className="h-8 max-w-xs" value={editFlowName} onChange={(e) => setEditFlowName(e.target.value)} />
                    ) : (
                      <span className="font-medium">{f.name}</span>
                    )}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t('callflow.nodes', {
                        count: Array.isArray((f.graph as { nodes?: unknown[] }).nodes) ? (f.graph as { nodes: unknown[] }).nodes.length : 0,
                      })}
                    </span>
                  </div>
                  {canWrite ? (
                    <div className="flex shrink-0 gap-1">
                      {editingFlowId === f.id ? (
                        <>
                          <Button type="button" size="sm" variant="outline" onClick={() => setEditingFlowId(null)}>
                            {t('actions.back')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={patchFlow.isPending || !editFlowName.trim()}
                            onClick={() => patchFlow.mutate({ id: f.id, name: editFlowName.trim() })}
                          >
                            {t('actions.save')}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingFlowId(f.id);
                              setEditFlowName(f.name);
                            }}
                          >
                            {t('extensions.edit')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            disabled={deleteFlow.isPending}
                            onClick={() => {
                              if (!window.confirm(t('callflow.confirmDeleteFlow'))) return;
                              deleteFlow.mutate(f.id);
                            }}
                          >
                            {t('extensions.delete')}
                          </Button>
                        </>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('callflow.rulesTitle')}</CardTitle>
          <p className="text-xs text-muted-foreground">{t('callflow.rulesSubtitle')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {canWrite ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{t('webhooks.urlLabel')}</label>
                <Input value={ruleUrl} onChange={(e) => setRuleUrl(e.target.value)} placeholder="https://…" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">{t('webhooks.eventsLabel')}</label>
                <EventPicker selected={ruleEvents} onChange={setRuleEvents} />
              </div>
              <Button
                type="button"
                disabled={createRule.isPending || ruleEvents.length === 0 || !ruleUrl.startsWith('http')}
                onClick={() => ruleEvents.forEach((e) => createRule.mutate(e))}
              >
                {t('callflow.addRule')}
              </Button>
            </div>
          ) : null}
          {rules.isPending ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-2 font-medium">{t('callflow.ruleEvent')}</th>
                  <th className="p-2 font-medium">URL</th>
                  <th className="p-2 font-medium">{t('webhooks.enabled')}</th>
                  {canWrite ? <th className="p-2 font-medium text-right">{t('extensions.colActions')}</th> : null}
                </tr>
              </thead>
              <tbody>
                {(rules.data?.items ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-border/80">
                    <td className="p-2"><EventBadgeI18n eventId={r.eventType} /></td>
                    <td className="max-w-xs truncate p-2 text-xs text-muted-foreground">{r.urlTemplate ?? '—'}</td>
                    <td className="p-2">
                      {canWrite ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={patchRule.isPending}
                          onClick={() => patchRule.mutate({ id: r.id, enabled: !r.enabled })}
                        >
                          {r.enabled ? t('webhooks.disable') : t('webhooks.enable')}
                        </Button>
                      ) : r.enabled ? (
                        t('orgs.yes')
                      ) : (
                        t('orgs.no')
                      )}
                    </td>
                    {canWrite ? (
                      <td className="p-2 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={deleteRule.isPending}
                          onClick={() => {
                            if (!window.confirm(t('callflow.confirmDeleteRule'))) return;
                            deleteRule.mutate(r.id);
                          }}
                        >
                          {t('extensions.delete')}
                        </Button>
                      </td>
                    ) : null}
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
