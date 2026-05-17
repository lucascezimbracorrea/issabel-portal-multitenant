import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type AutoRow = {
  id: number;
  enabled: boolean;
  blockWhat: 'ip' | 'port';
  analysisPeriodSec: number;
  failuresPerExtension: number;
  failuresPerIp: number;
  block1Minutes: number;
  block2Minutes: number;
  block3Minutes: number;
};

export function SecurityAutoPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: qk.securityAutoConfig(),
    queryFn: () => apiFetch<AutoRow>('/security/auto-config'),
  });
  const [draft, setDraft] = useState<Partial<AutoRow>>({});

  useEffect(() => {
    if (q.data) setDraft(q.data);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch<AutoRow>('/security/auto-config', {
        method: 'PATCH',
        body: JSON.stringify(draft),
      }),
    onSuccess: () => {
      toast.success(t('security.saved'));
      qc.invalidateQueries({ queryKey: qk.securityAutoConfig() });
    },
    onError: () => toast.error(t('security.saveFailed')),
  });

  if (q.isPending) return <Skeleton className="h-64 w-full" />;
  if (!q.data) return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('security.autoTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('security.autoSubtitle')}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('security.autoForm')}</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-xl gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!draft.enabled}
              onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
            />
            {t('security.autoEnabled')}
          </label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="bw"
                checked={draft.blockWhat === 'ip'}
                onChange={() => setDraft((d) => ({ ...d, blockWhat: 'ip' }))}
              />
              IP
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="bw"
                checked={draft.blockWhat === 'port'}
                onChange={() => setDraft((d) => ({ ...d, blockWhat: 'port' }))}
              />
              {t('security.port')}
            </label>
          </div>
          <label className="text-xs font-medium text-muted-foreground">
            {t('security.analysisPeriod')}
            <Input
              type="number"
              className="mt-1"
              value={draft.analysisPeriodSec ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, analysisPeriodSec: Number(e.target.value) }))}
            />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            {t('security.failExt')}
            <Input
              type="number"
              className="mt-1"
              value={draft.failuresPerExtension ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, failuresPerExtension: Number(e.target.value) }))}
            />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            {t('security.failIp')}
            <Input
              type="number"
              className="mt-1"
              value={draft.failuresPerIp ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, failuresPerIp: Number(e.target.value) }))}
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t('security.block1')}
              <Input
                type="number"
                className="mt-1"
                value={draft.block1Minutes ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, block1Minutes: Number(e.target.value) }))}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              {t('security.block2')}
              <Input
                type="number"
                className="mt-1"
                value={draft.block2Minutes ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, block2Minutes: Number(e.target.value) }))}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              {t('security.block3')}
              <Input
                type="number"
                className="mt-1"
                value={draft.block3Minutes ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, block3Minutes: Number(e.target.value) }))}
              />
            </label>
          </div>
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
            {t('actions.save')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
