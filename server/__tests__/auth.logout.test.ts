import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import { COOKIE_NAME } from "@shared/const";
import type { TrpcContext } from "../_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });

  it("authenticates as department official and sets session cookie", async () => {
    const setCookies: CookieCall[] = [];
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        cookie: (name: string, val: string, options: Record<string, unknown>) => {
          setCookies.push({ name, options: { val, ...options } });
        },
      } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.login({
      role: "official",
      identifier: "DOSJE-2024-0417",
      password: "password123",
      rememberMe: true,
    });

    expect(result.success).toBe(true);
    expect(result.user.role).toBe("DEPARTMENT_ADMIN");
    expect(result.token).toBeDefined();
    expect(setCookies.length).toBe(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);
  });

  it("authenticates as PMU inspector, NGO, and beneficiary", async () => {
    const setCookies: CookieCall[] = [];
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "http", headers: {} } as TrpcContext["req"],
      res: {
        cookie: (name: string, val: string, options: Record<string, unknown>) => {
          setCookies.push({ name, options: { val, ...options } });
        },
      } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    const pmu = await caller.auth.login({ role: "pmu", identifier: "PMU-TS-0289", password: "secret" });
    expect(pmu.user.role).toBe("PMU_INSPECTOR");

    const ngo = await caller.auth.login({ role: "ngo", identifier: "NGO/TS/2019/00341", password: "secret" });
    expect(ngo.user.role).toBe("INSTITUTE_ADMIN");

    const ben = await caller.auth.login({ role: "beneficiary", identifier: "9876543210", password: "secret" });
    expect(ben.user.role).toBe("user");
  });
});

