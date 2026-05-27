import { z } from 'zod';

export const routeTypeZ = z.enum(['none', 'ura', 'queue', 'extension', 'call_flow']);
export type RouteType = z.infer<typeof routeTypeZ>;

export const dtmfActionZ = z.enum(['none', 'extension', 'queue', 'ura', 'hangup']);
export type DtmfAction = z.infer<typeof dtmfActionZ>;

export const scheduleWindowZ = z.object({
  days: z.array(z.number().int().min(0).max(6)),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const businessScheduleZ = z.object({
  enabled: z.boolean().optional(),
  holidayListName: z.string().max(128).optional(),
  afterHoursAudioId: z.number().int().nullable().optional(),
  afterHoursAction: z.enum(['hangup', 'extension', 'queue', 'ura']).optional(),
  afterHoursDestinationId: z.number().int().nullable().optional(),
  windows: z.array(scheduleWindowZ).optional(),
});

export type BusinessSchedule = z.infer<typeof businessScheduleZ>;

export const dtmfActionRowZ = z.object({
  digit: z.string().regex(/^[0-9*#]$/),
  action: dtmfActionZ,
  destinationId: z.number().int().nullable().optional(),
});

export type DtmfActionRow = z.infer<typeof dtmfActionRowZ>;

export function parseScheduleJson(raw: string | null | undefined): BusinessSchedule {
  if (!raw?.trim()) return {};
  try {
    const j = JSON.parse(raw) as unknown;
    const p = businessScheduleZ.safeParse(j);
    return p.success ? p.data : {};
  } catch {
    return {};
  }
}

export function parseDtmfJson(raw: string | null | undefined): DtmfActionRow[] {
  if (!raw?.trim()) return defaultDtmfActions();
  try {
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return defaultDtmfActions();
    const rows: DtmfActionRow[] = [];
    for (const item of j) {
      const p = dtmfActionRowZ.safeParse(item);
      if (p.success) rows.push(p.data);
    }
    return rows.length > 0 ? rows : defaultDtmfActions();
  } catch {
    return defaultDtmfActions();
  }
}

export function defaultDtmfActions(): DtmfActionRow[] {
  return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => ({
    digit,
    action: 'none' as const,
    destinationId: null,
  }));
}

export function parseGraphJson(raw: string | null | undefined): { nodes: unknown[]; edges: unknown[] } {
  if (!raw?.trim()) return { nodes: [], edges: [] };
  try {
    const j = JSON.parse(raw) as { nodes?: unknown[]; edges?: unknown[] };
    return {
      nodes: Array.isArray(j.nodes) ? j.nodes : [],
      edges: Array.isArray(j.edges) ? j.edges : [],
    };
  } catch {
    return { nodes: [], edges: [] };
  }
}
