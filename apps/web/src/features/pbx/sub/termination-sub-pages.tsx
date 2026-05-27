import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Link } from '@tanstack/react-router';
import { Map, Server, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';

type Trunk = { id: number; name: string; type: string; host: string | null; username: string | null; status: string; description: string | null };
type OutboundRoute = { id: number; name: string; pattern: string; trunkId: number | null; prefix: string | null; priority: number; description: string | null };

const TRUNK_TYPE_COLORS: Record<string, string> = {
  sip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  iax2: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  dahdi: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

// ─── Trunks ────────────────────────────────────────────────────────────────────

export function TrunksPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = me.role === 'platform_admin' || me.role === 'org_admin' || me.role === 'org_operator';

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'sip' | 'iax2' | 'dahdi'>('sip');
  const [newHost, setNewHost] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editHost, setEditHost] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');

  const list = useQuery({
    queryKey: ['trunks', orgId ?? 0],
    queryFn: () => apiFetch<{ items: Trunk[] }>(`/trunks?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: () => apiFetch('/trunks', { method: 'POST', body: JSON.stringify({ organizationId: orgId, name: newName.trim(), type: newType, host: newHost.trim() || undefined, username: newUser.trim() || undefined, description: newDesc.trim() || undefined }) }),
    onSuccess: async () => { toast.success(t('trunk.created')); setShowCreate(false); setNewName(''); setNewHost(''); setNewUser(''); setNewDesc(''); await qc.invalidateQueries({ queryKey: ['trunks', orgId] }); },
    onError: () => toast.error(t('trunk.failed')),
  });

  const update = useMutation({
    mutationFn: ({ id, name, host, status }: { id: number; name: string; host: string; status: string }) =>
      apiFetch(`/trunks/${id}`, { method: 'PATCH', body: JSON.stringify({ name, host: host || null, status }) }),
    onSuccess: async () => { toast.success(t('trunk.updated')); setEditingId(null); await qc.invalidateQueries({ queryKey: ['trunks', orgId] }); },
    onError: () => toast.error(t('trunk.failed')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/trunks/${id}`, { method: 'DELETE' }),
    onSuccess: async () => { toast.success(t('trunk.deleted')); await qc.invalidateQueries({ queryKey: ['trunks', orgId] }); },
    onError: () => toast.error(t('trunk.failed')),
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pbx.trunks')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pbx.trunksBody')}</p>
        </div>
        {canWrite && (
          <Button asChild className="w-fit gap-2">
            <Link to="/pbx/termination/trunks/new"><Plus className="h-4 w-4" />{t('trunk.new')}</Link>
          </Button>
        )}
      </div>

      {showCreate && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('trunk.name')}</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('trunk.namePlaceholder')} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('trunk.type')}</label>
              <div className="flex gap-1.5">
                {(['sip', 'iax2', 'dahdi'] as const).map((tp) => (
                  <button key={tp} type="button" onClick={() => setNewType(tp)}
                    className={cn('rounded px-2.5 py-1 text-xs font-medium uppercase transition-colors',
                      newType === tp ? TRUNK_TYPE_COLORS[tp] + ' ring-2 ring-current ring-offset-1' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
                    {tp}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('trunk.host')}</label>
              <Input value={newHost} onChange={(e) => setNewHost(e.target.value)} placeholder="sip.provider.com" className="font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('trunk.username')}</label>
              <Input value={newUser} onChange={(e) => setNewUser(e.target.value)} placeholder={t('trunk.userPlaceholder')} />
            </div>
          </div>
          <div className="space-y-1 max-w-sm">
            <label className="text-xs font-medium">{t('trunk.description')}</label>
            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('trunk.descPlaceholder')} />
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
              <Server className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('trunk.empty')}</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="p-3">{t('trunk.name')}</th>
                <th className="p-3">{t('trunk.type')}</th>
                <th className="p-3">{t('trunk.host')}</th>
                <th className="p-3">{t('trunk.statusLabel')}</th>
                {canWrite && <th className="p-3 text-right">{t('extensions.colActions')}</th>}
              </tr></thead>
              <tbody>
                {(list.data?.items ?? []).map((tr) => (
                  <tr key={tr.id} className="border-b border-border/70">
                    <td className="p-3 font-medium">
                      {editingId === tr.id
                        ? <Input className="h-7 w-40" value={editName} onChange={(e) => setEditName(e.target.value)} />
                        : <>{tr.name}{tr.description && <p className="text-xs text-muted-foreground">{tr.description}</p>}</>}
                    </td>
                    <td className="p-3">
                      <span className={cn('rounded px-2 py-0.5 text-[10px] font-medium uppercase', TRUNK_TYPE_COLORS[tr.type] ?? TRUNK_TYPE_COLORS.sip)}>{tr.type}</span>
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {editingId === tr.id
                        ? <Input className="h-7 w-44 font-mono" value={editHost} onChange={(e) => setEditHost(e.target.value)} />
                        : tr.host ?? '—'}
                    </td>
                    <td className="p-3">
                      {editingId === tr.id ? (
                        <div className="flex gap-1">
                          {(['active', 'inactive'] as const).map((s) => (
                            <button key={s} type="button" onClick={() => setEditStatus(s)}
                              className={cn('rounded px-2 py-0.5 text-[10px] font-medium capitalize', editStatus === s
                                ? (s === 'active' ? 'bg-emerald-100 text-emerald-700 ring-1 ring-current' : 'bg-slate-100 text-slate-600 ring-1 ring-current')
                                : 'bg-muted text-muted-foreground')}>
                              {t(`trunk.status.${s}`)}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', tr.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                          {t(`trunk.status.${tr.status}`)}
                        </span>
                      )}
                    </td>
                    {canWrite && (
                      <td className="p-3 text-right">
                        {editingId === tr.id ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" className="h-7 px-2" disabled={update.isPending} onClick={() => update.mutate({ id: tr.id, name: editName, host: editHost, status: editStatus })}><Check className="h-3 w-3" /></Button>
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2" asChild><Link to="/pbx/termination/trunks/$trunkId" params={{ trunkId: String(tr.id) }}><Pencil className="h-3 w-3" /></Link></Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => { if (window.confirm(t('trunk.confirmDelete'))) remove.mutate(tr.id); }}><Trash2 className="h-3 w-3" /></Button>
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

// ─── Calling Plan (Outbound Routes) ───────────────────────────────────────────

export function CallingPlanPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = me.role === 'platform_admin' || me.role === 'org_admin' || me.role === 'org_operator';

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPattern, setNewPattern] = useState('');
  const [newPrefix, setNewPrefix] = useState('');
  const [newPriority, setNewPriority] = useState('0');
  const [newTrunkId, setNewTrunkId] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPattern, setEditPattern] = useState('');

  const list = useQuery({
    queryKey: ['outbound-routes', orgId ?? 0],
    queryFn: () => apiFetch<{ items: OutboundRoute[] }>(`/outbound-routes?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const trunks = useQuery({
    queryKey: ['trunks', orgId ?? 0],
    queryFn: () => apiFetch<{ items: Trunk[] }>(`/trunks?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: () => apiFetch('/outbound-routes', { method: 'POST', body: JSON.stringify({ organizationId: orgId, name: newName.trim(), pattern: newPattern.trim(), trunkId: newTrunkId ? Number(newTrunkId) : undefined, prefix: newPrefix.trim() || undefined, priority: Number(newPriority) || 0, description: newDesc.trim() || undefined }) }),
    onSuccess: async () => { toast.success(t('route.created')); setShowCreate(false); setNewName(''); setNewPattern(''); setNewPrefix(''); setNewPriority('0'); setNewTrunkId(''); setNewDesc(''); await qc.invalidateQueries({ queryKey: ['outbound-routes', orgId] }); },
    onError: () => toast.error(t('route.failed')),
  });

  const update = useMutation({
    mutationFn: ({ id, name, pattern }: { id: number; name: string; pattern: string }) =>
      apiFetch(`/outbound-routes/${id}`, { method: 'PATCH', body: JSON.stringify({ name, pattern }) }),
    onSuccess: async () => { toast.success(t('route.updated')); setEditingId(null); await qc.invalidateQueries({ queryKey: ['outbound-routes', orgId] }); },
    onError: () => toast.error(t('route.failed')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/outbound-routes/${id}`, { method: 'DELETE' }),
    onSuccess: async () => { toast.success(t('route.deleted')); await qc.invalidateQueries({ queryKey: ['outbound-routes', orgId] }); },
    onError: () => toast.error(t('route.failed')),
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  const trunkMap = Object.fromEntries((trunks.data?.items ?? []).map((tr) => [tr.id, tr.name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pbx.callingPlan')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pbx.callingPlanBody')}</p>
        </div>
        {canWrite && !showCreate && (
          <Button onClick={() => setShowCreate(true)} className="w-fit gap-2"><Plus className="h-4 w-4" />{t('route.new')}</Button>
        )}
      </div>

      {showCreate && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('route.name')}</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('route.namePlaceholder')} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('route.pattern')}</label>
              <Input value={newPattern} onChange={(e) => setNewPattern(e.target.value)} placeholder="9." className="font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('route.trunk')}</label>
              <select value={newTrunkId} onChange={(e) => setNewTrunkId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">{t('route.noTrunk')}</option>
                {(trunks.data?.items ?? []).map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('route.prefix')}</label>
              <Input value={newPrefix} onChange={(e) => setNewPrefix(e.target.value)} placeholder={t('route.prefixPlaceholder')} className="font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('route.priority')}</label>
              <Input type="number" min="0" value={newPriority} onChange={(e) => setNewPriority(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('route.description')}</label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('route.descPlaceholder')} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={create.isPending || !newName.trim() || !newPattern.trim()} onClick={() => create.mutate()} className="gap-1.5"><Check className="h-3.5 w-3.5" />{t('actions.save')}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)} className="gap-1.5"><X className="h-3.5 w-3.5" />{t('actions.cancel')}</Button>
          </div>
        </div>
      )}

      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="p-0">
          {list.isPending ? <Skeleton className="m-6 h-32 w-full" /> : (list.data?.items ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Map className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('route.empty')}</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="p-3">{t('route.name')}</th>
                <th className="p-3">{t('route.pattern')}</th>
                <th className="p-3">{t('route.trunk')}</th>
                <th className="p-3">{t('route.prefix')}</th>
                <th className="p-3">{t('route.priority')}</th>
                {canWrite && <th className="p-3 text-right">{t('extensions.colActions')}</th>}
              </tr></thead>
              <tbody>
                {(list.data?.items ?? []).sort((a, b) => a.priority - b.priority).map((rt) => (
                  <tr key={rt.id} className="border-b border-border/70">
                    <td className="p-3 font-medium">
                      {editingId === rt.id
                        ? <Input className="h-7 w-36" value={editName} onChange={(e) => setEditName(e.target.value)} />
                        : <>{rt.name}{rt.description && <p className="text-xs text-muted-foreground">{rt.description}</p>}</>}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {editingId === rt.id
                        ? <Input className="h-7 w-24 font-mono" value={editPattern} onChange={(e) => setEditPattern(e.target.value)} />
                        : rt.pattern}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{rt.trunkId ? (trunkMap[rt.trunkId] ?? `#${rt.trunkId}`) : '—'}</td>
                    <td className="p-3 font-mono text-xs">{rt.prefix ?? '—'}</td>
                    <td className="p-3 tabular-nums text-xs">{rt.priority}</td>
                    {canWrite && (
                      <td className="p-3 text-right">
                        {editingId === rt.id ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" className="h-7 px-2" disabled={update.isPending} onClick={() => update.mutate({ id: rt.id, name: editName, pattern: editPattern })}><Check className="h-3 w-3" /></Button>
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setEditingId(rt.id); setEditName(rt.name); setEditPattern(rt.pattern); }}><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => { if (window.confirm(t('route.confirmDelete'))) remove.mutate(rt.id); }}><Trash2 className="h-3 w-3" /></Button>
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
