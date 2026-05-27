import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { toast } from 'sonner';
import { GitBranch, Plus, Trash2, Pencil, Download, Check, X } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { canWriteCallFlows } from '@/shared/lib/can';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';

type Flow = {
  id: number;
  name: string;
  extensionNumber: string | null;
  graph: Record<string, unknown>;
  graphJson?: string;
  nodeCount?: number;
};

export function CallFlowsPbxPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = canWriteCallFlows(me.role);
  const fileRef = useRef<HTMLInputElement>(null);
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowNumber, setNewFlowNumber] = useState('');
  const [editingFlowId, setEditingFlowId] = useState<number | null>(null);
  const [editFlowName, setEditFlowName] = useState('');
  const [editFlowNumber, setEditFlowNumber] = useState('');

  const flows = useQuery({
    queryKey: qk.callFlows(orgId ?? 0),
    queryFn: () => apiFetch<{ items: Flow[] }>(`/call-flows?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const createFlow = useMutation({
    mutationFn: () =>
      apiFetch<Flow>('/call-flows', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: orgId,
          name: newFlowName.trim(),
          extensionNumber: newFlowNumber.trim() || null,
          graph: { nodes: [], edges: [] },
        }),
      }),
    onSuccess: async (flow) => {
      toast.success(t('callflow.created'));
      setNewFlowName('');
      setNewFlowNumber('');
      await qc.invalidateQueries({ queryKey: qk.callFlows(orgId!) });
      void navigate({ to: '/pbx/features/call-flows/$flowId/flow', params: { flowId: String(flow.id) } });
    },
    onError: () => toast.error(t('callflow.failed')),
  });

  const patchFlow = useMutation({
    mutationFn: (p: { id: number; name: string; extensionNumber: string }) =>
      apiFetch<Flow>(`/call-flows/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: p.name, extensionNumber: p.extensionNumber || null }),
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

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  async function importFlow(file: File) {
    try {
      const graph = JSON.parse(await file.text()) as object;
      const name = file.name.replace(/\.json$/i, '') || 'imported';
      await apiFetch('/call-flows', { method: 'POST', body: JSON.stringify({ organizationId: orgId, name, graph }) });
      toast.success(t('callflow.created'));
      await qc.invalidateQueries({ queryKey: qk.callFlows(orgId!) });
    } catch {
      toast.error(t('callflow.failed'));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pbx.callFlows')}</h1>
          <p className="text-sm text-muted-foreground">{t('pbx.callFlowsBody')}</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFlow(f); e.target.value = ''; }} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>Import</Button>
            <Button className="gap-2" onClick={() => createFlow.mutate()} disabled={!newFlowName.trim() || createFlow.isPending}><Plus className="h-4 w-4" />{t('callflow.create')}</Button>
          </div>
        )}
      </div>
      {canWrite && (
        <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-2">
          <Input value={newFlowName} onChange={(e) => setNewFlowName(e.target.value)} placeholder={t('callflow.namePlaceholder')} />
          <Input value={newFlowNumber} onChange={(e) => setNewFlowNumber(e.target.value)} placeholder="800" className="font-mono" />
        </div>
      )}
      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="p-0">
          {flows.isPending ? <Skeleton className="m-6 h-32" /> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="p-3">Nome</th><th className="p-3">Numero</th><th className="p-3">Nos</th>
                {canWrite && <th className="p-3 text-right">{t('extensions.colActions')}</th>}
              </tr></thead>
              <tbody>
                {(flows.data?.items ?? []).map((f) => {
                  const nodeCount = f.nodeCount ?? (Array.isArray((f.graph as { nodes?: unknown[] }).nodes) ? (f.graph as { nodes: unknown[] }).nodes.length : 0);
                  return (
                    <tr key={f.id} className="border-b border-border/70">
                      <td className="p-3 font-medium">{editingFlowId === f.id ? <Input className="h-7 w-40" value={editFlowName} onChange={(e) => setEditFlowName(e.target.value)} /> : f.name}</td>
                      <td className="p-3 font-mono text-xs">{editingFlowId === f.id ? <Input className="h-7 w-24 font-mono" value={editFlowNumber} onChange={(e) => setEditFlowNumber(e.target.value)} /> : (f.extensionNumber ?? '—')}</td>
                      <td className="p-3 text-muted-foreground">{nodeCount}</td>
                      {canWrite && (
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            {editingFlowId === f.id ? (
                              <>
                                <Button size="sm" className="h-7 px-2" onClick={() => patchFlow.mutate({ id: f.id, name: editFlowName.trim(), extensionNumber: editFlowNumber })}><Check className="h-3 w-3" /></Button>
                                <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditingFlowId(null)}><X className="h-3 w-3" /></Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0" asChild><Link to="/pbx/features/call-flows/$flowId/flow" params={{ flowId: String(f.id) }}><GitBranch className="h-3.5 w-3.5" /></Link></Button>
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Export portal JSON" onClick={() => { const blob = new Blob([JSON.stringify(f.graph)], { type: 'application/json' }); const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = f.name + '.json'; a.click(); URL.revokeObjectURL(u); }}><Download className="h-3.5 w-3.5" /></Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" title="Export Issabel bundle" onClick={async () => {
                                  try {
                                    const bundle = await apiFetch<Record<string, unknown>>(`/call-flows/${f.id}/export-issabel`, { method: 'POST' });
                                    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
                                    const u = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = u;
                                    a.download = `${f.name}-issabel.json`;
                                    a.click();
                                    URL.revokeObjectURL(u);
                                  } catch { toast.error(t('callflow.failed')); }
                                }}>Export</Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" title="Apply bundle to Issabel" onClick={async () => {
                                  try {
                                    const bundle = await apiFetch<Record<string, unknown>>(`/call-flows/${f.id}/apply-issabel`, { method: 'POST' });
                                    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
                                    const u = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = u;
                                    a.download = `${f.name}-apply-issabel.json`;
                                    a.click();
                                    URL.revokeObjectURL(u);
                                    toast.success('Bundle apply gerado');
                                  } catch { toast.error(t('callflow.failed')); }
                                }}>Apply</Button>
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => { setEditingFlowId(f.id); setEditFlowName(f.name); setEditFlowNumber(f.extensionNumber ?? ''); }}><Pencil className="h-3.5 w-3.5" /></Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (window.confirm(t('callflow.confirmDeleteFlow'))) deleteFlow.mutate(f.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                              </>
                            )}
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
