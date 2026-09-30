import { describe, expect, it } from "vitest";
import { canAccessStorageKey, normalizeStorageKey, scopedStorageKey } from "./storageAccess";
import { storageGet } from "./storage";

describe("storage access policy", () => {
  it("normalizes safe keys and rejects traversal", () => {
    expect(normalizeStorageKey("evidence/photo.jpg")).toBe("evidence/photo.jpg");
    expect(normalizeStorageKey("../../etc/passwd")).toBeNull();
    expect(normalizeStorageKey("evidence/../photo.jpg")).toBe("photo.jpg");
  });

  it("scopes object keys to the authenticated user", () => {
    const key = scopedStorageKey("user-1", "evidence/photo.jpg");
    expect(key).toBe("users/user-1/evidence/photo.jpg");
    expect(canAccessStorageKey("user-1", "user", key)).toBe(true);
    expect(canAccessStorageKey("user-2", "user", key)).toBe(false);
    expect(canAccessStorageKey("user-1", "user", "shared/public.pdf")).toBe(false);
    expect(canAccessStorageKey("admin-1", "admin", "shared/public.pdf")).toBe(true);
  });

  it("rejects unscoped storage helper keys", async () => {
    await expect(storageGet("evidence/photo.jpg")).rejects.toThrow("Storage keys must use");
  });
});
