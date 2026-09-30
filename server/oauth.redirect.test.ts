import { describe, expect, it } from "vitest";
import { resolveOAuthRedirectUri } from "../shared/oauth";

describe("OAuth redirect configuration", () => {
  it("uses the explicitly configured HTTPS callback URI", () => {
    expect(resolveOAuthRedirectUri(
      "https://preview.example.com",
      "https://allowlisted.example.com/api/oauth/callback",
    )).toBe("https://allowlisted.example.com/api/oauth/callback");
  });

  it("falls back to the current origin callback in local development", () => {
    expect(resolveOAuthRedirectUri("http://localhost:3000"))
      .toBe("http://localhost:3000/api/oauth/callback");
  });

  it("rejects callback paths that could redirect elsewhere", () => {
    expect(() => resolveOAuthRedirectUri(
      "https://preview.example.com",
      "https://allowlisted.example.com/other",
    )).toThrow("exactly /api/oauth/callback");
  });
});
