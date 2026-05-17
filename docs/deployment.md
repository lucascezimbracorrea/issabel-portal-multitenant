# Deploying Issabel Portal (SPA + API)

This portal is designed to sit **beside Issabel on the same hostname** so static assets and API calls share the Issabel origin. PBX screens in the SPA open **Issabel in a new tab** via deep links; cookies for the PBX (`issabelSession`) apply when that Issabel URL is **same-site** with the PBX host.

## Build outputs

- **Web (`apps/web`)**: `npm run build -w apps/web` produces `apps/web/dist`.
- **API (`apps/api`)**: `npm run build -w apps/api` compiles the Hono server (see that package for the start command).

## Platform database (MySQL)

The API stores tenants, users, integrations, and portal settings in **MySQL** (via `mysql2` + Drizzle). Create a database and user, set the variables below, then start the API. On first boot the API runs `CREATE TABLE IF NOT EXISTS` migrations (`initSchema`).

Apply schema updates after pulling new code: restart the API (or run `npm run db:push -w apps/api` if you use Drizzle Kit against the same database).

Until the API listens on port **8787**, the Vite dev proxy will log `ECONNREFUSED` for `/api` routes.

## Environment

### Web (`apps/web`)

- `VITE_ISSABEL_BASE_URL` — optional prefix or absolute Issabel base URL. Use `""` for same-origin `/index.php?menu=…`. Use `https://pbx.example.com` when the portal is hosted on a different hostname than Issabel (deep links still work, but PBX session cookies will not be shared with the portal origin).
- `VITE_BASE` — optional public path for the SPA (e.g. `/console/`).

### API (`apps/api`)

- `PORT` — listen port (default `8787`).
- `NODE_ENV=production` — enforces internal telephony token checks.
- `INTERNAL_TELEPHONY_TOKEN` — shared secret for `POST /internal/telephony/events`.
- **MySQL (portal DB)** — `DB_HOST` (default `localhost`), `DB_PORT` (default `3306`), `DB_USER`, `DB_PASSWORD`, `DB_NAME` (default `issabel-portal`). These are **only** for the portal application schema, not the Issabel CDR database (that remains configured per organization or via Issabel CDR env vars).

## Issabel PBX API (extension sync)

Issabel 4 ships with **`pbxapi`** (Fat-Free Framework REST under your web root, e.g. `https://pbx.example.com/pbxapi/`). The portal can push ramais to Issabel after each create/update:

1. Expose `pbxapi` over HTTPS on the same host (or a URL reachable **only** from the portal API process).
2. As **platform admin**, set per-organization **`issabelPbxApi`** (JSON) via `PATCH /organizations/:id/quotas` or `PATCH /organizations/:id` / create org:
   - `baseUrl` — absolute base of the API, no trailing slash (e.g. `https://pbx.example.com/pbxapi`).
   - `username` — defaults to `admin` (same as Issabel `pbxapi` authenticate).
   - `password` — Issabel **AMI admin** password from `/etc/issabel.conf` (`amiadminpwd`), used only to obtain a short-lived JWT against `/authenticate`.
   - `enabled` — optional, default `true`; set `false` to keep config but stop syncing.

Responses redact `password` as `********`. Sending `********` or an empty `password` on patch **keeps** the stored secret.

When `issabelPbxApi` is valid and enabled, `POST/PATCH /extensions` writes the portal row first, then calls Issabel `POST /extensions` (SIP) or `PUT /extensions/:id` on conflict. The extension row gains `metadata.issabelSync` (timestamp + result) and `source` becomes `synced` on success.

**Note:** This path targets **chan_sip-style** extensions as implemented by stock `pbxapi`. Issabel installs using **PJSIP only** may need a follow-up (different tech or Issabel version).

## Minimal nginx sketch

```nginx
server {
  listen 443 ssl;
  server_name pbx.example.com;

  # TLS certificates (Let's Encrypt, etc.)

  # Issabel PHP as today (adjust root to your install)
  location / {
    root /var/www/html;
    try_files $uri $uri/ /index.php?$query_string;
  }

  # Portal SPA + assets
  location /console/ {
    alias /var/www/portal/dist/;
    try_files $uri $uri/ /console/index.html;
  }

  # Portal API (Node upstream)
  location /console/api/ {
    proxy_pass http://127.0.0.1:8787/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Point the Vite/React app at `/console/api` in production (adjust `apps/web` `apiFetch` base path accordingly) or keep `/api` with a matching nginx location.

## Custom domains (white-label)

Organizations may store a normalized `custom_domain`. Terminate TLS for each verified hostname at the edge (Caddy on-demand TLS, nginx + ACME, etc.) and serve the **same** `dist/` bundle. The browser calls `GET /public/branding-by-host?host=…` to hydrate colors and trade name before login.

If the portal hostname differs from the Issabel hostname, document that operators need a separate PBX login or future SSO; the UI mentions this in Settings → Domain.

## Cookies and CORS

The dev Vite server proxies `/api` to the API without CORS pain. In production, prefer **same-origin** reverse proxy paths so the portal session cookie (`portal_session`) stays first-party. If the API is on another origin, configure CORS with credentials carefully and expect more moving parts.
