import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useRouteContext } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ExternalLink, Sparkles } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import type { BusinessSchedule, DtmfActionRow, DtmfAction } from '@/shared/lib/routing-types';
import { defaultDtmfActions } from '@/shared/lib/routing-types';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { Link } from '@tanstack/react-router';
import { BusinessScheduleEditor } from '@/features/routing/business-schedule-editor';
import { DestinationPicker } from '@/features/routing/destination-picker';
import { UraVoiceTestPanel } from './ura-voice-test-panel';

type UraDetail = {
  id: number;
  name: string;
  extensionNumber: string;
  initialAudioId: number | null;
  repetitions: number;
  allowDirectDial: boolean;
  scheduleEnabled: boolean;
  schedule?: BusinessSchedule;
  scheduleJson?: string;
  dtmfActions?: DtmfActionRow[];
  dtmfActionsJson?: string;
  active: boolean;
  uraMode?: 'classic' | 'ai';
  aiInstructions?: string | null;
  elevenlabsAgentId?: string | null;
  portalAiAgentId?: number | null;
  useAiInstructions?: boolean;
  useJson?: boolean;
  useInitialMessage?: boolean;
  initialMessage?: string | null;
  googleDocsUrl?: string | null;
  useGoogleDocs?: boolean;
};

type AudioFile = { id: number; name: string };

type UraForm = {
  name: string;
  extensionNumber: string;
  initialAudioId: number | '';
  repetitions: number;
  allowDirectDial: boolean;
  scheduleEnabled: boolean;
  schedule: BusinessSchedule;
  dtmfActions: DtmfActionRow[];
  active: boolean;
  uraMode: 'classic' | 'ai';
  aiInstructions: string;
  elevenlabsAgentId: string;
  portalAiAgentId: number | '';
  useAiInstructions: boolean;
  useJson: boolean;
  useInitialMessage: boolean;
  initialMessage: string;
  googleDocsUrl: string;
  useGoogleDocs: boolean;
  applyToIssabel: boolean;
};

const EMPTY_FORM: UraForm = {
  name: '',
  extensionNumber: '',
  initialAudioId: '',
  repetitions: 2,
  allowDirectDial: false,
  scheduleEnabled: false,
  schedule: {},
  dtmfActions: defaultDtmfActions(),
  active: true,
  uraMode: 'classic',
  aiInstructions: '',
  elevenlabsAgentId: '',
  portalAiAgentId: '',
  useAiInstructions: false,
  useJson: false,
  useInitialMessage: false,
  initialMessage: '',
  googleDocsUrl: '',
  useGoogleDocs: false,
  applyToIssabel: false,
};

const TABS = ['general', 'ai', 'schedule', 'dtmf'] as const;
type Tab = (typeof TABS)[number];

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

export function UraFormPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);

  const params = useParams({ strict: false }) as { uraId?: string };
  const isEdit = !!params.uraId && params.uraId !== 'new';
  const uraId = isEdit ? Number(params.uraId) : null;

  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [form, setForm] = useState<UraForm>(EMPTY_FORM);

  const { data: existing, isPending: loadingExisting } = useQuery({
    queryKey: qk.ura(uraId ?? 0),
    queryFn: () => apiFetch<UraDetail>(`/uras/${uraId}`),
    enabled: isEdit && !!uraId,
  });

  const audioFiles = useQuery({
    queryKey: ['audio-files', orgId ?? 0],
    queryFn: () => apiFetch<{ items: AudioFile[] }>(`/audio-files?organizationId=${orgId}`),
    enabled: !!orgId,
  });

  const issabelAgents = useQuery({
    queryKey: ['issabel-ia-agents', orgId ?? 0],
    queryFn: () =>
      apiFetch<{ configured: boolean; items: Array<{ elevenlabsAgentId: string; name: string }> }>(
        `/organizations/${orgId}/issabel/ia-agents`,
      ),
    enabled: !!orgId,
  });

  const portalAgents = useQuery({
    queryKey: ['ai-agents', orgId ?? 0],
    queryFn: () => apiFetch<{ items: Array<{ id: number; name: string; prompt: string }> }>(
      `/ai-agents?organizationId=${orgId}`,
    ),
    enabled: !!orgId,
  });

  useEffect(() => {
    if (existing) {
      let schedule: BusinessSchedule = existing.schedule ?? {};
      let dtmfActions: DtmfActionRow[] = existing.dtmfActions ?? defaultDtmfActions();
      if (!existing.schedule && existing.scheduleJson) {
        try {
          schedule = JSON.parse(existing.scheduleJson) as BusinessSchedule;
        } catch {
          schedule = {};
        }
      }
      if (!existing.dtmfActions?.length && existing.dtmfActionsJson) {
        try {
          const parsed = JSON.parse(existing.dtmfActionsJson) as DtmfActionRow[];
          if (Array.isArray(parsed) && parsed.length > 0) dtmfActions = parsed;
        } catch {
          dtmfActions = defaultDtmfActions();
        }
      }
      setForm({
        name: existing.name ?? '',
        extensionNumber: existing.extensionNumber ?? '',
        initialAudioId: existing.initialAudioId ?? '',
        repetitions: existing.repetitions ?? 2,
        allowDirectDial: existing.allowDirectDial ?? false,
        scheduleEnabled: existing.scheduleEnabled ?? false,
        schedule,
        dtmfActions,
        active: existing.active ?? true,
        uraMode: existing.uraMode ?? 'classic',
        aiInstructions: existing.aiInstructions ?? '',
        elevenlabsAgentId: existing.elevenlabsAgentId ?? '',
        portalAiAgentId: existing.portalAiAgentId ?? '',
        useAiInstructions: existing.useAiInstructions ?? false,
        useJson: existing.useJson ?? false,
        useInitialMessage: existing.useInitialMessage ?? false,
        initialMessage: existing.initialMessage ?? '',
        googleDocsUrl: existing.googleDocsUrl ?? '',
        useGoogleDocs: existing.useGoogleDocs ?? false,
        applyToIssabel: false,
      });
    }
  }, [existing]);

  function patch<K extends keyof UraForm>(key: K, value: UraForm[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'uraMode' && value === 'ai') {
        next.useAiInstructions = true;
      }
      return next;
    });
  }

  function patchDtmf(index: number, updates: Partial<DtmfActionRow>) {
    setForm((prev) => {
      const next = [...prev.dtmfActions];
      next[index] = { ...next[index], ...updates };
      return { ...prev, dtmfActions: next };
    });
  }

  const buildPayload = () => ({
    organizationId: orgId,
    name: form.name.trim(),
    extensionNumber: form.extensionNumber.trim(),
    initialAudioId: form.initialAudioId === '' ? null : form.initialAudioId,
    repetitions: form.repetitions,
    allowDirectDial: form.allowDirectDial,
    scheduleEnabled: form.scheduleEnabled,
    schedule: form.schedule,
    dtmfActions: form.dtmfActions,
    uraMode: form.uraMode,
    aiInstructions: form.aiInstructions.trim(),
    elevenlabsAgentId: form.elevenlabsAgentId.trim() || null,
    portalAiAgentId: form.portalAiAgentId === '' ? null : form.portalAiAgentId,
    useAiInstructions: form.useAiInstructions || form.uraMode === 'ai',
    useJson: form.useJson,
    initialMessage: form.initialMessage.trim() || null,
    useInitialMessage: form.useInitialMessage,
    googleDocsUrl: form.googleDocsUrl.trim() || null,
    useGoogleDocs: form.useGoogleDocs,
    applyToIssabel: form.applyToIssabel,
    active: form.active,
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch<{ applyJobId?: number }>('/uras', { method: 'POST', body: JSON.stringify(buildPayload()) }),
    onSuccess: async (res: { applyJobId?: number }) => {
      toast.success(
        res?.applyJobId ? t('routing.ura.applyQueued') : t('routing.ura.created'),
      );
      await qc.invalidateQueries({ queryKey: qk.uras(orgId ?? 0) });
      void navigate({ to: '/pbx/features/uras' });
    },
    onError: () => toast.error(t('ura.failed')),
  });

  const save = useMutation({
    mutationFn: () =>
      apiFetch<{ applyJobId?: number }>(`/uras/${uraId}`, {
        method: 'PATCH',
        body: JSON.stringify(buildPayload()),
      }),
    onSuccess: async (res: { applyJobId?: number }) => {
      toast.success(
        res?.applyJobId ? t('routing.ura.applyQueued') : t('routing.ura.updated'),
      );
      await qc.invalidateQueries({ queryKey: qk.uras(orgId ?? 0) });
      await qc.invalidateQueries({ queryKey: qk.ura(uraId ?? 0) });
      void navigate({ to: '/pbx/features/uras' });
    },
    onError: () => toast.error(t('ura.failed')),
  });

  const isPending = create.isPending || save.isPending;

  function handleSubmit() {
    if (!form.name.trim() || !form.extensionNumber.trim()) {
      toast.error(t('ura.validationRequired'));
      return;
    }
    if (isEdit) save.mutate();
    else create.mutate();
  }

  if (isEdit && loadingExisting) {
    return (
      <div className="space-y-4 pb-24">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void navigate({ to: '/pbx/features/uras' })}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            {t('pbx.uras')}
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold text-foreground">
            {isEdit ? (existing?.name ?? t('ura.editFallback')) : t('ura.new')}
          </span>
        </div>
        {isEdit && uraId && (
          <Button variant="outline" size="sm" asChild className="gap-2">
            <Link to="/pbx/features/uras/$uraId/flow" params={{ uraId: String(uraId) }}>
              <ExternalLink className="h-4 w-4" />
              {t('ura.openFlow')}
            </Link>
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/60 p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'general'
              ? t('routing.ura.tabGeneral')
              : tab === 'ai'
                ? t('routing.ura.tabAi')
                : tab === 'schedule'
                  ? t('routing.ura.tabSchedule')
                  : t('routing.ura.tabDtmf')}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('ura.tab.general')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{t('ura.fieldName')}</label>
                <Input
                  value={form.name}
                  onChange={(e) => patch('name', e.target.value)}
                  placeholder={t('ura.namePlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{t('ura.fieldExtension')}</label>
                <Input
                  value={form.extensionNumber}
                  onChange={(e) => patch('extensionNumber', e.target.value)}
                  placeholder="2000"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{t('ura.fieldAudio')}</label>
                <select
                  value={form.initialAudioId === '' ? '' : String(form.initialAudioId)}
                  onChange={(e) => patch('initialAudioId', e.target.value ? Number(e.target.value) : '')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">{t('ura.noAudio')}</option>
                  {(audioFiles.data?.items ?? []).map((af) => (
                    <option key={af.id} value={af.id}>{af.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{t('ura.fieldRepetitions')}</label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={form.repetitions}
                  onChange={(e) => patch('repetitions', Number(e.target.value))}
                  className="w-32"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <Toggle
                checked={form.allowDirectDial}
                onChange={(v) => patch('allowDirectDial', v)}
                label={t('ura.allowDirectDial')}
              />
              <Toggle
                checked={form.active}
                onChange={(v) => patch('active', v)}
                label={t('trunk.status.active')}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'ai' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-violet-500" />
              {t('routing.ura.tabAi')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={form.uraMode === 'classic'}
                  onChange={() => patch('uraMode', 'classic')}
                />
                {t('routing.ura.modeClassic')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={form.uraMode === 'ai'}
                  onChange={() => patch('uraMode', 'ai')}
                />
                {t('routing.ura.modeAi')}
              </label>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{t('routing.ura.elevenlabsAgent')}</label>
              <select
                value={form.elevenlabsAgentId}
                onChange={(e) => patch('elevenlabsAgentId', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">—</option>
                {(issabelAgents.data?.items ?? []).map((a) => (
                  <option key={a.elevenlabsAgentId} value={a.elevenlabsAgentId}>
                    {a.name}
                  </option>
                ))}
              </select>
              {issabelAgents.data && !issabelAgents.data.configured && (
                <p className="text-xs text-amber-600">{t('routing.ura.issabelAgentsEmpty')}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{t('routing.ura.portalAgent')}</label>
              <select
                value={form.portalAiAgentId === '' ? '' : String(form.portalAiAgentId)}
                onChange={(e) => patch('portalAiAgentId', e.target.value ? Number(e.target.value) : '')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">—</option>
                {(portalAgents.data?.items ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{t('routing.ura.aiInstructions')}</label>
              <textarea
                value={form.aiInstructions}
                onChange={(e) => patch('aiInstructions', e.target.value)}
                rows={6}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <Toggle
              checked={form.useInitialMessage}
              onChange={(v) => patch('useInitialMessage', v)}
              label={t('routing.ura.useInitialMessage')}
            />
            {form.useInitialMessage && (
              <textarea
                value={form.initialMessage}
                onChange={(e) => patch('initialMessage', e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={t('routing.ura.initialMessage')}
              />
            )}
            <Toggle
              checked={form.useGoogleDocs}
              onChange={(v) => patch('useGoogleDocs', v)}
              label={t('routing.ura.useGoogleDocs')}
            />
            {form.useGoogleDocs && (
              <Input
                value={form.googleDocsUrl}
                onChange={(e) => patch('googleDocsUrl', e.target.value)}
                placeholder="https://docs.google.com/..."
              />
            )}
            <Toggle
              checked={form.useJson}
              onChange={(v) => patch('useJson', v)}
              label={t('routing.ura.useJson')}
            />
            {form.uraMode === 'ai' && orgId && (
              <UraVoiceTestPanel
                orgId={orgId}
                extensionNumber={form.extensionNumber}
                initialMessage={form.initialMessage}
                aiInstructions={form.aiInstructions}
                useInitialMessage={form.useInitialMessage}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && orgId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('ura.tab.schedule')}</CardTitle>
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

      {/* DTMF Tab */}
      {activeTab === 'dtmf' && orgId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('ura.tab.dtmf')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="p-3 w-16">{t('ura.dtmfDigit')}</th>
                  <th className="p-3">{t('ura.dtmfAction')}</th>
                </tr>
              </thead>
              <tbody>
                {form.dtmfActions.map((row, idx) => (
                  <tr key={row.digit} className="border-b border-border/70">
                    <td className="p-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-mono text-sm font-bold">
                        {row.digit}
                      </span>
                    </td>
                    <td className="p-3">
                      <DestinationPicker
                        orgId={orgId}
                        routeType="none"
                        destinationId={row.destinationId ?? ''}
                        onRouteTypeChange={() => {}}
                        onDestinationChange={(v) => patchDtmf(idx, { destinationId: v === '' ? null : (v as number) })}
                        actionMode
                        action={row.action as DtmfAction}
                        onActionChange={(v) => patchDtmf(idx, { action: v, destinationId: null })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.applyToIssabel}
              onChange={(e) => patch('applyToIssabel', e.target.checked)}
            />
            {t('routing.ura.applyIssabel')}
          </label>
          <div className="flex gap-3">
          {isEdit && uraId && (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={async () => {
                try {
                  const r = await apiFetch<{ jobId?: number }>(`/uras/${uraId}/apply-issabel`, {
                    method: 'POST',
                  });
                  toast.success(t('routing.ura.applyQueued'));
                  void r;
                } catch {
                  toast.error(t('routing.ura.failed'));
                }
              }}
            >
              {t('routing.ura.applyIssabelBtn')}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => void navigate({ to: '/pbx/features/uras' })} disabled={isPending}>
            {t('extensions.form.btnReturn')}
          </Button>
          <Button type="button" className="min-w-[100px]" onClick={handleSubmit} disabled={isPending || !form.name.trim() || !form.extensionNumber.trim()}>
            {isPending
              ? isEdit ? t('extensions.form.saving') : t('extensions.form.inserting')
              : isEdit ? t('extensions.form.btnSave') : t('extensions.form.btnInsert')}
          </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
