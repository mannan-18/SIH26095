# Server Domain Layer (`server/domain`)

## Responsibilities
This layer contains all core domain business logic, simulation state management, and cryptography:
- `demoStore.ts`: Domain state store, in-memory fallback, and workflow simulations.
- `secureEngine.ts`: SHA-256 tamper-evident audit ledger, geofence verification, and risk-scoring algorithms.
- `providers.ts`: CCTV feed and Video Conference provider integrations.
- `storage.ts` & `storageAccess.ts`: Object storage abstraction and access control policies.

## Rules
- Domain modules must remain UI-agnostic and Express/tRPC wrapper-agnostic.
- Domain modules access data persistence via `server/db/db.ts`.
- Client files MUST NOT import from `server/domain/`.
