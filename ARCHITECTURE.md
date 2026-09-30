# SecureSight architecture

SecureSight is a modular monolith built for a focused monitoring and inspection workflow. The client is a React 19 application served by Vite in development and by the Express process in production. The server exposes typed tRPC procedures and a small authenticated multipart route for evidence ingestion.

## Runtime layers

| Layer | Technology | Responsibility |
|---|---|---|
| Browser client | React 19, TypeScript, Tailwind CSS | Command Centre, map, inspections, evidence, alerts, and audit views |
| API contract | tRPC 11 | Typed query and mutation procedures under `/api/trpc` |
| HTTP runtime | Express 4 and Node.js | OAuth callbacks, multipart evidence route, static assets, and tRPC adapter |
| Persistence | Drizzle ORM and managed MySQL | Auth users and restart-safe domain record envelope |
| Object storage | Built-in S3-compatible storage | Evidence bytes through presigned PUT/GET flows |
| Authentication | Manus OAuth | Session cookie and authenticated request context |
| Offline foundation | IndexedDB and service worker | Local inspection outbox and cached application shell |

## Domain persistence

The MVP uses the Drizzle-managed MySQL `domain_records` table. Each row contains a stable entity, record identifier, and JSON payload. Startup hydration loads records into the existing typed domain service. Mutating workflow procedures enqueue a transactional bulk upsert before returning to the caller.

This design is an intentional MVP persistence envelope. It removes critical state from process memory while preserving the current domain contracts. A later production iteration can normalize each entity into dedicated MySQL tables without changing the external tRPC contract.

## Security boundaries

The server selects inspectors, seals assignments, computes evidence hashes, evaluates geofence distance, updates audit hashes, and authorizes role-specific procedures. The browser never chooses an inspector or supplies a trusted evidence hash.

Geofencing uses one application-level Haversine implementation in `server/secureEngine.ts`. The calculation returns a 100-meter signal and does not independently assert fraud when location is unavailable.

Evidence bytes are sent to the built-in S3-compatible storage provider. Metadata remains under server control. Download requests require authentication and an allowed operational role before the server returns a signed object URL.

## Provider boundaries

CCTV and video-conference integrations use explicit provider interfaces. The current provider implementations are deterministic demo providers. They return honest unavailable, invalid, offline, or demo statuses instead of pretending to be live external integrations.

## Production evolution

The next hardening steps are normalized MySQL repositories, persisted organization memberships, encrypted offline evidence, background sync, malware scanning, rate limits, structured monitoring, and backup automation. This project does not claim FastAPI, SQLAlchemy, PostgreSQL, PostGIS, or Alembic infrastructure.
