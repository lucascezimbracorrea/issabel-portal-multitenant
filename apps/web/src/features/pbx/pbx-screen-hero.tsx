import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

export function PbxScreenHero({
  gradient,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  gradient: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border-0 shadow-lg ring-1 ring-border/50', gradient)}>
      <div className="px-6 py-8 text-white">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/85">{eyebrow}</p>
        <h1 className="mt-1 text-balance text-2xl font-bold tracking-tight drop-shadow-sm md:text-3xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-pretty text-sm leading-relaxed text-white/90">{subtitle}</p>
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </div>
  );
}
