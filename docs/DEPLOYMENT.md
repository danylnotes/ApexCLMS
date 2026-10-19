# Deployment

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. Use a least-privileged application user. |
| `APP_URL` | yes | Public base URL, used in emails and origin checks. |
| `COOKIE_SECURE` | prod | `true` when served over HTTPS (always in production). |
| `SESSION_TTL_HOURS`, `SESSION_IDLE_MINUTES` | no | Defaults for session lifetime; administrators can override in Configuration. |
| `STORAGE_DRIVER`, `STORAGE_LOCAL_DIR` | yes | `local` driver writes to a private directory (mount a persistent, backed-up volume). Never place it under `public/`. |
| `MAX_UPLOAD_MB` | no | Upload size limit (default 10). |
| `EMAIL_PROVIDER`, `EMAIL_FROM` | no | `outbox` (default) records messages in `email_outbox`. |
| `JOBS_SECRET` | prod | ≥ 12 random characters; required to call `POST /api/v1/jobs/run`. |
| `DEMO_MODE` | no | `true` shows the demo account list on the sign-in page. Never enable with real users. |
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` | no | Reserved for SSO (see below). |
| `ALLOW_DEMO_SEED` | no | Must be `true` for the seed to run when `NODE_ENV=production` (isolated demo environments only). |

Secrets are read from the environment only; none are stored in source control. Use your platform's secret manager.

## Build and run

```bash
npm ci
npx prisma migrate deploy      # apply migrations (idempotent; run on every release before starting)
npm run build                  # Next.js production build (output: standalone)
npm start                      # or: node .next/standalone/server.js
```

A `Dockerfile` is provided (multi-stage, non-root user, standalone output). Run migrations as a release step: `docker run --rm --env-file .env apex-lms npx prisma migrate deploy`.

**Fresh environment without demo data:** apply migrations, then create roles/permissions and the first administrator. The simplest route is to run the seed in an isolated environment, then deactivate or remove demo users — or insert the `roles`, `permissions` and `role_permissions` rows from `src/server/permissions.ts` and invite the first administrator. Demo users are flagged `isDemo = true` and use the `.test` domain, so they are easy to identify and must never be mixed with production records.

## Health checks and observability

- `GET /api/v1/health` — 200 `{status:"ok"}` when the database responds; 503 otherwise. Use for liveness/readiness probes.
- Server errors are logged with a digest; users see a reference, never stack traces.
- `audit_logs` records sign-ins, lockouts, approvals, grading, competency assessments, assignments, exports, user/role/settings changes.
- `job_runs` records each scheduled run and its counts.

## Scheduled processes

Run hourly from cron, Kubernetes CronJob or your scheduler:

```bash
curl -fsS -X POST -H "Authorization: Bearer $JOBS_SECRET" https://learning.example.com/api/v1/jobs/run
# or inside the container
npm run jobs:run
```

The job sends deadline and overdue reminders, webinar reminders, certificate-expiry and reassessment notices, closes finished webinars and purges stale sessions. Notifications are de-duplicated, so overlapping runs are harmless.

## Backup and recovery

- **Database**: daily `pg_dump -Fc` (or managed snapshots) plus point-in-time recovery via WAL archiving; retain per corporate policy. Test restores quarterly into an isolated environment.
- **Files**: back up `STORAGE_LOCAL_DIR` on the same schedule. File rows reference storage keys, so restore both to a consistent point.
- **Recovery order**: restore the database, restore files, run `prisma migrate deploy`, start the application, verify `/api/v1/health`.
- Historical records (completions, certificates, approved CPD, competency assessments, plan reviews, audit) are append-only by design, which simplifies reconciliation.

## Integration points (not active in this release)

### Single sign-on (Microsoft Entra ID)
Register an application in Entra ID with redirect URI `https://<host>/api/v1/auth/sso/callback`, then implement the OIDC authorization-code flow (e.g. `openid-client`) in a route that maps the verified `email`/`oid` claim to an existing `users` row and calls `createSession`. Keep local accounts for break-glass administrators. Until then `/sso` honestly reports that SSO is not configured.

### Email
`src/server/email.ts` is the single delivery point. Add an SMTP (nodemailer) or Microsoft Graph provider there and mark rows `SENT`/`FAILED`. Alternatively run a relay that reads `email_outbox WHERE status='QUEUED'`.

### Object storage
`src/server/storage.ts` (`saveFile`, `readStoredFile`) is the single storage boundary. To use S3/Azure Blob, implement the same two functions against a private bucket; continue to stream through `/api/v1/files/{id}` (or issue short-lived signed URLs after the same authorisation check).

### Teams / Zoom attendance
Store the meeting identifier in `webinars.externalMeetingId`; a job can fetch the attendance report and call `recordAttendance` with `verification: "PLATFORM_RECORD"`.
