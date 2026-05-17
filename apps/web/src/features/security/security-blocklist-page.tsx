import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { useState } from 'react';
import { toast } from 'sonner';

type Row = {
  id: number;
  ip: string;
  port: number | null;
  protocol: string;
  blockedFrom: string;
  blockedUntil: string | null;
  blockType: string;
};

export function SecurityBlocklistPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('5060');

  const list = useQuery({
    queryKey: qk.securityBlocklist(),
    queryFn: () => apiFetch<{ items: Row[] }>('/security/blocklist'),
  });

  const add = useMutation({
    mutationFn: () =>
      apiFetch<Row>('/security/blocklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, port: port ? Number(port) : null, protocol: 'udp' }),
      }),
    onSuccess: () => {
      toast.success(t('security.saved'));
      qc.invalidateQueries({ queryKey: qk.securityBlocklist() });
      qc.invalidateQueries({ queryKey: qk.securityLogs({}) });
      setIp('');
    },
    onError: () => toast.error(t('security.saveFailed')),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch<{ ok: boolean }>(`/security/blocklist/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.securityBlocklist() });
      qc.invalidateQueries({ queryKey: qk.securityLogs({}) });
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('security.blocklistTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('security.blocklistSubtitle')}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('security.blocklistAdd')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-muted-foreground">
            IP
            <Input className="mt-1 w-48" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="10.0.0.1" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            {t('security.port')}
            <Input className="mt-1 w-24" value={port} onChange={(e) => setPort(e.target.value)} />
          </label>
          <Button type="button" disabled={!ip.trim() || add.isPending} onClick={() => add.mutate()}>
            {t('security.block')}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('security.blocklistTable')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {list.isPending ? (
            <Skeleton className="m-6 h-40 w-full" />
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase text-muted-foreground">
                  <th className="p-2">IP</th>
                  <th className="p-2">{t('security.port')}</th>
                  <th className="p-2">{t('security.protocol')}</th>
                  <th className="p-2">{t('security.blockedFrom')}</th>
                  <th className="p-2">{t('security.blockedUntil')}</th>
                  <th className="p-2">{t('security.type')}</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {(list.data?.items ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-border/70">
                    <td className="p-2 font-mono text-xs">{r.ip}</td>
                    <td className="p-2">{r.port ?? '—'}</td>
                    <td className="p-2">{r.protocol}</td>
                    <td className="p-2 text-xs text-muted-foreground">{r.blockedFrom}</td>
                    <td className="p-2 text-xs text-muted-foreground">{r.blockedUntil ?? '—'}</td>
                    <td className="p-2">{r.blockType}</td>
                    <td className="p-2">
                      <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => del.mutate(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
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
