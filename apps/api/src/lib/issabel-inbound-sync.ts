import { parseIssabelPbxApiJson } from './issabel-pbx-api.js';

export type InboundRow = {
  id: number;
  number: string;
  routeType: string;
  destinationId: number | null;
  active: boolean;
};

export type InboundSyncResult =
  | { ok: true; mode: 'skipped' | 'noted' }
  | { ok: false; detail: string };

/** Document inbound route for Issabel — full pbxapi inbound varies by Issabel version. */
export async function syncInboundToIssabel(params: {
  issabelPbxApiRaw: string | null | undefined;
  inbound: InboundRow;
}): Promise<InboundSyncResult> {
  const cfg = parseIssabelPbxApiJson(params.issabelPbxApiRaw);
  if (!cfg || cfg.enabled === false) {
    return { ok: false, detail: 'pbxapi_not_configured' };
  }
  try {
    const base = cfg.baseUrl.replace(/\/+$/, '');
    const body = new URLSearchParams({ user: cfg.username, password: cfg.password });
    const authRes = await fetch(`${base}/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!authRes.ok) return { ok: false, detail: `pbxapi_auth_${authRes.status}` };
    const { access_token: token } = (await authRes.json()) as { access_token?: string };
    if (!token) return { ok: false, detail: 'pbxapi_no_token' };

    const payload = {
      extension: params.inbound.number,
      destination: params.inbound.routeType,
      destination_id: params.inbound.destinationId,
      enabled: params.inbound.active,
    };
    const res = await fetch(`${base}/inbound/${encodeURIComponent(params.inbound.number)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 404 || res.status === 501) {
      return {
        ok: true,
        mode: 'noted',
      };
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, detail: `pbxapi_inbound_${res.status}:${t.slice(0, 300)}` };
    }
    return { ok: true, mode: 'noted' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: msg.slice(0, 400) };
  }
}
