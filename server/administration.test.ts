import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(role: "admin" | "user", email: string): TrpcContext {
  const user = { id: 1, openId: `admin-test-${email}`, name: "Admin Test", email, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as const;
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] };
}

describe("administration authorization", () => {
  it("rejects role administration for non-department users", async () => {
    const caller = appRouter.createCaller(context("user", "pmu@securesight.gov.in"));
    await expect(caller.administration.permissionMatrix()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.administration.users()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns the permission matrix and user list for department admin", async () => {
    const caller = appRouter.createCaller(context("admin", "department-admin@securesight.gov.in"));
    const matrix = await caller.administration.permissionMatrix();
    const users = await caller.administration.users();
    expect(matrix.DEPARTMENT_ADMIN).toContain("users:manage");
    expect(matrix.PMU_INSPECTOR).toContain("evidence:capture");
    expect(Array.isArray(users)).toBe(true);
  });
});
