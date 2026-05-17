import { cn } from '@/shared/lib/utils';

type Status = 'active' | 'inactive' | 'warning' | 'info';

const styles: Record<Status, string> = {
  active: 'bg-status-active',
  inactive: 'bg-status-inactive',
  warning: 'bg-status-warning',
  info: 'bg-status-info',
};

export function StatusBadge({ status, label, className }: { status: Status; label: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', styles[status], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}

export function UsageBar({
  used,
  limit,
  label,
  unit = '',
}: {
  used: number;
  limit: number | null;
  label?: string;
  unit?: string;
}) {
  if (limit == null) {
    return (
      <span className="text-xs text-muted-foreground">
        {label ? `${label}: ` : ''}{used}{unit} / ∞
      </span>
    );
  }
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const color = pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-primary';
  return (
    <div className="min-w-[80px] space-y-1">
      {label && (
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{label}</span>
          <span className="tabular-nums">{used}{unit} / {limit}{unit}</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
