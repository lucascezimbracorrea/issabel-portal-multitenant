import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { useState } from 'react';

type LogRow = { id: number; ip: string; port: number; protocol: string; at: string; blockType: string; action: string };

export function SecurityLogsPage() {
  const { t } = useTranslation();
  const [ip, setIp] = useState('');
  const [blockType, setBlockType] = useState<'all' | 'manual' | 'auto'>('all');
  const [params, setParams] = useState<Record<string, string>>({});

  const list = useQuery({
    queryKey: qk.securityLogs(params),
    queryFn: () => {
      const sp = new URLSearchParams();
      if (params.ip) sp.set('ip', params.ip);
      if (params.blockType && params.blockType !== 'all') sp.set('blockType', params.blockType);
      return apiFetch<{ items: LogRow[] }>(`/security/logs?${sp.toString()}`);
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('security.logsTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('security.logsSubtitle')}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('calls.historyFilters')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Input className="max-w-xs" placeholder="IP" value={ip} onChange={(e) => setIp(e.target.value)} />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={blockType}
            onChange={(e) => setBlockType(e.target.value as typeof blockType)}
          >
            <option value="all">{t('security.logTypeAll')}</option>
            <option value="manual">{t('security.logTypeManual')}</option>
            <option value="auto">{t('security.logTypeAuto')}</option>
          </select>
          <Button type="button" onClick={() => setParams({ ip: ip.trim(), blockType })}>
            {t('calls.historyApply')}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {list.isPending ? (
            <Skeleton className="m-6 h-48 w-full" />
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase text-muted-foreground">
                  <th className="p-2">IP</th>
                  <th className="p-2">{t('security.port')}</th>
                  <th className="p-2">{t('security.protocol')}</th>
                  <th className="p-2">{t('security.colWhen')}</th>
                  <th className="p-2">{t('security.type')}</th>
                  <th className="p-2">{t('security.action')}</th>
                </tr>
              </thead>
              <tbody>
                {(list.data?.items ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-border/70">
                    <td className="p-2 font-mono text-xs">{r.ip}</td>
                    <td className="p-2">{r.port}</td>
                    <td className="p-2">{r.protocol}</td>
                    <td className="p-2 text-xs text-muted-foreground">{r.at}</td>
                    <td className="p-2">{r.blockType}</td>
                    <td className="p-2 font-mono text-xs">{r.action}</td>
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
