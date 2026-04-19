# Pila Lang v1 — Operations Runbook

Audience: an SRE or ops engineer standing the product up on a fresh host, keeping it running, and recovering from common failures. No code reading required.

---

## 1. Architecture at a glance

Four services, one network:

| Service    | Image                             | Role                                                                             |
| ---------- | --------------------------------- | -------------------------------------------------------------------------------- |
| `app`      | `ghcr.io/<owner>/pila-lang:<tag>` | Next.js server on port 3000. Serves the UI, REST + SSE APIs.                     |
| `postgres` | `postgres:16-alpine`              | Source of truth for tenants, parties, notifications, admin sessions.             |
| `redis`    | `redis:7-alpine`                  | Pub/sub channel per tenant + per party, per-key rate limits, undo buffer.        |
| `minio`    | `minio/minio:latest`              | S3-compatible blob store for tenant logos. Swap for AWS S3 in prod if preferred. |
| `migrator` | `node:22-alpine`                  | One-shot Drizzle migration runner. `app` waits on it.                            |

The `app` container is stateless — scale horizontally by starting more copies behind a shared-nothing load balancer (sticky sessions not required).

---

## 2. Host bootstrap — from bare Linux to serving traffic

```bash
# 1. Install docker + compose plugin (Debian/Ubuntu shown).
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 2. Clone the repo.
git clone https://github.com/<owner>/pila-lang.git /srv/pila-lang
cd /srv/pila-lang

# 3. Populate .env.prod from the template. Replace every "change_me" value.
cp .env.example .env.prod
$EDITOR .env.prod

# 4. Pull the published image and bring the stack up.
export PILA_LANG_IMAGE=ghcr.io/<owner>/pila-lang:latest
docker compose --env-file .env.prod \
  -f docker-compose.yml -f docker-compose.prod.yml pull app
docker compose --env-file .env.prod \
  -f docker-compose.yml -f docker-compose.prod.yml up -d

# 5. Verify health.
curl -fsS http://localhost:3000/api/health
# => {"ok":true}
```

Create the first tenant via the admin UI:

1. Open `https://<host>/admin` in a browser whose email is on `ADMIN_EMAILS`.
2. Enter the email, submit, open the magic link from the inbox.
3. Click **Create tenant**, fill out name/slug/timezone, submit.
4. **Copy the one-time password** displayed to the screen. It is never shown again.
5. Hand the password to the on-site manager. They sign in at `https://<host>/host/<slug>`.

---

## 3. Environment reference

Every variable is required unless noted. `lib/config/env.ts` is the source of truth.

| Variable             | Secret? | Purpose                                                                                |
| -------------------- | ------- | -------------------------------------------------------------------------------------- |
| `NODE_ENV`           | no      | `production` on a prod host.                                                           |
| `DATABASE_URL`       | yes     | Postgres connection string used by the app and migrator.                               |
| `REDIS_URL`          | yes     | Redis connection string.                                                               |
| `S3_ENDPOINT`        | no      | Blob store host.                                                                       |
| `S3_BUCKET`          | no      | Bucket for tenant logos. Defaults to `queue-logos`.                                    |
| `S3_ACCESS_KEY`      | yes     | Blob access key.                                                                       |
| `S3_SECRET_KEY`      | yes     | Blob secret key.                                                                       |
| `S3_PUBLIC_URL_BASE` | no      | Optional. Use when a CDN fronts the bucket. Defaults to `${S3_ENDPOINT}/${S3_BUCKET}`. |
| `QR_TOKEN_SECRET`    | yes     | 32+ char secret that signs display QR tokens. Rotating invalidates every live QR.      |
| `HOST_JWT_SECRET`    | yes     | 32+ char secret that signs host session JWTs. Rotating signs every host out.           |
| `ADMIN_EMAILS`       | no      | Comma-separated allow list. Only these emails can sign in to `/admin`.                 |
| `NEXTAUTH_SECRET`    | yes     | 16+ char secret for NextAuth (admin sessions).                                         |
| `NEXTAUTH_URL`       | no      | Public base URL. Must match the host serving the app.                                  |
| `RESEND_API_KEY`     | yes     | Resend key for admin magic links.                                                      |

Edit `.env.prod`, then `docker compose --env-file .env.prod … up -d` — no restart is needed if only `ADMIN_EMAILS` changed, but a bounce of `app` picks it up within seconds.

---

## 4. Backup — nightly pg_dump + blob mirror

```bash
# Postgres dump (custom format — smaller and pg_restore-friendly).
docker compose exec -T postgres pg_dump -U queue -d queue -Fc > \
  /srv/pila-lang/backups/queue-$(date +%F).dump

# MinIO mirror (local target). Requires the mc alias to be set once.
docker run --rm --network host minio/mc alias set local \
  http://localhost:9000 $S3_ACCESS_KEY $S3_SECRET_KEY
docker run --rm --network host -v /srv/pila-lang/backups:/backups minio/mc \
  mirror --overwrite local/queue-logos /backups/logos-$(date +%F)
```

Cron example (`/etc/cron.d/pila-lang`):

```
0 3 * * * root /srv/pila-lang/ops/backup.sh >> /var/log/pila-lang-backup.log 2>&1
```

Retention: delete dumps older than 14 days (`find ... -mtime +14 -delete`).

---

## 5. Restore from backup

```bash
# Stop the app first so no writes race the restore.
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop app

# Restore postgres.
docker compose exec -T postgres \
  pg_restore -U queue -d queue --clean --if-exists < \
  /srv/pila-lang/backups/queue-2026-04-19.dump

# Restore blobs.
docker run --rm --network host -v /srv/pila-lang/backups:/backups minio/mc \
  mirror --overwrite /backups/logos-2026-04-19 local/queue-logos

# Bring the app back up.
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d app
curl -fsS http://localhost:3000/api/health
```

---

## 6. Password-rotation recovery

A host lost their password. You do not need their help.

1. Open `/admin/tenants` and click the tenant.
2. Click **Reset host password**.
3. A new one-time plaintext password appears. Copy it.
4. Deliver the password to the manager out-of-band.

The previous password version is bumped, which signs out every device currently holding a session cookie — they get a 401 on their next action and land back on the login page.

If the admin-side UI is unreachable, connect to postgres directly and run:

```sql
UPDATE tenants SET host_password_version = host_password_version + 1 WHERE slug = '<slug>';
```

— then issue a new password via the admin UI once available. The version bump is what kicks live sessions.

---

## 7. Admin allow-list management

Add or remove admin emails by editing `ADMIN_EMAILS` in `.env.prod` (comma-separated) and restarting the app container:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  --env-file .env.prod up -d --force-recreate app
```

This is read at boot; hot reload of the value is not supported.

---

## 8. Log inspection

```bash
docker compose logs -f app
```

Structured events you'll see — grep for these names:

- `party.joined`, `party.seated`, `party.removed`, `party.left`, `party.restored`
- `host.login.ok`, `host.login.failed`, `host.password.rotated`
- `admin.tenant.created`, `admin.tenant.deleted`, `admin.demo.reset`
- `admin.magic_link.blocked`, `admin.sign_in.blocked`

Each entry is a single JSON line. Pipe through `jq` for filtering:

```bash
docker compose logs --no-log-prefix app | jq -r 'select(.event=="host.login.failed")'
```

---

## 9. Troubleshooting

**"SSE clients disconnect every few seconds."** Check the reverse proxy timeout. Nginx default is 60s — raise `proxy_read_timeout` to 120s+. The stream sends `:ping` comments every 15s so idle timeout never fires in a healthy deployment.

**"Logo uploads return 500."** Verify MinIO is reachable from the `app` container: `docker compose exec app wget -qO- http://minio:9000/minio/health/live`. If that fails, MinIO is down. If it succeeds, check `S3_ACCESS_KEY`/`S3_SECRET_KEY` in `.env.prod`.

**"Redis OOM."** Pub/sub + rate limits should never exceed a few MB. If Redis is at the `maxmemory` limit, something else in the network is writing to it. Confirm `SELECT 0` keys with `redis-cli DBSIZE`.

**"Guest wait page shows `Reconnecting…` permanently."** The SSE stream is rejecting the cookie or the party no longer exists. Check the app logs for the session token from that guest's request; a common cause is a demo reset that removed the row while the browser stayed open.

**"Display QR rotates but phones say `expired`."** The display page and the guest device clocks are out of sync. The QR token has a generous overlap window, but more than a minute of drift breaks it. Fix NTP on the display tablet.

---

## 10. On-call contact

Pager rotation lives in the team's on-call tool. For out-of-band escalation, check the project README for maintainer emails.
