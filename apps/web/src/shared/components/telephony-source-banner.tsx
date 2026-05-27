import { AlertTriangle } from 'lucide-react';

export function TelephonySourceBanner({ source }: { source?: 'demo' | 'cdr' }) {
  if (source !== 'demo') return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
      <div>
        <p className="font-medium">Dados de demonstração</p>
        <p className="text-xs opacity-90 mt-0.5">
          Configure o CDR MySQL na organização (aba Informações) para ver chamadas e KPIs reais do Issabel.
        </p>
      </div>
    </div>
  );
}
