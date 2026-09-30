# Claim Verification Matrix (AUDIT_REPORT_V2.md vs. Source Code)

**Project:** Securesight (DoSJE Nigrani 2.0 Grid) @ `d:\26095`  
**Verification Date:** October 1, 2026  
**Auditor Branch:** `docs/audit-v3`

---

## 1. Summary of Claim Verification Audit

Every factual claim in `AUDIT_REPORT_V2.md` was cross-referenced against the active TypeScript source code, test suites, and built production artifacts. Claims are categorized into:
- **Verified:** Fully backed by working code and active unit tests.
- **Partial:** Code logic exists, but unit tests or full integration coverage was incomplete.
- **Overstated / Not Found:** Claims where the implementation differed from marketing assertions, or where features described in V2 do not exist in the code.

---

## 2. Comprehensive Claim Verification Table

| Claim in AUDIT_REPORT_V2.md | Source File / Test Path | Result | Verification Findings & Notes |
| :--- | :--- | :--- | :--- |
| **Server-side Haversine Distance Calculation** | `server/domain/secureEngine.ts#L89` <br> `server/__tests__/secureEngine.test.ts#L22` | **Verified** | `calculateHaversineDistance` computes standard spherical distance in meters using $\Delta\phi$ and $\Delta\lambda$. Tested in Vitest. |
| **GPS Accuracy Threshold (>50m Rejection)** | `server/domain/secureEngine.ts#L134` <br> `server/__tests__/secureEngine.test.ts#L46` | **Verified** | `evaluateServerGeofence` flags `accuracy > 50` as `SPOOF_DETECTED` with detailed reason. Tested in Vitest. |
| **GPS Speed Anomaly Rejection (>150 km/h)** | `server/domain/secureEngine.ts#L143` | **Partial** | Speed heuristic is fully implemented using consecutive GPS fix history (`lastGpsFixStore`). However, vitest unit test for speed threshold was missing (added in Phase 2). |
| **GPS Timestamp Skew (>120s Rejection)** | `server/domain/secureEngine.ts#L120` <br> `server/__tests__/secureEngine.test.ts#L35` | **Verified** | Evaluates `Math.abs(serverTime - deviceTimestamp) > 120_000`. Tested in Vitest. |
| **Single-Use 120s Evidence Nonces** | `server/domain/secureEngine.ts#L12` <br> `server/__tests__/secureEngine.test.ts#L79` | **Partial** | Nonce creation, 120s expiration, and replay rejection are fully implemented. Replay is tested in Vitest, but nonce expiration timeout test was missing (added in Phase 2). |
| **SHA-256 Tamper-Evident Hash Chain** | `server/domain/secureEngine.ts#L35` <br> `server/__tests__/secureEngine.test.ts#L58` | **Verified** | Implements canonical JSON serialization and SHA-256 hash chaining (`previousHash` -> `currentHash`). Includes index-accurate broken entry detection. Tested in Vitest. |
| **State Authority Regional Scoping (HTTP 403)** | `server/routers/routers.ts#L262` | **Partial** | `stateAuthority.getRegionalData` enforces strict matching between user token state and requested region, throwing `TRPCError({ code: "FORBIDDEN" })`. Scoping code is verified, but unit test for 403 rejection was missing (added in Phase 2). |
| **Risk-Weighted Assignment Engine** | `server/domain/secureEngine.ts#L270` <br> `server/__tests__/secureEngine.test.ts#L151` | **Verified** | `calculateInstituteRiskScore` scores recent anomalies (+15), attendance variance (30%), missed VC calls (+20), CCTV offline (+25), and inspection age (+15). Tested in Vitest. |
| **Assignment Constraints (Repeat Pairing & District Conflict)** | `server/domain/secureEngine.ts#L342` <br> `server/__tests__/secureEngine.test.ts#L106` | **Verified** | Rejects same-district assignments (home inspector) and repeat pairings within 14 days. Tested in Vitest. |
| **CCTV Freeze Watchdog** | `client/src/components/cctv/CctvPlayer.tsx#L30` | **Overstated** | Watchdog runs **client-side** in React component checking HTML5 `<video>` element `currentTime` progression. It detects stream stalls ($>8\text{s}$ freeze), NOT AI video content looping. No server-side background daemon monitors feeds when no client browser is open. |
| **Random Video Conference (VC) Calls** | `client/src/components/vc/VideoConferenceModal.tsx` <br> `server/domain/demoStore.ts` | **Verified with Note** | Jitsi WebRTC embed uses public `meet.jit.si` host (not configurable). VC events (`ANSWERED`, `DECLINED`, `MISSED`, `ENDED`) are logged to the audit ledger. |
| **Real-Time Server-Sent Events (SSE)** | *None* | **Not Found** | V2 claimed `/api/events/sse` pushed real-time updates. No SSE endpoint or `EventSource` client listener exists in the codebase. Real-time updates rely on TanStack Query polling / tRPC query refetches. |
| **Script `repair-audit-chain.ts` Gating** | `scripts/repair-audit-chain.ts` | **Overstated / Security Risk** | Script fetches all audit events, recalculates SHA-256 hashes sequentially, and overwrites DB records. In V2, it ran unconditionally without `DEMO_MODE` checks, enabling full ledger rewrite by any database operator (gated in Phase 2). |
| **Credential Storage & Bundle Leak Audit** | `server/config/authConfig.ts` <br> `dist/public/` | **Verified with Note** | Plaintext demo passwords (`Admin@2026`, `Inspect@2026`, etc.) exist in `authConfig.ts` for demo mode. Grep of built client JS bundle (`dist/public/`) confirmed **0 plaintext passwords in client assets**, as credentials are processed server-side. |
| **Duplicate `const.ts` Files** | `shared/const.ts` vs `client/src/lib/const.ts` | **Verified** | Not redundant duplicates. `shared/const.ts` holds pure data tokens & state encoders. `client/src/lib/const.ts` re-exports shared tokens and adds DOM browser navigation (`startLogin`). |
| **Bundle & `index.html` Size Breakdown** | `vite.config.ts` <br> `client/src/app/App.tsx` | **Verified** | `dist/public/index.html` is ~368 kB because `vite-plugin-manus-runtime` inlines the debug runtime script directly into HTML. Main JS bundle is ~1.28 MB because all route components are imported synchronously in `App.tsx` without code splitting. |
| **Service Worker Shell Caching** | `client/public/service-worker.js#L23` | **Verified** | Confirmed service worker bypasses `/api/`, `/trpc`, and `text/event-stream` requests from cache. |
| **Data Persistence Architecture** | `server/db/db.ts` <br> `server/domain/demoStore.ts` | **Verified** | When `DATABASE_URL` is set, state persists to MySQL `domain_records` table. When unset, system falls back to in-memory store (state resets on process restart). |
