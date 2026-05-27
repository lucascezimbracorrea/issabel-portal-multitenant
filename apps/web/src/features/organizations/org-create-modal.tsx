import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Building2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/shared/api/client';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

type OrgCreatePayload = {
  name: string;
  tradeName?: string;
  orgKind: 'pabx' | 'dialer' | 'hospitality';
  issabelBaseUrl?: string;
  extensionsLimit?: number | null;
  channelsLimit?: number | null;
  diskQuotaGb?: number | null;
};

type Props = { onClose: () => void; onCreated?: () => void };

export function OrgCreateModal({ onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState<OrgCreatePayload>({ name: '', orgKind: 'pabx' });

  const create = useMutation({
    mutationFn: (body: OrgCreatePayload) => apiFetch('/organizations', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success(t('orgs.createSuccess'));
      void qc.invalidateQueries({ queryKey: ['organizations'] });
      onCreated?.();
      onClose();
    },
    onError: () => toast.error(t('orgs.createFailed')),
  });

  function field<K extends keyof OrgCreatePayload>(key: K, value: OrgCreatePayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t('orgs.createTitle')}</h2>
            <p className="text-xs text-muted-foreground">{t('orgs.createSubtitle')}</p>
          </div>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(form);
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-foreground">{t('orgs.fieldName')} *</label>
              <Input
                required
                placeholder="Empresa ABC"
                value={form.name}
                onChange={(e) => field('name', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">{t('orgs.fieldTradeName')}</label>
              <Input
                placeholder="ABC"
                value={form.tradeName ?? ''}
                onChange={(e) => field('tradeName', e.target.value || undefined)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">{t('orgs.fieldType')}</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.orgKind}
                onChange={(e) => field('orgKind', e.target.value as 'pabx' | 'dialer' | 'hospitality')}
              >
                <option value="pabx">PABX</option>
                <option value="dialer">Dialer</option>
                <option value="hospitality">Hotelaria</option>
              </select>
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium text-foreground">{t('orgs.fieldPbxUrl')}</label>
              <Input
                placeholder="https://pbx.empresa.com"
                value={form.issabelBaseUrl ?? ''}
                onChange={(e) => field('issabelBaseUrl', e.target.value || undefined)}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('orgs.quotasSection')}</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">{t('orgs.fieldExtLimit')}</label>
                <Input
                  type="number"
                  min={1}
                  placeholder="∞"
                  value={form.extensionsLimit ?? ''}
                  onChange={(e) => field('extensionsLimit', e.target.value ? Number(e.target.value) : null)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">{t('orgs.fieldChanLimit')}</label>
                <Input
                  type="number"
                  min={0}
                  placeholder="∞"
                  value={form.channelsLimit ?? ''}
                  onChange={(e) => field('channelsLimit', e.target.value ? Number(e.target.value) : null)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">{t('orgs.fieldDiskGb')}</label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  placeholder="∞"
                  value={form.diskQuotaGb ?? ''}
                  onChange={(e) => field('diskQuotaGb', e.target.value ? Number(e.target.value) : null)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={!form.name.trim() || create.isPending} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {create.isPending ? t('orgs.creating') : t('orgs.createBtn')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
