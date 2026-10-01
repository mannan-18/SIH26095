# Securesight (DoSJE Nigrani 2.0 Grid) - Test Failures & Defect Register

**Problem Statement 26095:** Smart Real-Time Monitoring & Inspection Mobile App  
**Testing Date:** October 1, 2026  
**Status:** All Identified Defects RESOLVED / CLOSED (Branch: `fix/login-hardening`)  

---

## Defect 1: Login Rate Limiter Route Mismatch (B3) - [FIXED]

- **Status:** **CLOSED / FIXED** (Commit `8cd7b59`)
- **Evidence Type:** `LIVE` & `UNIT`
- **Severity:** High *(Elevated: Absence of rate limiting on real tRPC login path permitted automated brute-forcing)*
- **Test ID:** `B3`
- **Affected Endpoint:** `/api/trpc/auth.login`
- **Steps to Reproduce (Pre-Fix):**
  1. Send 12 rapid failed login requests to `http://localhost:3000/api/trpc/auth.login`.
  2. Inspect the HTTP response status codes for attempts 11 and 12.
- **Expected Result:**
  Attempts 11 and 12 should be rejected with HTTP 429 Too Many Requests (`Too many login attempts. Please wait 15 minutes before trying again.`).
- **Actual Result (Post-Fix):**
  Attempts 1 to 10 return HTTP 401 Unauthorized (`Invalid credentials for the selected role.`). Attempts 11 and 12 return **HTTP 429 Too Many Requests** (`Too many login attempts. Please wait 15 minutes before trying again.`). Static assets and non-login tRPC queries (e.g. `dashboard.overview`) remain accessible with HTTP 200/401 during lockout. Successful logins do not consume the failed attempt budget (`skipSuccessfulRequests: true`).
- **Root Cause & Resolution:**
  Express rate limiter in [`server/_core/index.ts`](../../server/_core/index.ts#L313) was previously bound to unused paths `/api/auth/login` and `/api/dosje-login`. Re-mounted `authLoginLimiter` on `/api/trpc` specifically for requests whose path contains `auth.login` (single or batched).
- **Limitation Note:**
  The rate limiter uses in-memory store. A server restart resets failure counts and limits are tracked per server instance.

---

## Defect 2: Detailed User Existence Revelation on Login Error (K8) - [FIXED]

- **Status:** **CLOSED / FIXED** (Commit `340fbd8`)
- **Evidence Type:** `LIVE` & `UNIT`
- **Severity:** Low
- **Test ID:** `K8`
- **Affected Function:** `verifyServerRoleCredentials` in [`server/config/authConfig.ts`](../../server/config/authConfig.ts#L100)
- **Steps to Reproduce (Pre-Fix):**
  1. Submit a login request with an invalid user ID (`INVALID-ID-9999`).
  2. Submit a login request with a valid user ID but wrong password (`DOSJE-OFF-01` and `wrongpassword`).
- **Expected Result:**
  Both attempts must return identical error messages and identical HTTP 401 status without revealing user ID existence.
- **Actual Result (Post-Fix):**
  Both Case A (Unknown ID) and Case B (Known ID, wrong password) return identical HTTP 401 Unauthorized responses with message `"Invalid credentials for the selected role."`. Detailed failure reasons (`Reason: Unknown ID` vs `Reason: Invalid Password`) are written exclusively to server logs.
- **Root Cause & Resolution:**
  Refactored [`server/config/authConfig.ts`](../../server/config/authConfig.ts#L100) to perform constant-time password check simulation and return a unified error message (`"Invalid credentials for the selected role."`) containing zero user IDs or passwords.

---
*Register updated and verified by Securesight Security Engineering Team.*
