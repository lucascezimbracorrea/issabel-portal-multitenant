import mysql from 'mysql2/promise';
import type { CdrMysqlConfig } from './issabel-cdr.js';
import type { QueueAmiMetrics } from './issabel-ami.js';

type QueueLogRow = {
  event: string;
  data1: string;
  data2: string;
};

/** Aggregate queue_log (Asterisk) for dashboard KPIs — last 24h. */
export async function fetchQueueMetricsFromQueueLog(
  cfg: CdrMysqlConfig,
  queueName: string,
): Promise<QueueAmiMetrics | null> {
  const qn = queueName.trim();
  if (!qn) return null;
  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port ?? 3306,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      connectTimeout: 8000,
    });
    const since = Math.floor(Date.now() / 1000) - 86400;
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT event, data1, data2 FROM queue_log WHERE queuename = ? AND time >= ?`,
      [qn, since],
    );
    const events = rows as QueueLogRow[];
    if (events.length === 0) return null;

    let entered = 0;
    let connected = 0;
    let abandoned = 0;
    let waitSum = 0;
    let waitCount = 0;
    let talkSum = 0;
    let talkCount = 0;

    for (const e of events) {
      const ev = (e.event || '').toUpperCase();
      if (ev === 'ENTERQUEUE') entered++;
      if (ev === 'CONNECT') {
        connected++;
        const w = Number(e.data1);
        if (!Number.isNaN(w) && w >= 0) {
          waitSum += w;
          waitCount++;
        }
      }
      if (ev === 'ABANDON' || ev === 'EXITWITHTIMEOUT') abandoned++;
      if (ev === 'COMPLETEAGENT' || ev === 'COMPLETECALLER') {
        const t = Number(e.data2);
        if (!Number.isNaN(t) && t > 0) {
          talkSum += t;
          talkCount++;
        }
      }
    }

    const answeredToday = connected;
    const serviceLevelPct =
      entered > 0 ? Math.round((Math.min(connected + abandoned, entered) / entered) * 100) : 0;

    return {
      callsWaiting: Math.max(0, entered - connected - abandoned),
      answeredToday,
      abandonedToday: abandoned,
      avgWaitSec: waitCount > 0 ? Math.round(waitSum / waitCount) : 0,
      avgTalkSec: talkCount > 0 ? Math.round(talkSum / talkCount) : 0,
      serviceLevelPct: Math.min(100, Math.max(0, serviceLevelPct)),
      demo: false,
      source: 'queue_log',
    };
  } catch {
    return null;
  } finally {
    await conn?.end().catch(() => undefined);
  }
}
