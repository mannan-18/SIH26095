# Proposed Repository Structure (Securesight DoSJE Nigrani 2.0 Grid)

## Overview & Principles
This document outlines the before → after mapping for the refactoring of `Securesight (DoSJE Nigrani 2.0 Grid)`.
The goal is to establish a clean, layered, domain-driven structure while preserving 100% of runtime behavior, API shapes, routing, and database schema.

---

## High-Risk Path References Audit
The following path references outside imports were audited in Phase 0 and will be kept aligned during file moves:

1. **`package.json`**:
   - `scripts.build`: `vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`
   - `scripts.dev`: `tsx server/_core/index.ts`
   - `scripts.start`: `node dist/index.js`
   - `patchedDependencies`: `"wouter@3.7.1": "patches/wouter@3.7.1.patch"`

2. **`vite.config.ts`**:
   - `root`: `path.resolve(import.meta.dirname, "client")`
   - `build.outDir`: `path.resolve(import.meta.dirname, "dist/public")`
   - `@` alias: `path.resolve(import.meta.dirname, "client", "src")`
   - `@shared` alias: `path.resolve(import.meta.dirname, "shared")`
   - `@db` alias: `path.resolve(import.meta.dirname, "drizzle")`

3. **`tsconfig.json`**:
   - `paths.@/*`: `["./client/src/*"]`
   - `paths.@shared/*`: `["./shared/*"]`
   - `paths.@db/*`: `["./drizzle/*"]`
   - `include`: `["client/src/**/*", "shared/**/*", "server/**/*"]`

4. **`vitest.config.ts`**:
   - `alias.@`: `./client/src`
   - `alias.@shared`: `./shared`
   - `alias.@db`: `./drizzle`
   - `include`: `["server/**/*.test.ts"]`

5. **`drizzle.config.ts`**:
   - `schema`: `./drizzle/schema.ts`
   - `out`: `./drizzle`

6. **`server/_core/vite.ts`**:
   - `import viteConfig from "../../vite.config"`
   - `clientTemplate`: `path.resolve(import.meta.dirname, "../..", "client", "index.html")`
   - HTML injection replacement target: `src="/src/main.tsx"` -> updated to `src="/src/app/main.tsx"` when `main.tsx` moves to `client/src/app/`
   - `distPath`: `path.resolve(import.meta.dirname, "../..", "dist", "public")`

7. **`client/index.html`**:
   - `<script type="module" src="/src/main.tsx"></script>` -> updated to `<script type="module" src="/src/app/main.tsx"></script>`

8. **`client/public/service-worker.js`**:
   - Serves static assets, excludes `/api/` and `/trpc` and `text/event-stream`. URL paths remain stable.

---

## Detailed Before → After Move Map

### 1. Documentation (`docs/`)
| Before Path | Proposed After Path | Rationale / Layer |
| :--- | :--- | :--- |
| `docs/AUDIT_REPORT_V2.md` | `docs/reports/AUDIT_REPORT_V2.md` | Group under reports |
| `docs/DEMO_SCRIPT.md` | `docs/demo/DEMO_SCRIPT.md` | Group under demo guides |
| `docs/mysql_domain_schema.sql` | `docs/database/mysql_domain_schema.sql` | Group under database schema docs |
| `docs/login-screenshots/*` | `docs/screenshots/login/*` | Consolidate login screenshots into main screenshots folder |
| `ARCHITECTURE.md` | `docs/architecture/ARCHITECTURE.md` | Centralize architecture documentation |

---

### 2. Server Unit Tests (`server/__tests__/`)
| Before Path | Proposed After Path | Rationale / Layer |
| :--- | :--- | :--- |
| `server/administration.test.ts` | `server/__tests__/administration.test.ts` | Server unit test suite |
| `server/auth.logout.test.ts` | `server/__tests__/auth.logout.test.ts` | Server unit test suite |
| `server/demoStore.test.ts` | `server/__tests__/demoStore.test.ts` | Server unit test suite |
| `server/oauth.redirect.test.ts` | `server/__tests__/oauth.redirect.test.ts` | Server unit test suite |
| `server/persistence.test.ts` | `server/__tests__/persistence.test.ts` | Server unit test suite |
| `server/rbac.providers.test.ts` | `server/__tests__/rbac.providers.test.ts` | Server unit test suite |
| `server/secureEngine.test.ts` | `server/__tests__/secureEngine.test.ts` | Server unit test suite |
| `server/storageAccess.test.ts` | `server/__tests__/storageAccess.test.ts` | Server unit test suite |

---

### 3. Server Core & Domain (`server/`)
| Before Path | Proposed After Path | Rationale / Layer |
| :--- | :--- | :--- |
| `server/_core/*` | `server/_core/*` | UNTOUCHED (system runtime infrastructure) |
| `server/authConfig.ts` | `server/config/authConfig.ts` | Server auth & env configuration |
| `server/db.ts` | `server/db/db.ts` | Database connection & user persistence helpers |
| `server/demoStore.ts` | `server/domain/demoStore.ts` | Domain state store & simulation engine |
| `server/secureEngine.ts` | `server/domain/secureEngine.ts` | SHA-256 audit ledger domain logic |
| `server/providers.ts` | `server/domain/providers.ts` | Mock CCTV and VC domain integration providers |
| `server/storage.ts` | `server/domain/storage.ts` | Storage domain service |
| `server/storageAccess.ts` | `server/domain/storageAccess.ts` | Storage access domain helpers |
| `server/routers.ts` | `server/routers/routers.ts` | tRPC route definitions (with barrel `server/routers/index.ts`) |

---

### 4. Client Application (`client/src/`)
| Before Path | Proposed After Path | Rationale / Layer |
| :--- | :--- | :--- |
| `client/public/*` | `client/public/*` | UNTOUCHED (static PWA assets) |
| `client/src/App.tsx` | `client/src/app/App.tsx` | Main App component & router root |
| `client/src/main.tsx` | `client/src/app/main.tsx` | Entrypoint mounting React root & tRPC client |
| `client/src/_core/hooks/useAuth.ts` | `client/src/hooks/useAuth.ts` | Custom authentication hook |
| `client/src/index.css` | `client/src/styles/index.css` | Global CSS styles & design tokens |
| `client/src/const.ts` | `client/src/lib/const.ts` | Client constants & login redirection helpers |
| `client/src/pages/Home.tsx` | `client/src/pages/Home.tsx` | Top-level page |
| `client/src/pages/Login.tsx` | `client/src/pages/Login.tsx` | Top-level page |
| `client/src/pages/Login.css` | `client/src/pages/Login.css` | Login page specific stylesheet |
| `client/src/pages/NotFound.tsx` | `client/src/pages/NotFound.tsx` | Top-level page |
| `client/src/components/BiometricCheckinModal.tsx` | `client/src/components/capture/BiometricCheckinModal.tsx` | Face verification modal component |
| `client/src/components/CameraCapture.tsx` | `client/src/components/capture/CameraCapture.tsx` | Live camera capture component |
| `client/src/components/CctvPlayer.tsx` | `client/src/components/cctv/CctvPlayer.tsx` | CCTV feed player component |
| `client/src/components/VideoConferenceModal.tsx` | `client/src/components/vc/VideoConferenceModal.tsx` | Video conference modal component |
| `client/src/components/ErrorBoundary.tsx` | `client/src/components/common/ErrorBoundary.tsx` | Common error boundary component |
| `client/src/components/dashboards/*` | `client/src/components/dashboards/*` | Role dashboard views |
| `client/src/components/ui/*` | `client/src/components/ui/*` | Design system primitive UI components |

---

### 5. Shared & Framework (`shared/`, `drizzle/`, `patches/`)
| Path | Status | Rationale |
| :--- | :--- | :--- |
| `shared/*` | UNTOUCHED / Maintained | Pure shared types, constants, and error models |
| `drizzle/*` | UNTOUCHED | Mandatory per Rule 2 (Drizzle migration history) |
| `patches/*` | UNTOUCHED | Mandatory per Rule 2 (package.json patch-package refs) |

---

## Architectural Notes & Boundary Flags
- **Client/Server Imports**: Verified no direct client imports from server code (all contract communication happens via tRPC definitions and `@shared`).
- **Circular Dependencies**: None detected in existing imports.
- **Needs Human Decision**: None. All files have clear domain boundaries and target layers.
