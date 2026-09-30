import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "../routers";
import { LocalDemoEvidenceStorage, MockCCTVProvider, MockVideoConferenceProvider } from "../providers";
import type { TrpcContext } from "../_core/context";

function context(role: "admin" | "user" = "admin", email = "admin@securesight.gov.in", organizationId: string | null = null): TrpcContext {
  const user = { id: 1, openId: `test-${role}-${email}`, name: "Test User", email, loginMethod: "test", role, organizationId, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as const;
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] };
}

describe("server-enforced RBAC and provider failure behavior", () => {
  it("returns FORBIDDEN for PMU inspector attempting department assignment operations", async () => {
    const caller = appRouter.createCaller(context("user", "pmu@securesight.gov.in"));
    await expect(caller.workflow.startInspection({ instituteId: "INS-001" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.workflow.generateAssignment({ inspectionId: "INSP-0001", requestedInspectorId: "INSP-999" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("prevents an institute administrator from changing another organization's record", async () => {
    const caller = appRouter.createCaller(context("user", "institute-ins-001@securesight.gov.in", "INS-001"));
    await expect(caller.workflow.startInspection({ instituteId: "INS-002" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows PMU inspector field operations but rejects malformed and cross-role requests", async () => {
    const caller = appRouter.createCaller(context("user", "pmu@securesight.gov.in"));
    const gps = await caller.workflow.captureGps({ inspectionId: "INSP-0001", latitude: null, longitude: null });
    expect(gps.status).toBe("LOCATION_UNAVAILABLE");
    await expect(caller.workflow.captureGps({ inspectionId: "INSP-0001", latitude: 999, longitude: 0 })).rejects.toBeInstanceOf(TRPCError);
    await expect(caller.workflow.verifyAudit()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("handles local storage, invalid CCTV streams, and VC provider failures without crashing", async () => {
    const storage = new LocalDemoEvidenceStorage();
    const stored = await storage.put({ filename: "../unsafe/photo.jpg", content: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg" });
    expect(stored.storageKey).toMatch(/^demo\//);
    expect((await storage.verify(stored.storageKey)).available).toBe(true);

    const cctv = new MockCCTVProvider();
    expect((await cctv.getStatus("CAM-1", "invalid://stream")).status).toBe("INVALID_STREAM");
    expect((await cctv.getStatus("CAM-OFFLINE")).status).toBe("OFFLINE");

    const vc = new MockVideoConferenceProvider();
    expect((await vc.createSession({ participantId: "" })).status).toBe("FAILED");
    expect((await vc.createSession({ participantId: "beneficiary-001" })).provider).toBe("DEMO");
  });
});
