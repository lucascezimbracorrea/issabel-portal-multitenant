import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { KeyRound, Plus, Shield, Trash2, UserCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';

type UserRow = {
  id: number;
  email: string;
  displayName: string;
  role: string;
  orgRole: string | null;
};

const ROLE_STYLES: Record<string, string> = {
  platform_admin: 'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200',
  org_admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
  org_operator: 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200',
  org_viewer: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

type CreateForm = {
  email: string;
  displayName: string;
  password: string;
  role: 'platform_admin' | 'org_admin' | 'org_operator' | 'org_viewer';
};

export function UsersPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const [resetId, setResetId] = useState<number | null>(null);
  const [newPw, setNewPw] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({ email: '', displayName: '', password: '', role: 'org_viewer' });

  const list = useQuery({
    queryKey: qk.users(),
    queryFn: () => apiFetch<{ items: UserRow[] }>('/users'),
  });

  const reset = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      apiFetch<{ ok: boolean }>(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
    onSuccess: () => { toast.success(t('users.resetDone')); setResetId(null); setNewPw(''); },
    onError: () => toast.error(t('users.resetFailed')),
  });

  const create = useMutation({
    mutationFn: (body: CreateForm) => apiFetch('/users', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success(t('users.createSuccess'));
      void qc.invalidateQueries({ queryKey: qk.users() });
      setShowCreate(false);
      setCreateForm({ email: '', displayName: '', password: '', role: 'org_viewer' });
    },
    onError: (e: Error & { body?: { error?: string } }) => {
      const msg = e.body?.error === 'email_taken' ? t('users.emailTaken') : t('users.createFailed');
      toast.error(msg);
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('users.deleteDone'));
      setDeleteId(null);
      void qc.invalidateQueries({ queryKey: qk.users() });
    },
    onError: () => toast.error(t('users.deleteFailed')),
  });

  if (me.role !== 'platform_admin' && me.role !== 'org_admin') {
    return <p className="text-sm text-muted-foreground">{t('users.forbidden')}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-indigo-300 dark:via-violet-300 dark:to-purple-300">
            {t('users.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('users.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/api/users/export.csv" download>{t('users.exportCsv')}</a>
          </Button>
          {me.role === 'platform_admin' && (
            <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              {t('users.createBtn')}
            </Button>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <button type="button" onClick={() => setShowCreate(false)} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
                <UserCircle className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{t('users.createTitle')}</h2>
                <p className="text-xs text-muted-foreground">{t('users.createSubtitle')}</p>
              </div>
            </div>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(createForm); }}>
              {([
                { key: 'displayName', label: t('users.colName'), type: 'text', placeholder: 'João Silva' },
                { key: 'email', label: t('users.colEmail'), type: 'email', placeholder: 'joao@empresa.com' },
                { key: 'password', label: t('users.newPassword'), type: 'password', placeholder: '••••••••' },
              ] as const).map(({ key, label, type, placeholder }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium">{label}</label>
                  <Input
                    type={type}
                    placeholder={placeholder}
                    required
                    minLength={key === 'password' ? 8 : undefined}
                    value={createForm[key]}
                    onChange={(e) => setCreateForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="space-y-1">
                <label className="text-xs font-medium">{t('users.colPortalRole')}</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={createForm.role}
                  onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as CreateForm['role'] }))}
                >
                  <option value="platform_admin">Platform Admin</option>
                  <option value="org_admin">Org Admin</option>
                  <option value="org_operator">Operator</option>
                  <option value="org_viewer">Viewer</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>{t('actions.cancel')}</Button>
                <Button type="submit" disabled={create.isPending} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  {t('users.createBtn')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
            <p className="mb-4 font-medium">{t('users.deleteConfirm')}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteId(null)}>{t('actions.cancel')}</Button>
              <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" disabled={del.isPending} onClick={() => del.mutate(deleteId)}>
                <Trash2 className="mr-1.5 h-4 w-4" />
                {t('users.deleteBtn')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Users table */}
      <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
        <CardHeader className="flex flex-row items-center gap-2 border-b border-border bg-muted/25">
          <UserCircle className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          <CardTitle className="text-base">{t('users.tableTitle')}</CardTitle>
          <span className="ml-auto rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
            {list.data?.items.length ?? 0}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {list.isPending ? (
            <Skeleton className="m-6 h-40 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="p-3">{t('users.colName')}</th>
                    <th className="p-3">{t('users.colEmail')}</th>
                    <th className="p-3">{t('users.colPortalRole')}</th>
                    <th className="p-3">{t('users.colOrgRole')}</th>
                    <th className="p-3">{t('users.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(list.data?.items ?? []).map((u) => (
                    <tr key={u.id} className="border-b border-border/60 transition-colors hover:bg-muted/25">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                            {u.displayName[0]?.toUpperCase()}
                          </div>
                          <span className="font-medium">{u.displayName}</span>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">{u.email}</td>
                      <td className="p-3">
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', ROLE_STYLES[u.role] ?? 'bg-muted')}>
                          <Shield className="h-3 w-3" />
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{u.orgRole ?? '—'}</td>
                      <td className="p-3">
                        <div className="flex gap-1.5">
                          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => { setResetId(u.id); setNewPw(''); }}>
                            <KeyRound className="h-3 w-3" />
                            {t('users.resetPw')}
                          </Button>
                          {me.role === 'platform_admin' && u.id !== me.id && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteId(u.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset password panel */}
      {resetId != null && (
        <Card className="max-w-md border-border shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm">{t('users.resetTitle')}</CardTitle>
            <button type="button" onClick={() => setResetId(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input type="password" autoComplete="new-password" placeholder={t('users.newPassword')} value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setResetId(null)}>{t('actions.back')}</Button>
              <Button type="button" size="sm" disabled={newPw.length < 8 || reset.isPending} onClick={() => reset.mutate({ id: resetId, password: newPw })}>
                {t('actions.save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
