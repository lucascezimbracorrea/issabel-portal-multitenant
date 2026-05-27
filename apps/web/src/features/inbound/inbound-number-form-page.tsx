import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useRouteContext } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import type { RouteType, BusinessSchedule } from '@/shared/lib/routing-types';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { DestinationPicker } from '@/features/routing/destination-picker';
import { BusinessScheduleEditor } from '@/features/routing/business-schedule-editor';

type InboundForm = {
  number: string;
  routeType: RouteType;
  destinationId: number | '';
  maxConcurrentCalls: number;
  registerEnabled: boolean;
  recordCalls: boolean;
  scheduleEnabled: boolean;
  schedule: BusinessSchedule;
  description: string;
  active: boolean;
};

type InboundDetail = Omit<InboundForm, 'schedule' | 'scheduleEnabled'> & {
  id: number;
  scheduleJson?: string;
  scheduleEnabled?: boolean;
};

const EMPTY_FORM: InboundForm = {
  number: '',
  routeType: 'none',
  destinationId: '',
  maxConcurrentCalls: 0,
  registerEnabled: false,
  recordCalls: false,
  scheduleEnabled: false,
  schedule: {},
  description: '',
  active: true,
};

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <div
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onChange(!checked); }}
        className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${checked ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}

export function InboundNumberFormPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);

  const params = useParams({ strict: false }) as { inboundId?: string };
  const isEdit = !!params.inboundId && params.inboundId !== 'new';
  const inboundId = isEdit ? Number(params.inboundId) : null;

  const [form, setForm] = useState<InboundForm>(EMPTY_FORM);

  const { data: existing, isPending: loadingExisting } = useQuery({
    queryKey: qk.inboundNumber(inboundId ?? 0),
    queryFn: () => apiFetch<InboundDetail>(`/inbound-numbers/${inboundId}`),
    enabled: isEdit && !!inboundId,
  });

  useEffect(() => {
    if (existing) {
      let schedule: BusinessSchedule = {};
      try { schedule = JSON.parse(existing.scheduleJson ?? '{}'); } catch { schedule = {}; }
      setForm({
        number: existing.number ?? '',
        routeType: existing.routeType ?? 'none',
        destinationId: existing.destinationId ?? '',
        maxConcurrentCalls: existing.maxConcurrentCalls ?? 0,
        registerEnabled: existing.registerEnabled ?? false,
        recordCalls: existing.recordCalls ?? false,
        scheduleEnabled: existing.scheduleEnabled ?? false,
        schedule,
        description: existing.description ?? '',
        active: existing.active ?? true,
      });
    }
  }, [existing]);

  function patch<K extends keyof InboundForm>(key: K, value: InboundForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const buildPayload = () => ({
    organizationId: orgId,
    number: form.number.trim(),
    routeType: form.routeType,
    destinationId: form.destinationId === '' ? null : form.destinationId,
    maxConcurrentCalls: form.maxConcurrentCalls,
    registerEnabled: form.registerEnabled,
    recordCalls: form.recordCalls,
    scheduleEnabled: form.scheduleEnabled,
    scheduleJson: JSON.stringify(form.schedule),
    description: form.description.trim() || null,
    active: form.active,
  });

  const create = useMutation({
    mutationFn: () => apiFetch('/inbound-numbers', { method: 'POST', body: JSON.stringify(buildPayload()) }),
    onSuccess: async () => {
      toast.success(t('inbound.created'));
      await qc.invalidateQueries({ queryKey: qk.inboundNumbers(orgId ?? 0) });
      void navigate({ to: '/pbx/inbound-numbers' });
    },
    onError: () => toast.error(t('inbound.failed')),
  });

  const save = useMutation({
    mutationFn: () => apiFetch(`/inbound-numbers/${inboundId}`, { method: 'PATCH', body: JSON.stringify(buildPayload()) }),
    onSuccess: async () => {
      toast.success(t('inbound.updated'));
      await qc.invalidateQueries({ queryKey: qk.inboundNumbers(orgId ?? 0) });
      await qc.invalidateQueries({ queryKey: qk.inboundNumber(inboundId ?? 0) });
      void navigate({ to: '/pbx/inbound-numbers' });
    },
    onError: () => toast.error(t('inbound.failed')),
  });

  const syncIssabel = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; detail?: string }>(`/inbound-numbers/${inboundId}/sync-issabel`, { method: 'POST' }),
    onSuccess: (r) => {
      if (r.ok) toast.success('Sync Issabel enviado');
      else toast.error(r.detail ?? 'Sync falhou');
    },
    onError: () => toast.error('Sync Issabel falhou'),
  });

  const isPending = create.isPending || save.isPending;

  function handleSubmit() {
    if (!form.number.trim()) {
      toast.error(t('inbound.numberRequired'));
      return;
    }
    if (isEdit) save.mutate();
    else create.mutate();
  }

  if (isEdit && loadingExisting) {
    return (
      <div className="space-y-4 pb-24">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void navigate({ to: '/pbx/inbound-numbers' })}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          {t('nav.inboundNumbers')}
        </button>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold text-foreground">
          {isEdit ? (existing?.number ?? t('inbound.editFallback')) : t('inbound.new')}
        </span>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('inbound.sectionBasic')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{t('inbound.colNumber')}</label>
              <Input
                value={form.number}
                onChange={(e) => patch('number', e.target.value)}
                placeholder="+5511900000000"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{t('inbound.maxConcurrent')}</label>
              <Input
                type="number"
                min={0}
                value={form.maxConcurrentCalls}
                onChange={(e) => patch('maxConcurrentCalls', Number(e.target.value))}
                className="w-32"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">{t('inbound.description')}</label>
            <Input
              value={form.description}
              onChange={(e) => patch('description', e.target.value)}
              placeholder={t('inbound.descPlaceholder')}
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <Toggle
              checked={form.registerEnabled}
              onChange={(v) => patch('registerEnabled', v)}
              label={t('inbound.registerEnabled')}
            />
            <Toggle
              checked={form.recordCalls}
              onChange={(v) => patch('recordCalls', v)}
              label={t('inbound.recordCalls')}
            />
            <Toggle
              checked={form.active}
              onChange={(v) => patch('active', v)}
              label={t('trunk.status.active')}
            />
          </div>
        </CardContent>
      </Card>

      {orgId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('inbound.sectionRoute')}</CardTitle>
          </CardHeader>
          <CardContent>
            <DestinationPicker
              orgId={orgId}
              routeType={form.routeType}
              destinationId={form.destinationId}
              onRouteTypeChange={(v) => patch('routeType', v)}
              onDestinationChange={(v) => patch('destinationId', v)}
              allowNone
            />
          </CardContent>
        </Card>
      )}

      {orgId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('inbound.sectionSchedule')}</CardTitle>
          </CardHeader>
          <CardContent>
            <BusinessScheduleEditor
              orgId={orgId}
              enabled={form.scheduleEnabled}
              onEnabledChange={(v) => patch('scheduleEnabled', v)}
              schedule={form.schedule}
              onScheduleChange={(s) => patch('schedule', s)}
            />
          </CardContent>
        </Card>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-screen-xl items-center justify-end gap-3 px-6 py-3">
          <Button type="button" variant="outline" onClick={() => void navigate({ to: '/pbx/inbound-numbers' })} disabled={isPending}>
            {t('extensions.form.btnReturn')}
          </Button>
          {isEdit && inboundId && (
            <Button
              type="button"
              variant="outline"
              disabled={syncIssabel.isPending}
              onClick={() => syncIssabel.mutate()}
            >
              Sync Issabel
            </Button>
          )}
          <Button type="button" className="min-w-[100px]" onClick={handleSubmit} disabled={isPending || !form.number.trim()}>
            {isPending
              ? isEdit ? t('extensions.form.saving') : t('extensions.form.inserting')
              : isEdit ? t('extensions.form.btnSave') : t('extensions.form.btnInsert')}
          </Button>
        </div>
      </div>
    </div>
  );
}
