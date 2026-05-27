import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useRouteContext } from '@tanstack/react-router';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/shared/api/client';
import { useActiveOrganizationId } from '@/shared/lib/org-context';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';

type Tariff = { region: string; fixed?: number; mobile?: number; international?: number };
type TrunkDetail = {
  id: number;
  name: string;
  type: string;
  host: string | null;
  username: string | null;
  password: string | null;
  status: string;
  cutDigits: string | null;
  insertDigits: string | null;
  dynamicHost: boolean;
  useDefaultCodecs: boolean;
  codecs: string[];
  forwardRaw: boolean;
  registerStatus: string | null;
  tariffs: Tariff[];
  description: string | null;
};

const CODECS = ['ulaw', 'alaw', 'g729', 'gsm'];

export function TrunkFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { me } = useRouteContext({ from: '/_shell' });
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId(me);
  const params = useParams({ strict: false }) as { trunkId?: string };
  const trunkId = params.trunkId && params.trunkId !== 'new' ? Number(params.trunkId) : null;
  const isNew = !trunkId;

  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [cutDigits, setCutDigits] = useState('');
  const [insertDigits, setInsertDigits] = useState('');
  const [dynamicHost, setDynamicHost] = useState(false);
  const [useDefaultCodecs, setUseDefaultCodecs] = useState(true);
  const [selectedCodecs, setSelectedCodecs] = useState<string[]>(['ulaw', 'alaw']);
  const [forwardRaw, setForwardRaw] = useState(false);
  const [tariffs, setTariffs] = useState<Tariff[]>([{ region: 'Brasil', fixed: 0.05, mobile: 0.12, international: 0.35 }]);

  const detail = useQuery({
    queryKey: ['trunk', trunkId ?? 0],
    queryFn: () => apiFetch<TrunkDetail>(`/trunks/${trunkId}`),
    enabled: !!trunkId,
  });

  useEffect(() => {
    const tr = detail.data;
    if (!tr) return;
    setName(tr.name);
    setHost(tr.host ?? '');
    setUsername(tr.username ?? '');
    setStatus(tr.status as 'active' | 'inactive');
    setCutDigits(tr.cutDigits ?? '');
    setInsertDigits(tr.insertDigits ?? '');
    setDynamicHost(tr.dynamicHost);
    setUseDefaultCodecs(tr.useDefaultCodecs);
    setSelectedCodecs(tr.codecs?.length ? tr.codecs : ['ulaw']);
    setForwardRaw(tr.forwardRaw);
    setTariffs(tr.tariffs?.length ? tr.tariffs : [{ region: 'Brasil' }]);
  }, [detail.data]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        organizationId: orgId,
        name: name.trim(),
        host: host.trim() || null,
        username: username.trim() || null,
        password: password.trim() || null,
        status,
        cutDigits: cutDigits.trim() || null,
        insertDigits: insertDigits.trim() || null,
        dynamicHost,
        useDefaultCodecs,
        codecs: selectedCodecs,
        forwardRaw,
        tariffs,
        type: 'sip' as const,
      };
      if (isNew) {
        return apiFetch('/trunks', { method: 'POST', body: JSON.stringify(body) });
      }
      return apiFetch(`/trunks/${trunkId}`, { method: 'PATCH', body: JSON.stringify(body) });
    },
    onSuccess: async () => {
      toast.success(isNew ? t('trunk.created') : t('trunk.updated'));
      await qc.invalidateQueries({ queryKey: ['trunks', orgId] });
      void navigate({ to: '/pbx/termination/trunks' });
    },
    onError: () => toast.error(t('trunk.failed')),
  });

  const syncIssabel = useMutation({
    mutationFn: () => apiFetch<{ ok: boolean; detail?: string; mode?: string }>(`/trunks/${trunkId}/sync-issabel`, { method: 'POST' }),
    onSuccess: (r) => {
      if (r.ok) toast.success(`Issabel: ${r.mode ?? 'ok'}`);
      else toast.error(r.detail ?? 'Sync falhou');
    },
    onError: () => toast.error('Sync Issabel falhou'),
  });

  if (!orgId) return <p className="text-sm text-muted-foreground">{t('extensions.pickOrg')}</p>;
  if (!isNew && detail.isPending) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button type="button" onClick={() => void navigate({ to: '/pbx/termination/trunks' })} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {t('trunk.back')}
      </button>
      <div>
        <h1 className="text-2xl font-bold">{isNew ? t('trunk.new') : t('trunk.edit')}</h1>
        <p className="text-sm text-muted-foreground">{t('pbx.trunksBody')}</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium">{t('trunk.name')}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('trunk.host')}</label>
              <Input value={host} onChange={(e) => setHost(e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('trunk.statusLabel')}</label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}>
                <option value="active">{t('trunk.active')}</option>
                <option value="inactive">{t('trunk.inactive')}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('trunk.cutDigits')}</label>
              <Input value={cutDigits} onChange={(e) => setCutDigits(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('trunk.insertDigits')}</label>
              <Input value={insertDigits} onChange={(e) => setInsertDigits(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('trunk.username')}</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t('trunk.password')}</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={trunkId ? '••••••' : ''} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dynamicHost} onChange={(e) => setDynamicHost(e.target.checked)} />
            {t('trunk.dynamicHost')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={forwardRaw} onChange={(e) => setForwardRaw(e.target.checked)} />
            {t('trunk.forwardRaw')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useDefaultCodecs} onChange={(e) => setUseDefaultCodecs(e.target.checked)} />
            {t('trunk.defaultCodecs')}
          </label>
          {!useDefaultCodecs && (
            <div className="flex flex-wrap gap-2">
              {CODECS.map((c) => (
                <button key={c} type="button" onClick={() => setSelectedCodecs((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])}
                  className={cn('rounded px-2 py-1 text-xs font-medium', selectedCodecs.includes(c) ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{t('trunk.tariffs')}</p>
              <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setTariffs((p) => [...p, { region: '' }])}>
                <Plus className="h-3 w-3" />
                {t('trunk.addTariff')}
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-2">{t('trunk.region')}</th>
                  <th className="p-2">{t('trunk.fixed')}</th>
                  <th className="p-2">{t('trunk.mobile')}</th>
                  <th className="p-2">{t('trunk.intl')}</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {tariffs.map((row, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td className="p-2"><Input className="h-8" value={row.region} onChange={(e) => setTariffs((p) => p.map((r, j) => (j === i ? { ...r, region: e.target.value } : r)))} /></td>
                    <td className="p-2"><Input type="number" step="0.01" className="h-8 w-20" value={row.fixed ?? ''} onChange={(e) => setTariffs((p) => p.map((r, j) => (j === i ? { ...r, fixed: Number(e.target.value) } : r)))} /></td>
                    <td className="p-2"><Input type="number" step="0.01" className="h-8 w-20" value={row.mobile ?? ''} onChange={(e) => setTariffs((p) => p.map((r, j) => (j === i ? { ...r, mobile: Number(e.target.value) } : r)))} /></td>
                    <td className="p-2"><Input type="number" step="0.01" className="h-8 w-20" value={row.international ?? ''} onChange={(e) => setTariffs((p) => p.map((r, j) => (j === i ? { ...r, international: Number(e.target.value) } : r)))} /></td>
                    <td className="p-2">
                      <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => setTariffs((p) => p.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={save.isPending || !name.trim()} onClick={() => save.mutate()}>
              {t('actions.save')}
            </Button>
            {!isNew && trunkId && (
              <Button
                type="button"
                variant="outline"
                disabled={syncIssabel.isPending}
                onClick={() => syncIssabel.mutate()}
              >
                Sync Issabel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
