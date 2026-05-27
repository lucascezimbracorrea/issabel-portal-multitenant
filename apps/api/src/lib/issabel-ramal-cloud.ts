import { createHash } from 'node:crypto';

export type RamalCloudConfig = {
  apiBase: string;
  tokenSecret: string;
};

export function ramalCloudDailyToken(secret: string, date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  return createHash('md5').update(`${secret}${day}`).digest('hex');
}

function normalizeApiBase(url: string): string {
  return url.replace(/\/+$/, '');
}

async function ramalRequest<T>(
  cfg: RamalCloudConfig,
  path: string,
  init: RequestInit,
): Promise<T> {
  const base = normalizeApiBase(cfg.apiBase);
  const token = ramalCloudDailyToken(cfg.tokenSecret);
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`ramal_cloud_invalid_json:${res.status}:${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`ramal_cloud_http_${res.status}:${text.slice(0, 300)}`);
  }
  return body as T;
}

export type RamalCheckinResponse = {
  status: string;
  message?: string;
  job_id?: number;
  job_status?: string;
  ramal_num?: string;
  ramal_pass?: string;
  ramal_domain?: string;
};

export async function ramalCloudCheckin(params: {
  cfg: RamalCloudConfig;
  ipbxUrl: string;
  ramal: string;
  hotelId: string;
  roomNumber: string;
}): Promise<RamalCheckinResponse> {
  return ramalRequest(params.cfg, '/api/ramal_cloud_checkin.php', {
    method: 'POST',
    body: JSON.stringify({
      ipbx_url: params.ipbxUrl,
      ramal: params.ramal,
      hotel_id: params.hotelId,
      room_number: params.roomNumber,
    }),
  });
}

export async function ramalCloudCheckout(params: {
  cfg: RamalCloudConfig;
  ipbxUrl: string;
  ramal: string;
  hotelId: string;
  roomNumber: string;
}): Promise<RamalCheckinResponse> {
  return ramalRequest(params.cfg, '/api/ramal_cloud_checkout.php', {
    method: 'POST',
    body: JSON.stringify({
      ipbx_url: params.ipbxUrl,
      ramal: params.ramal,
      hotel_id: params.hotelId,
      room_number: params.roomNumber,
    }),
  });
}

export async function ramalCloudGetPassword(params: {
  cfg: RamalCloudConfig;
  ramal: string;
}): Promise<RamalCheckinResponse> {
  const q = new URLSearchParams({ ramal: params.ramal });
  return ramalRequest(params.cfg, `/api/ramal_cloud_get_password.php?${q}`, { method: 'GET' });
}

export async function ramalCloudDisconnect(params: {
  cfg: RamalCloudConfig;
  ipbxUrl: string;
  ramal: string;
  hotelId: string;
  roomNumber: string;
}): Promise<RamalCheckinResponse> {
  return ramalRequest(params.cfg, '/api/ramal_cloud_disconnect.php', {
    method: 'POST',
    body: JSON.stringify({
      ipbx_url: params.ipbxUrl,
      ramal: params.ramal,
      hotel_id: params.hotelId,
      room_number: params.roomNumber,
    }),
  });
}

/** Poll get_password until credentials or max attempts. */
export async function ramalCloudPollPassword(params: {
  cfg: RamalCloudConfig;
  ramal: string;
  maxAttempts?: number;
  delayMs?: number;
}): Promise<RamalCheckinResponse> {
  const { cfg, ramal, maxAttempts = 12, delayMs = 2500 } = params;
  for (let i = 0; i < maxAttempts; i++) {
    const r = await ramalCloudGetPassword({ cfg, ramal });
    if (r.status === 'success' && r.ramal_pass) return r;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return { status: 'timeout', message: 'password_not_ready' };
}
