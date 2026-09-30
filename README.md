# SecureSight

SecureSight is a Smart India Hackathon 2026 MVP for DoSJE project monitoring, surprise inspections, evidence integrity, and risk-led field verification.

## Confirmed stack

SecureSight intentionally stays on the existing WebDev stack:

- React 19, TypeScript, Vite, and Tailwind CSS
- Express 4 with tRPC 11
- Drizzle ORM with managed MySQL
- Manus OAuth for authentication
- Built-in S3-compatible object storage for evidence bytes
- Server-side Haversine distance calculation for geofencing

This project does not use FastAPI, SQLAlchemy, PostgreSQL, PostGIS, or Alembic.

## Implemented MVP capabilities

The current MVP includes server-authoritative surprise-assignment workflow, sealed assignment transitions, role-aware procedures, evidence SHA-256 verification, Haversine geofencing, risk scoring, attendance signals, CCTV and video-conference provider boundaries, alert triage, scheme-specific checklists, audit-chain verification, signed evidence downloads, IndexedDB offline queue foundation, and a service-worker shell cache.

Domain records are persisted through the Drizzle-managed MySQL `domain_records` table and rehydrated before the server accepts requests. This JSON-backed MVP persistence envelope preserves the existing typed domain contracts while avoiding an unsafe framework or database-engine migration at this stage.

## Run locally

```bash
pnpm install
pnpm check
pnpm test
pnpm build
pnpm dev
```

The development server uses port `3000` when available. The managed preview is exposed through the WebDev HTTPS proxy.

## Database migrations

Schema changes are generated through Drizzle and applied through the configured migration workflow:

```bash
pnpm drizzle-kit generate
pnpm db:push
```

The checked-in migration history includes the `domain_records` table used for restart-safe MVP persistence.

## Demo flow

1. Open the Command Centre and inspect KPI cards, recent inspections, alerts, and readiness posture.
2. Open **Institutes & projects**, choose an institute, and click **Start surprise**.
3. Open **Assignments** and execute generate, seal, reveal, GPS, evidence, submit, and advisory risk analysis.
4. Open **Evidence verification** and use **Tamper & re-verify** to create a server-side hash mismatch, alert, and audit event.
5. Open **Tamper-evident audit** and click **Verify chain**.

## OAuth and preview behavior

The frontend uses `VITE_OAUTH_REDIRECT_URI` when it is configured and validates that the callback is exactly `/api/oauth/callback` over HTTPS. The public sandbox preview domain is not guaranteed to be allowlisted in the Manus OAuth application. To avoid sending reviewers to a guaranteed `invalid redirect_uri` error, the preview stays available as a read-only demo when no authenticated session is present; protected mutations remain enforced by the server. Configure the exact deployed callback URI in the Manus OAuth application before enabling operator sign-in for a deployment.

## Evidence storage

Evidence uploads validate MIME type and size, calculate SHA-256 on the server, upload bytes through the built-in S3-compatible presigned storage path, and expose authorized signed downloads. The MVP validation is not a full antivirus engine. Evidence metadata is stored with the domain persistence layer.

## Important limitations

The current MVP is suitable for judging and controlled pilot design. Production hardening still includes dedicated normalized MySQL domain tables, field-level institute ownership checks backed by persistent memberships, encrypted offline evidence, background retry scheduling, malware scanning, rate limiting, backup automation, and operational monitoring.

See `MVP_COMPLETION_REPORT.md` for the evidence-based completion status and `CLOUD_TEST_HANDOFF_REPORT.md` for the HMR test handoff.
