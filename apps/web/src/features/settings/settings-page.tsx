import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { toast } from 'sonner';
import { apiFetch } from '@/shared/api/client';
import { qk } from '@/shared/api/query-keys';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { canManageOrgAppearance, canManageOrgDomain, canManageSpaces } from '@/shared/lib/can';
import { SpacesManager } from '@/features/spaces/spaces-manager';
import { applyAppearanceCssVars } from '@/shared/lib/branding-css';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';

const appearanceSchema = z.object({
  primary: z.string().optional(),
  loginTagline: z.string().optional(),
  logoUrl: z.string().optional(),
});

type AppearanceForm = z.infer<typeof appearanceSchema>;

export function SettingsPage() {
  const { t } = useTranslation();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const [domainDraft, setDomainDraft] = useState('');

  const org = useQuery({
    queryKey: qk.organization(orgId ?? 0),
    queryFn: () =>
      apiFetch<{
        id: number;
        name: string;
        tradeName: string | null;
        appearance: Record<string, unknown>;
        customDomain: string | null;
        customDomainVerifiedAt: string | null;
        issabelBaseUrl?: string | null;
      }>(`/organizations/${orgId}`),
    enabled: !!orgId,
  });

  useEffect(() => {
    setDomainDraft(org.data?.customDomain ?? '');
  }, [org.data?.customDomain]);

  const appearanceForm = useForm<AppearanceForm>({
    resolver: zodResolver(appearanceSchema),
    defaultValues: { primary: '', loginTagline: '', logoUrl: '' },
  });

  useEffect(() => {
    const a = org.data?.appearance ?? {};
    appearanceForm.reset({
      primary: typeof a.primary === 'string' ? a.primary : '',
      loginTagline: typeof a.loginTagline === 'string' ? a.loginTagline : '',
      logoUrl: typeof a.logoUrl === 'string' ? a.logoUrl : '',
    });
  }, [org.data, appearanceForm]);

  const watched = appearanceForm.watch();
  const previewVars = useMemo(() => {
    const next: Record<string, unknown> = {};
    if (watched.primary) next.primary = watched.primary;
    return next;
  }, [watched.primary]);

  useEffect(() => {
    const el = document.getElementById('settings-brand-preview');
    if (!el) return;
    applyAppearanceCssVars(previewVars, el);
    return () => {
      el.removeAttribute('style');
    };
  }, [previewVars]);

  const patchAppearance = useMutation({
    mutationFn: async (appearance: Record<string, unknown>) => {
      if (!orgId) throw new Error('no_org');
      return apiFetch(`/organizations/${orgId}/appearance`, { method: 'PATCH', body: JSON.stringify({ appearance }) });
    },
    onSuccess: async () => {
      toast.success(t('settings.saved'));
      await qc.invalidateQueries({ queryKey: qk.organization(orgId!) });
    },
    onError: () => toast.error(t('settings.saveFailed')),
  });

  const patchDomain = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('no_org');
      return apiFetch<{ ok: boolean }>(`/organizations/${orgId}/custom-domain`, {
        method: 'PATCH',
        body: JSON.stringify({ customDomain: domainDraft.trim() ? domainDraft.trim().toLowerCase() : null }),
      });
    },
    onSuccess: async () => {
      toast.success(t('settings.domainSaved'));
      await qc.invalidateQueries({ queryKey: qk.organization(orgId!) });
    },
    onError: () => toast.error(t('settings.domainFailed')),
  });

  const verifyDomain = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('no_org');
      return apiFetch(`/organizations/${orgId}/custom-domain/verify`, { method: 'POST' });
    },
    onSuccess: async () => {
      toast.success(t('settings.domainVerified'));
      await qc.invalidateQueries({ queryKey: qk.organization(orgId!) });
    },
    onError: () => toast.error(t('settings.domainVerifyFailed')),
  });

  if (!orgId) {
    return <p className="text-sm text-muted-foreground">{t('settings.pickOrg')}</p>;
  }

  const canAppearance = canManageOrgAppearance(me.role);
  const canDomain = canManageOrgDomain(me.role);
  const canSpaces = canManageSpaces(me.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.branding')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={appearanceForm.handleSubmit((v) => {
                if (!canAppearance) return;
                const merged: Record<string, unknown> = { ...(org.data?.appearance ?? {}) };
                merged.primary = v.primary;
                merged.loginTagline = v.loginTagline;
                merged.logoUrl = v.logoUrl?.trim() ? v.logoUrl.trim() : null;
                patchAppearance.mutate(merged);
              })}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('settings.primary')}</label>
                <Input {...appearanceForm.register('primary')} disabled={!canAppearance} placeholder="173 58% 39%" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('settings.tagline')}</label>
                <Input {...appearanceForm.register('loginTagline')} disabled={!canAppearance} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('settings.logoUrl')}</label>
                <Input {...appearanceForm.register('logoUrl')} disabled={!canAppearance} placeholder="https://…" />
                <p className="text-xs text-muted-foreground">{t('settings.logoHint')}</p>
              </div>
              <Button type="submit" disabled={!canAppearance || patchAppearance.isPending}>
                {t('actions.save')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.preview')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              id="settings-brand-preview"
              className="rounded-lg border border-border bg-background p-6 text-foreground shadow-sm"
            >
              {typeof watched.logoUrl === 'string' && /^https?:\/\//i.test(watched.logoUrl.trim()) ? (
                <img
                  src={watched.logoUrl.trim()}
                  alt=""
                  className="mb-3 h-12 w-auto max-w-full object-contain"
                />
              ) : null}
              <p className="text-sm font-medium text-primary">{org.data?.tradeName ?? org.data?.name}</p>
              <p className="mt-2 text-sm text-muted-foreground">{watched.loginTagline || t('settings.previewBody')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <SpacesManager orgId={orgId} canEdit={canSpaces} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.domain')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('settings.domainHint')}</p>
          <Input value={domainDraft} onChange={(e) => setDomainDraft(e.target.value)} disabled={!canDomain} placeholder="voice.cliente.com" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!canDomain || patchDomain.isPending} onClick={() => patchDomain.mutate()}>
              {t('settings.domainSave')}
            </Button>
            <Button type="button" disabled={!canDomain || verifyDomain.isPending} onClick={() => verifyDomain.mutate()}>
              {t('settings.domainVerify')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {org.data?.customDomainVerifiedAt ? t('settings.domainStatusVerified') : t('settings.domainStatusPending')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
