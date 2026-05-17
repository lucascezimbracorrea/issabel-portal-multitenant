const hits = new Map();
const WINDOW_MS = 60_000;
const MAX = 30;
export function rateLimitLogin(ip) {
    const now = Date.now();
    const cur = hits.get(ip);
    if (!cur || now - cur.t > WINDOW_MS) {
        hits.set(ip, { n: 1, t: now });
        return true;
    }
    if (cur.n >= MAX)
        return false;
    cur.n += 1;
    return true;
}
