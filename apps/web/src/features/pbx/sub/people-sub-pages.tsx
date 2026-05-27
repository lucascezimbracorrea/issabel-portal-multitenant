import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Link } from '@tanstack/react-router';
import { Plus, Trash2, Pencil, X, Check, Users, UserRound, Layers, UsersRound, Search, Download } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';

type Ext = { id: number; number: string; displayName: string; source: string };
type Group = { id: number; name: string; description: string | null; extensionIds: number[] };

// ─── People List ─────────────────────────────────────────────────────────────

export function PbxPeoplePage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const orgId = useActiveOrganizationId(me);
  const [q, setQ] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const list = useQuery({
    queryKey: ['extensions', orgId ?? 0],
    queryFn: () => apiFetch<{ items: Ext[] }>(`/extensions?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const importExt = useMutation({
    mutationFn: (rows: { number: string; displayName: string }[]) =>
      Promise.all(
        rows.map((row) =>
          apiFetch('/extensions', {
            method: 'POST',
            body: JSON.stringify({ organizationId: orgId, number: row.number, displayName: row.displayName }),
          }),
        ),
      ),
    onSuccess: async () => {
      toast.success(t('extensions.created'));
      await list.refetch();
    },
    onError: () => toast.error(t('extensions.failed')),
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  const filtered = (list.data?.items ?? []).filter((e) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return e.displayName.toLowerCase().includes(s) || e.number.includes(s);
  });

  async function handleImport(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const rows = lines.slice(1).map((line) => {
      const [number, name] = line.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
      return { number, displayName: name || number };
    }).filter((r) => r.number);
    if (rows.length === 0) {
      toast.error('CSV vazio ou invalido');
      return;
    }
    importExt.mutate(rows);
  }

  function exportCsv() {
    const header = 'numero,nome,origem\n';
    const rows = filtered.map((e) => `${e.number},"${e.displayName.replace(/"/g, '""')}",${e.source ?? ''}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pessoas.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pbx.peopleList')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pbx.peopleListBody')}</p>
        </div>
        <div className="flex gap-2">
          <input ref={importRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImport(f); e.target.value = ''; }} />
          <Button variant="outline" className="gap-2" onClick={() => importRef.current?.click()} disabled={importExt.isPending}>
            Importar
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button asChild className="gap-2">
            <Link to="/extensions/new"><Plus className="h-4 w-4" />Inserir ramal</Link>
          </Button>
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder={t('extensions.filter')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="p-0">
          {list.isPending ? <Skeleton className="m-6 h-32" /> : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Users className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('extensions.empty')}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="p-3">{t('extensions.colNumber')}</th>
                <th className="p-3">{t('extensions.colName')}</th>
                <th className="p-3">{t('extensions.colSource')}</th>
              </tr></thead>
              <tbody>
                {filtered.map((ext) => (
                  <tr key={ext.id} className="border-b border-border/70">
                    <td className="p-3 font-mono font-bold">{ext.number}</td>
                    <td className="p-3">{ext.displayName}</td>
                    <td className="p-3 text-xs text-muted-foreground">{ext.source}</td>
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

// ─── Extension Groups ─────────────────────────────────────────────────────────

function GroupForm({
  orgId: _orgId,
  extensions,
  initial,
  onSave,
  onCancel,
  saving,
}: {
  orgId: number;
  extensions: Ext[];
  initial?: Group;
  onSave: (data: { name: string; description: string; extensionIds: number[] }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [selected, setSelected] = useState<Set<number>>(new Set(initial?.extensionIds ?? []));

  const toggle = (id: number) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium">{t('pbx.groupName')}</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('pbx.groupNamePlaceholder')} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">{t('pbx.groupDescription')}</label>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('pbx.groupDescriptionPlaceholder')} />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium">{t('pbx.groupExtensions')}</label>
        <div className="flex flex-wrap gap-2">
          {extensions.map((ext) => (
            <button
              key={ext.id}
              type="button"
              onClick={() => toggle(ext.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selected.has(ext.id)
                  ? 'bg-teal-600 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {ext.number} — {ext.displayName}
            </button>
          ))}
          {extensions.length === 0 && (
            <p className="text-xs text-muted-foreground">{t('extensions.empty')}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={saving || !name.trim()}
          onClick={() => onSave({ name: name.trim(), description: desc.trim(), extensionIds: [...selected] })}
          size="sm"
          className="gap-1.5"
        >
          <Check className="h-3.5 w-3.5" />
          {t('actions.save')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="gap-1.5">
          <X className="h-3.5 w-3.5" />
          {t('actions.cancel')}
        </Button>
      </div>
    </div>
  );
}

export function ExtensionGroupsPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = me.role === 'platform_admin' || me.role === 'org_admin' || me.role === 'org_operator';
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const exts = useQuery({
    queryKey: ['extensions', orgId ?? 0],
    queryFn: () => apiFetch<{ items: Ext[] }>(`/extensions?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const groups = useQuery({
    queryKey: ['extension-groups', orgId ?? 0],
    queryFn: () => apiFetch<{ items: Group[] }>(`/extension-groups?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const extMap = Object.fromEntries((exts.data?.items ?? []).map((e) => [e.id, e]));

  const create = useMutation({
    mutationFn: (data: { name: string; description: string; extensionIds: number[] }) =>
      apiFetch('/extension-groups', {
        method: 'POST',
        body: JSON.stringify({ organizationId: orgId, ...data }),
      }),
    onSuccess: async () => {
      toast.success(t('pbx.groupCreated'));
      setShowCreate(false);
      await qc.invalidateQueries({ queryKey: ['extension-groups', orgId] });
    },
    onError: () => toast.error(t('pbx.groupFailed')),
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: { id: number; name: string; description: string; extensionIds: number[] }) =>
      apiFetch(`/extension-groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: async () => {
      toast.success(t('pbx.groupUpdated'));
      setEditingId(null);
      await qc.invalidateQueries({ queryKey: ['extension-groups', orgId] });
    },
    onError: () => toast.error(t('pbx.groupFailed')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/extension-groups/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success(t('pbx.groupDeleted'));
      await qc.invalidateQueries({ queryKey: ['extension-groups', orgId] });
    },
    onError: () => toast.error(t('pbx.groupFailed')),
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pbx.extensionGroups')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pbx.extensionGroupsBody')}</p>
        </div>
        {canWrite && !showCreate && (
          <Button type="button" onClick={() => setShowCreate(true)} className="gap-2 w-fit">
            <Plus className="h-4 w-4" />
            {t('pbx.groupNew')}
          </Button>
        )}
      </div>

      {showCreate && (
        <GroupForm
          orgId={orgId}
          extensions={exts.data?.items ?? []}
          onSave={(data) => create.mutate(data)}
          onCancel={() => setShowCreate(false)}
          saving={create.isPending}
        />
      )}

      {groups.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (groups.data?.items ?? []).length === 0 ? (
        <Card className="border-0 shadow-md ring-1 ring-border/50">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Layers className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('pbx.groupEmpty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(groups.data?.items ?? []).map((g) =>
            editingId === g.id ? (
              <GroupForm
                key={g.id}
                orgId={orgId}
                extensions={exts.data?.items ?? []}
                initial={g}
                onSave={(data) => update.mutate({ id: g.id, ...data })}
                onCancel={() => setEditingId(null)}
                saving={update.isPending}
              />
            ) : (
              <Card key={g.id} className="border-0 shadow-md ring-1 ring-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-950/40">
                        <Layers className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{g.name}</p>
                        {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                      </div>
                    </div>
                    {canWrite && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingId(g.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { if (window.confirm(t('pbx.groupConfirmDelete'))) remove.mutate(g.id); }}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5 pt-0">
                  {g.extensionIds.length === 0 ? (
                    <span className="text-xs text-muted-foreground">{t('pbx.groupNoExtensions')}</span>
                  ) : (
                    g.extensionIds.map((eid) => {
                      const ext = extMap[eid];
                      return ext ? (
                        <span key={eid} className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                          {ext.number} — {ext.displayName}
                        </span>
                      ) : null;
                    })
                  )}
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export function TeamsPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = me.role === 'platform_admin' || me.role === 'org_admin' || me.role === 'org_operator';
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const exts = useQuery({
    queryKey: ['extensions', orgId ?? 0],
    queryFn: () => apiFetch<{ items: Ext[] }>(`/extensions?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const teams = useQuery({
    queryKey: ['teams', orgId ?? 0],
    queryFn: () => apiFetch<{ items: Group[] }>(`/teams?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const extMap = Object.fromEntries((exts.data?.items ?? []).map((e) => [e.id, e]));

  const create = useMutation({
    mutationFn: (data: { name: string; description: string; extensionIds: number[] }) =>
      apiFetch('/teams', {
        method: 'POST',
        body: JSON.stringify({ organizationId: orgId, ...data }),
      }),
    onSuccess: async () => {
      toast.success(t('pbx.teamCreated'));
      setShowCreate(false);
      await qc.invalidateQueries({ queryKey: ['teams', orgId] });
    },
    onError: () => toast.error(t('pbx.teamFailed')),
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: { id: number; name: string; description: string; extensionIds: number[] }) =>
      apiFetch(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: async () => {
      toast.success(t('pbx.teamUpdated'));
      setEditingId(null);
      await qc.invalidateQueries({ queryKey: ['teams', orgId] });
    },
    onError: () => toast.error(t('pbx.teamFailed')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/teams/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success(t('pbx.teamDeleted'));
      await qc.invalidateQueries({ queryKey: ['teams', orgId] });
    },
    onError: () => toast.error(t('pbx.teamFailed')),
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pbx.teams')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pbx.teamsBody')}</p>
        </div>
        {canWrite && !showCreate && (
          <Button type="button" onClick={() => setShowCreate(true)} className="gap-2 w-fit">
            <Plus className="h-4 w-4" />
            {t('pbx.teamNew')}
          </Button>
        )}
      </div>

      {showCreate && (
        <GroupForm
          orgId={orgId}
          extensions={exts.data?.items ?? []}
          onSave={(data) => create.mutate(data)}
          onCancel={() => setShowCreate(false)}
          saving={create.isPending}
        />
      )}

      {teams.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (teams.data?.items ?? []).length === 0 ? (
        <Card className="border-0 shadow-md ring-1 ring-border/50">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <UsersRound className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('pbx.teamEmpty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(teams.data?.items ?? []).map((team) =>
            editingId === team.id ? (
              <GroupForm
                key={team.id}
                orgId={orgId}
                extensions={exts.data?.items ?? []}
                initial={team}
                onSave={(data) => update.mutate({ id: team.id, ...data })}
                onCancel={() => setEditingId(null)}
                saving={update.isPending}
              />
            ) : (
              <Card key={team.id} className="border-0 shadow-md ring-1 ring-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/40">
                        <UsersRound className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{team.name}</p>
                        {team.description && <p className="text-xs text-muted-foreground">{team.description}</p>}
                      </div>
                    </div>
                    {canWrite && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingId(team.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { if (window.confirm(t('pbx.teamConfirmDelete'))) remove.mutate(team.id); }}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5 pt-0">
                  {team.extensionIds.length === 0 ? (
                    <span className="text-xs text-muted-foreground">{t('pbx.groupNoExtensions')}</span>
                  ) : (
                    team.extensionIds.map((eid) => {
                      const ext = extMap[eid];
                      return ext ? (
                        <span key={eid} className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                          {ext.number} — {ext.displayName}
                        </span>
                      ) : null;
                    })
                  )}
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Extension List ───────────────────────────────────────────────────────────

export function ExtensionListPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const orgId = useActiveOrganizationId(me);
  const [q, setQ] = useState('');

  const list = useQuery({
    queryKey: ['extensions', orgId ?? 0],
    queryFn: () => apiFetch<{ items: Ext[] }>(`/extensions?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;

  const filtered = (list.data?.items ?? []).filter((e) => {
    const s = q.trim().toLowerCase();
    return !s || e.displayName.toLowerCase().includes(s) || e.number.includes(s);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('pbx.extensionList')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pbx.extensionListBody')}</p>
      </div>
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder={t('extensions.filter')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="p-0">
          {list.isPending ? <Skeleton className="m-6 h-32 w-full" /> : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <UserRound className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('extensions.empty')}</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="p-3">{t('extensions.colNumber')}</th>
                <th className="p-3">{t('extensions.colName')}</th>
                <th className="p-3">{t('extensions.colSource')}</th>
              </tr></thead>
              <tbody>
                {filtered.map((ext) => (
                  <tr key={ext.id} className="border-b border-border/70 hover:bg-muted/30">
                    <td className="p-3 font-mono font-bold">{ext.number}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
                          <UserRound className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        {ext.displayName}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{ext.source}</td>
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
