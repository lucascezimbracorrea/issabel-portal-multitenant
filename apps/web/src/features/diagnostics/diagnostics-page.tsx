import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Activity, Database, Server } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';

type Summary = {
  apiVersion: string;
  uptimeHint: string;
  counts: { organizations: number; users: number; spaces: number; webhooks: number; callRules: number };
};

export function DiagnosticsPage() {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: qk.diagnosticsSummary(),
    queryFn: () => apiFetch<Summary>('/diagnostics/summary'),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="bg-gradient-to-r from-cyan-700 via-blue-600 to-indigo-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-cyan-300 dark:via-blue-300 dark:to-indigo-300">
          {t('diagnostics.title')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('diagnostics.subtitle')}</p>
      </div>

      {q.isPending ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : q.data ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-0 border-l-4 border-l-blue-500 shadow-md ring-1 ring-border/50">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-sm font-semibold">{t('diagnostics.api')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">{t('diagnostics.version')}:</span> {q.data.apiVersion}
              </p>
              <p>
                <span className="text-muted-foreground">{t('diagnostics.mode')}:</span> {q.data.uptimeHint}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 border-l-4 border-l-emerald-500 shadow-md ring-1 ring-border/50">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Database className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <CardTitle className="text-sm font-semibold">{t('diagnostics.data')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t('diagnostics.orgs')}</p>
                <p className="text-xl font-bold">{q.data.counts.organizations}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('diagnostics.users')}</p>
                <p className="text-xl font-bold">{q.data.counts.users}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('diagnostics.spaces')}</p>
                <p className="text-xl font-bold">{q.data.counts.spaces}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('diagnostics.webhooks')}</p>
                <p className="text-xl font-bold">{q.data.counts.webhooks}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 border-l-4 border-l-violet-500 shadow-md ring-1 ring-border/50">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Activity className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              <CardTitle className="text-sm font-semibold">{t('diagnostics.rules')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{t('diagnostics.callRules')}</p>
              <p className="text-3xl font-bold">{q.data.counts.callRules}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
