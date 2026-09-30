# SecureSight security model

SecureSight treats the server as authoritative for inspector selection, assignment transitions, evidence verification, geofence signals, risk analysis, authorization, and audit-chain generation.

## Implemented controls

- Role checks execute in protected tRPC procedures.
- Institute-scope checks reject the current cross-institute institute-admin path.
- Inspector selection uses server-side eligibility filters and cryptographic randomness.
- Sealed assignments cannot be modified or revealed early.
- Evidence hashes are computed on the server.
- Evidence uploads use an allowlisted MIME type and a 10 MB size limit.
- Evidence bytes are stored through the built-in S3-compatible storage helper.
- Downloads return signed object URLs only after authentication and role checks.
- Audit events contain previous and current hashes.
- Audit verification recomputes the canonical hash chain.
- Geofencing uses one application-level Haversine calculation.
- AI/risk output is advisory and cannot mutate security-critical records.
- Provider failures return explicit unavailable or failed states.
- Secrets remain server-side and are not imported into client code.

## Persistence controls

The Drizzle-managed MySQL `domain_records` table stores institutes, inspectors, inspections, evidence metadata, alerts, assignments, attendance, and audit events as typed JSON payloads. Workflow mutations perform a transactional bulk upsert before returning. Startup hydration loads the persisted records before accepting requests.

The JSON envelope is an MVP persistence boundary. A production deployment should normalize the entities into dedicated MySQL tables, add foreign keys, add membership tables, and use transactional row locking for assignment creation.

## Evidence limitations

MIME and size checks are basic upload validation. They are not a full antivirus or malware-scanning engine. Production should add quarantine, content inspection, retention automation, and immutable object-lock policy.

## Offline limitations

The current IndexedDB outbox and service-worker shell are a foundation. Binary evidence encryption, key derivation at login, background retry scheduling, and server-authoritative conflict resolution remain production work.

## Deferred production controls

The MVP has a process-local 120 requests/minute `/api/trpc` rate limit and a readiness endpoint. Before broad deployment, replace the in-process limiter with a distributed control, add authentication-specific throttling, structured error monitoring, database backups, secret rotation, formal organization membership authorization, retention enforcement, and centralized health/metrics.

SecureSight does not claim FastAPI, SQLAlchemy, PostgreSQL, PostGIS, or Alembic infrastructure.
