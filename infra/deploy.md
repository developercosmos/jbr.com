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

## Deploy (`deploy-pm2.sh`) — fail-safe

Dijalankan dari mesin dev (script SSH ke server):

```bash
bash deploy-pm2.sh main                      # deploy branch main
SKIP_MIGRATIONS=1 bash deploy-pm2.sh main    # deploy tanpa menjalankan migrasi
```

Script **tidak pernah meninggalkan production mati** saat gagal:
- **Tidak ada `pm2 stop` di awal** — app lama tetap melayani selama `npm ci` + `npm run build` (tahap paling rawan); swap ke build baru di akhir via `pm2 startOrReload` (downtime minimal).
- **`npm ci || npm install`** — fallback bila lockfile/registry bermasalah.
- **ERR trap + health gate** (butuh `set -E`): kegagalan apa pun — atau build baru tidak 200 di `/api/health` — memicu **rollback otomatis** ke commit sebelumnya (reset → rebuild bersih → restart). End state selalu build yang sehat.
- `.env.production`/`.env.local` disalin ke `.next/standalone/` (next build tidak menyalinnya); static disinkron oleh hook `postbuild`.

### Migrasi (run-once ledger)

Migrasi **default-on** lewat tabel `_deploy_migrations` (`filename` PK, `applied_at`):
- Tiap `drizzle/*.sql` dijalankan **maksimal sekali**, dengan `ON_ERROR_STOP` (migrasi baru yang gagal → deploy abort → rollback).
- **Bootstrap** (sekali, pada DB yang sudah ter-migrasi): ledger kosong + tabel `users` ada → semua file existing dicatat *applied* **tanpa dieksekusi**. DB benar-benar fresh (tanpa schema) → semua file dijalankan beneran.
- Tambah migrasi baru: cukup taruh `drizzle/00XX_*.sql`, commit, deploy — otomatis jalan tepat sekali. **Jangan** lagi apply manual semua file (file lama mis. `0000` tidak idempotent — bare `CREATE TYPE`).
- Skip untuk satu deploy darurat: `SKIP_MIGRATIONS=1`.

### Caveat: lockfile (npm)

Server = **node 20 / npm 10**; mesin dev mungkin **node 24 / npm 11**. `package-lock.json` yang ditulis npm 11 bisa bikin `npm ci` di server gagal (`Missing ... from lock file`). Regenerasi lock pakai npm 10 agar cocok:

```bash
cd web && npx -y npm@10 install --package-lock-only
# pastikan diff HANYA menambah entri (tanpa major bump), lalu commit
```

### Caveat: Auth base URL / OAuth (IP privat)

Google OAuth menolak `redirect_uri` ke IP privat (*"device_id and device_name are required for private IP"*). Maka:
- `BETTER_AUTH_URL` dan `NEXT_PUBLIC_APP_URL` **harus** `https://jualbeliraket.com` (bukan IP).
- `src/lib/auth.ts` punya guard: jika env berisi raw IP non-loopback, `baseURL` otomatis fallback ke domain.
- **Awas pm2 env basi:** `pm2 reload --update-env` tidak menghapus var lama. Bila proses pernah start dengan `BETTER_AUTH_URL=<IP>`, nilainya nempel meski `.env` sudah benar (process.env menang atas `.env` yang dibaca standalone). Perbaiki:
  ```bash
  BETTER_AUTH_URL='https://jualbeliraket.com' NEXT_PUBLIC_APP_URL='https://jualbeliraket.com' \
    pm2 restart jualbeliraket --update-env && pm2 save
  # verifikasi: pm2 env <id> | grep AUTH_URL
  ```
- File `/var/www/jbr/.env*.bak.*` (berisi IP lama) inert tapi membingungkan — boleh dihapus.

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

### KYC OCR (optional, feature-flagged)
Pre-screens KYC KTP images via a local OpenAI-compatible LLM (e.g. llama.cpp + Gemma 4). OFF unless the `kyc.ocr` feature flag is enabled AND `KYC_OCR_LLM_URL`/`KYC_OCR_LLM_MODEL` are set (see `.env.example`).
- **Primary trigger**: automatic — submitting a KYC application kicks OCR in the background (`after()`, post-response), so no cron is needed for the happy path and the result is usually ready within ~1 minute of submission.
- **Cron sweep = retry/backstop only**: re-processes rows whose kick died mid-flight (app restart, LLM down). Recommended:
  - **Script**: `/var/www/jbr/scripts/jbr-kyc-ocr.sh` → `POST /api/cron/kyc-ocr` (auth via `CRON_SECRET`)
  - **Cron**: `*/5 * * * * /usr/bin/flock -n /tmp/jbr-kyc-ocr.lock /var/www/jbr/scripts/jbr-kyc-ocr.sh`
  - **Log**: `/var/www/jbr/logs/kyc-ocr.log`
- The admin KYC page also has a manual "Jalankan OCR / Jalankan ulang" button (re-runs + old submissions).
- Affiliate enrollments use the same pipeline behind their own flag `affiliate.ocr` (env override `FEATURE_AFFILIATE_OCR`); the same cron route sweeps both queues and the admin Affiliates page has its own manual-run button.
- The LLM endpoint must be reachable from the app server (verify: `curl http://<llm-host>/v1/models`).

### Shipping providers (RajaOngkir / Biteship)
Two independent options under Admin → Settings → Shipping (`integration_settings`); enable one. If both are enabled, **Biteship wins**. Env overrides: `BITESHIP_API_KEY`, `BITESHIP_API_URL`, `BITESHIP_COURIERS`, `BITESHIP_WEBHOOK_TOKEN` (see `.env.example`).
- **Biteship rates**: checkout quotes per seller using the seller's default-pickup address (map coordinates → postal code fallback); buyer address uses coordinates/postal too — no RajaOngkir `city_id` needed.
- **Pickup booking**: seller order page → "Request Pickup (Biteship)" (requires the platform Biteship balance + seller default-pickup address). Waybill/resi fills automatically.
- **Webhook**: register `https://jualbeliraket.com/api/webhooks/biteship?token=<webhook_token>` in the Biteship dashboard. Status `picked` → order SHIPPED (buyer notified), `delivered` → DELIVERED + escrow timer armed; failures notify the seller and free the order for rebooking. Fail-closed: requests without the exact token get 401.
- **Sandbox**: use a Biteship TEST api key — orders are processed but no courier physically picks up.

### Tier caps & pajak PMK 37/2025 (configurable via accounting_settings)
- Batas GMV bulanan per tier KYC: `kyc.tier_cap_t0` (default 10jt), `kyc.tier_cap_t1` (50jt), `kyc.tier_cap_t2` (250jt). Gating tambahan T0: `kyc.t0_max_product_price` (default 1jt — harga maksimal per produk saat create/update) dan `kyc.t0_max_payout` (default 10jt — payout di atasnya diblok + seller dinotifikasi wajib naik T1) — enforced at order creation; seller melihat meter pemakaian di Pengaturan → KYC. Ubah via `setSetting(key, value)` (accounting_settings, versioned).
- PPh 22 marketplace: `tax.pph22_enabled` (default **false** — set true HANYA setelah JBR ditunjuk DJP), `tax.pph22_rate` (0.005), `tax.pph22_omzet_threshold` (500000000). Saat aktif, pemungutan terjadi di escrow release (`postOrderRelease`): CR akun slot `wht_pph22` (default 24700) + catatan per-order di `tax_withholdings` (bukti pungut). Orang pribadi dgn pernyataan omzet ≤ ambang tidak dipungut; crossing → pungut mulai awal bulan berikutnya. Seller mengelola NPWP/NIK + alamat korespondensi + pernyataan di Keuangan → Pajak.

### Private identity documents (PII) — serving rules + legacy migration
- Identity docs (seller-KYC + affiliate KTP/Surat Pernyataan) are PRIVATE `files` rows under `uploads/kyc/<user_id>/...`, served ONLY via `/api/files/[id]` (owner-or-admin).
- They must never be reachable through the public static path. Two layers enforce this and BOTH must be active:
  1. Next route `/uploads/[...segments]` returns 403 for `kyc/`, `ktp/`, `statements/` (ships with the app).
  2. **nginx** (`infra/nginx/jualbeliraket.com.conf`): regex location returning 403 for `^/uploads/(kyc|ktp|statements)(/|$)` ABOVE the `/uploads/` alias. nginx serves `/uploads/` straight from disk, so without this rule the app-level guard is bypassed. Apply on server:
     `sudo cp /var/www/jbr/infra/nginx/jualbeliraket.com.conf /etc/nginx/sites-available/jualbeliraket.com && sudo nginx -t && sudo systemctl reload nginx`
- **Legacy migration** (one-time): affiliates who enrolled before the private flow have KTP/Surat Pernyataan as PUBLIC files (`uploads/ktp/...`, `uploads/statements/...`) referenced by `ktp_url`/`statement_url`. Move them with:
  `cd /var/www/jbr && set -a && . .env.local && set +a && node scripts/migrate-affiliate-private-docs.mjs` (dry run) then add `--execute`.
  The script copies each file into `uploads/kyc/<user_id>/...`, inserts a private `files` row (sha256 `content_hash`), sets `ktp_file_id`/`statement_file_id`, NULLs the legacy URL, and deletes the public copy. Idempotent; safe to re-run.

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
