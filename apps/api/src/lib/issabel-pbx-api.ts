import { z } from 'zod';

/** Stored on `organizations.issabel_pbx_api` — Issabel 4 `pbxapi` REST (JWT after /authenticate). */
export const issabelPbxApiConfigSchema = z.object({
  enabled: z.boolean().optional().default(true),
  baseUrl: z.string().url().min(8),
  username: z.string().min(1).optional().default('admin'),
  password: z.string().min(1),
});

export type IssabelPbxApiConfig = z.infer<typeof issabelPbxApiConfigSchema>;

export function parseIssabelPbxApiJson(raw: string | null | undefined): IssabelPbxApiConfig | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    const p = issabelPbxApiConfigSchema.safeParse(j);
    return p.success ? p.data : null;
  } catch {
    return null;
  }
}

/** Strip password for API responses (UI shows placeholder). */
export function redactIssabelPbxApiJson(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (typeof j.password === 'string' && j.password.length > 0) {
      j.password = '********';
    }
    return JSON.stringify(j);
  } catch {
    return raw;
  }
}

/**
 * Merge PATCH body into existing JSON. Empty string password keeps previous secret.
 */
export function mergeIssabelPbxApiPatch(existingRaw: string | null | undefined, patchRaw: string): string {
  let existing: Record<string, unknown> = {};
  if (existingRaw?.trim()) {
    try {
      existing = JSON.parse(existingRaw) as Record<string, unknown>;
    } catch {
      existing = {};
    }
  }
  const patch = JSON.parse(patchRaw) as Record<string, unknown>;
  const merged = { ...existing, ...patch };
  const keepPassword =
    patch.password === '' ||
    patch.password === undefined ||
    patch.password === '********';
  if (keepPassword) {
    if (typeof existing.password === 'string') merged.password = existing.password;
    else delete merged.password;
  }
  const validated = issabelPbxApiConfigSchema.safeParse(merged);
  if (!validated.success) {
    throw new Error('invalid_issabel_pbx_api_json');
  }
  return JSON.stringify(validated.data);
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

async function authenticatePbxApi(cfg: IssabelPbxApiConfig): Promise<string> {
  const base = normalizeBaseUrl(cfg.baseUrl);
  const url = `${base}/authenticate`;
  const body = new URLSearchParams({
    user: cfg.username,
    password: cfg.password,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`pbxapi_auth_http_${res.status}:${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new Error('pbxapi_auth_no_token');
  return j.access_token;
}

export type IssabelSyncResult =
  | { ok: true; mode: 'create' | 'update' }
  | { ok: false; mode: 'create' | 'update'; detail: string };

/**
 * Create or update extension on Issabel via bundled `pbxapi` (POST/PUT /extensions).
 */
export async function syncExtensionViaIssabelPbxApi(params: {
  cfg: IssabelPbxApiConfig;
  extensionNumber: string;
  displayName: string;
  sipSecret: string;
  mode: 'create' | 'update';
}): Promise<IssabelSyncResult> {
  const { cfg, extensionNumber, displayName, sipSecret, mode } = params;
  if (cfg.enabled === false) {
    return { ok: false, mode, detail: 'pbxapi_disabled' };
  }
  try {
    const token = await authenticatePbxApi(cfg);
    const base = normalizeBaseUrl(cfg.baseUrl);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    if (mode === 'create') {
      const body: Record<string, unknown> = {
        extension: extensionNumber,
        name: displayName,
        tech: 'sip',
      };
      if (sipSecret.trim()) body.secret = sipSecret;

      const res = await fetch(`${base}/extensions`, { method: 'POST', headers, body: JSON.stringify(body) });
      if (res.status === 409) {
        const tryPut = await fetch(`${base}/extensions/${encodeURIComponent(extensionNumber)}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            name: displayName,
            ...(sipSecret.trim() ? { secret: sipSecret } : {}),
          }),
        });
        if (!tryPut.ok) {
          const t = await tryPut.text().catch(() => '');
          return { ok: false, mode: 'update', detail: `pbxapi_put_${tryPut.status}:${t.slice(0, 400)}` };
        }
        return { ok: true, mode: 'update' };
      }
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        return { ok: false, mode: 'create', detail: `pbxapi_post_${res.status}:${t.slice(0, 400)}` };
      }
      return { ok: true, mode: 'create' };
    }

    const putBody: Record<string, unknown> = { name: displayName };
    if (sipSecret.trim()) putBody.secret = sipSecret;
    const res = await fetch(`${base}/extensions/${encodeURIComponent(extensionNumber)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(putBody),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, mode: 'update', detail: `pbxapi_put_${res.status}:${t.slice(0, 400)}` };
    }
    return { ok: true, mode: 'update' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, mode, detail: msg.slice(0, 500) };
  }
}
