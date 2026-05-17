import { z } from 'zod';
/** Stored on `organizations.issabel_pbx_api` — Issabel 4 `pbxapi` REST (JWT after /authenticate). */
export const issabelPbxApiConfigSchema = z.object({
    enabled: z.boolean().optional().default(true),
    baseUrl: z.string().url().min(8),
    username: z.string().min(1).optional().default('admin'),
    password: z.string().min(1),
});
export function parseIssabelPbxApiJson(raw) {
    if (!raw?.trim())
        return null;
    try {
        const j = JSON.parse(raw);
        const p = issabelPbxApiConfigSchema.safeParse(j);
        return p.success ? p.data : null;
    }
    catch {
        return null;
    }
}
/** Strip password for API responses (UI shows placeholder). */
export function redactIssabelPbxApiJson(raw) {
    if (!raw?.trim())
        return null;
    try {
        const j = JSON.parse(raw);
        if (typeof j.password === 'string' && j.password.length > 0) {
            j.password = '********';
        }
        return JSON.stringify(j);
    }
    catch {
        return raw;
    }
}
/**
 * Merge PATCH body into existing JSON. Empty string password keeps previous secret.
 */
export function mergeIssabelPbxApiPatch(existingRaw, patchRaw) {
    let existing = {};
    if (existingRaw?.trim()) {
        try {
            existing = JSON.parse(existingRaw);
        }
        catch {
            existing = {};
        }
    }
    const patch = JSON.parse(patchRaw);
    const merged = { ...existing, ...patch };
    const keepPassword = patch.password === '' ||
        patch.password === undefined ||
        patch.password === '********';
    if (keepPassword) {
        if (typeof existing.password === 'string')
            merged.password = existing.password;
        else
            delete merged.password;
    }
    const validated = issabelPbxApiConfigSchema.safeParse(merged);
    if (!validated.success) {
        throw new Error('invalid_issabel_pbx_api_json');
    }
    return JSON.stringify(validated.data);
}
function normalizeBaseUrl(baseUrl) {
    return baseUrl.replace(/\/+$/, '');
}
async function authenticatePbxApi(cfg) {
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
    const j = (await res.json());
    if (!j.access_token)
        throw new Error('pbxapi_auth_no_token');
    return j.access_token;
}
/**
 * Create or update extension on Issabel via bundled `pbxapi` (POST/PUT /extensions).
 */
export async function syncExtensionViaIssabelPbxApi(params) {
    const { cfg, extensionNumber, displayName, sipSecret, mode } = params;
    if (cfg.enabled === false) {
        return { ok: false, mode, detail: 'pbxapi_disabled' };
    }
    try {
        const token = await authenticatePbxApi(cfg);
        const base = normalizeBaseUrl(cfg.baseUrl);
        const headers = {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
        if (mode === 'create') {
            const body = {
                extension: extensionNumber,
                name: displayName,
                tech: 'sip',
            };
            if (sipSecret.trim())
                body.secret = sipSecret;
            let res = await fetch(`${base}/extensions`, { method: 'POST', headers, body: JSON.stringify(body) });
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
        const putBody = { name: displayName };
        if (sipSecret.trim())
            putBody.secret = sipSecret;
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
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, mode, detail: msg.slice(0, 500) };
    }
}
