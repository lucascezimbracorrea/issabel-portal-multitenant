import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useRouteContext } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { canWriteExtensions } from '@/shared/lib/can';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { SoftphoneProvisionPanel } from '@/features/softphone/softphone-provision-panel';

// ─── Types ────────────────────────────────────────────────────────────────────

type CallAnalysis = 'disabled' | 'full' | 'summarize_transcribe' | 'transcribe_only';

type ExtForm = {
  number: string;
  displayName: string;
  extensionGroup: string;
  maxWaitingTime: number;
  sipPassword: string;
  enableWebAccess: boolean;
  callerId: string;
  passCallerIdFromOrigin: boolean;
  callingPlan: string;
  waitingMusicGroup: string;
  callPickup: string;
  costCenter: string;
  enableBlf: boolean;
  enableTimer: boolean;
  recordCall: boolean;
  blockExtension: boolean;
  areaCode: string;
  callAnalysis: CallAnalysis;
  enableDualAuth: boolean;
  enableMailbox: boolean;
  forwardAllCalls: string;
  forwardOffline: string;
  forwardBusy: string;
};

type ExtDetail = ExtForm & { id: number; source: string };

const EMPTY_FORM: ExtForm = {
  number: '',
  displayName: '',
  extensionGroup: '',
  maxWaitingTime: 60,
  sipPassword: '',
  enableWebAccess: false,
  callerId: '',
  passCallerIdFromOrigin: false,
  callingPlan: '',
  waitingMusicGroup: 'pabx_default',
  callPickup: 'same_group',
  costCenter: '',
  enableBlf: false,
  enableTimer: false,
  recordCall: false,
  blockExtension: false,
  areaCode: '',
  callAnalysis: 'disabled',
  enableDualAuth: false,
  enableMailbox: false,
  forwardAllCalls: '',
  forwardOffline: '',
  forwardBusy: '',
};

const ANALYSIS_ORDER: CallAnalysis[] = ['disabled', 'full', 'summarize_transcribe', 'transcribe_only'];

const ANALYSIS_ICONS: Record<CallAnalysis, ReactNode> = {
  disabled: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
      <circle cx="12" cy="12" r="9" />
      <line x1="7" y1="7" x2="17" y2="17" />
    </svg>
  ),
  full: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
      <path d="M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3Z" />
      <path d="M8 12h2l2-4 2 8 2-4h2" />
    </svg>
  ),
  summarize_transcribe: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
      <path d="M17 15l2 2-2 2" />
    </svg>
  ),
  transcribe_only: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h5" />
      <path d="M15 17c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2Z" />
      <path d="M17 15v-2" />
    </svg>
  ),
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2', disabled && 'cursor-not-allowed opacity-60')}>
      <div
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => !disabled && onChange(!checked)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) onChange(!checked);
        }}
        className={cn(
          'relative h-5 w-9 flex-shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          checked ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600',
        )}
      >
        <div
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </div>
      <span className="text-sm font-medium">{label}</span>
      {hint && (
        <span className="cursor-help text-muted-foreground" title={hint}>
          &#9432;
        </span>
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
  hint,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-xs font-medium text-foreground">
        {label}
        {hint && (
          <span className="cursor-help text-muted-foreground" title={hint}>
            &#9432;
          </span>
        )}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        {children}
      </select>
    </div>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex items-center gap-1 text-xs font-medium text-foreground">
      {children}
      {hint && (
        <span className="cursor-help text-muted-foreground" title={hint}>
          &#9432;
        </span>
      )}
    </label>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ExtensionFormPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const canWrite = canWriteExtensions(me.role);

  const params = useParams({ strict: false }) as { extId?: string };
  const isEdit = !!params.extId && params.extId !== 'new';
  const extId = isEdit ? Number(params.extId) : null;

  const [form, setForm] = useState<ExtForm>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);

  const { data: existing, isPending: loadingExisting } = useQuery({
    queryKey: ['extension', extId],
    queryFn: () => apiFetch<ExtDetail>(`/extensions/${extId}`),
    enabled: isEdit && !!extId,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        number: existing.number ?? '',
        displayName: existing.displayName ?? '',
        extensionGroup: existing.extensionGroup ?? '',
        maxWaitingTime: existing.maxWaitingTime ?? 60,
        sipPassword: existing.sipPassword ?? '',
        enableWebAccess: existing.enableWebAccess ?? false,
        callerId: existing.callerId ?? '',
        passCallerIdFromOrigin: existing.passCallerIdFromOrigin ?? false,
        callingPlan: existing.callingPlan ?? '',
        waitingMusicGroup: existing.waitingMusicGroup ?? 'pabx_default',
        callPickup: existing.callPickup ?? 'same_group',
        costCenter: existing.costCenter ?? '',
        enableBlf: existing.enableBlf ?? false,
        enableTimer: existing.enableTimer ?? false,
        recordCall: existing.recordCall ?? false,
        blockExtension: existing.blockExtension ?? false,
        areaCode: existing.areaCode ?? '',
        callAnalysis: existing.callAnalysis ?? 'disabled',
        enableDualAuth: existing.enableDualAuth ?? false,
        enableMailbox: existing.enableMailbox ?? false,
        forwardAllCalls: existing.forwardAllCalls ?? '',
        forwardOffline: existing.forwardOffline ?? '',
        forwardBusy: existing.forwardBusy ?? '',
      });
    }
  }, [existing]);

  function patch<K extends keyof ExtForm>(key: K, value: ExtForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const analysisInfo = useMemo(() => {
    const link = t('extensions.form.analysis.pricingLink');
    const key = form.callAnalysis;
    const text = t(`extensions.form.analysis.${key}.long`);
    return { text, link: key === 'disabled' ? '' : link };
  }, [form.callAnalysis, t]);

  const create = useMutation({
    mutationFn: () =>
      apiFetch<ExtDetail>('/extensions', {
        method: 'POST',
        body: JSON.stringify({ organizationId: orgId, ...form }),
      }),
    onSuccess: async () => {
      toast.success(t('extensions.created'));
      await qc.invalidateQueries({ queryKey: qk.extensions(orgId!) });
      await qc.invalidateQueries({ queryKey: ['organizations'] });
      void navigate({ to: '/extensions' });
    },
    onError: (e: Error & { body?: { error?: string } }) => {
      const code = e.body?.error;
      toast.error(code === 'duplicate_number' ? t('extensions.duplicate') : t('extensions.failed'));
    },
  });

  const save = useMutation({
    mutationFn: () =>
      apiFetch<ExtDetail>(`/extensions/${extId}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      }),
    onSuccess: async () => {
      toast.success(t('extensions.updated'));
      await qc.invalidateQueries({ queryKey: qk.extensions(orgId!) });
      await qc.invalidateQueries({ queryKey: ['extension', extId] });
      void navigate({ to: '/extensions' });
    },
    onError: (e: Error & { body?: { error?: string } }) => {
      const code = e.body?.error;
      toast.error(code === 'duplicate_number' ? t('extensions.duplicate') : t('extensions.failed'));
    },
  });

  const isPending = create.isPending || save.isPending;

  function handleSubmit() {
    if (!form.number.trim() || !form.displayName.trim()) {
      toast.error(t('extensions.form.validationRequired'));
      return;
    }
    if (isEdit) {
      save.mutate();
    } else {
      create.mutate();
    }
  }

  if (isEdit && loadingExisting) {
    return (
      <div className="space-y-4 pb-24">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void navigate({ to: '/extensions' })}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          {t('extensions.title')}
        </button>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold text-foreground">
          {isEdit
            ? (existing?.displayName ?? existing?.number ?? t('extensions.form.editFallback', { id: String(extId) }))
            : t('extensions.new')}
        </span>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('extensions.form.sectionBasic')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>{t('extensions.form.fieldNumber')}</FieldLabel>
              {isEdit ? (
                <Input
                  value={form.number}
                  onChange={(e) => patch('number', e.target.value)}
                  disabled={!canWrite}
                  className="font-mono"
                  placeholder={t('extensions.form.placeholderNumber')}
                />
              ) : (
                <select
                  value={form.number}
                  onChange={(e) => patch('number', e.target.value)}
                  disabled={!canWrite}
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{t('extensions.form.selectNumber')}</option>
                  {['1001', '1002', '1003', '1004', '1005'].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              )}
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-amber-500">
                  <path d="M12 9v4M12 17h.01" />
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                </svg>
                {t('extensions.form.availableHint')}
              </p>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>{t('extensions.form.fieldName')}</FieldLabel>
              <Input
                value={form.displayName}
                onChange={(e) => patch('displayName', e.target.value)}
                disabled={!canWrite}
                placeholder={t('extensions.form.placeholderName')}
              />
            </div>
          </div>

          <SelectField
            label={t('extensions.form.fieldGroup')}
            value={form.extensionGroup}
            onChange={(v) => patch('extensionGroup', v)}
            disabled={!canWrite}
          >
            <option value="">{t('extensions.form.optNone')}</option>
            <option value="sales">{t('extensions.form.optSales')}</option>
            <option value="support">{t('extensions.form.optSupport')}</option>
            <option value="management">{t('extensions.form.optManagement')}</option>
          </SelectField>

          <div className="space-y-1.5">
            <FieldLabel hint={t('extensions.form.hintMaxWait')}>{t('extensions.form.fieldMaxWait')}</FieldLabel>
            <Input
              type="number"
              min={0}
              max={300}
              value={form.maxWaitingTime}
              onChange={(e) => patch('maxWaitingTime', Number(e.target.value))}
              disabled={!canWrite}
              className="w-40"
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>{t('extensions.form.fieldSipPassword')}</FieldLabel>
            <div className="relative flex items-center">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={form.sipPassword}
                onChange={(e) => patch('sipPassword', e.target.value)}
                disabled={!canWrite}
                className="pr-10"
                placeholder={t('extensions.form.placeholderSipSecret')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? t('extensions.form.hidePassword') : t('extensions.form.showPassword')}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <Toggle
            checked={form.enableWebAccess}
            onChange={(v) => patch('enableWebAccess', v)}
            label={t('extensions.form.labelWebAccess')}
            hint={t('extensions.form.hintWebAccess')}
            disabled={!canWrite}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('extensions.form.sectionIdentification')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <SelectField
              label={t('extensions.form.fieldCallerId')}
              value={form.callerId}
              onChange={(v) => patch('callerId', v)}
              hint={t('extensions.form.hintCallerId')}
              disabled={!canWrite}
            >
              <option value="">{t('extensions.form.optDefault')}</option>
              <option value="ddi_1">{t('extensions.form.optDdi1')}</option>
              <option value="ddi_55">{t('extensions.form.optDdi55')}</option>
              <option value="internal">{t('extensions.form.optInternalOnly')}</option>
            </SelectField>

            <div className="flex items-end pb-1">
              <Toggle
                checked={form.passCallerIdFromOrigin}
                onChange={(v) => patch('passCallerIdFromOrigin', v)}
                label={t('extensions.form.passCallerId')}
                hint={t('extensions.form.hintPassCallerId')}
                disabled={!canWrite}
              />
            </div>

            <SelectField
              label={t('extensions.form.fieldCallingPlan')}
              value={form.callingPlan}
              onChange={(v) => patch('callingPlan', v)}
              disabled={!canWrite}
            >
              <option value="">{t('extensions.form.optDefault')}</option>
              <option value="national">{t('extensions.form.optNational')}</option>
              <option value="international">{t('extensions.form.optInternational')}</option>
              <option value="local_only">{t('extensions.form.optLocalOnly')}</option>
            </SelectField>

            <SelectField
              label={t('extensions.form.fieldWaitingMusic')}
              value={form.waitingMusicGroup}
              onChange={(v) => patch('waitingMusicGroup', v)}
              disabled={!canWrite}
            >
              <option value="pabx_default">{t('extensions.form.optPabxDefault')}</option>
              <option value="jazz">{t('extensions.form.optJazz')}</option>
              <option value="classical">{t('extensions.form.optClassical')}</option>
              <option value="none">{t('extensions.form.optSilence')}</option>
            </SelectField>

            <SelectField
              label={t('extensions.form.fieldCallPickup')}
              value={form.callPickup}
              onChange={(v) => patch('callPickup', v)}
              hint={t('extensions.form.hintCallPickup')}
              disabled={!canWrite}
            >
              <option value="same_group">{t('extensions.form.optPickupSame')}</option>
              <option value="any">{t('extensions.form.optPickupAny')}</option>
              <option value="disabled">{t('extensions.form.optPickupDisabled')}</option>
            </SelectField>

            <SelectField
              label={t('extensions.form.fieldCostCenter')}
              value={form.costCenter}
              onChange={(v) => patch('costCenter', v)}
              disabled={!canWrite}
            >
              <option value="">{t('extensions.form.optNone')}</option>
              <option value="cc_sales">{t('extensions.form.optCcSales')}</option>
              <option value="cc_support">{t('extensions.form.optCcSupport')}</option>
              <option value="cc_ops">{t('extensions.form.optCcOps')}</option>
            </SelectField>

            <div className="flex items-center">
              <Toggle
                checked={form.enableBlf}
                onChange={(v) => patch('enableBlf', v)}
                label={t('extensions.form.enableBlf')}
                hint={t('extensions.form.hintBlf')}
                disabled={!canWrite}
              />
            </div>

            <div className="flex items-center">
              <Toggle
                checked={form.enableTimer}
                onChange={(v) => patch('enableTimer', v)}
                label={t('extensions.form.enableTimer')}
                hint={t('extensions.form.hintTimer')}
                disabled={!canWrite}
              />
            </div>

            <div className="col-span-1 flex items-center sm:col-span-2">
              <Toggle checked={form.recordCall} onChange={(v) => patch('recordCall', v)} label={t('extensions.form.recordCall')} disabled={!canWrite} />
            </div>

            <div className="col-span-1 flex items-center sm:col-span-2">
              <Toggle
                checked={form.blockExtension}
                onChange={(v) => patch('blockExtension', v)}
                label={t('extensions.form.blockExtension')}
                disabled={!canWrite}
              />
            </div>

            <SelectField
              label={t('extensions.form.fieldAreaCode')}
              value={form.areaCode}
              onChange={(v) => patch('areaCode', v)}
              disabled={!canWrite}
            >
              <option value="">{t('extensions.form.optNone')}</option>
              <option value="11">{t('extensions.form.optArea11')}</option>
              <option value="21">{t('extensions.form.optArea21')}</option>
              <option value="31">{t('extensions.form.optArea31')}</option>
              <option value="41">{t('extensions.form.optArea41')}</option>
              <option value="51">{t('extensions.form.optArea51')}</option>
            </SelectField>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('extensions.form.sectionCallAnalysis')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('extensions.form.sectionCallAnalysisLead')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ANALYSIS_ORDER.map((value) => (
              <button
                key={value}
                type="button"
                disabled={!canWrite}
                onClick={() => patch('callAnalysis', value)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  form.callAnalysis === value
                    ? 'border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
                    : 'border-border bg-card text-muted-foreground hover:border-teal-300 hover:text-foreground',
                  !canWrite && 'cursor-not-allowed opacity-60',
                )}
              >
                <span
                  className={cn(
                    'transition-colors',
                    form.callAnalysis === value ? 'text-teal-600 dark:text-teal-400' : 'text-muted-foreground',
                  )}
                >
                  {ANALYSIS_ICONS[value]}
                </span>
                <span className="text-xs font-semibold leading-tight">{t(`extensions.form.analysis.${value}.title`)}</span>
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <p>{analysisInfo.text}</p>
            {analysisInfo.link ? (
              <button type="button" className="mt-1 text-xs font-medium text-teal-600 underline hover:text-teal-500">
                {analysisInfo.link}
              </button>
            ) : null}
          </div>

          {form.callAnalysis !== 'disabled' && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 h-4 w-4 flex-shrink-0">
                <path d="M12 9v4M12 17h.01" />
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
              <span>{t('extensions.form.noteRecorded')}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('extensions.form.sectionSafety')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Toggle
            checked={form.enableDualAuth}
            onChange={(v) => patch('enableDualAuth', v)}
            label={t('extensions.form.dualAuth')}
            hint={t('extensions.form.hintDualAuth')}
            disabled={!canWrite}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('extensions.form.sectionMailbox')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Toggle
            checked={form.enableMailbox}
            onChange={(v) => patch('enableMailbox', v)}
            label={t('extensions.form.enableMailbox')}
            disabled={!canWrite}
          />
          {form.enableMailbox && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 h-4 w-4 flex-shrink-0">
                <path d="M12 9v4M12 17h.01" />
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
              <span>{t('extensions.form.mailboxWarn')}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('extensions.form.sectionForwarding')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 h-4 w-4 flex-shrink-0">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
            <span>{t('extensions.form.queueForwardWarn')}</span>
          </div>

          <div className="space-y-4">
            <SelectField
              label={t('extensions.form.forwardAll')}
              value={form.forwardAllCalls}
              onChange={(v) => patch('forwardAllCalls', v)}
              disabled={!canWrite}
            >
              <option value="">{t('extensions.form.optNoForward')}</option>
              <option value="voicemail">{t('extensions.form.optVoicemail')}</option>
              <option value="1000">{t('extensions.form.optExt1000')}</option>
              <option value="queue_sales">{t('extensions.form.optQueueSales')}</option>
              <option value="queue_support">{t('extensions.form.optQueueSupport')}</option>
            </SelectField>

            <SelectField
              label={t('extensions.form.forwardOffline')}
              value={form.forwardOffline}
              onChange={(v) => patch('forwardOffline', v)}
              disabled={!canWrite}
            >
              <option value="">{t('extensions.form.optNoForward')}</option>
              <option value="voicemail">{t('extensions.form.optVoicemail')}</option>
              <option value="1000">{t('extensions.form.optExt1000')}</option>
              <option value="queue_sales">{t('extensions.form.optQueueSales')}</option>
              <option value="queue_support">{t('extensions.form.optQueueSupport')}</option>
            </SelectField>

            <SelectField
              label={t('extensions.form.forwardBusy')}
              value={form.forwardBusy}
              onChange={(v) => patch('forwardBusy', v)}
              disabled={!canWrite}
            >
              <option value="">{t('extensions.form.optNoForward')}</option>
              <option value="voicemail">{t('extensions.form.optVoicemail')}</option>
              <option value="1000">{t('extensions.form.optExt1000')}</option>
              <option value="queue_sales">{t('extensions.form.optQueueSales')}</option>
              <option value="queue_support">{t('extensions.form.optQueueSupport')}</option>
            </SelectField>
          </div>
        </CardContent>
      </Card>

      {isEdit && orgId && extId != null && (
        <SoftphoneProvisionPanel orgId={orgId} extensionId={extId} />
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-screen-xl items-center justify-end gap-3 px-6 py-3">
          <Button type="button" variant="outline" onClick={() => void navigate({ to: '/extensions' })} disabled={isPending}>
            {t('extensions.form.btnReturn')}
          </Button>
          {canWrite && (
            <Button
              type="button"
              className="min-w-[100px]"
              onClick={handleSubmit}
              disabled={isPending || !form.number.trim() || !form.displayName.trim()}
            >
              {isPending ? (isEdit ? t('extensions.form.saving') : t('extensions.form.inserting')) : isEdit ? t('extensions.form.btnSave') : t('extensions.form.btnInsert')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
