import { parseIssabelPbxApiJson } from './issabel-pbx-api.js';

export type IssabelIaAgent = {
  id: number;
  name: string;
  nickname: string | null;
  elevenlabsAgentId: string;
  voiceId: string | null;
  language: string | null;
};

function resolveListUrl(issabelPbxApiRaw: string | null | undefined, issabelBaseUrl: string | null): string | null {
  if (issabelPbxApiRaw?.trim()) {
    try {
      const j = JSON.parse(issabelPbxApiRaw) as Record<string, unknown>;
      if (typeof j.applyWebhookUrl === 'string' && j.applyWebhookUrl.includes('portal_apply_bundle')) {
        return j.applyWebhookUrl.replace(/portal_apply_bundle\.php.*$/, 'portal_list_ia_agents.php');
      }
      if (typeof j.baseUrl === 'string') {
        const base = j.baseUrl.replace(/\/pbxapi\/?$/, '').replace(/\/+$/, '');
        return `${base}/api/portal_list_ia_agents.php`;
      }
    } catch {
      /* ignore */
    }
  }
  if (issabelBaseUrl?.trim()) {
    return `${issabelBaseUrl.replace(/\/+$/, '')}/api/portal_list_ia_agents.php`;
  }
  return null;
}

function resolveSecret(issabelPbxApiRaw: string | null | undefined): string | null {
  if (!issabelPbxApiRaw?.trim()) return process.env.PORTAL_APPLY_SECRET?.trim() ?? null;
  try {
    const j = JSON.parse(issabelPbxApiRaw) as Record<string, unknown>;
    if (typeof j.applyWebhookSecret === 'string' && j.applyWebhookSecret) {
      return j.applyWebhookSecret;
    }
  } catch {
    /* ignore */
  }
  return process.env.PORTAL_APPLY_SECRET?.trim() ?? null;
}

/** Fetch voice agents registered on Issabel (ia_agents table). */
export async function fetchIssabelIaAgents(params: {
  issabelPbxApiRaw: string | null | undefined;
  issabelBaseUrl: string | null | undefined;
}): Promise<{ ok: true; items: IssabelIaAgent[] } | { ok: false; detail: string }> {
  const url = resolveListUrl(params.issabelPbxApiRaw, params.issabelBaseUrl ?? null);
  const secret = resolveSecret(params.issabelPbxApiRaw);
  if (!url) return { ok: false, detail: 'issabel_url_not_configured' };
  if (!secret) return { ok: false, detail: 'apply_webhook_secret_not_configured' };

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, detail: `issabel_http_${res.status}:${t.slice(0, 200)}` };
    }
    const j = (await res.json()) as { ok?: boolean; items?: IssabelIaAgent[]; error?: string };
    if (!j.items) return { ok: false, detail: j.error ?? 'invalid_response' };
    return { ok: true, items: j.items };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: msg.slice(0, 300) };
  }
}

export function buildUraAiBundle(row: {
  name: string;
  extensionNumber: string;
  graphJson: string;
  dtmfActionsJson: string;
  uraMode: string;
  aiInstructions: string | null;
  elevenlabsAgentId: string | null;
  useAiInstructions: boolean;
  useJson: boolean;
  jsonContent: string | null;
  initialMessage: string | null;
  useInitialMessage: boolean;
  googleDocsUrl: string | null;
  useGoogleDocs: boolean;
}): Record<string, unknown> {
  const graph = JSON.parse(row.graphJson || '{}') as object;
  const dtmfActions = JSON.parse(row.dtmfActionsJson || '[]');
  return {
    format: 'portal-ura-v1',
    name: row.name,
    extensionNumber: row.extensionNumber,
    graph,
    dtmfActions,
    uraMode: row.uraMode,
    aiInstructions: row.aiInstructions ?? '',
    elevenlabsAgentId: row.elevenlabsAgentId ?? null,
    useAiInstructions: row.useAiInstructions,
    useJson: row.useJson,
    jsonContent: row.jsonContent,
    initialMessage: row.initialMessage ?? '',
    useInitialMessage: row.useInitialMessage,
    googleDocsUrl: row.googleDocsUrl ?? '',
    useGoogleDocs: row.useGoogleDocs,
    appliedAt: new Date().toISOString(),
    status: 'pending_apply',
  };
}
