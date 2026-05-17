import mysql from 'mysql2/promise';
function tableName(cfg) {
    const t = cfg.table?.trim() || 'cdr';
    if (!/^[a-zA-Z0-9_]+$/.test(t))
        throw new Error('invalid_cdr_table');
    return t;
}
export function parseCdrConfig(raw) {
    if (!raw?.trim())
        return null;
    try {
        const j = JSON.parse(raw);
        const host = typeof j.host === 'string' ? j.host : '';
        const user = typeof j.user === 'string' ? j.user : '';
        const password = typeof j.password === 'string' ? j.password : '';
        const database = typeof j.database === 'string' ? j.database : '';
        if (!host || !user || !database)
            return null;
        return {
            host,
            port: typeof j.port === 'number' ? j.port : 3306,
            user,
            password,
            database,
            table: typeof j.table === 'string' ? j.table : 'cdr',
        };
    }
    catch {
        return null;
    }
}
export function globalCdrConfigFromEnv() {
    const json = process.env.ISSABEL_CDR_MYSQL_JSON?.trim();
    if (json)
        return parseCdrConfig(json);
    const host = process.env.ISSABEL_MYSQL_HOST;
    const user = process.env.ISSABEL_MYSQL_USER;
    const password = process.env.ISSABEL_MYSQL_PASSWORD;
    const database = process.env.ISSABEL_MYSQL_DATABASE;
    if (!host || !user || !database)
        return null;
    return {
        host,
        port: Number(process.env.ISSABEL_MYSQL_PORT || 3306),
        user,
        password: password ?? '',
        database,
        table: process.env.ISSABEL_MYSQL_CDR_TABLE || 'cdr',
    };
}
function guessDirection(src, dst) {
    const extLike = (s) => /^[0-9*#+]{1,8}$/.test(s.replace(/\s/g, ''));
    if (extLike(dst) && !extLike(src))
        return 'inbound';
    if (extLike(src) && !extLike(dst))
        return 'outbound';
    return src.length >= dst.length ? 'inbound' : 'outbound';
}
export async function fetchCdrHistory(cfg, opts) {
    const t = tableName(cfg);
    const conn = await mysql.createConnection({
        host: cfg.host,
        port: cfg.port ?? 3306,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        connectTimeout: 8000,
    });
    try {
        const ac = opts.accountcode?.trim();
        const acClause = ac ? ` AND accountcode = ? ` : '';
        const baseParams = [];
        if (ac)
            baseParams.push(ac);
        baseParams.push(opts.fromIso, opts.toIso);
        let extra = '';
        if (opts.src?.trim()) {
            extra += ` AND src LIKE ? `;
            baseParams.push(`%${opts.src.trim()}%`);
        }
        if (opts.dst?.trim()) {
            extra += ` AND dst LIKE ? `;
            baseParams.push(`%${opts.dst.trim()}%`);
        }
        const [countRows] = await conn.query(`SELECT COUNT(*) AS c FROM ${t}
       WHERE calldate >= ? AND calldate <= ? ${acClause} ${extra}`, baseParams);
        const total = Number(countRows[0]?.c ?? 0);
        const offset = (opts.page - 1) * opts.pageSize;
        const listParams = [...baseParams, opts.pageSize, offset];
        const [rows] = await conn.query(`SELECT calldate, src, dst, duration, billsec, disposition, uniqueid, dcontext, accountcode
       FROM ${t}
       WHERE calldate >= ? AND calldate <= ? ${acClause} ${extra}
       ORDER BY calldate DESC
       LIMIT ? OFFSET ?`, listParams);
        const items = rows.map((r) => ({
            calldate: String(r.calldate),
            src: String(r.src ?? ''),
            dst: String(r.dst ?? ''),
            duration: Number(r.duration ?? 0),
            billsec: Number(r.billsec ?? 0),
            disposition: String(r.disposition ?? ''),
            uniqueid: String(r.uniqueid ?? ''),
            dcontext: r.dcontext != null ? String(r.dcontext) : null,
            accountcode: r.accountcode != null ? String(r.accountcode) : null,
        }));
        return { items, total };
    }
    finally {
        await conn.end();
    }
}
export async function fetchTelephonyFromCdr(organizationId, cfg, opts) {
    const t = tableName(cfg);
    const conn = await mysql.createConnection({
        host: cfg.host,
        port: cfg.port ?? 3306,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        connectTimeout: 8000,
    });
    try {
        const ac = opts?.accountcode?.trim();
        const acClause = ac ? ` AND accountcode = ? ` : '';
        const params24 = [];
        if (ac)
            params24.push(ac);
        const [aggRows] = await conn.query(`SELECT 
        COUNT(*) AS total,
        SUM(disposition = 'ANSWERED') AS answered,
        SUM(CHAR_LENGTH(src) > CHAR_LENGTH(dst) OR src LIKE '+%' OR src LIKE '0%') AS inboundish,
        COALESCE(SUM(billsec),0) AS sumBill
      FROM ${t}
      WHERE calldate >= (NOW() - INTERVAL 1 DAY) ${acClause}`, params24);
        const agg = aggRows[0];
        const total = Number(agg?.total ?? 0);
        const answered = Number(agg?.answered ?? 0);
        const inboundish = Number(agg?.inboundish ?? 0);
        const sumBill = Number(agg?.sumBill ?? 0);
        const inboundPct = total ? Math.round((inboundish / total) * 100) : 0;
        const answerRate = total ? Math.round((answered / total) * 100) : 0;
        const avgDurationSec = answered ? Math.round(sumBill / answered) : 0;
        const asrPct = total ? Math.round((answered / total) * 1000) / 10 : 0;
        const hourlyParams = [];
        if (ac)
            hourlyParams.push(ac);
        const [hourRows] = await conn.query(`SELECT HOUR(calldate) AS h, COUNT(*) AS n
       FROM ${t}
       WHERE calldate >= (NOW() - INTERVAL 1 DAY) ${acClause}
       GROUP BY HOUR(calldate)`, hourlyParams);
        const hourlyMap = new Map();
        for (const r of hourRows) {
            hourlyMap.set(Number(r.h), Number(r.n));
        }
        const hourly = Array.from({ length: 24 }, (_, h) => hourlyMap.get(h) ?? 0);
        const bucketMinutes = 5;
        const buckets = 24 * (60 / bucketMinutes); // 288 points for 24h at 5min
        const bucketSql = `FLOOR(TIMESTAMPDIFF(MINUTE, DATE_SUB(NOW(), INTERVAL 1 DAY), calldate) / ${bucketMinutes})`;
        const bucketParams = [];
        if (ac)
            bucketParams.push(ac);
        const [bucketRows] = await conn.query(`SELECT ${bucketSql} AS b, COUNT(*) AS n
       FROM ${t}
       WHERE calldate >= (NOW() - INTERVAL 1 DAY) ${acClause}
       GROUP BY b`, bucketParams);
        const simultaneousBuckets = Array.from({ length: buckets }, () => 0);
        for (const r of bucketRows) {
            const idx = Number(r.b);
            if (idx >= 0 && idx < buckets)
                simultaneousBuckets[idx] = Number(r.n);
        }
        const recentParams = [];
        if (ac)
            recentParams.push(ac);
        const [recentRows] = await conn.query(`SELECT calldate, src, dst, duration, billsec, disposition, uniqueid, channel, dcontext
       FROM ${t}
       WHERE calldate >= (NOW() - INTERVAL 7 DAY) ${acClause}
       ORDER BY calldate DESC
       LIMIT 20`, recentParams);
        const recentCalls = recentRows.map((r) => {
            const dir = guessDirection(String(r.src), String(r.dst));
            return {
                id: String(r.uniqueid),
                direction: dir,
                from: String(r.src),
                to: String(r.dst),
                durationSec: Number(r.billsec || r.duration || 0),
                disposition: String(r.disposition || '').toLowerCase(),
            };
        });
        const onlineParams = [];
        if (ac)
            onlineParams.push(ac);
        const [onlineRows] = await conn.query(`SELECT COUNT(*) AS n FROM ${t}
       WHERE calldate >= (NOW() - INTERVAL 10 MINUTE)
       AND disposition = 'ANSWERED'
       AND billsec = 0
       AND duration > 0 ${acClause}`, onlineParams);
        const onlineAgg = onlineRows[0];
        const onlineCallsEstimate = Number(onlineAgg?.n ?? 0);
        return {
            organizationId,
            calls24h: total,
            inboundPct,
            answerRate,
            avgDurationSec,
            asrPct,
            hourly,
            recentCalls,
            source: 'cdr',
            simultaneousBuckets,
            bucketMinutes,
            onlineCallsEstimate,
        };
    }
    finally {
        await conn.end();
    }
}
