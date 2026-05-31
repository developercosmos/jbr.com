# JBR Deployment Information

## Server Details
| Setting | Value |
|---------|-------|
| Server IP | 192.168.1.225 |
| SSH Username | developer |
| SSH Auth | **Key-based only** — password auth disabled (`PasswordAuthentication no`). Do NOT commit credentials to this repo. |
| Deployment Path | /var/www/jbr |

> ⚠️ A plaintext SSH password was previously committed here. It has been removed —
> **rotate that credential on the server now and purge it from git history** (treat it
> as compromised). Use SSH keys + a secrets manager going forward.

## Domain & SSL
| Setting | Value |
|---------|-------|
| Domain | jualbeliraket.com |
| SSL | Let's Encrypt via Cloudflare DNS-01 |
| HTTPS Port | 443 |
| Auto-Renewal | Certbot timer (twice daily) |

## Nginx Configuration
- **Config file**: `/etc/nginx/sites-available/jualbeliraket.com`
- **Global zones file**: `/etc/nginx/nginx.conf` (defines `limit_req_zone` directives)
- **Reverse proxy**: Port 443 → localhost:3000
- **HTTP redirect**: Port 80 → HTTPS
- **SSL certificates**: `/etc/letsencrypt/live/jualbeliraket.com/`
- **Cloudflare credentials**: `/etc/letsencrypt/cloudflare/credentials.ini`
- **Real client IP**: `real_ip_header CF-Connecting-IP` with full Cloudflare CIDR allowlist so `$binary_remote_addr` resolves to the visitor IP (not the Cloudflare edge IP). Required for per-user rate limiting to work behind Cloudflare.

### Rate Limiting (updated 2026-04-28)

Two layers operate in production:

**Layer 1 — Nginx zones** (defined in `/etc/nginx/nginx.conf`):

| Zone | Rate | Memory | Purpose |
|------|------|--------|---------|
| `general` | 300 r/s | 10 MB | Catch-all for `location /` (page navigation, server actions, RSC POSTs) |
| `api` | 300 r/s | 10 MB | `/api/*` (REST and Next.js route handlers, except auth) |
| `auth` | 15 r/min | 10 MB | `/api/auth/*` write operations (login, register, password reset) |

**Per-location burst** (in `/etc/nginx/sites-available/jualbeliraket.com`):

| Location | Directive |
|----------|-----------|
| `location /` | `limit_req zone=general burst=2000 delay=500` |
| `location /api/` | `limit_req zone=api burst=1000 nodelay` |
| `location /api/auth/` | `limit_req zone=auth burst=10 nodelay` |
| `location = /api/auth/get-session` | exempt (Better Auth session polling) |
| `location = /api/auth/session` | exempt |
| `location = /api/auth/list-sessions` | exempt |
| `location /_next/static/` | exempt (immutable hashed assets) |
| `location /_next/image` | exempt (image optimizer) |

`burst=2000 delay=500` for the general zone is sized for Next.js 16 admin dashboards which fire 50-100 RSC POSTs in rapid succession per navigation. Tighten only if you observe abuse — admin browsing legitimately needs the headroom.

**Layer 2 — Next.js middleware** ([web/src/middleware.ts](web/src/middleware.ts)):
- Per-IP per-tier in-memory bucket. Tiers: `auth-write` (10/min), `password-reset` (5/min), `upload` (30/min), `search` (60/min), `messages-write` (30/min).
- Global per-IP browsing budget: 300/min.
- **Exempt from both gates**: any POST that carries a Next.js framework header (`RSC`, `Next-Router-Prefetch`, `Next-Router-State-Tree`, `Next-Action`, `Next-Url`). Without this, server actions and RSC fetches consume the global budget and surface as 429s on normal browsing.

### Editing the Rate Limits

```bash
ssh developer@192.168.1.225
sudo nano /etc/nginx/nginx.conf                              # edit limit_req_zone rate
sudo nano /etc/nginx/sites-available/jualbeliraket.com       # edit per-location burst
sudo nginx -t                                                # validate syntax
sudo nginx -s reload                                         # apply without dropping connections
```

Backup files written by previous edits live next to the originals with `.bak` suffix.

## URLs
- **Production**: https://jualbeliraket.com
- **QA (direct)**: http://192.168.1.225:3000

## Critical Deploy Note (Next.js Standalone Static)

Jika deploy manual tanpa `deploy-pm2.sh`, pastikan folder runtime static benar-benar dibuat sebelum copy.
Tanpa langkah ini, endpoint `/_next/static/*` bisa 404 dan browser akan menolak CSS/JS karena MIME `text/plain`.

Gunakan urutan aman berikut di server:

```bash
cd /var/www/jbr
npm run build
mkdir -p .next/standalone/.next .next/standalone/public
rm -rf .next/standalone/public .next/standalone/.next/static
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
pm2 restart jualbeliraket
```

## Runtime Reliability
- **PM2 startup service**: `pm2-developer` (systemd)
- **PM2 state file**: `/home/developer/.pm2/dump.pm2`
- **App healthcheck script**: `/var/www/jbr/scripts/healthcheck-jualbeliraket.sh`
- **Healthcheck cron**: `*/1 * * * * /usr/bin/flock -n /tmp/healthcheck-jualbeliraket.lock /var/www/jbr/scripts/healthcheck-jualbeliraket.sh`
- **Healthcheck log**: `/var/www/jbr/logs/healthcheck-jualbeliraket.log`

### E2E Smoke Test (regression detector)

Endpoint internal: `POST/GET /api/cron/smoke-test` (auth via `CRON_SECRET`).

Apa yang dicek setiap run:
- HTTP probe semua route public (home, search, category, login, register) — wajib 200.
- HTTP probe semua route admin (feature-flags, audit, kill-switch, disputes, orders, users, files, analytics, kyc, products, categories, settings, moderation, support, fees, vouchers, affiliates) — wajib 200/307/308 **bukan 500**.
- Static asset probe: parse homepage HTML, fetch 5 chunk JS pertama → wajib 200 + MIME `application/javascript`.
- Direct DB probe (read-only): `feature_flags` listing, `feature_flag_audit_log` find, kill switch, disputes filter `BUYER_RATING`, `product_events`, `pdp_presence_pings`, kolom `offers.intent_score`, kolom `feature_flag_audit_log.confirmation_phrase`.

Setup cron (di server, sebagai user `developer`):

```bash
chmod +x /var/www/jbr/scripts/smoke-test.sh
# Edit crontab
crontab -e
# Tambahkan baris berikut (jalan tiap 15 menit, log ke logs/smoke-test.log):
*/15 * * * * /var/www/jbr/scripts/smoke-test.sh
```

Output:
- Log: `/var/www/jbr/logs/smoke-test.log` (1 baris JSON per run).
- Marker file `/var/www/jbr/logs/smoke-test.fail` muncul jika ada check yang gagal — bisa dipantau oleh sistem alert.
- Cron mail-on-error otomatis fire saat exit code != 0.

Manual run untuk verifikasi:

```bash
/var/www/jbr/scripts/smoke-test.sh && echo "all green"
# atau langsung curl:
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
    http://localhost:3000/api/cron/smoke-test | jq .
```

See also: `docs/domain-routing-checklist.md`
