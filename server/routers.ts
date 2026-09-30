import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { verifyServerRoleCredentials, SERVER_DEMO_CREDENTIALS } from "./authConfig";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { alerts, assignments, auditLog, evidence, flushPersistence, generateAssignment, getAttendanceSummary, getAudit, getChecklistForInspection, getOverview, institutes, inspections, queuePersistence, reveal, runRiskAnalysis, seal, startSurpriseInspection, captureGps, submitInspection, updateAlertStatus, verifyEvidenceDemo, seedNewEvidence, requestEvidenceNonce, submitLiveCapture, activeVcSessions, triggerRandomVc, answerVcCall, declineVcCall, missVcCall, endVcCall, reportCctvFeedStatus, getRegionalOverview } from "./demoStore";
import { verifyAuditChain } from "./secureEngine";
import { MockCCTVProvider, MockVideoConferenceProvider } from "./providers";
import type { User } from "../drizzle/schema";
import { claimAssignment, createInvitedUser, getUserByOpenId, listUsers, updateUserAccess, upsertUser } from "./db";

export type ActorRole = "DEPARTMENT_ADMIN" | "PMU_INSPECTOR" | "INSTITUTE_ADMIN" | "STATE_AUTHORITY" | "AUDITOR";

export function actorRole(user: User): ActorRole {
  if (user.role === "admin" || user.role === "DEPARTMENT_ADMIN") return "DEPARTMENT_ADMIN";
  if (user.role === "PMU_INSPECTOR") return "PMU_INSPECTOR";
  if (user.role === "INSTITUTE_ADMIN") return "INSTITUTE_ADMIN";
  if (user.role === "STATE_AUTHORITY") return "STATE_AUTHORITY";
  if (user.role === "AUDITOR") return "AUDITOR";
  const email = user.email?.toLowerCase() ?? "";
  if (email.includes("auditor")) return "AUDITOR";
  if (email.includes("institute")) return "INSTITUTE_ADMIN";
  if (email.includes("state")) return "STATE_AUTHORITY";
  return "PMU_INSPECTOR";
}

function roleProcedure(...allowed: ActorRole[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    const role = actorRole(ctx.user);
    if (!allowed.includes(role)) throw new TRPCError({ code: "FORBIDDEN", message: `Role ${role} is not authorized for this operation` });
    return next({ ctx: { ...ctx, actorRole: role } });
  });
}

function assertInstituteScope(role: ActorRole, organizationId: string | null, instituteId: string) {
  if (role === "INSTITUTE_ADMIN" && (!organizationId || organizationId !== instituteId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Institute administrator cannot access another organization's records" });
  }
}

export function getUserStateScope(user: User): string {
  const openId = user.openId.toLowerCase();
  const email = (user.email ?? "").toLowerCase();
  if (openId.includes("maharashtra") || email.includes("maharashtra")) return "Maharashtra";
  if (openId.includes("karnataka") || email.includes("karnataka")) return "Karnataka";
  if (openId.includes("up") || email.includes("uttar-pradesh")) return "Uttar Pradesh";
  return "Delhi";
}

const readProcedure = protectedProcedure;
const departmentProcedure = roleProcedure("DEPARTMENT_ADMIN");
const fieldProcedure = roleProcedure("DEPARTMENT_ADMIN", "PMU_INSPECTOR");
const verificationProcedure = roleProcedure("DEPARTMENT_ADMIN", "AUDITOR");
const evidenceVerificationProcedure = roleProcedure("DEPARTMENT_ADMIN", "PMU_INSPECTOR", "AUDITOR");
const cctv = new MockCCTVProvider();
const vc = new MockVideoConferenceProvider();

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    demoCredentials: publicProcedure.query(() => {
      const isDemoMode = process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production";
      if (!isDemoMode) {
        return { demoMode: false, credentials: null };
      }
      return {
        demoMode: true,
        credentials: SERVER_DEMO_CREDENTIALS,
      };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    login: publicProcedure
      .input(
        z.object({
          role: z.enum(["official", "pmu", "ngo", "beneficiary", "state"]),
          identifier: z.string().trim().min(1, "Identifier is required"),
          password: z.string().min(1, "Password is required"),
          rememberMe: z.boolean().default(false),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const authCheck = verifyServerRoleCredentials(input.role, input.identifier, input.password);
        if (!authCheck.valid || !authCheck.credential) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: authCheck.error || "Authentication failed. Invalid credentials for the selected role.",
          });
        }

        const cred = authCheck.credential;
        const role: User["role"] = cred.dbRole;
        const defaultName = cred.name;
        const email = cred.email;
        const organizationId = cred.organizationId;
        const sanitizedId = input.identifier.replace(/[^a-zA-Z0-9_-]/g, "");
        const openId = `dosje-${cred.roleKey}-${sanitizedId.toLowerCase() || cred.primaryId.toLowerCase()}`;

        await upsertUser({
          openId,
          name: defaultName,
          email,
          role,
          organizationId,
          loginMethod: "dosje-login",
          lastSignedIn: new Date(),
        });

        const user = await getUserByOpenId(openId);
        if (!user) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to establish user session" });
        }

        const expiresInMs = input.rememberMe ? ONE_YEAR_MS : 24 * 60 * 60 * 1000;
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || defaultName,
          expiresInMs,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: expiresInMs,
        });

        return {
          success: true,
          token: sessionToken,
          user,
        };
      }),
  }),
  dashboard: router({
    overview: readProcedure.query(() => getOverview()),
    institutes: readProcedure.query(() => institutes),
    inspections: readProcedure.query(() => inspections),
    alerts: readProcedure.query(() => alerts),
    assignments: readProcedure.query(() => assignments),
    evidence: readProcedure.query(() => evidence.slice(0, 36)),
    attendance: readProcedure.query(() => getAttendanceSummary()),
    checklist: readProcedure.input(z.object({ inspectionId: z.string().regex(/^INSP-\d{4,}$/) })).query(({ input }) => getChecklistForInspection(input.inspectionId)),
    audit: verificationProcedure.query(() => getAudit()),
  }),
  workflow: router({
    startInspection: departmentProcedure.input(z.object({ instituteId: z.string().regex(/^INS-\d{3}$/) })).mutation(async ({ ctx, input }) => { assertInstituteScope(ctx.actorRole, ctx.user.organizationId, input.instituteId); const result = startSurpriseInspection(input.instituteId); queuePersistence(); await flushPersistence(); return result; }),
    generateAssignment: departmentProcedure.input(z.object({ inspectionId: z.string().regex(/^INSP-\d{4,}$/), requestedInspectorId: z.string().optional() })).mutation(async ({ input }) => { const claimed = await claimAssignment(input.inspectionId, randomUUID()); if (!claimed) throw new TRPCError({ code: "CONFLICT", message: "This inspection is already being assigned by another operator" }); const result = generateAssignment(input.inspectionId); queuePersistence(); await flushPersistence(); return result; }),
    sealAssignment: departmentProcedure.input(z.object({ assignmentId: z.string().regex(/^ASN-\d{4,}$/) })).mutation(async ({ input }) => { const result = seal(input.assignmentId); queuePersistence(); await flushPersistence(); return result; }),
    revealAssignment: departmentProcedure.input(z.object({ assignmentId: z.string().regex(/^ASN-\d{4,}$/) })).mutation(async ({ input }) => { const result = reveal(input.assignmentId); queuePersistence(); await flushPersistence(); return result; }),
    captureGps: fieldProcedure.input(z.object({ inspectionId: z.string().regex(/^INSP-\d{4,}$/), latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(), accuracy: z.number().nullable().optional(), deviceTimestamp: z.number().nullable().optional() })).mutation(async ({ input }) => { const result = captureGps(input.inspectionId, input.latitude, input.longitude, input.accuracy, input.deviceTimestamp); queuePersistence(); await flushPersistence(); return result; }),
    captureEvidence: fieldProcedure.input(z.object({ inspectionId: z.string().regex(/^INSP-\d{4,}$/) })).mutation(async ({ input }) => { const result = seedNewEvidence(input.inspectionId); queuePersistence(); await flushPersistence(); return result; }),
    requestNonce: fieldProcedure.input(z.object({ inspectionId: z.string().regex(/^INSP-\d{4,}$/) })).mutation(({ input }) => requestEvidenceNonce(input.inspectionId)),
    submitLiveEvidence: fieldProcedure.input(z.object({
      inspectionId: z.string().regex(/^INSP-\d{4,}$/),
      nonce: z.string().min(1),
      imageBase64: z.string().min(1),
      gps: z.object({
        latitude: z.number().min(-90).max(90).nullable(),
        longitude: z.number().min(-180).max(180).nullable(),
        accuracy: z.number().nullable().optional(),
        deviceTimestamp: z.number().nullable().optional(),
      }),
    })).mutation(async ({ input }) => {
      const result = submitLiveCapture(input.inspectionId, input.nonce, input.imageBase64, {
        latitude: input.gps.latitude,
        longitude: input.gps.longitude,
        accuracy: input.gps.accuracy ?? null,
        deviceTimestamp: input.gps.deviceTimestamp ?? null,
      });
      queuePersistence();
      await flushPersistence();
      return result;
    }),
    submitInspection: fieldProcedure.input(z.object({ inspectionId: z.string().regex(/^INSP-\d{4,}$/), observation: z.string().trim().min(3).max(1000), evidenceHash: z.string().optional() })).mutation(async ({ input }) => { const result = submitInspection(input.inspectionId, input.observation, input.evidenceHash); queuePersistence(); await flushPersistence(); return result; }),
    verifyEvidence: evidenceVerificationProcedure.input(z.object({ evidenceId: z.string().regex(/^EVD-\d{4,}$/), tamper: z.boolean().default(false) })).mutation(async ({ input }) => { const result = verifyEvidenceDemo(input.evidenceId, input.tamper); queuePersistence(); await flushPersistence(); return result; }),
    analyzeRisk: verificationProcedure.input(z.object({ inspectionId: z.string().regex(/^INSP-\d{4,}$/) })).mutation(async ({ input }) => { const result = runRiskAnalysis(input.inspectionId); queuePersistence(); await flushPersistence(); return result; }),
    verifyAudit: verificationProcedure.mutation(() => verifyAuditChain(getAudit().events)),
    createVideoSession: fieldProcedure.input(z.object({ participantId: z.string().trim().min(1).max(120) })).mutation(({ input }) => vc.createSession(input)),
    acknowledgeAlert: departmentProcedure.input(z.object({ alertId: z.string().regex(/^ALT-\d{4,}$/) })).mutation(async ({ input }) => { const result = updateAlertStatus(input.alertId, "ACKNOWLEDGED"); queuePersistence(); await flushPersistence(); return result; }),
    resolveAlert: departmentProcedure.input(z.object({ alertId: z.string().regex(/^ALT-\d{4,}$/) })).mutation(async ({ input }) => { const result = updateAlertStatus(input.alertId, "RESOLVED"); queuePersistence(); await flushPersistence(); return result; }),
  }),
  ledger: router({
    verifyChain: readProcedure.query(() => verifyAuditChain(auditLog)),
    tamperDemo: departmentProcedure.mutation(async () => {
      if (auditLog.length > 0) {
        const targetIdx = Math.min(1, auditLog.length - 1);
        auditLog[targetIdx].payload = { ...auditLog[targetIdx].payload, _TAMPERED_BY_ATTACKER: true };
      }
      queuePersistence();
      await flushPersistence();
      return verifyAuditChain(auditLog);
    }),
    restoreDemo: departmentProcedure.mutation(async () => {
      auditLog.forEach((entry) => {
        if (entry.payload && typeof entry.payload === "object" && "_TAMPERED_BY_ATTACKER" in entry.payload) {
          delete (entry.payload as any)._TAMPERED_BY_ATTACKER;
        }
      });
      queuePersistence();
      await flushPersistence();
      return verifyAuditChain(auditLog);
    }),
  }),
  vc: router({
    triggerRandom: departmentProcedure.mutation(async ({ ctx }) => {
      const session = triggerRandomVc(ctx.user.email ?? ctx.user.openId);
      queuePersistence();
      await flushPersistence();
      return session;
    }),
    activeCalls: readProcedure.query(() => activeVcSessions),
    answerCall: readProcedure.input(z.object({ sessionId: z.string() })).mutation(async ({ ctx, input }) => {
      const session = answerVcCall(input.sessionId, ctx.user.email ?? ctx.user.openId);
      queuePersistence();
      await flushPersistence();
      return session;
    }),
    declineCall: readProcedure.input(z.object({ sessionId: z.string() })).mutation(async ({ ctx, input }) => {
      const session = declineVcCall(input.sessionId, ctx.user.email ?? ctx.user.openId);
      queuePersistence();
      await flushPersistence();
      return session;
    }),
    missCall: readProcedure.input(z.object({ sessionId: z.string() })).mutation(async ({ input }) => {
      const session = missVcCall(input.sessionId);
      queuePersistence();
      await flushPersistence();
      return session;
    }),
    endCall: readProcedure.input(z.object({ sessionId: z.string() })).mutation(async ({ ctx, input }) => {
      const session = endVcCall(input.sessionId, ctx.user.email ?? ctx.user.openId);
      queuePersistence();
      await flushPersistence();
      return session;
    }),
  }),
  cctv: router({
    reportFeedStatus: readProcedure.input(z.object({
      instituteId: z.string().regex(/^INS-\d{3}$/),
      status: z.enum(["ONLINE", "OFFLINE", "FROZEN"]),
      reason: z.string().optional(),
    })).mutation(async ({ input }) => {
      const result = reportCctvFeedStatus(input.instituteId, input.status, input.reason);
      queuePersistence();
      await flushPersistence();
      return result;
    }),
  }),
  stateAuthority: router({
    overview: protectedProcedure.query(({ ctx }) => {
      const userRole = actorRole(ctx.user);
      const scopeState = userRole === "STATE_AUTHORITY" ? getUserStateScope(ctx.user) : null;
      return getRegionalOverview(scopeState);
    }),
    getRegionalData: protectedProcedure
      .input(z.object({ requestedState: z.string() }))
      .query(({ ctx, input }) => {
        const userRole = actorRole(ctx.user);
        const userState = getUserStateScope(ctx.user);

        if (userRole === "STATE_AUTHORITY" && input.requestedState.toLowerCase() !== userState.toLowerCase()) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Access Denied: State Authority for '${userState}' cannot fetch out-of-scope data for region '${input.requestedState}'`,
          });
        }
        return getRegionalOverview(input.requestedState);
      }),
  }),
  providers: router({
    cctvStatus: readProcedure.input(z.object({ cameraId: z.string().min(1).max(120), streamUrl: z.string().max(500).optional() })).query(({ input }) => cctv.getStatus(input.cameraId, input.streamUrl)),
  }),
  administration: router({
    users: departmentProcedure.query(() => listUsers()),
    updateUser: departmentProcedure.input(z.object({ userId: z.number().int().positive(), role: z.enum(["DEPARTMENT_ADMIN", "PMU_INSPECTOR", "INSTITUTE_ADMIN", "AUDITOR"]), organizationId: z.string().regex(/^INS-\d{3}$/).nullable() })).mutation(({ input }) => updateUserAccess(input.userId, input.role, input.organizationId)),
    inviteUser: departmentProcedure.input(z.object({ openId: z.string().trim().min(3).max(64), name: z.string().trim().min(2).max(120), email: z.string().email(), role: z.enum(["DEPARTMENT_ADMIN", "PMU_INSPECTOR", "INSTITUTE_ADMIN", "AUDITOR"]), organizationId: z.string().regex(/^INS-\d{3}$/).nullable() })).mutation(({ input }) => createInvitedUser(input)),
    permissionMatrix: departmentProcedure.query(() => ({
      DEPARTMENT_ADMIN: ["dashboard:read", "inspection:create", "assignment:generate", "assignment:seal", "assignment:reveal", "evidence:verify", "alerts:triage", "users:manage"],
      PMU_INSPECTOR: ["dashboard:read", "inspection:field-update", "gps:capture", "evidence:capture", "inspection:submit"],
      INSTITUTE_ADMIN: ["dashboard:read", "institute:own-scope"],
      AUDITOR: ["dashboard:read", "evidence:verify", "audit:verify", "risk:review"],
    })),
  }),
  security: router({
    whoAmI: readProcedure.query(({ ctx }) => ({ role: actorRole(ctx.user), serverAuthoritative: true })),
  }),
});

export type AppRouter = typeof appRouter;
