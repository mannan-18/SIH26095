import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { claimAssignment } from "./db";
import { getAudit, hydrateDemoState } from "./demoStore";

describe("managed MySQL persistence boundaries", () => {
  it("hydrates domain records from the database and keeps the audit chain valid", async () => {
    const result = await hydrateDemoState();
    expect(["seeded", "database"]).toContain(result.source);
    expect(result.count).toBeGreaterThan(100);
    expect(getAudit().verification.valid).toBe(true);
  });

  it("allows only one assignment claim for an inspection", async () => {
    const inspectionId = `LOCK-${randomUUID()}`;
    const first = await claimAssignment(inspectionId, randomUUID());
    const second = await claimAssignment(inspectionId, randomUUID());
    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});
