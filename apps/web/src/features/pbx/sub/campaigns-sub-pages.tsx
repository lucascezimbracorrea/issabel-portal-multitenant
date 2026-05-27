import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Calendar, FileAudio, Megaphone, Plus, Star, Trash2, Pencil, Check, X, Clock } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';

type Campaign = {
  id: number;
  name: string;
  type: 'outbound' | 'preview' | 'predictive';
  status: 'active' | 'paused' | 'completed' | 'draft';
  description: string | null;
  externalDiscadorId?: string | null;
};

const TYPE_COLORS: Record<string, string> = {
  outbound: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  preview: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  predictive: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  completed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  draft: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
};

export function CampaignListPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = me.role === 'platform_admin' || me.role === 'org_admin' || me.role === 'org_operator';

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<Campaign['type']>('outbound');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState<Campaign['status']>('draft');
  const [editDiscadorId, setEditDiscadorId] = useState('');

  const list = useQuery({
    queryKey: ['campaigns', orgId ?? 0],
    queryFn: () => apiFetch<{ items: Campaign[] }>(`/campaigns?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/campaigns', {
        method: 'POST',
        body: JSON.stringify({ organizationId: orgId, name: newName.trim(), type: newType, description: newDesc.trim() || undefined }),
      }),
    onSuccess: async () => {
      toast.success(t('campaign.created'));
      setShowCreate(false); setNewName(''); setNewDesc('');
      await qc.invalidateQueries({ queryKey: ['campaigns', orgId] });
    },
    onError: () => toast.error(t('campaign.failed')),
  });

  const syncDiscador = useMutation({
    mutationFn: (id: number) => apiFetch<{ ok: boolean; discadorUrl?: string }>(`/campaigns/${id}/sync-discador`, { method: 'POST' }),
    onSuccess: (r) => {
      toast.success(r.discadorUrl ? `Discador: ${r.discadorUrl}` : 'Sync iniciado');
    },
    onError: () => toast.error(t('campaign.failed')),
  });

  const update = useMutation({
    mutationFn: ({
      id,
      name,
      status,
      externalDiscadorId,
    }: {
      id: number;
      name: string;
      status: Campaign['status'];
      externalDiscadorId: string | null;
    }) =>
      apiFetch(`/campaigns/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, status, externalDiscadorId }),
      }),
    onSuccess: async () => {
      toast.success(t('campaign.updated'));
      setEditingId(null);
      await qc.invalidateQueries({ queryKey: ['campaigns', orgId] });
    },
    onError: () => toast.error(t('campaign.failed')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/campaigns/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success(t('campaign.deleted'));
      await qc.invalidateQueries({ queryKey: ['campaigns', orgId] });
    },
    onError: () => toast.error(t('campaign.failed')),
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pbx.campaignList')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pbx.campaignListBody')}</p>
        </div>
        {canWrite && !showCreate && (
          <Button onClick={() => setShowCreate(true)} className="w-fit gap-2">
            <Plus className="h-4 w-4" />{t('campaign.new')}
          </Button>
        )}
      </div>

      {showCreate && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('campaign.fieldName')}</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('campaign.namePlaceholder')} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('campaign.fieldType')}</label>
              <div className="flex gap-1.5 flex-wrap">
                {(['outbound', 'preview', 'predictive'] as const).map((tp) => (
                  <button key={tp} type="button" onClick={() => setNewType(tp)}
                    className={cn('rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                      newType === tp ? TYPE_COLORS[tp] + ' ring-2 ring-current ring-offset-1' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
                    {t(`campaign.type.${tp}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">{t('campaign.fieldDesc')}</label>
            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('campaign.descPlaceholder')} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={create.isPending || !newName.trim()} onClick={() => create.mutate()} className="gap-1.5">
              <Check className="h-3.5 w-3.5" />{t('actions.save')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)} className="gap-1.5">
              <X className="h-3.5 w-3.5" />{t('actions.cancel')}
            </Button>
          </div>
        </div>
      )}

      {list.isPending ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : (list.data?.items ?? []).length === 0 ? (
        <Card className="border-0 shadow-md ring-1 ring-border/50">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Megaphone className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('campaign.empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(list.data?.items ?? []).map((camp) => (
            <Card key={camp.id} className="border-0 shadow-md ring-1 ring-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-950/40">
                      <Megaphone className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    {editingId === camp.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input className="h-8 w-48" value={editName} onChange={(e) => setEditName(e.target.value)} />
                        <Input
                          className="h-8 w-36 font-mono text-xs"
                          value={editDiscadorId}
                          onChange={(e) => setEditDiscadorId(e.target.value)}
                          placeholder="ID discador"
                        />
                        <div className="flex gap-1 flex-wrap">
                          {(['active', 'paused', 'draft', 'completed'] as const).map((s) => (
                            <button key={s} type="button" onClick={() => setEditStatus(s)}
                              className={cn('rounded px-2 py-0.5 text-[10px] font-medium capitalize', editStatus === s ? STATUS_COLORS[s] + ' ring-1 ring-current' : 'bg-muted text-muted-foreground')}>
                              {t(`campaign.status.${s}`)}
                            </button>
                          ))}
                        </div>
                        <Button size="sm" className="h-7 px-2" disabled={update.isPending}
                          onClick={() =>
                            update.mutate({
                              id: camp.id,
                              name: editName,
                              status: editStatus,
                              externalDiscadorId: editDiscadorId.trim() || null,
                            })
                          }>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{camp.name}</p>
                        <div className="flex gap-1.5 mt-0.5 flex-wrap">
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', TYPE_COLORS[camp.type])}>
                            {t(`campaign.type.${camp.type}`)}
                          </span>
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_COLORS[camp.status])}>
                            {t(`campaign.status.${camp.status}`)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  {canWrite && editingId !== camp.id && (
                    <div className="flex gap-1 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        disabled={syncDiscador.isPending}
                        onClick={() => syncDiscador.mutate(camp.id)}
                      >
                        Issabel
                      </Button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(camp.id);
                          setEditName(camp.name);
                          setEditStatus(camp.status);
                          setEditDiscadorId(camp.externalDiscadorId ?? '');
                        }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button"
                        onClick={() => { if (window.confirm(t('campaign.confirmDelete'))) remove.mutate(camp.id); }}
                        className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </CardHeader>
              {(camp.description || camp.externalDiscadorId) && (
                <CardContent className="pt-0 space-y-1 text-xs text-muted-foreground">
                  {camp.description && <p>{camp.description}</p>}
                  {camp.externalDiscadorId && (
                    <p className="font-mono">Discador: {camp.externalDiscadorId}</p>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Campaign Schedules ───────────────────────────────────────────────────────

type CampaignSchedule = { id: number; name: string; daysOfWeek: number[]; startTime: string; endTime: string; description: string | null };

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function CampaignSchedulesPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = me.role === 'platform_admin' || me.role === 'org_admin' || me.role === 'org_operator';

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDays, setNewDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newStart, setNewStart] = useState('08:00');
  const [newEnd, setNewEnd] = useState('18:00');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const list = useQuery({
    queryKey: ['campaign-schedules', orgId ?? 0],
    queryFn: () => apiFetch<{ items: CampaignSchedule[] }>(`/campaign-schedules?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const toggleDay = (d: number) =>
    setNewDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());

  const create = useMutation({
    mutationFn: () => apiFetch('/campaign-schedules', { method: 'POST', body: JSON.stringify({ organizationId: orgId, name: newName.trim(), daysOfWeek: newDays, startTime: newStart, endTime: newEnd, description: newDesc.trim() || undefined }) }),
    onSuccess: async () => { toast.success(t('schedule.created')); setShowCreate(false); setNewName(''); setNewDays([1,2,3,4,5]); setNewDesc(''); await qc.invalidateQueries({ queryKey: ['campaign-schedules', orgId] }); },
    onError: () => toast.error(t('schedule.failed')),
  });

  const update = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      apiFetch(`/campaign-schedules/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    onSuccess: async () => { toast.success(t('schedule.updated')); setEditingId(null); await qc.invalidateQueries({ queryKey: ['campaign-schedules', orgId] }); },
    onError: () => toast.error(t('schedule.failed')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/campaign-schedules/${id}`, { method: 'DELETE' }),
    onSuccess: async () => { toast.success(t('schedule.deleted')); await qc.invalidateQueries({ queryKey: ['campaign-schedules', orgId] }); },
    onError: () => toast.error(t('schedule.failed')),
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pbx.campaignSchedules')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pbx.campaignSchedulesBody')}</p>
        </div>
        {canWrite && !showCreate && (
          <Button onClick={() => setShowCreate(true)} className="w-fit gap-2"><Plus className="h-4 w-4" />{t('schedule.new')}</Button>
        )}
      </div>

      {showCreate && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-3">
              <label className="text-xs font-medium">{t('schedule.name')}</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('schedule.namePlaceholder')} className="max-w-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('schedule.start')}</label>
              <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('schedule.end')}</label>
              <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('schedule.description')}</label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('schedule.descPlaceholder')} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">{t('schedule.days')}</label>
            <div className="flex gap-1.5 flex-wrap">
              {[0,1,2,3,4,5,6].map((d) => (
                <button key={d} type="button" onClick={() => toggleDay(d)}
                  className={cn('rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    newDays.includes(d) ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
                  {DAY_LABELS[d]}
                </button>
              ))}
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
              <Calendar className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('schedule.empty')}</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="p-3">{t('schedule.name')}</th>
                <th className="p-3">{t('schedule.days')}</th>
                <th className="p-3">{t('schedule.hours')}</th>
                {canWrite && <th className="p-3 text-right">{t('extensions.colActions')}</th>}
              </tr></thead>
              <tbody>
                {(list.data?.items ?? []).map((sc) => (
                  <tr key={sc.id} className="border-b border-border/70">
                    <td className="p-3 font-medium">
                      {editingId === sc.id
                        ? <Input className="h-7 w-40" value={editName} onChange={(e) => setEditName(e.target.value)} />
                        : <>{sc.name}{sc.description && <p className="text-xs text-muted-foreground">{sc.description}</p>}</>}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-0.5 flex-wrap">
                        {[0,1,2,3,4,5,6].map((d) => (
                          <span key={d} className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', sc.daysOfWeek.includes(d) ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-muted text-muted-foreground/40')}>
                            {DAY_LABELS[d]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs">{sc.startTime} – {sc.endTime}</td>
                    {canWrite && (
                      <td className="p-3 text-right">
                        {editingId === sc.id ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" className="h-7 px-2" disabled={update.isPending} onClick={() => update.mutate({ id: sc.id, name: editName })}><Check className="h-3 w-3" /></Button>
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setEditingId(sc.id); setEditName(sc.name); }}><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => { if (window.confirm(t('schedule.confirmDelete'))) remove.mutate(sc.id); }}><Trash2 className="h-3 w-3" /></Button>
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

// ─── Campaign Audio ───────────────────────────────────────────────────────────

export function CampaignAudioPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = me.role === 'platform_admin' || me.role === 'org_admin' || me.role === 'org_operator';

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFilename, setNewFilename] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const list = useQuery({
    queryKey: ['audio-files', orgId ?? 0],
    queryFn: () => apiFetch<{ items: { id: number; name: string; filename: string | null; description: string | null }[] }>(`/audio-files?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: () => apiFetch('/audio-files', { method: 'POST', body: JSON.stringify({ organizationId: orgId, name: newName.trim(), filename: newFilename.trim() || undefined, description: newDesc.trim() || undefined }) }),
    onSuccess: async () => { toast.success(t('audio.created')); setShowCreate(false); setNewName(''); setNewFilename(''); setNewDesc(''); await qc.invalidateQueries({ queryKey: ['audio-files', orgId] }); },
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
          <h1 className="text-2xl font-bold tracking-tight">{t('pbx.campaignAudio')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pbx.campaignAudioBody')}</p>
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
              <Input value={newFilename} onChange={(e) => setNewFilename(e.target.value)} placeholder="campaign-intro.wav" className="font-mono" />
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
                    <td className="p-3 font-medium">{af.name}{af.description && <p className="text-xs text-muted-foreground">{af.description}</p>}</td>
                    <td className="p-3 font-mono text-xs">{af.filename ?? <span className="text-muted-foreground">—</span>}</td>
                    {canWrite && (
                      <td className="p-3 text-right">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => { if (window.confirm(t('audio.confirmDelete'))) remove.mutate(af.id); }}><Trash2 className="h-3 w-3" /></Button>
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

// ─── Campaign Ratings ─────────────────────────────────────────────────────────

type CampaignRating = { id: number; name: string; code: string; maxAttempts: number; waitDays: number; description: string | null };

export function CampaignRatingsPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = me.role === 'platform_admin' || me.role === 'org_admin' || me.role === 'org_operator';

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newMax, setNewMax] = useState('3');
  const [newWait, setNewWait] = useState('1');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');

  const list = useQuery({
    queryKey: ['campaign-ratings', orgId ?? 0],
    queryFn: () => apiFetch<{ items: CampaignRating[] }>(`/campaign-ratings?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const create = useMutation({
    mutationFn: () => apiFetch('/campaign-ratings', { method: 'POST', body: JSON.stringify({ organizationId: orgId, name: newName.trim(), code: newCode.trim(), maxAttempts: Number(newMax) || 3, waitDays: Number(newWait) || 1, description: newDesc.trim() || undefined }) }),
    onSuccess: async () => { toast.success(t('rating.created')); setShowCreate(false); setNewName(''); setNewCode(''); setNewDesc(''); await qc.invalidateQueries({ queryKey: ['campaign-ratings', orgId] }); },
    onError: () => toast.error(t('rating.failed')),
  });

  const update = useMutation({
    mutationFn: ({ id, name, code }: { id: number; name: string; code: string }) =>
      apiFetch(`/campaign-ratings/${id}`, { method: 'PATCH', body: JSON.stringify({ name, code }) }),
    onSuccess: async () => { toast.success(t('rating.updated')); setEditingId(null); await qc.invalidateQueries({ queryKey: ['campaign-ratings', orgId] }); },
    onError: () => toast.error(t('rating.failed')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/campaign-ratings/${id}`, { method: 'DELETE' }),
    onSuccess: async () => { toast.success(t('rating.deleted')); await qc.invalidateQueries({ queryKey: ['campaign-ratings', orgId] }); },
    onError: () => toast.error(t('rating.failed')),
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pbx.campaignRatings')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pbx.campaignRatingsBody')}</p>
        </div>
        {canWrite && !showCreate && (
          <Button onClick={() => setShowCreate(true)} className="w-fit gap-2"><Plus className="h-4 w-4" />{t('rating.new')}</Button>
        )}
      </div>

      {showCreate && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('rating.name')}</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('rating.namePlaceholder')} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('rating.code')}</label>
              <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="INT" className="font-mono uppercase" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('rating.maxAttempts')}</label>
              <Input type="number" min="1" value={newMax} onChange={(e) => setNewMax(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('rating.waitDays')}</label>
              <Input type="number" min="0" value={newWait} onChange={(e) => setNewWait(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1 max-w-sm">
            <label className="text-xs font-medium">{t('rating.description')}</label>
            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('rating.descPlaceholder')} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={create.isPending || !newName.trim() || !newCode.trim()} onClick={() => create.mutate()} className="gap-1.5"><Check className="h-3.5 w-3.5" />{t('actions.save')}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)} className="gap-1.5"><X className="h-3.5 w-3.5" />{t('actions.cancel')}</Button>
          </div>
        </div>
      )}

      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="p-0">
          {list.isPending ? <Skeleton className="m-6 h-32 w-full" /> : (list.data?.items ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Star className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('rating.empty')}</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="p-3">{t('rating.code')}</th>
                <th className="p-3">{t('rating.name')}</th>
                <th className="p-3">{t('rating.maxAttempts')}</th>
                <th className="p-3">{t('rating.waitDays')}</th>
                {canWrite && <th className="p-3 text-right">{t('extensions.colActions')}</th>}
              </tr></thead>
              <tbody>
                {(list.data?.items ?? []).map((rt) => (
                  <tr key={rt.id} className="border-b border-border/70">
                    <td className="p-3 font-mono text-xs font-bold">
                      {editingId === rt.id ? <Input className="h-7 w-20 font-mono uppercase" value={editCode} onChange={(e) => setEditCode(e.target.value)} /> : rt.code}
                    </td>
                    <td className="p-3 font-medium">
                      {editingId === rt.id
                        ? <Input className="h-7 w-40" value={editName} onChange={(e) => setEditName(e.target.value)} />
                        : <>{rt.name}{rt.description && <p className="text-xs text-muted-foreground">{rt.description}</p>}</>}
                    </td>
                    <td className="p-3 tabular-nums text-xs">{rt.maxAttempts}</td>
                    <td className="p-3 tabular-nums text-xs">{rt.waitDays}d</td>
                    {canWrite && (
                      <td className="p-3 text-right">
                        {editingId === rt.id ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" className="h-7 px-2" disabled={update.isPending} onClick={() => update.mutate({ id: rt.id, name: editName, code: editCode })}><Check className="h-3 w-3" /></Button>
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setEditingId(rt.id); setEditName(rt.name); setEditCode(rt.code); }}><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => { if (window.confirm(t('rating.confirmDelete'))) remove.mutate(rt.id); }}><Trash2 className="h-3 w-3" /></Button>
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

// keep Clock import used above
void Clock;
