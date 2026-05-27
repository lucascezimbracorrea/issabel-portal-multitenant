import { asc, eq } from 'drizzle-orm';
import type { db as DbType } from '../db/client.js';
import * as schema from '../db/schema.js';
import { parseIssabelPbxApiJson } from './issabel-pbx-api.js';

export type ApplyJobRow = typeof schema.issabelApplyJobs.$inferSelect;

async function postApplyWebhook(
  url: string,
  secret: string,
  bundle: Record<string, unknown>,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(bundle),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, detail: `http_${res.status}:${t.slice(0, 200)}` };
    }
    return { ok: true, detail: 'webhook_ok' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: msg.slice(0, 200) };
  }
}

/** Process pending Issabel apply jobs — optional applyWebhookUrl on org issabel_pbx_api JSON. */
export async function processIssabelApplyJobs(db: typeof DbType, limit = 20): Promise<Array<{ id: number; status: string; detail?: string }>> {
  const jobs = await db
    .select()
    .from(schema.issabelApplyJobs)
    .where(eq(schema.issabelApplyJobs.status, 'pending'))
    .orderBy(asc(schema.issabelApplyJobs.id))
    .limit(limit);

  const results: Array<{ id: number; status: string; detail?: string }> = [];

  for (const job of jobs) {
    const [org] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, job.organizationId));
    let bundle: Record<string, unknown> = {};
    try {
      bundle = JSON.parse(job.bundleJson) as Record<string, unknown>;
    } catch {
      bundle = {};
    }

    let applyUrl: string | null = null;
    let applySecret: string | null = null;
    if (org?.issabelPbxApi) {
      try {
        const j = JSON.parse(org.issabelPbxApi) as Record<string, unknown>;
        if (typeof j.applyWebhookUrl === 'string') applyUrl = j.applyWebhookUrl;
        if (typeof j.applyWebhookSecret === 'string') applySecret = j.applyWebhookSecret;
      } catch {
        /* ignore */
      }
    }

    const pbxCfg = parseIssabelPbxApiJson(org?.issabelPbxApi ?? null);
    const now = new Date().toISOString();

    if (applyUrl && applySecret) {
      const r = await postApplyWebhook(applyUrl, applySecret, {
        ...bundle,
        jobId: job.id,
        resourceType: job.resourceType,
        resourceId: job.resourceId,
        organizationId: job.organizationId,
      });
      if (r.ok) {
        await db
          .update(schema.issabelApplyJobs)
          .set({ status: 'applied', processedAt: now, lastError: null })
          .where(eq(schema.issabelApplyJobs.id, job.id));
        results.push({ id: job.id, status: 'applied' });
        continue;
      }
      await db
        .update(schema.issabelApplyJobs)
        .set({ status: 'failed', processedAt: now, lastError: r.detail })
        .where(eq(schema.issabelApplyJobs.id, job.id));
      results.push({ id: job.id, status: 'failed', detail: r.detail });
      continue;
    }

    if (pbxCfg) {
      await db
        .update(schema.issabelApplyJobs)
        .set({
          status: 'awaiting_manual',
          processedAt: now,
          lastError:
            'Configure applyWebhookUrl + applyWebhookSecret in issabel_pbx_api or import bundle manually on Issabel.',
        })
        .where(eq(schema.issabelApplyJobs.id, job.id));
      results.push({ id: job.id, status: 'awaiting_manual' });
      continue;
    }

    await db
      .update(schema.issabelApplyJobs)
      .set({ status: 'failed', processedAt: now, lastError: 'issabel_not_configured' })
      .where(eq(schema.issabelApplyJobs.id, job.id));
    results.push({ id: job.id, status: 'failed', detail: 'issabel_not_configured' });
  }

  return results;
}

export async function enqueueApplyJob(
  db: typeof DbType,
  params: {
    organizationId: number;
    resourceType: 'call_flow' | 'ura';
    resourceId: number;
    bundle: Record<string, unknown>;
  },
): Promise<number> {
  const [res] = await db.insert(schema.issabelApplyJobs).values({
    organizationId: params.organizationId,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    bundleJson: JSON.stringify(params.bundle),
    status: 'pending',
  }) as unknown as [{ insertId: number }];
  return res.insertId;
}
