import { normalizePhone } from './phone-util.js';

export type LensleadConfig = {
  functionsUrl: string;
  syncSecret: string;
  lensleadUserId: string;
};

export type LensleadSyncPage = {
  leads: Array<Record<string, unknown>>;
  clients: Array<Record<string, unknown>>;
  nextSince: string | null;
  hasMore: boolean;
};

export async function fetchLensleadPage(params: {
  cfg: LensleadConfig;
  since: string | null;
  page?: number;
  pageSize?: number;
}): Promise<LensleadSyncPage> {
  const base = params.cfg.functionsUrl.replace(/\/+$/, '');
  const url = `${base}/portal-sync`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.cfg.syncSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: params.cfg.lensleadUserId,
      since: params.since,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 100,
      entities: ['leads', 'clients'],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`lenslead_sync_${res.status}:${t.slice(0, 400)}`);
  }
  return (await res.json()) as LensleadSyncPage;
}

export function mapLeadRow(orgId: number, row: Record<string, unknown>, syncedAt: string) {
  const phone = (row.phone as string) ?? (row.whatsapp as string) ?? null;
  return {
    organizationId: orgId,
    externalId: String(row.id),
    name: String(row.name ?? ''),
    email: (row.email as string) ?? null,
    phone,
    phoneNormalized: normalizePhone(phone),
    status: row.status != null ? String(row.status) : null,
    source: (row.source as string) ?? null,
    rawJson: JSON.stringify(row),
    syncedAt,
  };
}

export function mapClientRow(orgId: number, row: Record<string, unknown>, syncedAt: string) {
  const phone = (row.phone as string) ?? (row.whatsapp as string) ?? null;
  return {
    organizationId: orgId,
    externalId: String(row.id),
    leadExternalId: row.lead_id != null ? String(row.lead_id) : null,
    name: String(row.name ?? ''),
    email: (row.email as string) ?? null,
    phone,
    phoneNormalized: normalizePhone(phone),
    rawJson: JSON.stringify(row),
    syncedAt,
  };
}
