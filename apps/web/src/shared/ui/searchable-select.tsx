import * as React from 'react';
import { Command as CommandMenu } from 'cmdk';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

export type SearchableSelectOption = {
  value: string;
  label: string;
  keywords?: string[];
  description?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
};

type Tone = 'default' | 'sidebar';

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  className,
  align = 'start',
  side = 'bottom',
  tone = 'default',
}: {
  options: SearchableSelectOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  className?: string;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom' | 'left' | 'right';
  tone?: Tone;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === (value ?? ''));

  const triggerClasses =
    tone === 'sidebar'
      ? 'w-full border-white/15 bg-white/10 text-sidebar-foreground shadow-none hover:bg-white/14 hover:text-white'
      : 'w-full border-border bg-background shadow-sm hover:bg-accent/60';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('justify-between font-normal', triggerClasses, className)}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-left">
            {selected?.icon}
            <span className="truncate">{selected?.label ?? placeholder}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} side={side} className="w-[var(--radix-popover-trigger-width)] p-0" sideOffset={4}>
        <CommandMenu
          label={searchPlaceholder}
          className="flex max-h-[min(20rem,var(--radix-popover-content-available-height))] flex-col overflow-hidden rounded-md bg-card text-sm"
        >
          <div className="border-b border-border px-2 py-1.5">
            <CommandMenu.Input
              placeholder={searchPlaceholder}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
          <CommandMenu.List className="max-h-[min(16rem,60vh)] overflow-y-auto overscroll-contain p-1">
            <CommandMenu.Empty className="px-2 py-6 text-center text-xs text-muted-foreground">{emptyText}</CommandMenu.Empty>
            <CommandMenu.Group>
              {options.map((opt) => (
                <CommandMenu.Item
                  key={opt.value}
                  value={opt.value}
                  keywords={opt.keywords ?? [opt.label, opt.description ?? ''].filter(Boolean)}
                  disabled={opt.disabled}
                  onSelect={(v) => {
                    onValueChange(v);
                    setOpen(false);
                  }}
                  className={cn(
                    'relative flex cursor-pointer select-none items-start gap-2 rounded-md px-2 py-2 text-sm outline-none',
                    'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
                    'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
                    'aria-selected:bg-accent/80',
                  )}
                >
                  <Check className={cn('mt-0.5 h-4 w-4 shrink-0', (value ?? '') !== opt.value && 'opacity-0')} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium leading-tight">
                      {opt.icon}
                      <span className="truncate">{opt.label}</span>
                    </span>
                    {opt.description ? (
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{opt.description}</span>
                    ) : null}
                  </span>
                </CommandMenu.Item>
              ))}
            </CommandMenu.Group>
          </CommandMenu.List>
        </CommandMenu>
      </PopoverContent>
    </Popover>
  );
}
