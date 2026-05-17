import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { toast } from 'sonner';
import { DollarSign, Info, CalendarDays, Clock, Plus, Trash2, Pencil, Check, X, Database, Server, Users, Webhook, Workflow } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';

// ─── Cost Center ──────────────────────────────────────────────────────────────

type CostCenter = { id: number; code: string; name: string; description: string | null };

export function CostCenterPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = me.role === 'platform_admin' || me.role === 'org_admin' || me.role === 'org_operator';
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');

  const list = useQuery({
    queryKey: ['cost-centers', orgId ?? 0],
    queryFn: () => apiFetch<{ items: CostCenter[] }>(`/cost-centers?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: () => apiFetch('/cost-centers', { method: 'POST', body: JSON.stringify({ organizationId: orgId, code: newCode.trim(), name: newName.trim(), description: newDesc.trim() || undefined }) }),
    onSuccess: async () => { toast.success(t('costCenter.created')); setShowCreate(false); setNewCode(''); setNewName(''); setNewDesc(''); await qc.invalidateQueries({ queryKey: ['cost-centers', orgId] }); },
    onError: () => toast.error(t('costCenter.failed')),
  });

  const update = useMutation({
    mutationFn: ({ id, code, name }: { id: number; code: string; name: string }) =>
      apiFetch(`/cost-centers/${id}`, { method: 'PATCH', body: JSON.stringify({ code, name }) }),
    onSuccess: async () => { toast.success(t('costCenter.updated')); setEditingId(null); await qc.invalidateQueries({ queryKey: ['cost-centers', orgId] }); },
    onError: () => toast.error(t('costCenter.failed')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/cost-centers/${id}`, { method: 'DELETE' }),
    onSuccess: async () => { toast.success(t('costCenter.deleted')); await qc.invalidateQueries({ queryKey: ['cost-centers', orgId] }); },
    onError: () => toast.error(t('costCenter.failed')),
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pbx.costCenter')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pbx.costCenterBody')}</p>
        </div>
        {canWrite && !showCreate && (
          <Button onClick={() => setShowCreate(true)} className="w-fit gap-2"><Plus className="h-4 w-4" />{t('costCenter.new')}</Button>
        )}
      </div>
      {showCreate && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('costCenter.code')}</label>
              <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="CC-001" className="font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('costCenter.name')}</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('costCenter.namePlaceholder')} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('costCenter.description')}</label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('costCenter.descPlaceholder')} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={create.isPending || !newCode.trim() || !newName.trim()} onClick={() => create.mutate()} className="gap-1.5"><Check className="h-3.5 w-3.5" />{t('actions.save')}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)} className="gap-1.5"><X className="h-3.5 w-3.5" />{t('actions.cancel')}</Button>
          </div>
        </div>
      )}
      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="p-0">
          {list.isPending ? <Skeleton className="m-6 h-32 w-full" /> : (list.data?.items ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <DollarSign className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('costCenter.empty')}</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="p-3">{t('costCenter.code')}</th>
                <th className="p-3">{t('costCenter.name')}</th>
                {canWrite && <th className="p-3 text-right">{t('extensions.colActions')}</th>}
              </tr></thead>
              <tbody>
                {(list.data?.items ?? []).map((cc) => (
                  <tr key={cc.id} className="border-b border-border/70">
                    <td className="p-3 font-mono text-xs">
                      {editingId === cc.id ? <Input className="h-7 w-28 font-mono" value={editCode} onChange={(e) => setEditCode(e.target.value)} /> : cc.code}
                    </td>
                    <td className="p-3">
                      {editingId === cc.id ? <Input className="h-7 w-48" value={editName} onChange={(e) => setEditName(e.target.value)} /> : cc.name}
                      {cc.description && <p className="text-xs text-muted-foreground">{cc.description}</p>}
                    </td>
                    {canWrite && (
                      <td className="p-3 text-right">
                        {editingId === cc.id ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" className="h-7 px-2" disabled={update.isPending} onClick={() => update.mutate({ id: cc.id, code: editCode, name: editName })}><Check className="h-3 w-3" /></Button>
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setEditingId(cc.id); setEditCode(cc.code); setEditName(cc.name); }}><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => { if (window.confirm(t('costCenter.confirmDelete'))) remove.mutate(cc.id); }}><Trash2 className="h-3 w-3" /></Button>
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

// ─── General Settings ─────────────────────────────────────────────────────────

export function GeneralSettingsPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const orgId = useActiveOrganizationId(me);

  const org = useQuery({
    queryKey: ['organization', orgId ?? 0],
    queryFn: () => apiFetch<{ id: number; name: string; issabelBaseUrl: string | null; cdrMysql: string | null }>(`/organizations/${orgId}`),
    enabled: !!orgId,
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  const pbxUrl = org.data?.issabelBaseUrl;
  const hasCdr = !!org.data?.cdrMysql?.trim();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('pbx.generalSettings')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pbx.generalSettingsBody')}</p>
      </div>
      {org.isPending ? <Skeleton className="h-48 w-full rounded-xl" /> : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-0 shadow-md ring-1 ring-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-teal-600" />
                <CardTitle className="text-sm">{t('settings.pbxConnection')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('orgs.fieldPbxUrl')}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', pbxUrl ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                  {pbxUrl ? t('settings.configured') : t('settings.notConfigured')}
                </span>
              </div>
              {pbxUrl && <p className="truncate font-mono text-xs text-muted-foreground">{pbxUrl}</p>}
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md ring-1 ring-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-indigo-600" />
                <CardTitle className="text-sm">{t('settings.cdrConnection')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">CDR MySQL</span>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', hasCdr ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                  {hasCdr ? t('settings.configured') : t('settings.notConfigured')}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('settings.editHint')}</p>
    </div>
  );
}

// ─── System Info ─────────────────────────────────────────────────────────────

type DiagSummary = {
  apiVersion: string;
  uptimeHint: string;
  counts: { organizations: number; users: number; spaces: number; webhooks: number; callRules: number };
};

export function SystemInfoPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });

  const diag = useQuery({
    queryKey: ['diagnostics-summary'],
    queryFn: () => apiFetch<DiagSummary>('/diagnostics/summary'),
    enabled: me.role === 'platform_admin',
    retry: false,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('pbx.systemInfo')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pbx.systemInfoBody')}</p>
      </div>
      {me.role !== 'platform_admin' ? (
        <Card className="border-0 shadow-md ring-1 ring-border/50">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">{t('settings.adminOnly')}</CardContent>
        </Card>
      ) : diag.isPending ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : diag.data ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Server, label: t('sysinfo.apiVersion'), value: diag.data.apiVersion, color: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-950/40' },
              { icon: Info, label: t('sysinfo.uptime'), value: diag.data.uptimeHint, color: 'text-sky-600', bg: 'bg-sky-100 dark:bg-sky-950/40' },
              { icon: Database, label: t('sysinfo.orgs'), value: diag.data.counts.organizations, color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-950/40' },
              { icon: Users, label: t('sysinfo.users'), value: diag.data.counts.users, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-950/40' },
              { icon: Webhook, label: t('sysinfo.webhooks'), value: diag.data.counts.webhooks, color: 'text-fuchsia-600', bg: 'bg-fuchsia-100 dark:bg-fuchsia-950/40' },
              { icon: Workflow, label: t('sysinfo.callRules'), value: diag.data.counts.callRules, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-950/40' },
            ].map(({ icon: Icon, label, value, color, bg }) => (
              <Card key={label} className="border-0 shadow-md ring-1 ring-border/50">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', bg)}>
                    <Icon className={cn('h-5 w-5', color)} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-bold text-lg tabular-nums">{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-destructive">{t('sysinfo.error')}</p>
      )}
    </div>
  );
}

// ─── Holidays ────────────────────────────────────────────────────────────────

type Holiday = { id: number; name: string; date: string; recurs: boolean; description: string | null };

export function HolidaysPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = me.role === 'platform_admin' || me.role === 'org_admin' || me.role === 'org_operator';
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newRecurs, setNewRecurs] = useState(false);

  const list = useQuery({
    queryKey: ['holidays', orgId ?? 0],
    queryFn: () => apiFetch<{ items: Holiday[] }>(`/holidays?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: () => apiFetch('/holidays', { method: 'POST', body: JSON.stringify({ organizationId: orgId, name: newName.trim(), date: newDate, recurs: newRecurs }) }),
    onSuccess: async () => { toast.success(t('holiday.created')); setShowCreate(false); setNewName(''); setNewDate(''); setNewRecurs(false); await qc.invalidateQueries({ queryKey: ['holidays', orgId] }); },
    onError: () => toast.error(t('holiday.failed')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/holidays/${id}`, { method: 'DELETE' }),
    onSuccess: async () => { toast.success(t('holiday.deleted')); await qc.invalidateQueries({ queryKey: ['holidays', orgId] }); },
    onError: () => toast.error(t('holiday.failed')),
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pbx.holidays')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pbx.holidaysBody')}</p>
        </div>
        {canWrite && !showCreate && (
          <Button onClick={() => setShowCreate(true)} className="w-fit gap-2"><Plus className="h-4 w-4" />{t('holiday.new')}</Button>
        )}
      </div>
      {showCreate && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('holiday.name')}</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('holiday.namePlaceholder')} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('holiday.date')}</label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="flex items-end gap-2 pb-0.5">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={newRecurs} onChange={(e) => setNewRecurs(e.target.checked)} className="h-4 w-4" />
                {t('holiday.recurs')}
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={create.isPending || !newName.trim() || !newDate} onClick={() => create.mutate()} className="gap-1.5"><Check className="h-3.5 w-3.5" />{t('actions.save')}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)} className="gap-1.5"><X className="h-3.5 w-3.5" />{t('actions.cancel')}</Button>
          </div>
        </div>
      )}
      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="p-0">
          {list.isPending ? <Skeleton className="m-6 h-32 w-full" /> : (list.data?.items ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('holiday.empty')}</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="p-3">{t('holiday.name')}</th>
                <th className="p-3">{t('holiday.date')}</th>
                <th className="p-3">{t('holiday.recurs')}</th>
                {canWrite && <th className="p-3 text-right">{t('extensions.colActions')}</th>}
              </tr></thead>
              <tbody>
                {(list.data?.items ?? []).map((h) => (
                  <tr key={h.id} className="border-b border-border/70">
                    <td className="p-3 font-medium">{h.name}</td>
                    <td className="p-3 font-mono text-xs">{h.date}</td>
                    <td className="p-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', h.recurs ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                        {h.recurs ? t('holiday.yearly') : t('holiday.once')}
                      </span>
                    </td>
                    {canWrite && (
                      <td className="p-3 text-right">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive"
                          onClick={() => { if (window.confirm(t('holiday.confirmDelete'))) remove.mutate(h.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
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

// ─── Pause List ───────────────────────────────────────────────────────────────

type PauseType = { id: number; name: string; code: string; description: string | null; enabled: boolean };

export function PauseListPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = me.role === 'platform_admin' || me.role === 'org_admin' || me.role === 'org_operator';
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');

  const list = useQuery({
    queryKey: ['pause-types', orgId ?? 0],
    queryFn: () => apiFetch<{ items: PauseType[] }>(`/pause-types?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: () => apiFetch('/pause-types', { method: 'POST', body: JSON.stringify({ organizationId: orgId, code: newCode.trim(), name: newName.trim(), description: newDesc.trim() || undefined }) }),
    onSuccess: async () => { toast.success(t('pause.created')); setShowCreate(false); setNewCode(''); setNewName(''); setNewDesc(''); await qc.invalidateQueries({ queryKey: ['pause-types', orgId] }); },
    onError: () => toast.error(t('pause.failed')),
  });

  const update = useMutation({
    mutationFn: ({ id, code, name }: { id: number; code: string; name: string }) =>
      apiFetch(`/pause-types/${id}`, { method: 'PATCH', body: JSON.stringify({ code, name }) }),
    onSuccess: async () => { toast.success(t('pause.updated')); setEditingId(null); await qc.invalidateQueries({ queryKey: ['pause-types', orgId] }); },
    onError: () => toast.error(t('pause.failed')),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      apiFetch(`/pause-types/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['pause-types', orgId] }); },
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/pause-types/${id}`, { method: 'DELETE' }),
    onSuccess: async () => { toast.success(t('pause.deleted')); await qc.invalidateQueries({ queryKey: ['pause-types', orgId] }); },
    onError: () => toast.error(t('pause.failed')),
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pbx.pauseList')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pbx.pauseListBody')}</p>
        </div>
        {canWrite && !showCreate && (
          <Button onClick={() => setShowCreate(true)} className="w-fit gap-2"><Plus className="h-4 w-4" />{t('pause.new')}</Button>
        )}
      </div>
      {showCreate && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('pause.code')}</label>
              <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="ALM" className="font-mono uppercase" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('pause.name')}</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('pause.namePlaceholder')} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('pause.description')}</label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('pause.descPlaceholder')} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={create.isPending || !newCode.trim() || !newName.trim()} onClick={() => create.mutate()} className="gap-1.5"><Check className="h-3.5 w-3.5" />{t('actions.save')}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)} className="gap-1.5"><X className="h-3.5 w-3.5" />{t('actions.cancel')}</Button>
          </div>
        </div>
      )}
      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="p-0">
          {list.isPending ? <Skeleton className="m-6 h-32 w-full" /> : (list.data?.items ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Clock className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('pause.empty')}</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="p-3">{t('pause.code')}</th>
                <th className="p-3">{t('pause.name')}</th>
                <th className="p-3">{t('pause.status')}</th>
                {canWrite && <th className="p-3 text-right">{t('extensions.colActions')}</th>}
              </tr></thead>
              <tbody>
                {(list.data?.items ?? []).map((p) => (
                  <tr key={p.id} className="border-b border-border/70">
                    <td className="p-3 font-mono text-xs">
                      {editingId === p.id ? <Input className="h-7 w-20 font-mono uppercase" value={editCode} onChange={(e) => setEditCode(e.target.value)} /> : p.code}
                    </td>
                    <td className="p-3">
                      {editingId === p.id ? <Input className="h-7 w-48" value={editName} onChange={(e) => setEditName(e.target.value)} /> : (
                        <><span>{p.name}</span>{p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}</>
                      )}
                    </td>
                    <td className="p-3">
                      {canWrite ? (
                        <button type="button" onClick={() => toggle.mutate({ id: p.id, enabled: !p.enabled })}
                          className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors', p.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                          {p.enabled ? t('pause.enabled') : t('pause.disabled')}
                        </button>
                      ) : (
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', p.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                          {p.enabled ? t('pause.enabled') : t('pause.disabled')}
                        </span>
                      )}
                    </td>
                    {canWrite && (
                      <td className="p-3 text-right">
                        {editingId === p.id ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" className="h-7 px-2" disabled={update.isPending} onClick={() => update.mutate({ id: p.id, code: editCode, name: editName })}><Check className="h-3 w-3" /></Button>
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setEditingId(p.id); setEditCode(p.code); setEditName(p.name); }}><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => { if (window.confirm(t('pause.confirmDelete'))) remove.mutate(p.id); }}><Trash2 className="h-3 w-3" /></Button>
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
