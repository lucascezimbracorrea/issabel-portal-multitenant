import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, useRouteContext } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Building2, Database, HardDrive, Palette,
  Settings, Trash2, UserPlus, Users, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { StatusBadge, UsageBar } from '@/shared/ui/status-badge';
import { cn } from '@/shared/lib/utils';
import type { Me } from '@/shared/types/me';

type OrgDetail = {
  id: number;
  name: string;
  tradeName: string | null;
  active: boolean;
  orgKind: 'pabx' | 'dialer' | 'hospitality';
  issabelBaseUrl: string | null;
  customDomain: string | null;
  domainVerificationToken: string | null;
  customDomainVerifiedAt: string | null;
  extensionsLimit: number | null;
  channelsLimit: number | null;
  diskQuotaGb: number | null;
  cdrMysql: string | null;
  appearance: Record<string, unknown>;
  createdAt: string | null;
};

type Member = {
  userId: number;
  role: string;
  email: string;
  displayName: string;
};

type UserRow = { id: number; email: string; displayName: string; role: string };

type Tab = 'info' | 'appearance' | 'quotas' | 'cdr' | 'members' | 'spaces';

const TABS: { id: Tab; icon: React.ComponentType<{ className?: string }>; labelKey: string }[] = [
  { id: 'info', icon: Building2, labelKey: 'orgDetail.tabInfo' },
  { id: 'appearance', icon: Palette, labelKey: 'orgDetail.tabAppearance' },
  { id: 'quotas', icon: HardDrive, labelKey: 'orgDetail.tabQuotas' },
  { id: 'cdr', icon: Database, labelKey: 'orgDetail.tabCdr' },
  { id: 'members', icon: Users, labelKey: 'orgDetail.tabMembers' },
  { id: 'spaces', icon: Settings, labelKey: 'orgDetail.tabSpaces' },
];

export function OrganizationDetailPage() {
  const { t } = useTranslation();
  const { orgId } = useParams({ from: '/_shell/organizations/$orgId' });
  const { me } = useRouteContext({ from: '/_shell' });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const id = Number(orgId);
  const [tab, setTab] = useState<Tab>('info');
  const isAdmin = me.role === 'platform_admin';

  const { data: org, isPending } = useQuery({
    queryKey: qk.organization(id),
    queryFn: () => apiFetch<OrgDetail>(`/organizations/${id}`),
  });

  if (isPending) return <div className="space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full rounded-xl" /></div>;
  if (!org) return <p className="text-sm text-muted-foreground">Organização não encontrada.</p>;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => void navigate({ to: '/organizations' })}>
          <ArrowLeft className="h-4 w-4" />
          {t('orgs.title')}
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{org.tradeName ?? org.name}</span>
        <StatusBadge status={org.active ? 'active' : 'inactive'} label={org.active ? t('orgs.filterActive') : t('orgs.filterInactive')} />
        <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase text-accent-foreground">{org.orgKind}</span>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              tab === tb.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <tb.icon className="h-4 w-4" />
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'info' && <InfoTab org={org} isAdmin={isAdmin} onUpdated={() => void qc.invalidateQueries({ queryKey: qk.organization(id) })} />}
      {tab === 'appearance' && <AppearanceTab org={org} isAdmin={isAdmin} onUpdated={() => void qc.invalidateQueries({ queryKey: qk.organization(id) })} />}
      {tab === 'quotas' && <QuotasTab org={org} isAdmin={isAdmin} onUpdated={() => void qc.invalidateQueries({ queryKey: qk.organization(id) })} />}
      {tab === 'cdr' && <CdrTab org={org} isAdmin={isAdmin} onUpdated={() => void qc.invalidateQueries({ queryKey: qk.organization(id) })} />}
      {tab === 'members' && <MembersTab orgId={id} me={me} isAdmin={isAdmin} />}
      {tab === 'spaces' && <SpacesTab orgId={id} isAdmin={isAdmin} />}
    </div>
  );
}

// ─── Info Tab ────────────────────────────────────────────────────────────────

function InfoTab({ org, isAdmin, onUpdated }: { org: OrgDetail; isAdmin: boolean; onUpdated: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(org.name);
  const [tradeName, setTradeName] = useState(org.tradeName ?? '');
  const [issabelUrl, setIssabelUrl] = useState(org.issabelBaseUrl ?? '');
  const [active, setActive] = useState(org.active);

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/organizations/${org.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, tradeName: tradeName || null, issabelBaseUrl: issabelUrl || null, active }),
      }),
    onSuccess: () => { toast.success(t('actions.saved')); onUpdated(); },
    onError: () => toast.error(t('actions.saveFailed')),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t('orgDetail.tabInfo')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">{t('orgs.fieldName')}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">{t('orgs.fieldTradeName')}</label>
            <Input value={tradeName} onChange={(e) => setTradeName(e.target.value)} disabled={!isAdmin} />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-medium">{t('orgs.fieldPbxUrl')}</label>
            <Input value={issabelUrl} onChange={(e) => setIssabelUrl(e.target.value)} disabled={!isAdmin} placeholder="https://pbx.empresa.com" />
          </div>
          <div className="col-span-2 flex items-center gap-3">
            <label className="text-xs font-medium">{t('orgs.colActive')}</label>
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setActive((a) => !a)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
                active ? 'bg-primary' : 'bg-border',
                !isAdmin && 'cursor-not-allowed opacity-60',
              )}
            >
              <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', active ? 'translate-x-6' : 'translate-x-1')} />
            </button>
            <span className="text-sm text-muted-foreground">{active ? t('orgs.filterActive') : t('orgs.filterInactive')}</span>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{t('actions.save')}</Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Appearance Tab ───────────────────────────────────────────────────────────

function AppearanceTab({ org, isAdmin, onUpdated }: { org: OrgDetail; isAdmin: boolean; onUpdated: () => void }) {
  const { t } = useTranslation();
  const ap = (org.appearance ?? {}) as Record<string, string>;
  const [logoUrl, setLogoUrl] = useState(ap.logoUrl ?? '');
  const [primaryColor, setPrimaryColor] = useState(ap.primaryColor ?? '#0d9488');
  const [accentColor, setAccentColor] = useState(ap.accentColor ?? '#0ea5e9');

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/organizations/${org.id}/appearance`, {
        method: 'PATCH',
        body: JSON.stringify({ appearance: { logoUrl: logoUrl || null, primaryColor, accentColor } }),
      }),
    onSuccess: () => { toast.success(t('actions.saved')); onUpdated(); },
    onError: () => toast.error(t('actions.saveFailed')),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t('orgDetail.tabAppearance')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium">Logo URL</label>
          <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} disabled={!isAdmin} placeholder="https://..." />
          {logoUrl && <img src={logoUrl} alt="logo" className="mt-2 h-16 w-auto rounded-lg border object-contain" />}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">{t('orgDetail.primaryColor')}</label>
            <div className="flex gap-2">
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} disabled={!isAdmin} className="h-10 w-12 cursor-pointer rounded border border-input" />
              <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} disabled={!isAdmin} className="font-mono text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">{t('orgDetail.accentColor')}</label>
            <div className="flex gap-2">
              <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} disabled={!isAdmin} className="h-10 w-12 cursor-pointer rounded border border-input" />
              <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} disabled={!isAdmin} className="font-mono text-xs" />
            </div>
          </div>
        </div>
        {/* Preview */}
        <div className="rounded-lg border border-border p-4" style={{ '--preview-primary': primaryColor, '--preview-accent': accentColor } as React.CSSProperties}>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{t('orgDetail.preview')}</p>
          <div className="flex gap-2">
            <span className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: primaryColor }}>Botão</span>
            <span className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: accentColor }}>Acento</span>
          </div>
        </div>
        {isAdmin && <Button onClick={() => save.mutate()} disabled={save.isPending}>{t('actions.save')}</Button>}
      </CardContent>
    </Card>
  );
}

// ─── Quotas Tab ───────────────────────────────────────────────────────────────

function QuotasTab({ org, isAdmin, onUpdated }: { org: OrgDetail; isAdmin: boolean; onUpdated: () => void }) {
  const { t } = useTranslation();
  const [extLimit, setExtLimit] = useState<number | null>(org.extensionsLimit);
  const [chanLimit, setChanLimit] = useState<number | null>(org.channelsLimit);
  const [diskGb, setDiskGb] = useState<number | null>(org.diskQuotaGb);
  const [orgKind, setOrgKind] = useState(org.orgKind);

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/organizations/${org.id}/quotas`, {
        method: 'PATCH',
        body: JSON.stringify({ orgKind, extensionsLimit: extLimit, channelsLimit: chanLimit, diskQuotaGb: diskGb }),
      }),
    onSuccess: () => { toast.success(t('actions.saved')); onUpdated(); },
    onError: () => toast.error(t('actions.saveFailed')),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t('orgDetail.tabQuotas')}</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">{t('orgs.fieldType')}</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={orgKind}
              onChange={(e) => setOrgKind(e.target.value as 'pabx' | 'dialer' | 'hospitality')}
              disabled={!isAdmin}
            >
              <option value="pabx">PABX</option>
              <option value="dialer">Dialer</option>
              <option value="hospitality">Hotelaria</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: t('orgs.fieldExtLimit'), value: extLimit, set: setExtLimit, icon: '👤' },
            { label: t('orgs.fieldChanLimit'), value: chanLimit, set: setChanLimit, icon: '📞' },
            { label: t('orgs.fieldDiskGb') + ' (GB)', value: diskGb, set: setDiskGb, icon: '💾' },
          ].map(({ label, value, set, icon }) => (
            <div key={label} className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="mb-2 text-2xl">{icon}</div>
              <label className="mb-1 block text-xs font-medium">{label}</label>
              <Input
                type="number"
                min={0}
                step={label.includes('GB') ? 0.5 : 1}
                placeholder="∞ sem limite"
                value={value ?? ''}
                onChange={(e) => set(e.target.value ? Number(e.target.value) : null)}
                disabled={!isAdmin}
              />
              <div className="mt-2"><UsageBar used={0} limit={value} /></div>
            </div>
          ))}
        </div>
        {isAdmin && <Button onClick={() => save.mutate()} disabled={save.isPending}>{t('actions.save')}</Button>}
      </CardContent>
    </Card>
  );
}

// ─── CDR Tab ──────────────────────────────────────────────────────────────────

function CdrTab({ org, isAdmin, onUpdated }: { org: OrgDetail; isAdmin: boolean; onUpdated: () => void }) {
  const { t } = useTranslation();
  let initialCdr = { host: 'localhost', port: 3306, user: 'root', password: '', database: 'asterisk', table: 'cdr', accountcode: '' };
  try {
    if (org.cdrMysql) initialCdr = { ...initialCdr, ...(JSON.parse(org.cdrMysql) as typeof initialCdr) };
  } catch { /* ignore */ }
  const [cdr, setCdr] = useState(initialCdr);

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/organizations/${org.id}/quotas`, {
        method: 'PATCH',
        body: JSON.stringify({ cdrMysql: JSON.stringify(cdr) }),
      }),
    onSuccess: () => { toast.success(t('actions.saved')); onUpdated(); },
    onError: () => toast.error(t('actions.saveFailed')),
  });

  function f(key: keyof typeof cdr, val: string) { setCdr((c) => ({ ...c, [key]: key === 'port' ? Number(val) : val })); }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('orgDetail.tabCdr')}</CardTitle>
        <p className="text-xs text-muted-foreground">{t('orgDetail.cdrHint')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">Host</label>
            <Input value={cdr.host} onChange={(e) => f('host', e.target.value)} disabled={!isAdmin} placeholder="localhost" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Porta</label>
            <Input type="number" value={cdr.port} onChange={(e) => f('port', e.target.value)} disabled={!isAdmin} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Usuário</label>
            <Input value={cdr.user} onChange={(e) => f('user', e.target.value)} disabled={!isAdmin} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Senha</label>
            <Input type="password" value={cdr.password} onChange={(e) => f('password', e.target.value)} disabled={!isAdmin} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Banco</label>
            <Input value={cdr.database} onChange={(e) => f('database', e.target.value)} disabled={!isAdmin} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Tabela</label>
            <Input value={cdr.table} onChange={(e) => f('table', e.target.value)} disabled={!isAdmin} placeholder="cdr" />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-medium">Account Code (filtro por empresa)</label>
            <Input value={cdr.accountcode} onChange={(e) => f('accountcode', e.target.value)} disabled={!isAdmin} placeholder="opcional" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 p-3 font-mono text-xs text-muted-foreground">
          {JSON.stringify(cdr, null, 2)}
        </div>
        {isAdmin && <Button onClick={() => save.mutate()} disabled={save.isPending}>{t('actions.save')}</Button>}
      </CardContent>
    </Card>
  );
}

// ─── Members Tab ──────────────────────────────────────────────────────────────

function MembersTab({ orgId, me, isAdmin }: { orgId: number; me: Me; isAdmin: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newUserId, setNewUserId] = useState<number | null>(null);
  const [newRole, setNewRole] = useState<'org_admin' | 'org_operator' | 'org_viewer'>('org_operator');

  const members = useQuery({
    queryKey: qk.orgMembers(orgId),
    queryFn: () => apiFetch<{ items: Member[] }>(`/organizations/${orgId}/members`),
  });

  const users = useQuery({
    queryKey: qk.users(),
    queryFn: () => apiFetch<{ items: UserRow[] }>('/users'),
    enabled: isAdmin && showAdd,
  });

  const addMember = useMutation({
    mutationFn: () =>
      apiFetch(`/organizations/${orgId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: newUserId, role: newRole }),
      }),
    onSuccess: () => {
      toast.success(t('orgDetail.memberAdded'));
      void qc.invalidateQueries({ queryKey: qk.orgMembers(orgId) });
      setShowAdd(false);
      setNewUserId(null);
    },
    onError: () => toast.error(t('actions.saveFailed')),
  });

  const removeMember = useMutation({
    mutationFn: (userId: number) => apiFetch(`/organizations/${orgId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('orgDetail.memberRemoved'));
      void qc.invalidateQueries({ queryKey: qk.orgMembers(orgId) });
    },
    onError: () => toast.error(t('actions.saveFailed')),
  });

  const ROLE_COLORS: Record<string, string> = {
    org_admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
    org_operator: 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200',
    org_viewer: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t('orgDetail.tabMembers')}</CardTitle>
        {isAdmin && (
          <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
            <UserPlus className="h-4 w-4" />
            {t('orgDetail.addMember')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showAdd && (
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">{t('orgDetail.addMember')}</p>
              <button type="button" onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Usuário</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={newUserId ?? ''}
                  onChange={(e) => setNewUserId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Selecionar...</option>
                  {(users.data?.items ?? []).map((u) => (
                    <option key={u.id} value={u.id}>{u.displayName} ({u.email})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Função</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as typeof newRole)}
                >
                  <option value="org_admin">Admin</option>
                  <option value="org_operator">Operador</option>
                  <option value="org_viewer">Visualizador</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" disabled={!newUserId || addMember.isPending} onClick={() => addMember.mutate()}>
                {t('orgDetail.addMember')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>{t('actions.cancel')}</Button>
            </div>
          </div>
        )}

        {members.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : (members.data?.items ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('orgDetail.noMembers')}</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {(members.data?.items ?? []).map((m) => (
              <div key={m.userId} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {m.displayName[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-sm">{m.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', ROLE_COLORS[m.role] ?? 'bg-muted text-foreground')}>
                  {m.role}
                </span>
                {isAdmin && m.userId !== (me as Me).id && (
                  <button
                    type="button"
                    onClick={() => removeMember.mutate(m.userId)}
                    className="ml-2 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Spaces Tab ───────────────────────────────────────────────────────────────

type Space = { id: number; name: string; status: 'active' | 'inactive' };

function SpacesTab({ orgId, isAdmin }: { orgId: number; isAdmin: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');

  const spaces = useQuery({
    queryKey: qk.spaces(orgId, { page: 1, pageSize: 100 }),
    queryFn: () => apiFetch<{ items: Space[] }>(`/organizations/${orgId}/spaces?page=1&pageSize=100`),
  });

  const create = useMutation({
    mutationFn: () => apiFetch(`/organizations/${orgId}/spaces`, { method: 'POST', body: JSON.stringify({ name: newName }) }),
    onSuccess: () => {
      setNewName('');
      void qc.invalidateQueries({ queryKey: qk.spaces(orgId, { page: 1, pageSize: 100 }) });
      toast.success(t('actions.saved'));
    },
    onError: () => toast.error(t('actions.saveFailed')),
  });

  const remove = useMutation({
    mutationFn: (spaceId: number) => apiFetch(`/organizations/${orgId}/spaces/${spaceId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.spaces(orgId, { page: 1, pageSize: 100 }) });
      toast.success(t('actions.saved'));
    },
  });

  const toggle = useMutation({
    mutationFn: ({ spaceId, status }: { spaceId: number; status: 'active' | 'inactive' }) =>
      apiFetch(`/organizations/${orgId}/spaces/${spaceId}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.spaces(orgId, { page: 1, pageSize: 100 }) }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t('orgDetail.tabSpaces')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdmin && (
          <div className="flex gap-2">
            <Input
              placeholder={t('orgDetail.newSpaceName')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) create.mutate(); }}
            />
            <Button disabled={!newName.trim() || create.isPending} onClick={() => create.mutate()}>
              {t('actions.add')}
            </Button>
          </div>
        )}
        {spaces.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : (spaces.data?.items ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('orgDetail.noSpaces')}</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {(spaces.data?.items ?? []).map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="font-medium text-sm">{s.name}</p>
                </div>
                <StatusBadge status={s.status === 'active' ? 'active' : 'inactive'} label={s.status} />
                {isAdmin && (
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => toggle.mutate({ spaceId: s.id, status: s.status === 'active' ? 'inactive' : 'active' })}
                    >
                      {s.status === 'active' ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => remove.mutate(s.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
