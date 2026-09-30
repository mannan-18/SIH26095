# Securesight Refactoring Move Map

This table lists every file moved during the safe, behavior-preserving repository reorganization.

| Original Path | New Path | Group / Category |
| :--- | :--- | :--- |
| `ARCHITECTURE.md` | `docs/architecture/ARCHITECTURE.md` | Documentation |
| `docs/AUDIT_REPORT_V2.md` | `docs/reports/AUDIT_REPORT_V2.md` | Reports |
| `docs/DEMO_SCRIPT.md` | `docs/demo/DEMO_SCRIPT.md` | Demo Guides |
| `docs/mysql_domain_schema.sql` | `docs/database/mysql_domain_schema.sql` | Database Schema Docs |
| `docs/login-screenshots/*` | `docs/screenshots/login/*` | Screenshots |
| `server/administration.test.ts` | `server/__tests__/administration.test.ts` | Server Tests |
| `server/auth.logout.test.ts` | `server/__tests__/auth.logout.test.ts` | Server Tests |
| `server/demoStore.test.ts` | `server/__tests__/demoStore.test.ts` | Server Tests |
| `server/oauth.redirect.test.ts` | `server/__tests__/oauth.redirect.test.ts` | Server Tests |
| `server/persistence.test.ts` | `server/__tests__/persistence.test.ts` | Server Tests |
| `server/rbac.providers.test.ts` | `server/__tests__/rbac.providers.test.ts` | Server Tests |
| `server/secureEngine.test.ts` | `server/__tests__/secureEngine.test.ts` | Server Tests |
| `server/storageAccess.test.ts` | `server/__tests__/storageAccess.test.ts` | Server Tests |
| `server/authConfig.ts` | `server/config/authConfig.ts` | Server Config |
| `server/db.ts` | `server/db/db.ts` | Server DB |
| `server/demoStore.ts` | `server/domain/demoStore.ts` | Server Domain |
| `server/secureEngine.ts` | `server/domain/secureEngine.ts` | Server Domain |
| `server/providers.ts` | `server/domain/providers.ts` | Server Domain |
| `server/storage.ts` | `server/domain/storage.ts` | Server Domain |
| `server/storageAccess.ts` | `server/domain/storageAccess.ts` | Server Domain |
| `server/routers.ts` | `server/routers/routers.ts` | Server Routers |
| `client/src/App.tsx` | `client/src/app/App.tsx` | Client App |
| `client/src/main.tsx` | `client/src/app/main.tsx` | Client App |
| `client/src/index.css` | `client/src/styles/index.css` | Client Styles |
| `client/src/const.ts` | `client/src/lib/const.ts` | Client Lib |
| `client/src/_core/hooks/useAuth.ts` | `client/src/hooks/useAuth.ts` | Client Hooks |
| `client/src/components/BiometricCheckinModal.tsx` | `client/src/components/capture/BiometricCheckinModal.tsx` | Client Components |
| `client/src/components/CameraCapture.tsx` | `client/src/components/capture/CameraCapture.tsx` | Client Components |
| `client/src/components/CctvPlayer.tsx` | `client/src/components/cctv/CctvPlayer.tsx` | Client Components |
| `client/src/components/VideoConferenceModal.tsx` | `client/src/components/vc/VideoConferenceModal.tsx` | Client Components |
| `client/src/components/ErrorBoundary.tsx` | `client/src/components/common/ErrorBoundary.tsx` | Client Components |
