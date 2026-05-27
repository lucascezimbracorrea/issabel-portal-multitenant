import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import type { AfterHoursAction, BusinessSchedule, ScheduleWindow } from '@/shared/lib/routing-types';
import { AFTER_HOURS_ACTIONS, DAY_KEYS } from '@/shared/lib/routing-types';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/lib/utils';

type Props = {
  orgId: number;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  schedule: BusinessSchedule;
  onScheduleChange: (s: BusinessSchedule) => void;
};

export function BusinessScheduleEditor({ orgId, enabled, onEnabledChange, schedule, onScheduleChange }: Props) {
  const { t } = useTranslation();
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');

  const audio = useQuery({
    queryKey: ['audio-files', orgId],
    queryFn: () => apiFetch<{ items: { id: number; name: string }[] }>(`/audio-files?organizationId=${orgId}`),
    enabled: !!orgId,
  });
  const holidays = useQuery({
    queryKey: ['holidays', orgId],
    queryFn: () => apiFetch<{ items: { id: number; name: string; date: string }[] }>(`/holidays?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const windows = schedule.windows ?? [];

  const toggleDay = (d: number) => {
    setSelectedDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const addWindow = () => {
    if (selectedDays.length === 0) return;
    const w: ScheduleWindow = { days: [...selectedDays], startTime, endTime };
    onScheduleChange({ ...schedule, windows: [...windows, w] });
  };

  const removeWindow = (idx: number) => {
    onScheduleChange({ ...schedule, windows: windows.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold">{t('routing.schedule.title')}</h3>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => onEnabledChange(e.target.checked)} className="h-4 w-4 rounded" />
          {t('routing.schedule.enable')}
        </label>
      </div>

      {enabled && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('routing.schedule.holidayList')}</label>
              <Input
                list="holiday-lists"
                value={schedule.holidayListName ?? ''}
                onChange={(e) => onScheduleChange({ ...schedule, holidayListName: e.target.value })}
                placeholder={t('routing.schedule.holidayPlaceholder')}
              />
              <datalist id="holiday-lists">
                {(holidays.data?.items ?? []).map((h) => (
                  <option key={h.id} value={h.name} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('routing.schedule.afterHoursAudio')}</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={schedule.afterHoursAudioId ?? ''}
                onChange={(e) =>
                  onScheduleChange({
                    ...schedule,
                    afterHoursAudioId: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">—</option>
                {(audio.data?.items ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('routing.schedule.afterHoursAction')}</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={schedule.afterHoursAction ?? 'hangup'}
                onChange={(e) =>
                  onScheduleChange({ ...schedule, afterHoursAction: e.target.value as AfterHoursAction })
                }
              >
                {AFTER_HOURS_ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {t(`routing.afterHours.${a}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{t('routing.schedule.daysHint')}</p>
          <div className="flex flex-wrap items-end gap-2">
            {DAY_KEYS.map((key, idx) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleDay(idx)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  selectedDays.includes(idx)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {t(`routing.day.${key}`)}
              </button>
            ))}
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-28" />
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-28" />
            <Button type="button" size="icon" variant="outline" onClick={addWindow} className="shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {windows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('routing.schedule.empty')}</p>
          ) : (
            <ul className="space-y-2">
              {windows.map((w, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span>
                    {w.days.map((d) => t(`routing.day.${DAY_KEYS[d]}`)).join(', ')} — {w.startTime}–{w.endTime}
                  </span>
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeWindow(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
