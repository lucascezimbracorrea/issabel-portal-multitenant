import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import {
  ArrowDownLeft, ArrowUpRight, BarChart3, Download, FileText,
  Phone, PhoneOff, Search,
} from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { cn } from '@/shared/lib/utils';

type CdrRow = {
  calldate: string;
  src: string;
  dst: string;
  duration: number;
  billsec: number;
  disposition: string;
  uniqueid: string;
  dcontext: string | null;
  accountcode: string | null;
};

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 16);
  return { from: fmt(from), to: fmt(to) };
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

const DISP_STYLES: Record<string, string> = {
  ANSWERED: 'bg-status-active',
  'NO ANSWER': 'bg-status-warning',
  BUSY: 'bg-status-info',
  FAILED: 'bg-status-inactive',
};

export function ReportsPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const activeOrg = useActiveOrganizationId(me);
  const [range, setRange] = useState(defaultRange);
  const [src, setSrc] = useState('');
  const [dst, setDst] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const oid = activeOrg ?? (me.organizationIds[0] ?? 0);

  const cdrParams = useMemo(() => ({
    page,
    pageSize,
    from: range.from.replace('T', ' '),
    to: range.to.replace('T', ' '),
    ...(src ? { src } : {}),
    ...(dst ? { dst } : {}),
    ...(oid ? { organizationId: oid } : {}),
  }), [range, src, dst, page, oid]);

  const cdr = useQuery({
    queryKey: qk.cdrHistory(cdrParams),
    queryFn: () => {
      const sp = new URLSearchParams();
      Object.entries(cdrParams).forEach(([k, v]) => sp.set(k, String(v)));
      return apiFetch<{ items: CdrRow[]; total: number; page: number; pageSize: number }>(`/metrics/cdr/history?${sp}`);
    },
    enabled: true,
  });

  const exportHref = useMemo(() => {
    const sp = new URLSearchParams({
      from: range.from.replace('T', ' '),
      to: range.to.replace('T', ' '),
    });
    if (oid) sp.set('organizationId', String(oid));
    if (src) sp.set('src', src);
    if (dst) sp.set('dst', dst);
    return `/api/reports/cdr-export.csv?${sp}`;
  }, [range, src, dst, oid]);

  const items = cdr.data?.items ?? [];
  const total = cdr.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const answered = items.filter((r) => r.disposition === 'ANSWERED').length;
  const missed = items.filter((r) => r.disposition !== 'ANSWERED').length;
  const avgBill = items.length > 0 ? Math.round(items.reduce((a, r) => a + r.billsec, 0) / items.length) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-blue-300 dark:via-indigo-300 dark:to-violet-300">
            {t('reports.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('reports.subtitle')}</p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <a href={exportHref} download>
            <Download className="h-4 w-4" />
            {t('reports.downloadCdrCsv')}
          </a>
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <CardTitle className="text-base">{t('reports.cdrExportTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('calls.historyFrom')}</label>
              <Input
                type="datetime-local"
                value={range.from}
                onChange={(e) => { setRange((r) => ({ ...r, from: e.target.value })); setPage(1); }}
                className="w-52"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t('calls.historyTo')}</label>
              <Input
                type="datetime-local"
                value={range.to}
                onChange={(e) => { setRange((r) => ({ ...r, to: e.target.value })); setPage(1); }}
                className="w-52"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Origem</label>
              <Input className="w-36" placeholder="ex: 1001" value={src} onChange={(e) => { setSrc(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Destino</label>
              <Input className="w-36" placeholder="ex: 1002" value={dst} onChange={(e) => { setDst(e.target.value); setPage(1); }} />
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => setPage(1)}>
              <Search className="h-4 w-4" />
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      {!cdr.isPending && items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total de chamadas', value: total, icon: Phone, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
            { label: 'Atendidas', value: answered, icon: ArrowDownLeft, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
            { label: 'Perdidas', value: missed, icon: PhoneOff, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/30' },
            { label: 'Duração média', value: fmtDuration(avgBill), icon: ArrowUpRight, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/30' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={cn('flex items-center gap-3 rounded-xl border border-border p-4', bg)}>
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg bg-white/80 shadow-sm dark:bg-black/20', color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn('text-xl font-bold tabular-nums', color)}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CDR Table */}
      <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border/60">
        <CardHeader className="flex flex-row items-center gap-2 border-b border-border bg-muted/25">
          <FileText className="h-4 w-4 text-blue-600" />
          <CardTitle className="text-sm">CDR — Histórico de Chamadas</CardTitle>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">{total} registros</span>
        </CardHeader>
        <CardContent className="p-0">
          {cdr.isPending ? (
            <Skeleton className="m-6 h-64 w-full" />
          ) : cdr.isError ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">CDR não configurado para esta organização.</p>
              <p className="mt-1 text-xs text-muted-foreground">Configure a conexão MySQL em Organizações → CDR.</p>
            </div>
          ) : items.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma chamada encontrada no período.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="p-3">Data</th>
                      <th className="p-3">Origem</th>
                      <th className="p-3">Destino</th>
                      <th className="p-3">Duração</th>
                      <th className="p-3">Faturado</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r) => (
                      <tr key={r.uniqueid} className="border-b border-border/60 hover:bg-muted/20">
                        <td className="p-3 font-mono text-xs text-muted-foreground">{r.calldate}</td>
                        <td className="p-3 font-medium">{r.src}</td>
                        <td className="p-3 text-muted-foreground">{r.dst}</td>
                        <td className="p-3 tabular-nums text-muted-foreground">{fmtDuration(r.duration)}</td>
                        <td className="p-3 tabular-nums text-muted-foreground">{fmtDuration(r.billsec)}</td>
                        <td className="p-3">
                          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', DISP_STYLES[r.disposition] ?? 'bg-muted text-foreground')}>
                            {r.disposition}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground">Página {page} de {pages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
