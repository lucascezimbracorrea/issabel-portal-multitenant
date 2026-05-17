import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { BarChart3, Download, TrendingUp, UserCheck, PhoneCall, Phone, PhoneOff, Clock3, Percent, FolderOpen } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import type { Me } from '@/shared/types/me';
import type { CdrHistoryRow } from '@/shared/types/telephony';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 16);
  return { from: fmt(from), to: fmt(to) };
}

function useCdrOrg(me: Me) {
  const activeOrg = useActiveOrganizationId(me);
  return me.role === 'platform_admin' ? activeOrg : activeOrg ?? me.organizationIds[0] ?? null;
}

// ─── Operations Report ─────────────────────────────────────────────────────────

export function ReportOperationsPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const oid = useCdrOrg(me);
  const [{ from, to }, setRange] = useState(defaultRange);
  const [applied, setApplied] = useState({ from: defaultRange().from, to: defaultRange().to });

  const params = useMemo(() => ({
    from: applied.from.replace('T', ' '),
    to: applied.to.replace('T', ' '),
    pageSize: 5000,
    ...(oid != null ? { organizationId: oid } : {}),
  }), [applied, oid]);

  const q = useQuery({
    queryKey: qk.cdrHistory(params as Record<string, string | number>),
    queryFn: () => {
      const sp = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null) sp.set(k, String(v)); });
      return apiFetch<{ items?: CdrHistoryRow[]; total?: number; error?: string }>(`/metrics/cdr/history?${sp.toString()}`);
    },
    enabled: me.role === 'platform_admin' ? true : oid != null,
  });

  const stats = useMemo(() => {
    const items = q.data?.items ?? [];
    const total = items.length;
    const answered = items.filter((r) => r.disposition === 'ANSWERED').length;
    const asr = total > 0 ? Math.round((answered / total) * 100) : 0;
    const avgBill = answered > 0
      ? Math.round(items.filter((r) => r.disposition === 'ANSWERED').reduce((a, r) => a + r.billsec, 0) / answered)
      : 0;
    const noAnswer = items.filter((r) => r.disposition === 'NO ANSWER').length;
    const busy = items.filter((r) => r.disposition === 'BUSY').length;
    return { total, answered, asr, avgBill, noAnswer, busy };
  }, [q.data]);

  if (me.role !== 'platform_admin' && !oid) {
    return <p className="text-sm text-muted-foreground">{t('calls.pickOrg')}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('pbx.reportOperations')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pbx.reportOperationsBody')}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('calls.historyFilters')}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-muted-foreground">
            {t('calls.historyFrom')}
            <Input type="datetime-local" value={from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="mt-1" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            {t('calls.historyTo')}
            <Input type="datetime-local" value={to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="mt-1" />
          </label>
          <div className="flex items-end">
            <Button type="button" onClick={() => setApplied({ from, to })}>{t('calls.historyApply')}</Button>
          </div>
        </CardContent>
      </Card>

      {q.isPending ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : q.data?.error === 'cdr_not_configured' ? (
        <p className="text-sm text-destructive">{t('calls.historyCdrMissing')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Phone, label: t('report.totalCalls'), value: stats.total, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-950/40' },
            { icon: PhoneOff, label: t('report.answeredCalls'), value: stats.answered, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-950/40' },
            { icon: Percent, label: t('report.asr'), value: `${stats.asr}%`, color: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-950/40' },
            { icon: Clock3, label: t('report.avgDuration'), value: `${stats.avgBill}s`, color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-950/40' },
            { icon: PhoneOff, label: t('report.noAnswer'), value: stats.noAnswer, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-950/40' },
            { icon: PhoneOff, label: t('report.busy'), value: stats.busy, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-950/40' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <Card key={label} className="border-0 shadow-md ring-1 ring-border/50">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', bg)}>
                  <Icon className={cn('h-5 w-5', color)} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-bold tabular-nums">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Detail Report (CDR table) ─────────────────────────────────────────────────

export function ReportDetailPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const oid = useCdrOrg(me);
  const [{ from, to }, setRange] = useState(defaultRange);
  const [src, setSrc] = useState('');
  const [page, setPage] = useState(1);

  const params = useMemo(() => ({
    from: from.replace('T', ' '),
    to: to.replace('T', ' '),
    src: src.trim(),
    page,
    pageSize: 50,
    ...(oid != null ? { organizationId: oid } : {}),
  }), [from, to, src, page, oid]);

  const q = useQuery({
    queryKey: qk.cdrHistory(params as Record<string, string | number>),
    queryFn: () => {
      const sp = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null) sp.set(k, String(v)); });
      return apiFetch<{ items?: CdrHistoryRow[]; total?: number; error?: string }>(`/metrics/cdr/history?${sp.toString()}`);
    },
    enabled: me.role === 'platform_admin' ? true : oid != null,
  });

  const DISP_COLORS: Record<string, string> = {
    'ANSWERED': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    'NO ANSWER': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    'BUSY': 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    'FAILED': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  };

  if (me.role !== 'platform_admin' && !oid) {
    return <p className="text-sm text-muted-foreground">{t('calls.pickOrg')}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('pbx.reportDetail')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pbx.reportDetailBody')}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('calls.historyFilters')}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-muted-foreground">
            {t('calls.historyFrom')}
            <Input type="datetime-local" value={from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="mt-1" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            {t('calls.historyTo')}
            <Input type="datetime-local" value={to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="mt-1" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            {t('calls.historySrc')}
            <Input value={src} onChange={(e) => setSrc(e.target.value)} className="mt-1" />
          </label>
          <div className="flex items-end sm:col-span-3">
            <Button type="button" onClick={() => setPage(1)}>{t('calls.historyApply')}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {q.isPending ? (
            <Skeleton className="m-6 h-48 w-full" />
          ) : q.data?.error === 'cdr_not_configured' ? (
            <p className="p-6 text-sm text-destructive">{t('calls.historyCdrMissing')}</p>
          ) : (q.data?.items ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('report.empty')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="p-3">{t('calls.historyColWhen')}</th>
                    <th className="p-3">{t('calls.historyColSrc')}</th>
                    <th className="p-3">{t('calls.historyColDst')}</th>
                    <th className="p-3">{t('calls.historyColBill')}</th>
                    <th className="p-3">{t('report.disposition')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(q.data?.items ?? []).map((r) => (
                    <tr key={r.uniqueid} className="border-b border-border/70 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{r.calldate}</td>
                      <td className="p-3 font-mono text-xs">{r.src}</td>
                      <td className="p-3 font-mono text-xs">{r.dst}</td>
                      <td className="p-3 tabular-nums">{r.billsec}s</td>
                      <td className="p-3">
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', DISP_COLORS[r.disposition] ?? DISP_COLORS['FAILED'])}>
                          {r.disposition}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {q.data && (q.data.total ?? 0) > 50 && (
            <div className="flex justify-end gap-2 border-t border-border p-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('orgs.prev')}</Button>
              <Button variant="outline" size="sm" disabled={page * 50 >= (q.data?.total ?? 0)} onClick={() => setPage((p) => p + 1)}>{t('orgs.next')}</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Exports ───────────────────────────────────────────────────────────────────

export function ReportExportsPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const oid = useCdrOrg(me);
  const [{ from, to }, setRange] = useState(defaultRange);
  const [downloading, setDownloading] = useState(false);

  if (me.role !== 'platform_admin' && !oid) {
    return <p className="text-sm text-muted-foreground">{t('calls.pickOrg')}</p>;
  }

  async function handleExport() {
    setDownloading(true);
    try {
      const sp = new URLSearchParams({
        from: from.replace('T', ' '),
        to: to.replace('T', ' '),
        ...(oid != null ? { organizationId: String(oid) } : {}),
      });
      const res = await fetch(`/api/reports/cdr-export.csv?${sp.toString()}`, { credentials: 'include' });
      if (!res.ok) { alert(t('report.exportFailed')); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cdr-export-${from.slice(0, 10)}-${to.slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('pbx.reportExports')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pbx.reportExportsBody')}</p>
      </div>

      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardHeader><CardTitle className="text-base">{t('report.exportTitle')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t('calls.historyFrom')}
              <Input type="datetime-local" value={from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="mt-1" />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              {t('calls.historyTo')}
              <Input type="datetime-local" value={to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="mt-1" />
            </label>
          </div>
          <Button onClick={handleExport} disabled={downloading} className="gap-2">
            <Download className="h-4 w-4" />
            {downloading ? t('report.exporting') : t('report.exportCsv')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── ASR Report ────────────────────────────────────────────────────────────────

export function ReportAsrPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const oid = useCdrOrg(me);
  const [{ from, to }, setRange] = useState(defaultRange);
  const [applied, setApplied] = useState({ from: defaultRange().from, to: defaultRange().to });

  const params = useMemo(() => ({
    from: applied.from.replace('T', ' '),
    to: applied.to.replace('T', ' '),
    pageSize: 5000,
    ...(oid != null ? { organizationId: oid } : {}),
  }), [applied, oid]);

  const q = useQuery({
    queryKey: qk.cdrHistory(params as Record<string, string | number>),
    queryFn: () => {
      const sp = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null) sp.set(k, String(v)); });
      return apiFetch<{ items?: CdrHistoryRow[]; error?: string }>(`/metrics/cdr/history?${sp.toString()}`);
    },
    enabled: me.role === 'platform_admin' ? true : oid != null,
  });

  const byDay = useMemo(() => {
    const items = q.data?.items ?? [];
    const map = new Map<string, { total: number; answered: number }>();
    for (const r of items) {
      const day = r.calldate.slice(0, 10);
      const cur = map.get(day) ?? { total: 0, answered: 0 };
      cur.total++;
      if (r.disposition === 'ANSWERED') cur.answered++;
      map.set(day, cur);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, { total, answered }]) => ({
        day,
        total,
        answered,
        asr: total > 0 ? Math.round((answered / total) * 100) : 0,
      }));
  }, [q.data]);

  const overall = useMemo(() => {
    const total = byDay.reduce((s, d) => s + d.total, 0);
    const answered = byDay.reduce((s, d) => s + d.answered, 0);
    return { total, answered, asr: total > 0 ? Math.round((answered / total) * 100) : 0 };
  }, [byDay]);

  if (me.role !== 'platform_admin' && !oid) {
    return <p className="text-sm text-muted-foreground">{t('calls.pickOrg')}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('pbx.reportAsr')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pbx.reportAsrBody')}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('calls.historyFilters')}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-muted-foreground">
            {t('calls.historyFrom')}
            <Input type="datetime-local" value={from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="mt-1" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            {t('calls.historyTo')}
            <Input type="datetime-local" value={to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="mt-1" />
          </label>
          <div className="flex items-end">
            <Button type="button" onClick={() => setApplied({ from, to })}>{t('calls.historyApply')}</Button>
          </div>
        </CardContent>
      </Card>

      {q.isPending ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : q.data?.error === 'cdr_not_configured' ? (
        <p className="text-sm text-destructive">{t('calls.historyCdrMissing')}</p>
      ) : byDay.length === 0 ? (
        <Card className="border-0 shadow-md ring-1 ring-border/50">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <TrendingUp className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('report.empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: t('report.totalCalls'), value: overall.total, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-950/40' },
              { label: t('report.answeredCalls'), value: overall.answered, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-950/40' },
              { label: t('report.asr'), value: `${overall.asr}%`, color: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-950/40' },
            ].map(({ label, value, color, bg }) => (
              <Card key={label} className="border-0 shadow-md ring-1 ring-border/50">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', bg)}>
                    <TrendingUp className={cn('h-5 w-5', color)} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg font-bold tabular-nums">{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="border-0 shadow-md ring-1 ring-border/50">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="p-3">{t('report.day')}</th>
                      <th className="p-3 text-right">{t('report.totalCalls')}</th>
                      <th className="p-3 text-right">{t('report.answeredCalls')}</th>
                      <th className="p-3 text-right">{t('report.asr')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDay.map((d) => (
                      <tr key={d.day} className="border-b border-border/70 hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs">{d.day}</td>
                        <td className="p-3 text-right tabular-nums">{d.total}</td>
                        <td className="p-3 text-right tabular-nums">{d.answered}</td>
                        <td className="p-3 text-right tabular-nums">
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium',
                            d.asr >= 70 ? 'bg-emerald-100 text-emerald-700' :
                            d.asr >= 40 ? 'bg-amber-100 text-amber-700' :
                            'bg-rose-100 text-rose-700')}>
                            {d.asr}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Queue Log helpers ────────────────────────────────────────────────────────

type QueueLogRow = { time: number; callid: string; queuename: string; agent: string; event: string; data1: string; data2: string; data3: string; data4: string; data5: string };

function defaultDateRange() {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { from, to };
}

function useQueueLog(orgId: number | null, from: string, to: string, enabled: boolean) {
  return useQuery({
    queryKey: ['queue-log', orgId, from, to],
    queryFn: () => {
      const sp = new URLSearchParams({ from, to, pageSize: '5000' });
      if (orgId != null) sp.set('organizationId', String(orgId));
      return apiFetch<{ items?: QueueLogRow[]; error?: string }>(`/metrics/queue-log?${sp.toString()}`);
    },
    enabled,
  });
}

// ─── Queue Report ─────────────────────────────────────────────────────────────

export function ReportQueuesPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const oid = useCdrOrg(me);
  const [range, setRange] = useState(defaultDateRange);
  const [applied, setApplied] = useState(defaultDateRange);

  const q = useQueueLog(oid, applied.from, applied.to, me.role === 'platform_admin' ? true : oid != null);

  const byQueue = useMemo(() => {
    const items = q.data?.items ?? [];
    const map = new Map<string, { total: number; answered: number; abandoned: number; totalTalk: number }>();
    for (const r of items) {
      const cur = map.get(r.queuename) ?? { total: 0, answered: 0, abandoned: 0, totalTalk: 0 };
      if (r.event === 'ENTERQUEUE') cur.total++;
      if (r.event === 'CONNECT') { cur.answered++; cur.totalTalk += Number(r.data1) || 0; }
      if (r.event === 'ABANDON' || r.event === 'EXITWITHTIMEOUT') cur.abandoned++;
      map.set(r.queuename, cur);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([name, s]) => ({ name, ...s, avgTalk: s.answered > 0 ? Math.round(s.totalTalk / s.answered) : 0, asr: s.total > 0 ? Math.round((s.answered / s.total) * 100) : 0 }));
  }, [q.data]);

  if (me.role !== 'platform_admin' && !oid) return <p className="text-sm text-muted-foreground">{t('calls.pickOrg')}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('pbx.reportQueues')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pbx.reportQueuesBody')}</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t('calls.historyFilters')}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-muted-foreground">{t('calls.historyFrom')}<Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="mt-1" /></label>
          <label className="text-xs font-medium text-muted-foreground">{t('calls.historyTo')}<Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="mt-1" /></label>
          <div className="flex items-end"><Button type="button" onClick={() => setApplied(range)}>{t('calls.historyApply')}</Button></div>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="p-0">
          {q.isPending ? <Skeleton className="m-6 h-32 w-full" /> : q.data?.error === 'cdr_not_configured' ? (
            <p className="p-6 text-sm text-destructive">{t('calls.historyCdrMissing')}</p>
          ) : byQueue.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <BarChart3 className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('report.empty')}</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="p-3">{t('queueReport.queueName')}</th>
                <th className="p-3 text-right">{t('queueReport.total')}</th>
                <th className="p-3 text-right">{t('queueReport.answered')}</th>
                <th className="p-3 text-right">{t('queueReport.abandoned')}</th>
                <th className="p-3 text-right">{t('queueReport.asr')}</th>
                <th className="p-3 text-right">{t('queueReport.avgTalk')}</th>
              </tr></thead>
              <tbody>
                {byQueue.map((row) => (
                  <tr key={row.name} className="border-b border-border/70 hover:bg-muted/30">
                    <td className="p-3 font-medium">{row.name}</td>
                    <td className="p-3 text-right tabular-nums">{row.total}</td>
                    <td className="p-3 text-right tabular-nums text-emerald-700">{row.answered}</td>
                    <td className="p-3 text-right tabular-nums text-amber-700">{row.abandoned}</td>
                    <td className="p-3 text-right">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', row.asr >= 70 ? 'bg-emerald-100 text-emerald-700' : row.asr >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')}>{row.asr}%</span>
                    </td>
                    <td className="p-3 text-right tabular-nums text-xs">{row.avgTalk}s</td>
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

// ─── Agents Report ────────────────────────────────────────────────────────────

export function ReportAgentsPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const oid = useCdrOrg(me);
  const [range, setRange] = useState(defaultDateRange);
  const [applied, setApplied] = useState(defaultDateRange);

  const q = useQueueLog(oid, applied.from, applied.to, me.role === 'platform_admin' ? true : oid != null);

  const byAgent = useMemo(() => {
    const items = q.data?.items ?? [];
    const map = new Map<string, { calls: number; totalTalk: number; pauses: number }>();
    for (const r of items) {
      if (!r.agent || r.agent === 'NONE') continue;
      const cur = map.get(r.agent) ?? { calls: 0, totalTalk: 0, pauses: 0 };
      if (r.event === 'CONNECT') { cur.calls++; cur.totalTalk += Number(r.data1) || 0; }
      if (r.event === 'PAUSE') cur.pauses++;
      map.set(r.agent, cur);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([agent, s]) => ({ agent, ...s, avgTalk: s.calls > 0 ? Math.round(s.totalTalk / s.calls) : 0 }));
  }, [q.data]);

  if (me.role !== 'platform_admin' && !oid) return <p className="text-sm text-muted-foreground">{t('calls.pickOrg')}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('pbx.reportAgents')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pbx.reportAgentsBody')}</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t('calls.historyFilters')}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-muted-foreground">{t('calls.historyFrom')}<Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="mt-1" /></label>
          <label className="text-xs font-medium text-muted-foreground">{t('calls.historyTo')}<Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="mt-1" /></label>
          <div className="flex items-end"><Button type="button" onClick={() => setApplied(range)}>{t('calls.historyApply')}</Button></div>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="p-0">
          {q.isPending ? <Skeleton className="m-6 h-32 w-full" /> : q.data?.error === 'cdr_not_configured' ? (
            <p className="p-6 text-sm text-destructive">{t('calls.historyCdrMissing')}</p>
          ) : byAgent.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <UserCheck className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('report.empty')}</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="p-3">{t('agentReport.agent')}</th>
                <th className="p-3 text-right">{t('agentReport.calls')}</th>
                <th className="p-3 text-right">{t('agentReport.totalTalk')}</th>
                <th className="p-3 text-right">{t('agentReport.avgTalk')}</th>
                <th className="p-3 text-right">{t('agentReport.pauses')}</th>
              </tr></thead>
              <tbody>
                {byAgent.map((row) => (
                  <tr key={row.agent} className="border-b border-border/70 hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{row.agent}</td>
                    <td className="p-3 text-right tabular-nums">{row.calls}</td>
                    <td className="p-3 text-right tabular-nums text-xs">{row.totalTalk}s</td>
                    <td className="p-3 text-right tabular-nums text-xs">{row.avgTalk}s</td>
                    <td className="p-3 text-right tabular-nums">{row.pauses}</td>
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

// ─── Campaign Calls Report ────────────────────────────────────────────────────

export function ReportCampaignPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const oid = useCdrOrg(me);

  const campaigns = useQuery({
    queryKey: ['campaigns', oid ?? 0],
    queryFn: () => apiFetch<{ items: { id: number; name: string; type: string; status: string }[] }>(`/campaigns?organizationId=${oid}`),
    enabled: oid != null,
  });

  const [range, setRange] = useState(defaultDateRange);
  const [applied, setApplied] = useState(defaultDateRange);

  const q = useQueueLog(oid, applied.from, applied.to, me.role === 'platform_admin' ? true : oid != null);

  const summary = useMemo(() => {
    const items = q.data?.items ?? [];
    const total = items.filter((r) => r.event === 'ENTERQUEUE').length;
    const answered = items.filter((r) => r.event === 'CONNECT').length;
    const abandoned = items.filter((r) => r.event === 'ABANDON' || r.event === 'EXITWITHTIMEOUT').length;
    return { total, answered, abandoned, asr: total > 0 ? Math.round((answered / total) * 100) : 0 };
  }, [q.data]);

  if (me.role !== 'platform_admin' && !oid) return <p className="text-sm text-muted-foreground">{t('calls.pickOrg')}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('pbx.reportCampaign')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pbx.reportCampaignBody')}</p>
      </div>

      {campaigns.data && campaigns.data.items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: t('report.totalCalls'), value: summary.total, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-950/40' },
            { label: t('report.answeredCalls'), value: summary.answered, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-950/40' },
            { label: t('report.noAnswer'), value: summary.abandoned, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-950/40' },
            { label: t('report.asr'), value: `${summary.asr}%`, color: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-950/40' },
          ].map(({ label, value, color, bg }) => (
            <Card key={label} className="border-0 shadow-md ring-1 ring-border/50">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', bg)}>
                  <PhoneCall className={cn('h-5 w-5', color)} />
                </div>
                <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-bold tabular-nums">{value}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{t('calls.historyFilters')}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-muted-foreground">{t('calls.historyFrom')}<Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="mt-1" /></label>
          <label className="text-xs font-medium text-muted-foreground">{t('calls.historyTo')}<Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="mt-1" /></label>
          <div className="flex items-end"><Button type="button" onClick={() => setApplied(range)}>{t('calls.historyApply')}</Button></div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md ring-1 ring-border/50">
        <CardContent className="p-0">
          {campaigns.isPending ? <Skeleton className="m-6 h-32 w-full" /> : (campaigns.data?.items ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <PhoneCall className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('campaign.empty')}</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="p-3">{t('campaign.fieldName')}</th>
                <th className="p-3">{t('campaign.fieldType')}</th>
                <th className="p-3">{t('campaign.status.active')}/{t('campaign.status.paused')}</th>
              </tr></thead>
              <tbody>
                {(campaigns.data?.items ?? []).map((c) => (
                  <tr key={c.id} className="border-b border-border/70 hover:bg-muted/30">
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3 text-xs text-muted-foreground capitalize">{c.type}</td>
                    <td className="p-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>{c.status}</span>
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
