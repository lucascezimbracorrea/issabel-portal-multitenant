import type { IssabelPbxApiConfig } from './issabel-pbx-api.js';
import { parseIssabelPbxApiJson } from './issabel-pbx-api.js';

export type PortalTrunk = {
  id: number;
  name: string;
  host: string | null;
  username: string | null;
  password: string | null;
  status: string;
  type: string;
};

export type TrunkSyncResult =
  | { ok: true; mode: 'create' | 'update' | 'skipped' }
  | { ok: false; detail: string };

async function pbxToken(cfg: IssabelPbxApiConfig): Promise<string> {
  const base = cfg.baseUrl.replace(/\/+$/, '');
  const body = new URLSearchParams({ user: cfg.username, password: cfg.password });
  const res = await fetch(`${base}/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`pbxapi_auth_${res.status}`);
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new Error('pbxapi_no_token');
  return j.access_token;
}

/** Best-effort push trunk to Issabel pbxapi (endpoint shape varies by Issabel version). */
export async function syncTrunkToIssabel(params: {
  issabelPbxApiRaw: string | null | undefined;
  trunk: PortalTrunk;
  mode: 'create' | 'update';
}): Promise<TrunkSyncResult> {
  const cfg = parseIssabelPbxApiJson(params.issabelPbxApiRaw);
  if (!cfg || cfg.enabled === false) return { ok: false, detail: 'pbxapi_not_configured' };
  try {
    const token = await pbxToken(cfg);
    const base = cfg.baseUrl.replace(/\/+$/, '');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const body = {
      name: params.trunk.name,
      host: params.trunk.host ?? '',
      username: params.trunk.username ?? '',
      secret: params.trunk.password ?? '',
      tech: params.trunk.type || 'sip',
    };
    const path =
      params.mode === 'create'
        ? `${base}/trunks`
        : `${base}/trunks/${encodeURIComponent(params.trunk.name)}`;
    const res = await fetch(path, {
      method: params.mode === 'create' ? 'POST' : 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    if (res.status === 404 || res.status === 501) {
      return { ok: true, mode: 'skipped' };
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, detail: `pbxapi_trunk_${res.status}:${t.slice(0, 300)}` };
    }
    return { ok: true, mode: params.mode };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: msg.slice(0, 400) };
  }
}
