import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/shared/api/client';
import type { DtmfAction, RouteType } from '@/shared/lib/routing-types';
import { ROUTE_TYPES, DTMF_ACTIONS } from '@/shared/lib/routing-types';

type Props = {
  orgId: number;
  routeType: RouteType;
  destinationId: number | '';
  onRouteTypeChange: (v: RouteType) => void;
  onDestinationChange: (v: number | '') => void;
  allowNone?: boolean;
  actionMode?: boolean;
  action?: DtmfAction;
  onActionChange?: (v: DtmfAction) => void;
};

export function DestinationPicker({
  orgId,
  routeType,
  destinationId,
  onRouteTypeChange,
  onDestinationChange,
  allowNone = true,
  actionMode = false,
  action = 'none',
  onActionChange,
}: Props) {
  const { t } = useTranslation();
  const effectiveType = actionMode
    ? action === 'extension'
      ? 'extension'
      : action === 'queue'
        ? 'queue'
        : action === 'ura'
          ? 'ura'
          : 'none'
    : routeType;

  const uras = useQuery({
    queryKey: ['uras', orgId],
    queryFn: () => apiFetch<{ items: { id: number; name: string }[] }>(`/uras?organizationId=${orgId}`),
    enabled: !!orgId && effectiveType === 'ura',
  });
  const queues = useQuery({
    queryKey: ['queues', orgId],
    queryFn: () => apiFetch<{ items: { id: number; name: string }[] }>(`/queues?organizationId=${orgId}`),
    enabled: !!orgId && effectiveType === 'queue',
  });
  const extensions = useQuery({
    queryKey: ['extensions', orgId],
    queryFn: () =>
      apiFetch<{ items: { id: number; displayName: string; number: string }[] }>(
        `/extensions?organizationId=${orgId}`,
      ),
    enabled: !!orgId && effectiveType === 'extension',
  });
  const flows = useQuery({
    queryKey: ['callFlows', orgId],
    queryFn: () => apiFetch<{ items: { id: number; name: string }[] }>(`/call-flows?organizationId=${orgId}`),
    enabled: !!orgId && !actionMode && routeType === 'call_flow',
  });

  const types = actionMode ? DTMF_ACTIONS : allowNone ? ROUTE_TYPES : ROUTE_TYPES.filter((x) => x !== 'none');

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <label className="text-xs font-medium">
          {actionMode ? t('routing.ura.dtmfAction') : t('routing.inbound.pointsTo')}
        </label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={actionMode ? action : routeType}
          onChange={(e) => {
            const v = e.target.value;
            if (actionMode && onActionChange) {
              onActionChange(v as DtmfAction);
              onDestinationChange('');
            } else {
              onRouteTypeChange(v as RouteType);
              onDestinationChange('');
            }
          }}
        >
          {types.map((tp) => (
            <option key={tp} value={tp}>
              {t(actionMode ? `routing.dtmfAction.${tp}` : `routing.routeType.${tp}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">{t('routing.inbound.destination')}</label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
          value={destinationId === '' ? '' : String(destinationId)}
          disabled={effectiveType === 'none' || (actionMode && action === 'hangup')}
          onChange={(e) => onDestinationChange(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">—</option>
          {effectiveType === 'ura' &&
            (uras.data?.items ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          {effectiveType === 'queue' &&
            (queues.data?.items ?? []).map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          {effectiveType === 'extension' &&
            (extensions.data?.items ?? []).map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.displayName} ({ex.number})
              </option>
            ))}
          {!actionMode &&
            routeType === 'call_flow' &&
            (flows.data?.items ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}