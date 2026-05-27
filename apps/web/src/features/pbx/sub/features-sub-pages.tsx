import { Fragment, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { FileAudio, List, Workflow, Pause, Hash, Video, Plus, Trash2, Pencil, Check, X, Search } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';

type Queue = { id: number; name: string; queueCode?: string | null; strategy: string; timeout: number; maxCalls: number | null; description: string | null };
type HoldGroup = { id: number; name: string; mode: string; description: string | null };
type ConferenceRoom = { id: number; roomNumber: string; name: string; pin: string | null; maxParticipants: number | null; description: string | null; settings?: { record?: boolean; announceJoin?: boolean; musicOnHold?: boolean } };
type AudioFile = { id: number; name: string; filename: string | null; description: string | null };

const STRATEGY_COLORS: Record<string, string> = {
  roundrobin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  leastrecent: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  fewestcalls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  random: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  rrmemory: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
};

// ─── Queues ────────────────────────────────────────────────────────────────────

export function QueuesPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = me.role === 'platform_admin' || me.role === 'org_admin' || me.role === 'org_operator';

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStrategy, setNewStrategy] = useState<Queue['strategy']>('roundrobin');
  const [newTimeout, setNewTimeout] = useState('30');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editTimeout, setEditTimeout] = useState('30');
  const [viewMode, setViewMode] = useState<'dashboard' | 'list'>('dashboard');
  const [selectedQueueId, setSelectedQueueId] = useState<number | null>(null);
  const [newAgentLabel, setNewAgentLabel] = useState('');

  const list = useQuery({
    queryKey: ['queues', orgId ?? 0],
    queryFn: () => apiFetch<{ items: Queue[] }>(`/queues?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const activeQueueId = selectedQueueId ?? list.data?.items?.[0]?.id ?? null;
  const dashboard = useQuery({
    queryKey: ['queue-dashboard', activeQueueId ?? 0],
    queryFn: () => apiFetch<{ queue: Queue; metrics: { callsWaiting: number; answeredToday: number; abandonedToday: number; avgWaitSec: number; avgTalkSec: number; serviceLevelPct: number; demo?: boolean }; members: { id: number; agentLabel: string }[] }>(`/queues/${activeQueueId}/dashboard`),
    enabled: !!activeQueueId && viewMode === 'dashboard',
  });

  const create = useMutation({
    mutationFn: () => apiFetch('/queues', { method: 'POST', body: JSON.stringify({ organizationId: orgId, name: newName.trim(), strategy: newStrategy, timeout: Number(newTimeout) || 30, description: newDesc.trim() || undefined }) }),
    onSuccess: async () => { toast.success(t('queue.created')); setShowCreate(false); setNewName(''); setNewDesc(''); await qc.invalidateQueries({ queryKey: ['queues', orgId] }); },
    onError: () => toast.error(t('queue.failed')),
  });

  const update = useMutation({
    mutationFn: ({ id, name, timeout }: { id: number; name: string; timeout: number }) =>
      apiFetch(`/queues/${id}`, { method: 'PATCH', body: JSON.stringify({ name, timeout }) }),
    onSuccess: async () => { toast.success(t('queue.updated')); setEditingId(null); await qc.invalidateQueries({ queryKey: ['queues', orgId] }); },
    onError: () => toast.error(t('queue.failed')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/queues/${id}`, { method: 'DELETE' }),
    onSuccess: async () => { toast.success(t('queue.deleted')); await qc.invalidateQueries({ queryKey: ['queues', orgId] }); },
    onError: () => toast.error(t('queue.failed')),
  });

  const addMember = useMutation({
    mutationFn: () => apiFetch(`/queues/${activeQueueId}/members`, { method: 'POST', body: JSON.stringify({ agentLabel: newAgentLabel.trim() }) }),
    onSuccess: async () => {
      setNewAgentLabel('');
      await qc.invalidateQueries({ queryKey: ['queue-dashboard', activeQueueId ?? 0] });
    },
    onError: () => toast.error(t('queue.failed')),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: number) => apiFetch(`/queues/${activeQueueId}/members/${memberId}`, { method: 'DELETE' }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['queue-dashboard', activeQueueId ?? 0] }); },
    onError: () => toast.error(t('queue.failed')),
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  const strategies = ['roundrobin', 'leastrecent', 'fewestcalls', 'random', 'rrmemory'] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pbx.queues')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pbx.queuesBody')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={viewMode === 'dashboard' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('dashboard')}>{t('queue.dashboard')}</Button>
          <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')}>{t('queue.listMode')}</Button>
          {canWrite && !showCreate && viewMode === 'list' && (
            <Button onClick={() => setShowCreate(true)} className="w-fit gap-2"><Plus className="h-4 w-4" />{t('queue.new')}</Button>
          )}
        </div>
      </div>

      {viewMode === 'dashboard' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(list.data?.items ?? []).map((q) => (
              <Button key={q.id} size="sm" variant={activeQueueId === q.id ? 'default' : 'outline'} onClick={() => setSelectedQueueId(q.id)}>
                {q.queueCode ? `${q.queueCode} - ` : ''}{q.name}
              </Button>
            ))}
          </div>
          {dashboard.isPending ? <Skeleton className="h-40 w-full" /> : dashboard.data && (
            <Card className="border-0 shadow-md ring-1 ring-border/50">
              <CardContent className="space-y-4 p-6">
                <p className="text-lg font-semibold">{dashboard.data.queue.name}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{t('queue.waiting')}</p><p className="text-2xl font-bold">{dashboard.data.metrics.callsWaiting}</p></div>
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{t('queue.answeredToday')}</p><p className="text-2xl font-bold">{dashboard.data.metrics.answeredToday}</p></div>
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{t('queue.abandoned')}</p><p className="text-2xl font-bold">{dashboard.data.metrics.abandonedToday}</p></div>
                  <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">TME / TMA</p><p className="text-lg font-bold">{dashboard.data.metrics.avgWaitSec}s / {dashboard.data.metrics.avgTalkSec}s</p></div>
                </div>
                {dashboard.data.metrics.demo && (
                  <p className="text-xs text-amber-600">
                    {t('queue.demoMetrics')} — configure AMI ou CDR (queue_log) na empresa.
                  </p>
                )}
                {!dashboard.data.metrics.demo && (
                  <p className="text-xs text-emerald-600">Métricas em tempo real (AMI / queue_log)</p>
                )}
                {!dashboard.data.metrics.demo &&
                  (dashboard.data.metrics as { source?: string }).source === 'queue_log' && (
                  <p className="text-xs text-teal-600">Métricas reais (queue_log 24h)</p>
                )}
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-2">{t('queue.agents')}</th>{canWrite && <th className="p-2 w-16" />}</tr></thead>
                  <tbody>
                    {(dashboard.data.members ?? []).map((m) => (
                      <tr key={m.id} className="border-b">
                        <td className="p-2">{m.agentLabel}</td>
                        {canWrite && (
                          <td className="p-2 text-right">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeMember.mutate(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {canWrite && (
                  <div className="flex gap-2 pt-2">
                    <Input className="h-8 max-w-xs" value={newAgentLabel} onChange={(e) => setNewAgentLabel(e.target.value)} placeholder={t('queue.agentPlaceholder')} />
                    <Button size="sm" disabled={!newAgentLabel.trim() || addMember.isPending} onClick={() => addMember.mutate()}><Plus className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {viewMode === 'list' && showCreate && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('queue.name')}</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('queue.namePlaceholder')} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('queue.timeout')}</label>
              <Input type="number" min="5" max="300" value={newTimeout} onChange={(e) => setNewTimeout(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">{t('queue.strategy')}</label>
            <div className="flex flex-wrap gap-1.5">
              {strategies.map((s) => (
                <button key={s} type="button" onClick={() => setNewStrategy(s)}
                  className={cn('rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    newStrategy === s ? STRATEGY_COLORS[s] + ' ring-2 ring-current ring-offset-1' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1 max-w-sm">
            <label className="text-xs font-medium">{t('queue.description')}</label>
            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('queue.descPlaceholder')} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={create.isPending || !newName.trim()} onClick={() => create.mutate()} className="gap-1.5"><Check className="h-3.5 w-3.5" />{t('actions.save')}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)} className="gap-1.5"><X className="h-3.5 w-3.5" />{t('actions.cancel')}</Button>
          </div>
        </div>
      )}

      {viewMode === 'list' && (
      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="p-0">
          {list.isPending ? <Skeleton className="m-6 h-32 w-full" /> : (list.data?.items ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <List className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('queue.empty')}</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="p-3">{t('queue.name')}</th>
                <th className="p-3">{t('queue.strategy')}</th>
                <th className="p-3">{t('queue.timeout')}</th>
                {canWrite && <th className="p-3 text-right">{t('extensions.colActions')}</th>}
              </tr></thead>
              <tbody>
                {(list.data?.items ?? []).map((q) => (
                  <tr key={q.id} className="border-b border-border/70">
                    <td className="p-3 font-medium">
                      {editingId === q.id
                        ? <Input className="h-7 w-40" value={editName} onChange={(e) => setEditName(e.target.value)} />
                        : <>{q.name}{q.description && <p className="text-xs text-muted-foreground">{q.description}</p>}</>}
                    </td>
                    <td className="p-3"><span className={cn('rounded px-2 py-0.5 text-[10px] font-medium', STRATEGY_COLORS[q.strategy] ?? STRATEGY_COLORS.roundrobin)}>{q.strategy}</span></td>
                    <td className="p-3 tabular-nums">
                      {editingId === q.id
                        ? <Input type="number" className="h-7 w-20" value={editTimeout} onChange={(e) => setEditTimeout(e.target.value)} />
                        : `${q.timeout}s`}
                    </td>
                    {canWrite && (
                      <td className="p-3 text-right">
                        {editingId === q.id ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" className="h-7 px-2" disabled={update.isPending} onClick={() => update.mutate({ id: q.id, name: editName, timeout: Number(editTimeout) })}><Check className="h-3 w-3" /></Button>
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setEditingId(q.id); setEditName(q.name); setEditTimeout(String(q.timeout)); }}><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => { if (window.confirm(t('queue.confirmDelete'))) remove.mutate(q.id); }}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}

// ─── Hold Groups ──────────────────────────────────────────────────────────────

export function HoldGroupPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = me.role === 'platform_admin' || me.role === 'org_admin' || me.role === 'org_operator';

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState('files');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [mohMode, setMohMode] = useState<'default' | 'custom'>('default');
  const [mohAudioId, setMohAudioId] = useState<number | ''>('');

  const audioFiles = useQuery({
    queryKey: ['audio-files', orgId ?? 0],
    queryFn: () => apiFetch<{ items: { id: number; name: string }[] }>(`/audio-files?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const holdMusic = useQuery({
    queryKey: ['hold-music', orgId ?? 0],
    queryFn: () => apiFetch<{ holdMusic: { mode: 'default' | 'custom'; audioFileId?: number | null } }>(`/organizations/${orgId}/hold-music`),
    enabled: !!orgId,
  });

  useEffect(() => {
    if (holdMusic.data?.holdMusic?.mode) setMohMode(holdMusic.data.holdMusic.mode);
    if (holdMusic.data?.holdMusic?.audioFileId) setMohAudioId(holdMusic.data.holdMusic.audioFileId);
  }, [holdMusic.data]);

  const saveMoh = useMutation({
    mutationFn: () => apiFetch(`/organizations/${orgId}/hold-music`, { method: 'PATCH', body: JSON.stringify({ mode: mohMode, audioFileId: mohMode === 'custom' && mohAudioId ? Number(mohAudioId) : null }) }),
    onSuccess: () => toast.success(t('holdGroup.updated')),
    onError: () => toast.error(t('holdGroup.failed')),
  });

  const list = useQuery({
    queryKey: ['hold-groups', orgId ?? 0],
    queryFn: () => apiFetch<{ items: HoldGroup[] }>(`/hold-groups?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: () => apiFetch('/hold-groups', { method: 'POST', body: JSON.stringify({ organizationId: orgId, name: newName.trim(), mode: newMode, description: newDesc.trim() || undefined }) }),
    onSuccess: async () => { toast.success(t('holdGroup.created')); setShowCreate(false); setNewName(''); setNewDesc(''); await qc.invalidateQueries({ queryKey: ['hold-groups', orgId] }); },
    onError: () => toast.error(t('holdGroup.failed')),
  });

  const update = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      apiFetch(`/hold-groups/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    onSuccess: async () => { toast.success(t('holdGroup.updated')); setEditingId(null); await qc.invalidateQueries({ queryKey: ['hold-groups', orgId] }); },
    onError: () => toast.error(t('holdGroup.failed')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/hold-groups/${id}`, { method: 'DELETE' }),
    onSuccess: async () => { toast.success(t('holdGroup.deleted')); await qc.invalidateQueries({ queryKey: ['hold-groups', orgId] }); },
    onError: () => toast.error(t('holdGroup.failed')),
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        Música de espera personalizada fica guardada no portal. Para ouvir no Asterisk, envie o áudio para o servidor Issabel (MOH) ou use o sync manual do PBX.
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pbx.holdGroup')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pbx.holdGroupBody')}</p>
        </div>
        {canWrite && !showCreate && (
          <Button onClick={() => setShowCreate(true)} className="w-fit gap-2"><Plus className="h-4 w-4" />{t('holdGroup.new')}</Button>
        )}
      </div>

      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-medium">{t('holdGroup.defaultMoh')}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" checked={mohMode === 'default'} onChange={() => setMohMode('default')} disabled={!canWrite} />{t('holdGroup.mohPabx')}</label>
            <label className="flex items-center gap-2"><input type="radio" checked={mohMode === 'custom'} onChange={() => setMohMode('custom')} disabled={!canWrite} />{t('holdGroup.mohCustom')}</label>
          </div>
          {mohMode === 'custom' && (
            <select className="h-9 max-w-sm rounded-md border border-input bg-background px-2 text-sm" value={mohAudioId} onChange={(e) => setMohAudioId(e.target.value ? Number(e.target.value) : '')} disabled={!canWrite}>
              <option value="">{t('holdGroup.pickAudio')}</option>
              {(audioFiles.data?.items ?? []).map((af) => <option key={af.id} value={af.id}>{af.name}</option>)}
            </select>
          )}
          {canWrite && <Button size="sm" onClick={() => saveMoh.mutate()} disabled={saveMoh.isPending}>{t('actions.save')}</Button>}
        </CardContent>
      </Card>

      {showCreate && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('holdGroup.name')}</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('holdGroup.namePlaceholder')} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('holdGroup.mode')}</label>
              <select value={newMode} onChange={(e) => setNewMode(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                {['files', 'playlist', 'random', 'none'].map((m) => <option key={m} value={m}>{t(`holdGroup.mode.${m}`)}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('holdGroup.description')}</label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('holdGroup.descPlaceholder')} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={create.isPending || !newName.trim()} onClick={() => create.mutate()} className="gap-1.5"><Check className="h-3.5 w-3.5" />{t('actions.save')}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)} className="gap-1.5"><X className="h-3.5 w-3.5" />{t('actions.cancel')}</Button>
          </div>
        </div>
      )}

      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="p-0">
          {list.isPending ? <Skeleton className="m-6 h-32 w-full" /> : (list.data?.items ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Pause className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('holdGroup.empty')}</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="p-3">{t('holdGroup.name')}</th>
                <th className="p-3">{t('holdGroup.mode')}</th>
                {canWrite && <th className="p-3 text-right">{t('extensions.colActions')}</th>}
              </tr></thead>
              <tbody>
                {(list.data?.items ?? []).map((hg) => (
                  <tr key={hg.id} className="border-b border-border/70">
                    <td className="p-3 font-medium">
                      {editingId === hg.id
                        ? <Input className="h-7 w-40" value={editName} onChange={(e) => setEditName(e.target.value)} />
                        : <>{hg.name}{hg.description && <p className="text-xs text-muted-foreground">{hg.description}</p>}</>}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{t(`holdGroup.mode.${hg.mode}`)}</td>
                    {canWrite && (
                      <td className="p-3 text-right">
                        {editingId === hg.id ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" className="h-7 px-2" disabled={update.isPending} onClick={() => update.mutate({ id: hg.id, name: editName })}><Check className="h-3 w-3" /></Button>
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setEditingId(hg.id); setEditName(hg.name); }}><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => { if (window.confirm(t('holdGroup.confirmDelete'))) remove.mutate(hg.id); }}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        )}
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

// ─── Conference Rooms ─────────────────────────────────────────────────────────

export function ConferenceRoomsPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = me.role === 'platform_admin' || me.role === 'org_admin' || me.role === 'org_operator';

  const [showCreate, setShowCreate] = useState(false);
  const [newRoom, setNewRoom] = useState('');
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newMax, setNewMax] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editRoom, setEditRoom] = useState('');
  const [confRecord, setConfRecord] = useState(false);
  const [confAnnounce, setConfAnnounce] = useState(true);
  const [confMoh, setConfMoh] = useState(false);
  const [newConfRecord, setNewConfRecord] = useState(false);
  const [newConfAnnounce, setNewConfAnnounce] = useState(true);

  const list = useQuery({
    queryKey: ['conference-rooms', orgId ?? 0],
    queryFn: () => apiFetch<{ items: ConferenceRoom[] }>(`/conference-rooms?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: () => apiFetch('/conference-rooms', { method: 'POST', body: JSON.stringify({
      organizationId: orgId,
      roomNumber: newRoom.trim(),
      name: newName.trim(),
      pin: newPin.trim() || undefined,
      maxParticipants: newMax ? Number(newMax) : undefined,
      description: newDesc.trim() || undefined,
      settings: { record: newConfRecord, announceJoin: newConfAnnounce, musicOnHold: false },
    }) }),
    onSuccess: async () => { toast.success(t('confRoom.created')); setShowCreate(false); setNewRoom(''); setNewName(''); setNewPin(''); setNewMax(''); setNewDesc(''); await qc.invalidateQueries({ queryKey: ['conference-rooms', orgId] }); },
    onError: () => toast.error(t('confRoom.failed')),
  });

  const update = useMutation({
    mutationFn: ({ id, name, roomNumber, settings }: { id: number; name: string; roomNumber: string; settings?: Record<string, unknown> }) =>
      apiFetch(`/conference-rooms/${id}`, { method: 'PATCH', body: JSON.stringify({ name, roomNumber, settings }) }),
    onSuccess: async () => { toast.success(t('confRoom.updated')); setEditingId(null); await qc.invalidateQueries({ queryKey: ['conference-rooms', orgId] }); },
    onError: () => toast.error(t('confRoom.failed')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/conference-rooms/${id}`, { method: 'DELETE' }),
    onSuccess: async () => { toast.success(t('confRoom.deleted')); await qc.invalidateQueries({ queryKey: ['conference-rooms', orgId] }); },
    onError: () => toast.error(t('confRoom.failed')),
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pbx.conferenceRooms')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pbx.conferenceRoomsBody')}</p>
        </div>
        {canWrite && !showCreate && (
          <Button onClick={() => setShowCreate(true)} className="w-fit gap-2"><Plus className="h-4 w-4" />{t('confRoom.new')}</Button>
        )}
      </div>

      {showCreate && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('confRoom.number')}</label>
              <Input value={newRoom} onChange={(e) => setNewRoom(e.target.value)} placeholder="8000" className="font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('confRoom.name')}</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('confRoom.namePlaceholder')} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('confRoom.pin')}</label>
              <Input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder={t('confRoom.pinOptional')} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('confRoom.maxParticipants')}</label>
              <Input type="number" min="2" value={newMax} onChange={(e) => setNewMax(e.target.value)} placeholder="—" />
            </div>
          </div>
          <div className="space-y-1 max-w-sm">
            <label className="text-xs font-medium">{t('confRoom.description')}</label>
            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('confRoom.descPlaceholder')} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={newConfRecord} onChange={(e) => setNewConfRecord(e.target.checked)} />{t('confRoom.record')}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={newConfAnnounce} onChange={(e) => setNewConfAnnounce(e.target.checked)} />{t('confRoom.announceJoin')}</label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={create.isPending || !newRoom.trim() || !newName.trim()} onClick={() => create.mutate()} className="gap-1.5"><Check className="h-3.5 w-3.5" />{t('actions.save')}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)} className="gap-1.5"><X className="h-3.5 w-3.5" />{t('actions.cancel')}</Button>
          </div>
        </div>
      )}

      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="p-0">
          {list.isPending ? <Skeleton className="m-6 h-32 w-full" /> : (list.data?.items ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Video className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('confRoom.empty')}</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="p-3">{t('confRoom.number')}</th>
                <th className="p-3">{t('confRoom.name')}</th>
                <th className="p-3">{t('confRoom.settings')}</th>
                <th className="p-3">{t('confRoom.pin')}</th>
                <th className="p-3">{t('confRoom.maxParticipants')}</th>
                {canWrite && <th className="p-3 text-right">{t('extensions.colActions')}</th>}
              </tr></thead>
              <tbody>
                {(list.data?.items ?? []).map((cr) => (
                  <Fragment key={cr.id}>
                  <tr className="border-b border-border/70">
                    <td className="p-3 font-mono text-xs font-bold">
                      {editingId === cr.id
                        ? <Input className="h-7 w-20 font-mono" value={editRoom} onChange={(e) => setEditRoom(e.target.value)} />
                        : cr.roomNumber}
                    </td>
                    <td className="p-3 font-medium">
                      {editingId === cr.id
                        ? <Input className="h-7 w-40" value={editName} onChange={(e) => setEditName(e.target.value)} />
                        : <>{cr.name}{cr.description && <p className="text-xs text-muted-foreground">{cr.description}</p>}</>}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {cr.settings?.record && <span className="mr-1 rounded bg-muted px-1">REC</span>}
                      {cr.settings?.announceJoin !== false && <span className="rounded bg-muted px-1">AN</span>}
                    </td>
                    <td className="p-3 text-xs">{cr.pin ? '••••' : <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-3 tabular-nums text-xs">{cr.maxParticipants ?? '—'}</td>
                    {canWrite && (
                      <td className="p-3 text-right">
                        {editingId === cr.id ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" className="h-7 px-2" disabled={update.isPending} onClick={() => update.mutate({ id: cr.id, name: editName, roomNumber: editRoom, settings: { record: confRecord, announceJoin: confAnnounce, musicOnHold: confMoh } })}><Check className="h-3 w-3" /></Button>
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setEditingId(cr.id); setEditName(cr.name); setEditRoom(cr.roomNumber); setConfRecord(!!cr.settings?.record); setConfAnnounce(cr.settings?.announceJoin !== false); setConfMoh(!!cr.settings?.musicOnHold); }}><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => { if (window.confirm(t('confRoom.confirmDelete'))) remove.mutate(cr.id); }}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                  {editingId === cr.id && (
                    <tr className="border-b border-border/70 bg-muted/20">
                      <td colSpan={canWrite ? 6 : 5} className="p-3">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">{t('confRoom.settings')}</p>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <label className="flex items-center gap-2"><input type="checkbox" checked={confRecord} onChange={(e) => setConfRecord(e.target.checked)} />{t('confRoom.record')}</label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={confAnnounce} onChange={(e) => setConfAnnounce(e.target.checked)} />{t('confRoom.announceJoin')}</label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={confMoh} onChange={(e) => setConfMoh(e.target.checked)} />{t('confRoom.musicOnHold')}</label>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Audio Files ──────────────────────────────────────────────────────────────

export function AudioFilesPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = me.role === 'platform_admin' || me.role === 'org_admin' || me.role === 'org_operator';

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFilename, setNewFilename] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editFilename, setEditFilename] = useState('');

  const list = useQuery({
    queryKey: ['audio-files', orgId ?? 0],
    queryFn: () => apiFetch<{ items: AudioFile[] }>(`/audio-files?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: () => apiFetch('/audio-files', { method: 'POST', body: JSON.stringify({ organizationId: orgId, name: newName.trim(), filename: newFilename.trim() || undefined, description: newDesc.trim() || undefined }) }),
    onSuccess: async () => { toast.success(t('audio.created')); setShowCreate(false); setNewName(''); setNewFilename(''); setNewDesc(''); await qc.invalidateQueries({ queryKey: ['audio-files', orgId] }); },
    onError: () => toast.error(t('audio.failed')),
  });

  const update = useMutation({
    mutationFn: ({ id, name, filename }: { id: number; name: string; filename: string }) =>
      apiFetch(`/audio-files/${id}`, { method: 'PATCH', body: JSON.stringify({ name, filename: filename || null }) }),
    onSuccess: async () => { toast.success(t('audio.updated')); setEditingId(null); await qc.invalidateQueries({ queryKey: ['audio-files', orgId] }); },
    onError: () => toast.error(t('audio.failed')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/audio-files/${id}`, { method: 'DELETE' }),
    onSuccess: async () => { toast.success(t('audio.deleted')); await qc.invalidateQueries({ queryKey: ['audio-files', orgId] }); },
    onError: () => toast.error(t('audio.failed')),
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pbx.audioFiles')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pbx.audioFilesBody')}</p>
        </div>
        {canWrite && !showCreate && (
          <Button onClick={() => setShowCreate(true)} className="w-fit gap-2"><Plus className="h-4 w-4" />{t('audio.new')}</Button>
        )}
      </div>

      {showCreate && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('audio.name')}</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('audio.namePlaceholder')} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('audio.filename')}</label>
              <Input value={newFilename} onChange={(e) => setNewFilename(e.target.value)} placeholder="greeting.wav" className="font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('audio.description')}</label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('audio.descPlaceholder')} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={create.isPending || !newName.trim()} onClick={() => create.mutate()} className="gap-1.5"><Check className="h-3.5 w-3.5" />{t('actions.save')}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)} className="gap-1.5"><X className="h-3.5 w-3.5" />{t('actions.cancel')}</Button>
          </div>
        </div>
      )}

      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="p-0">
          {list.isPending ? <Skeleton className="m-6 h-32 w-full" /> : (list.data?.items ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <FileAudio className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('audio.empty')}</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="p-3">{t('audio.name')}</th>
                <th className="p-3">{t('audio.filename')}</th>
                {canWrite && <th className="p-3 text-right">{t('extensions.colActions')}</th>}
              </tr></thead>
              <tbody>
                {(list.data?.items ?? []).map((af) => (
                  <tr key={af.id} className="border-b border-border/70">
                    <td className="p-3 font-medium">
                      {editingId === af.id
                        ? <Input className="h-7 w-40" value={editName} onChange={(e) => setEditName(e.target.value)} />
                        : <>{af.name}{af.description && <p className="text-xs text-muted-foreground">{af.description}</p>}</>}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {editingId === af.id
                        ? <Input className="h-7 w-44 font-mono" value={editFilename} onChange={(e) => setEditFilename(e.target.value)} />
                        : af.filename ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    {canWrite && (
                      <td className="p-3 text-right">
                        {editingId === af.id ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" className="h-7 px-2" disabled={update.isPending} onClick={() => update.mutate({ id: af.id, name: editName, filename: editFilename })}><Check className="h-3 w-3" /></Button>
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setEditingId(af.id); setEditName(af.name); setEditFilename(af.filename ?? ''); }}><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => { if (window.confirm(t('audio.confirmDelete'))) remove.mutate(af.id); }}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        )}
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

// ─── Internal Numbers (Extensions list) ───────────────────────────────────────

export function InternalNumbersPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const orgId = useActiveOrganizationId(me);
  const [q, setQ] = useState('');

  const list = useQuery({
    queryKey: ['internal-numbers', orgId ?? 0],
    queryFn: () => apiFetch<{ items: { id: string; shortNumber: string; destType: string; name: string; source: string }[] }>(`/internal-numbers?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  const destLabels: Record<string, string> = { ura: 'URA', queue: 'Fila', call_flow: 'Fluxo', extension: 'Ramal' };
  const filtered = (list.data?.items ?? []).filter((row) => {
    const s = q.trim().toLowerCase();
    return !s || row.shortNumber.includes(s) || row.name.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('pbx.internalNumbers')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pbx.internalNumbersBody')}</p>
      </div>
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder={t('extensions.filter')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="p-0">
          {list.isPending ? <Skeleton className="m-6 h-32 w-full" /> : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Hash className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('extensions.empty')}</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="p-3">{t('extensions.colNumber')}</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">{t('extensions.colName')}</th>
                <th className="p-3">Origem</th>
              </tr></thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-b border-border/70 hover:bg-muted/30">
                    <td className="p-3 font-mono font-bold text-sm">{row.shortNumber}</td>
                    <td className="p-3"><span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">{destLabels[row.destType] ?? row.destType}</span></td>
                    <td className="p-3 font-medium">{row.name}</td>
                    <td className="p-3 text-xs text-muted-foreground">{row.source === 'auto' ? 'Auto' : 'Manual'}</td>
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

// UrasPage is now provided by @/features/ura/uras-list-page — kept as re-export for legacy imports
export { UrasListPage as UrasPage } from '@/features/ura/uras-list-page';

// ─── Call Flows (portal builder) ─────────────────────────────────────────────

export function CallFlowsFeaturePage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('pbx.callFlows')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pbx.callFlowsBody')}</p>
      </div>
      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-950/40">
            <Workflow className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold">{t('pbx.callFlows')}</p>
            <p className="text-sm text-muted-foreground max-w-sm">{t('pbx.callFlowsPortalHint')}</p>
          </div>
          <Button asChild>
            <Link to="/integrations/flows">{t('pbx.openCallFlows')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
