import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';

type Space = { id: number; name: string; status: string };

export function SpacesManager({ orgId, canEdit }: { orgId: number; canEdit: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const list = useQuery({
    queryKey: qk.spaces(orgId, { page: 1, pageSize: 100, q: '' }),
    queryFn: () =>
      apiFetch<{ items: Space[] }>(`/organizations/${orgId}/spaces?page=1&pageSize=100`),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch<Space>(`/organizations/${orgId}/spaces`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), status: 'active' }),
      }),
    onSuccess: async () => {
      toast.success(t('spaces.created'));
      setName('');
      await qc.invalidateQueries({ queryKey: ['spaces', orgId] });
      await qc.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: () => toast.error(t('spaces.failed')),
  });

  const patch = useMutation({
    mutationFn: (p: { id: number; name: string }) =>
      apiFetch<Space>(`/organizations/${orgId}/spaces/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: p.name }),
      }),
    onSuccess: async () => {
      toast.success(t('spaces.updated'));
      setEditingId(null);
      await qc.invalidateQueries({ queryKey: ['spaces', orgId] });
      await qc.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: () => toast.error(t('spaces.failed')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch<{ ok: boolean }>(`/organizations/${orgId}/spaces/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success(t('spaces.deleted'));
      await qc.invalidateQueries({ queryKey: ['spaces', orgId] });
      await qc.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: () => toast.error(t('spaces.failed')),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('spaces.title')}</CardTitle>
        <p className="text-xs text-muted-foreground">{t('spaces.subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('spaces.name')}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="min-w-[12rem]" />
            </div>
            <Button type="button" disabled={create.isPending || !name.trim()} onClick={() => create.mutate()}>
              {t('spaces.create')}
            </Button>
          </div>
        ) : null}

        {list.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-2 font-medium">{t('spaces.name')}</th>
                <th className="p-2 font-medium">{t('spaces.status')}</th>
                {canEdit ? <th className="p-2 font-medium text-right">{t('extensions.colActions')}</th> : null}
              </tr>
            </thead>
            <tbody>
              {(list.data?.items ?? []).map((s) => (
                <tr key={s.id} className="border-b border-border/80">
                  <td className="p-2">
                    {editingId === s.id ? (
                      <Input className="h-8" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    ) : (
                      s.name
                    )}
                  </td>
                  <td className="p-2 capitalize text-muted-foreground">{s.status}</td>
                  {canEdit ? (
                    <td className="p-2 text-right">
                      {editingId === s.id ? (
                        <div className="flex justify-end gap-1">
                          <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                            {t('actions.back')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={patch.isPending || !editName.trim()}
                            onClick={() => patch.mutate({ id: s.id, name: editName.trim() })}
                          >
                            {t('actions.save')}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(s.id);
                              setEditName(s.name);
                            }}
                          >
                            {t('extensions.edit')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            disabled={remove.isPending}
                            onClick={() => {
                              if (!window.confirm(t('spaces.confirmDelete'))) return;
                              remove.mutate(s.id);
                            }}
                          >
                            {t('extensions.delete')}
                          </Button>
                        </div>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
