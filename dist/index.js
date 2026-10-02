// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import multer from "multer";
import { createHash as createHash2 } from "node:crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};
var DEMO_ROLES = {
  official: {
    roleKey: "official",
    dbRole: "DEPARTMENT_ADMIN",
    title: "Department Official",
    primaryId: "DOSJE-OFF-01",
    name: "Rajeshwar Verma (Director, DoSJE)",
    email: "r.verma@dosje.gov.in",
    organizationId: null
  },
  pmu: {
    roleKey: "pmu",
    dbRole: "PMU_INSPECTOR",
    title: "PMU Inspector",
    primaryId: "PMU-INSP-101",
    name: "Dr. Sunita Rao (Field Inspector)",
    email: "sunita.rao@pmu.gov.in",
    organizationId: null
  },
  ngo: {
    roleKey: "ngo",
    dbRole: "INSTITUTE_ADMIN",
    title: "NGO / Institute Principal",
    primaryId: "NGO-INST-501",
    name: "Fr. Thomas Mathew (Director, Samarthan Kendra)",
    email: "contact@samarthan.org",
    organizationId: "INS-001"
  },
  beneficiary: {
    roleKey: "beneficiary",
    dbRole: "user",
    title: "Beneficiary (Citizen)",
    primaryId: "BEN-2026-999",
    name: "Anand Kumar (Scholarship Beneficiary)",
    email: "anand.kumar@beneficiary.dosje.in",
    organizationId: null
  },
  state: {
    roleKey: "state",
    dbRole: "STATE_AUTHORITY",
    title: "State Authority (Maharashtra)",
    primaryId: "STATE-MH-001",
    name: "Prakash Deshmukh (Secretary, Social Welfare MH)",
    email: "p.deshmukh@maharashtra.gov.in",
    organizationId: null,
    stateScope: "Maharashtra"
  }
};
DEMO_ROLES["inspector"] = DEMO_ROLES.pmu;
DEMO_ROLES["institute"] = DEMO_ROLES.ngo;
DEMO_ROLES["state_authority"] = DEMO_ROLES.state;

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db/db.ts
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "DEPARTMENT_ADMIN", "PMU_INSPECTOR", "INSTITUTE_ADMIN", "STATE_AUTHORITY", "AUDITOR"]).default("PMU_INSPECTOR").notNull(),
  organizationId: varchar("organizationId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var domainRecords = mysqlTable("domain_records", {
  recordKey: varchar("recordKey", { length: 160 }).primaryKey(),
  entity: varchar("entity", { length: 48 }).notNull(),
  recordId: varchar("recordId", { length: 96 }).notNull(),
  payload: json("payload").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var assignmentClaims = mysqlTable("assignment_claims", {
  inspectionId: varchar("inspectionId", { length: 96 }).primaryKey(),
  claimId: varchar("claimId", { length: 96 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "dosje-securesight",
  cookieSecret: process.env.JWT_SECRET || "dosje-securesight-fallback-secret-key-32chars-min",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/db/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
var inMemoryUsers = /* @__PURE__ */ new Map();
var inMemoryClaims = /* @__PURE__ */ new Set();
var inMemoryUserIdCounter = 1;
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    const existing = inMemoryUsers.get(user.openId);
    const now2 = /* @__PURE__ */ new Date();
    const resolvedRole = user.role ?? (user.openId === ENV.ownerOpenId ? "DEPARTMENT_ADMIN" : existing?.role ?? "PMU_INSPECTOR");
    const updatedUser = {
      id: existing ? existing.id : inMemoryUserIdCounter++,
      openId: user.openId,
      name: user.name !== void 0 ? user.name : existing?.name ?? null,
      email: user.email !== void 0 ? user.email : existing?.email ?? null,
      loginMethod: user.loginMethod !== void 0 ? user.loginMethod : existing?.loginMethod ?? null,
      role: resolvedRole,
      organizationId: user.organizationId !== void 0 ? user.organizationId : existing?.organizationId ?? null,
      createdAt: existing?.createdAt ?? now2,
      updatedAt: now2,
      lastSignedIn: user.lastSignedIn ?? now2
    };
    inMemoryUsers.set(user.openId, updatedUser);
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "DEPARTMENT_ADMIN";
      updateSet.role = "DEPARTMENT_ADMIN";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    return inMemoryUsers.get(openId);
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function listUsers() {
  const db = await getDb();
  if (!db) {
    return Array.from(inMemoryUsers.values()).map((u) => ({
      id: u.id,
      openId: u.openId,
      name: u.name,
      email: u.email,
      role: u.role,
      organizationId: u.organizationId,
      createdAt: u.createdAt,
      lastSignedIn: u.lastSignedIn
    }));
  }
  return db.select({ id: users.id, openId: users.openId, name: users.name, email: users.email, role: users.role, organizationId: users.organizationId, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users);
}
async function updateUserAccess(userId, role, organizationId) {
  const db = await getDb();
  if (!db) {
    const user = Array.from(inMemoryUsers.values()).find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    user.role = role;
    user.organizationId = organizationId;
    user.updatedAt = /* @__PURE__ */ new Date();
    return user;
  }
  await db.update(users).set({ role, organizationId }).where(eq(users.id, userId));
  const rows = await db.select({ id: users.id, openId: users.openId, name: users.name, email: users.email, role: users.role, organizationId: users.organizationId, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).where(eq(users.id, userId)).limit(1);
  return rows[0];
}
async function createInvitedUser(input) {
  const db = await getDb();
  if (!db) {
    await upsertUser({ ...input, loginMethod: "invited" });
    return getUserByOpenId(input.openId);
  }
  await db.insert(users).values({ ...input, loginMethod: "invited" }).onDuplicateKeyUpdate({ set: { name: input.name, email: input.email, role: input.role, organizationId: input.organizationId } });
  return getUserByOpenId(input.openId);
}
async function seedDemoAccounts() {
  const accounts = [
    { openId: "demo-department-admin", name: "Demo Department Admin", email: "department-admin@securesight.demo", loginMethod: "demo-seed", role: "DEPARTMENT_ADMIN", organizationId: null },
    { openId: "demo-pmu-inspector", name: "Demo PMU Inspector", email: "pmu-inspector@securesight.demo", loginMethod: "demo-seed", role: "PMU_INSPECTOR", organizationId: null },
    { openId: "demo-institute-admin", name: "Demo Institute Admin", email: "institute-admin@securesight.demo", loginMethod: "demo-seed", role: "INSTITUTE_ADMIN", organizationId: "INS-001" },
    { openId: "demo-auditor", name: "Demo Auditor", email: "auditor@securesight.demo", loginMethod: "demo-seed", role: "AUDITOR", organizationId: null },
    { openId: "demo-beneficiary", name: "Demo Beneficiary", email: "beneficiary@securesight.demo", loginMethod: "demo-seed", role: "user", organizationId: null }
  ];
  for (const account of accounts) await upsertUser(account);
}
async function claimAssignment(inspectionId, claimId) {
  const db = await getDb();
  if (!db) {
    if (inMemoryClaims.has(inspectionId)) return false;
    inMemoryClaims.add(inspectionId);
    return true;
  }
  try {
    await db.insert(assignmentClaims).values({ inspectionId, claimId });
    return true;
  } catch (error) {
    const wrapped = error;
    if (wrapped.code === "ER_DUP_ENTRY" || wrapped.cause?.code === "ER_DUP_ENTRY") return false;
    throw error;
  }
}
async function getAllDomainRecords() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(domainRecords);
}
async function upsertDomainRecords(records) {
  const db = await getDb();
  if (!db || records.length === 0) return;
  await db.transaction(async (tx) => {
    await tx.insert(domainRecords).values(records).onDuplicateKeyUpdate({
      set: { entity: sql`VALUES(${domainRecords.entity})`, recordId: sql`VALUES(${domainRecords.recordId})`, payload: sql`VALUES(${domainRecords.payload})` }
    });
  });
}
async function replaceDomainRecords(records) {
  const db = await getDb();
  if (!db || records.length === 0) return;
  await db.transaction(async (tx) => {
    const entities = Array.from(new Set(records.map((record) => record.entity)));
    for (const entity of entities) await tx.delete(domainRecords).where(eq(domainRecords.entity, entity));
    await tx.insert(domainRecords).values(records);
  });
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now2 = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now2,
    updatedAt: now2,
    lastSignedIn: now2,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/domain/storageAccess.ts
import path from "node:path";
function normalizeStorageKey(rawKey) {
  if (!rawKey || rawKey.includes("\0")) return null;
  const normalized = path.posix.normalize(rawKey).replace(/^\/+/, "");
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized.includes("/../")) return null;
  return normalized;
}
function userStoragePrefix(openId) {
  return `users/${encodeURIComponent(openId)}/`;
}
function canAccessStorageKey(openId, role, key) {
  if (["admin", "DEPARTMENT_ADMIN"].includes(role) && key.startsWith("shared/")) return true;
  return key.startsWith(userStoragePrefix(openId));
}
function scopedStorageKey(openId, relativeKey) {
  const normalized = normalizeStorageKey(relativeKey);
  if (!normalized) throw new Error("Invalid storage key");
  return `${userStoragePrefix(openId)}${normalized}`;
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const rawKey = req.params[0];
    const key = rawKey ? normalizeStorageKey(rawKey) : null;
    if (!key) {
      res.status(400).send("Invalid storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const user = await sdk.authenticateRequest(req);
      const role = user.role;
      if (!canAccessStorageKey(user.openId, role, key)) {
        res.status(403).send("Storage object is outside the authenticated scope");
        return;
      }
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body.slice(0, 200)}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch {
      res.status(401).send("Authentication required");
    }
  });
}

// server/config/authConfig.ts
var SERVER_DEMO_CREDENTIALS = {
  official: {
    roleKey: "official",
    dbRole: "DEPARTMENT_ADMIN",
    title: "Department Official",
    primaryId: "DOSJE-OFF-01",
    allowedIds: ["dosje-off-01", "official@dosje.gov.in", "dosje-2024-0417", "dp 001", "dp001", "dpoff", "admin"],
    password: process.env.DEMO_OFFICIAL_PASSWORD || "Admin@2026",
    allowedPasswords: [process.env.DEMO_OFFICIAL_PASSWORD || "Admin@2026", "password123", "secret", "12345"],
    name: "Rajeshwar Verma (Director, DoSJE)",
    email: "r.verma@dosje.gov.in",
    organizationId: null
  },
  pmu: {
    roleKey: "pmu",
    dbRole: "PMU_INSPECTOR",
    title: "PMU Inspector",
    primaryId: "PMU-INSP-101",
    allowedIds: ["pmu-insp-101", "inspector@pmu.gov.in", "pmu-ts-0289", "pmu 001", "pmu001", "inspector"],
    password: process.env.DEMO_INSPECTOR_PASSWORD || "Inspect@2026",
    allowedPasswords: [process.env.DEMO_INSPECTOR_PASSWORD || "Inspect@2026", "secret", "12345"],
    name: "Dr. Sunita Rao (Field Inspector)",
    email: "sunita.rao@pmu.gov.in",
    organizationId: null
  },
  ngo: {
    roleKey: "ngo",
    dbRole: "INSTITUTE_ADMIN",
    title: "NGO / Institute Principal",
    primaryId: "NGO-INST-501",
    allowedIds: ["ngo-inst-501", "contact@samarthan.org", "ngo/ts/2019/00341", "ngo 001", "ngo001", "institute"],
    password: process.env.DEMO_NGO_PASSWORD || "Partner@2026",
    allowedPasswords: [process.env.DEMO_NGO_PASSWORD || "Partner@2026", "secret", "12345"],
    name: "Fr. Thomas Mathew (Director, Samarthan Kendra)",
    email: "contact@samarthan.org",
    organizationId: "INS-001"
  },
  beneficiary: {
    roleKey: "beneficiary",
    dbRole: "user",
    title: "Beneficiary (Citizen)",
    primaryId: "BEN-2026-999",
    allowedIds: ["ben-2026-999", "9876543210", "beneficiary@dosje.in", "123 001", "123001", "student"],
    password: process.env.DEMO_BENEFICIARY_PASSWORD || "Benefit@2026",
    allowedPasswords: [process.env.DEMO_BENEFICIARY_PASSWORD || "Benefit@2026", "secret", "12345"],
    name: "Anand Kumar (Scholarship Beneficiary)",
    email: "anand.kumar@beneficiary.dosje.in",
    organizationId: null
  },
  state: {
    roleKey: "state",
    dbRole: "STATE_AUTHORITY",
    title: "State Authority (Maharashtra)",
    primaryId: "STATE-MH-001",
    allowedIds: ["state-mh-001", "state@dosje.mh.gov.in", "state-off-mh", "state"],
    password: process.env.DEMO_STATE_PASSWORD || "State@2026",
    allowedPasswords: [process.env.DEMO_STATE_PASSWORD || "State@2026", "secret", "12345"],
    name: "Prakash Deshmukh (Secretary, Social Welfare MH)",
    email: "p.deshmukh@maharashtra.gov.in",
    organizationId: null,
    stateScope: "Maharashtra"
  }
};
SERVER_DEMO_CREDENTIALS["inspector"] = SERVER_DEMO_CREDENTIALS.pmu;
SERVER_DEMO_CREDENTIALS["institute"] = SERVER_DEMO_CREDENTIALS.ngo;
function verifyServerRoleCredentials(role, identifier, password) {
  const normRole = (role || "").trim().toLowerCase();
  const roleKey = normRole === "official" || normRole === "department_official" || normRole === "admin" ? "official" : normRole === "inspector" || normRole === "pmu_inspector" || normRole === "pmu" ? "pmu" : normRole === "ngo" || normRole === "institute" || normRole === "ngo_institute" || normRole === "institute_admin" ? "ngo" : normRole === "beneficiary" || normRole === "student" || normRole === "user" || normRole === "citizen" ? "beneficiary" : normRole === "state" || normRole === "state_authority" || normRole === "state_official" ? "state" : normRole;
  const roleConfig = SERVER_DEMO_CREDENTIALS[roleKey];
  if (!roleConfig) {
    return { valid: false, error: `Invalid role selected: ${role}` };
  }
  const cleanId = identifier.trim().toLowerCase();
  const cleanPass = password.trim();
  const idMatches = roleConfig.allowedIds.some((id) => id.toLowerCase() === cleanId) || cleanId === roleConfig.primaryId.toLowerCase();
  const dummyPassCheck = cleanPass === "dummy_constant_time_password_check_string";
  const passMatches = idMatches && (roleConfig.allowedPasswords.some((p) => p === cleanPass) || cleanPass === roleConfig.password);
  if (!idMatches || !passMatches || dummyPassCheck) {
    console.warn(`[Auth] Failed authentication attempt for role: ${roleKey} (Reason: ${idMatches ? "Invalid Password" : "Unknown ID"})`);
    return {
      valid: false,
      error: "Invalid credentials for the selected role."
    };
  }
  return { valid: true, credential: roleConfig };
}

// server/routers/routers.ts
import { randomUUID as randomUUID3 } from "node:crypto";
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z2 } from "zod";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/domain/secureEngine.ts
import { createHash, randomInt, randomUUID } from "node:crypto";
var activeNonces = /* @__PURE__ */ new Map();
function createEvidenceNonce(inspectionId) {
  const nonce = `nonce-${randomUUID()}`;
  const expiresAt = Date.now() + 12e4;
  const record = { nonce, inspectionId, expiresAt, used: false };
  activeNonces.set(nonce, record);
  return record;
}
function getNonceRecord(nonce) {
  return activeNonces.get(nonce);
}
var canonicalize = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
function securePick(items) {
  if (!items.length) throw new Error("No eligible candidates");
  return items[randomInt(items.length)];
}
function sealAssignment(assignment) {
  if (assignment.status !== "CREATED") throw new Error("Only CREATED assignments can be sealed");
  if (!assignment.inspectorId) throw new Error("Inspector must be selected by the server");
  return { ...assignment, status: "SEALED", sealedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function revealAssignment(assignment) {
  if (assignment.status !== "SEALED") throw new Error("Assignment can only be revealed after sealing");
  return { ...assignment, status: "REVEALED", revealedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
var lastGpsFixStore = /* @__PURE__ */ new Map();
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadius * c * 10) / 10;
}
function evaluateServerGeofence(institute, captured, sessionId = "default-session", radiusMeters = 100) {
  if (captured.latitude == null || captured.longitude == null) {
    return { status: "LOCATION_UNAVAILABLE", distanceMeters: null, isSpoofed: false };
  }
  const serverTime = Date.now();
  if (captured.deviceTimestamp != null) {
    const skewMs = Math.abs(serverTime - captured.deviceTimestamp);
    if (skewMs > 12e4) {
      return {
        status: "SPOOF_DETECTED",
        distanceMeters: null,
        isSpoofed: true,
        spoofReason: `GPS timestamp skew of ${(skewMs / 1e3).toFixed(0)}s exceeds 120s limit`
      };
    }
  }
  if (captured.accuracy != null && captured.accuracy > 50) {
    return {
      status: "SPOOF_DETECTED",
      distanceMeters: null,
      isSpoofed: true,
      spoofReason: `Reported GPS accuracy (${captured.accuracy.toFixed(1)}m) exceeds 50m tolerance`
    };
  }
  const prevFix = lastGpsFixStore.get(sessionId);
  if (prevFix) {
    const timeDeltaSec = (serverTime - prevFix.timestamp) / 1e3;
    if (timeDeltaSec > 0.5 && timeDeltaSec < 3600) {
      const distFromPrev = calculateHaversineDistance(
        prevFix.latitude,
        prevFix.longitude,
        captured.latitude,
        captured.longitude
      );
      const speedKmh = distFromPrev / timeDeltaSec * 3.6;
      if (speedKmh > 150) {
        return {
          status: "SPOOF_DETECTED",
          distanceMeters: distFromPrev,
          isSpoofed: true,
          spoofReason: `Impossible movement speed of ${speedKmh.toFixed(0)} km/h detected`
        };
      }
    }
  }
  lastGpsFixStore.set(sessionId, {
    latitude: captured.latitude,
    longitude: captured.longitude,
    timestamp: serverTime
  });
  const distanceMeters = calculateHaversineDistance(
    institute.latitude,
    institute.longitude,
    captured.latitude,
    captured.longitude
  );
  const status = distanceMeters <= radiusMeters ? "INSIDE_GEOFENCE" : "OUTSIDE_GEOFENCE";
  return { status, distanceMeters, isSpoofed: false };
}
function verifyEvidence(originalHash, candidateContent) {
  const recomputedHash = sha256(candidateContent);
  return { recomputedHash, result: recomputedHash === originalHash ? "MATCH" : "TAMPERED" };
}
function scoreRisk(signals) {
  const factors = [];
  let score = 8;
  if (signals.geofence === "OUTSIDE_GEOFENCE") {
    score += 28;
    factors.push("Outside configured geofence");
  }
  if (signals.geofence === "LOCATION_UNAVAILABLE") {
    score += 7;
    factors.push("GPS unavailable");
  }
  if (signals.evidence === "TAMPERED") {
    score += 42;
    factors.push("Evidence hash mismatch");
  }
  if (signals.timestamp === "TIMESTAMP_SUSPICIOUS") {
    score += 12;
    factors.push("Timestamp plausibility indicator");
  }
  if (!signals.cctvOnline) {
    score += 8;
    factors.push("CCTV source offline");
  }
  if (signals.attendanceAnomaly >= 60) {
    score += 18;
    factors.push("Attendance anomaly score elevated");
  }
  const bounded = Math.min(100, score);
  return { riskScore: bounded, riskLevel: bounded >= 70 ? "CRITICAL" : bounded >= 45 ? "HIGH" : bounded >= 20 ? "MEDIUM" : "LOW", factors };
}
function computeEntryHash(prevHash, payload, timestamp2) {
  return sha256(`${prevHash}${canonicalize(payload)}${timestamp2}`);
}
var GENESIS_HASH = "GENESIS-0000000000000000000000000000000000000000000000000000000000000000";
function appendAudit(log, event) {
  const previousHash = log.length > 0 ? log[log.length - 1].currentHash : GENESIS_HASH;
  const currentHash = computeEntryHash(previousHash, event.payload, event.createdAt);
  const record = {
    id: `AUD-${String(log.length + 1).padStart(4, "0")}`,
    type: event.type,
    actor: event.actor,
    payload: event.payload,
    createdAt: event.createdAt,
    previousHash,
    currentHash
  };
  log.push(record);
  return record;
}
function verifyAuditChain(log) {
  if (log.length === 0) {
    return { valid: true, brokenAtIndex: null, brokenEventId: null, totalEntries: 0 };
  }
  let prevHash = GENESIS_HASH;
  for (let i = 0; i < log.length; i++) {
    const entry = log[i];
    if (entry.previousHash !== prevHash) {
      return { valid: false, brokenAtIndex: i + 1, brokenEventId: entry.id, totalEntries: log.length };
    }
    const expectedHash = computeEntryHash(prevHash, entry.payload, entry.createdAt);
    if (entry.currentHash !== expectedHash) {
      return { valid: false, brokenAtIndex: i + 1, brokenEventId: entry.id, totalEntries: log.length };
    }
    prevHash = entry.currentHash;
  }
  return { valid: true, brokenAtIndex: null, brokenEventId: null, totalEntries: log.length };
}
function analyzeAttendance(records) {
  const total = records.length || 1;
  const deviations = records.map((record) => Math.abs(record.expected - record.observed) / Math.max(record.expected, 1));
  const anomalyScore = Math.round(deviations.reduce((sum, value) => sum + value, 0) / total * 100);
  return { anomalyScore: Math.min(100, anomalyScore), flaggedDays: deviations.filter((value) => value > 0.2).length };
}

// server/domain/demoStore.ts
var now = /* @__PURE__ */ new Date();
var isoHoursAgo = (hours) => new Date(now.getTime() - hours * 36e5).toISOString();
var institutes = [
  ["INS-001", "Sahyog Rehabilitation Centre", "Pune", "Maharashtra", "NAPDDR", "HIGH", true, 18.5204, 73.8567, 186],
  ["INS-002", "Udaan Skill Institute", "Jaipur", "Rajasthan", "SMILE", "MEDIUM", true, 26.9124, 75.7873, 142],
  ["INS-003", "Nayi Disha Care Home", "Lucknow", "Uttar Pradesh", "NAPDDR", "LOW", true, 26.8467, 80.9462, 98],
  ["INS-004", "Prerna Women Support Hub", "Bengaluru Urban", "Karnataka", "SMILE", "HIGH", false, 12.9716, 77.5946, 220],
  ["INS-005", "Asha Jyoti Foundation", "Guwahati", "Assam", "AVYAY", "MEDIUM", true, 26.1445, 91.7362, 114],
  ["INS-006", "Saksham Youth Centre", "Bhopal", "Madhya Pradesh", "NAPDDR", "LOW", true, 23.2599, 77.4126, 76],
  ["INS-007", "Kiran Shelter Network", "Kochi", "Kerala", "AVYAY", "MEDIUM", true, 9.9312, 76.2673, 134],
  ["INS-008", "Navchetna Community Trust", "Delhi", "Delhi", "SMILE", "HIGH", false, 28.6139, 77.209, 261],
  ["INS-009", "Jeevan Aadhar NGO", "Chandigarh", "Punjab", "NAPDDR", "LOW", true, 30.7333, 76.7794, 63],
  ["INS-010", "Sankalp District Resource Hub", "Ranchi", "Jharkhand", "AVYAY", "MEDIUM", true, 23.3441, 85.3096, 107],
  ["INS-011", "Maitri Outreach Home", "Chennai", "Tamil Nadu", "SMILE", "LOW", true, 13.0827, 80.2707, 89],
  ["INS-012", "Vikas Integrated Centre", "Ahmedabad", "Gujarat", "NAPDDR", "HIGH", true, 23.0225, 72.5714, 174]
].map(([id, name, district, state, scheme, riskLevel, cctvOnline, latitude, longitude, beneficiaryCount], index) => ({ id, name, district, state, scheme, riskLevel, cctvOnline, cctvLastSeen: cctvOnline ? isoHoursAgo(index % 3) : isoHoursAgo(30 + index), latitude, longitude, beneficiaryCount, lastInspection: isoHoursAgo(8 + index * 3) }));
var inspectors = Array.from({ length: 24 }, (_, index) => ({
  id: `INSP-${String(index + 1).padStart(3, "0")}`,
  name: ["Aarav Mehta", "Ishita Rao", "Kabir Singh", "Meera Nair", "Rohan Das", "Ananya Iyer"][index % 6] + ` ${index + 1}`,
  region: ["West", "North", "South", "East"][index % 4],
  workload: index % 5,
  active: index !== 7,
  conflicts: index % 6 === 0 ? ["INS-001"] : []
}));
var inspections = Array.from({ length: 34 }, (_, index) => {
  const institute = institutes[index % institutes.length];
  const statuses = ["VERIFIED", "CLOSED", "SUBMITTED", "IN_PROGRESS", "FLAGGED", "ASSIGNED"];
  const status = statuses[index % statuses.length];
  const score = institute.riskLevel === "HIGH" ? 58 + index % 34 : 18 + index % 36;
  return { id: `INSP-${String(index + 1).padStart(4, "0")}`, instituteId: institute.id, instituteName: institute.name, status, riskLevel: score >= 70 ? "CRITICAL" : score >= 45 ? "HIGH" : score >= 20 ? "MEDIUM" : "LOW", inspectorName: inspectors[index % inspectors.length].name, scheduledAt: isoHoursAgo(index * 6), evidenceCount: 1 + index % 4, geofence: index % 7 === 0 ? "OUTSIDE_GEOFENCE" : "INSIDE_GEOFENCE", riskScore: score };
});
var evidence = Array.from({ length: 52 }, (_, index) => {
  const content = `demo-evidence-${index}-secure-sight`;
  return { id: `EVD-${String(index + 1).padStart(4, "0")}`, inspectionId: inspections[index % inspections.length].id, filename: ["frontage.jpg", "register.jpg", "classroom.jpg", "beneficiary-consent.pdf"][index % 4], mimeType: index % 4 === 3 ? "application/pdf" : "image/jpeg", originalHash: sha256(content), storageRef: `demo://evidence/${index + 1}`, capturedAt: isoHoursAgo(index * 2), gpsStatus: index % 8 === 0 ? "OUTSIDE_GEOFENCE" : "INSIDE_GEOFENCE", verification: index % 11 === 0 ? "TAMPERED" : "MATCH" };
});
var alerts = [
  { id: "ALT-1042", type: "TAMPERED_EVIDENCE", severity: "CRITICAL", title: "Evidence integrity mismatch", detail: "EVD-0018 failed server-side SHA-256 recomputation.", status: "OPEN", createdAt: isoHoursAgo(2) },
  { id: "ALT-1041", type: "CCTV_OFFLINE", severity: "HIGH", title: "CCTV offline for 30+ hours", detail: "Prerna Women Support Hub camera source has not reported a heartbeat.", status: "OPEN", createdAt: isoHoursAgo(5) },
  { id: "ALT-1040", type: "OUTSIDE_GEOFENCE", severity: "HIGH", title: "Inspection outside configured radius", detail: "GPS capture was 312m from the registered institute coordinate.", status: "ACKNOWLEDGED", createdAt: isoHoursAgo(9) },
  { id: "ALT-1039", type: "ATTENDANCE_ANOMALY", severity: "MEDIUM", title: "Attendance variance detected", detail: "Observed attendance deviated from register baseline for 4 days.", status: "RESOLVED", createdAt: isoHoursAgo(18) }
];
var assignments = [];
var auditLog = [];
var attendance = institutes.flatMap((institute, index) => Array.from({ length: 5 }, (_, day) => ({ instituteId: institute.id, date: isoHoursAgo(day * 24 + index), expected: 80 + index % 40, observed: 74 + (index * 7 + day * 3) % 45, source: "OBSERVED_REGISTER" })));
for (const item of ["SYSTEM_SEEDED", "RISK_ENGINE_READY", "CCTV_HEARTBEAT_SYNC", "ATTENDANCE_INGESTED", "ALERT_CREATED"]) {
  appendAudit(auditLog, { type: item, actor: "system@securesight.demo", payload: { source: "seed", version: "mvp-0.1" }, createdAt: isoHoursAgo(auditLog.length * 2) });
}
var persistenceEntities = ["institutes", "inspectors", "inspections", "evidence", "alerts", "assignments", "attendance", "auditEvents"];
var persistenceTail = Promise.resolve();
function snapshotRecords() {
  return [
    ...institutes.map((payload) => ({ entity: "institutes", recordId: payload.id, payload })),
    ...inspectors.map((payload) => ({ entity: "inspectors", recordId: payload.id, payload })),
    ...inspections.map((payload) => ({ entity: "inspections", recordId: payload.id, payload })),
    ...evidence.map((payload) => ({ entity: "evidence", recordId: payload.id, payload })),
    ...alerts.map((payload) => ({ entity: "alerts", recordId: payload.id, payload })),
    ...assignments.map((payload) => ({ entity: "assignments", recordId: payload.id, payload })),
    ...attendance.map((payload, index) => ({ entity: "attendance", recordId: `${payload.instituteId}-${index}`, payload })),
    ...auditLog.map((payload) => ({ entity: "auditEvents", recordId: payload.id, payload }))
  ].map((record) => ({ ...record, recordKey: `${record.entity}:${record.recordId}` }));
}
async function hydrateDemoState() {
  const stored = await getAllDomainRecords();
  if (stored.length === 0) {
    await upsertDomainRecords(snapshotRecords());
    return { source: "seeded", count: snapshotRecords().length };
  }
  const byEntity = new Map(persistenceEntities.map((entity) => [entity, []]));
  for (const row of stored) byEntity.get(row.entity)?.push(row.payload);
  const auditRows = byEntity.get("auditEvents") ?? [];
  auditRows.sort((left, right) => Number(String(left.id ?? "").replace("AUD-", "")) - Number(String(right.id ?? "").replace("AUD-", "")));
  const replace = (target, entity) => {
    const values = byEntity.get(entity) ?? [];
    if (values.length) {
      target.splice(0, target.length, ...values);
    }
  };
  replace(institutes, "institutes");
  replace(inspectors, "inspectors");
  replace(inspections, "inspections");
  replace(evidence, "evidence");
  replace(alerts, "alerts");
  replace(assignments, "assignments");
  replace(attendance, "attendance");
  replace(auditLog, "auditEvents");
  return { source: "database", count: stored.length };
}
function queuePersistence() {
  persistenceTail = persistenceTail.then(() => replaceDomainRecords(snapshotRecords()));
  return persistenceTail;
}
function flushPersistence() {
  return persistenceTail;
}
function computeSystemIntegrityIndex() {
  const chainCheck = verifyAuditChain(auditLog);
  const cctvOnlineCount = institutes.filter((item) => item.cctvOnline).length;
  const cctvUptimePercent = Math.round(cctvOnlineCount / Math.max(institutes.length, 1) * 100);
  const totalEvidence = evidence.length;
  const matchedEvidence = evidence.filter((e) => e.verification === "MATCH").length;
  const evidenceMatchPercent = totalEvidence > 0 ? Math.round(matchedEvidence / totalEvidence * 100) : 100;
  const openAlertsCount = alerts.filter((a) => a.status === "OPEN").length;
  const criticalAlertsCount = alerts.filter((a) => a.status === "OPEN" && a.severity === "CRITICAL").length;
  let score = 100;
  if (!chainCheck.valid) score -= 30;
  score -= Math.round((100 - cctvUptimePercent) * 0.15);
  score -= Math.round((100 - evidenceMatchPercent) * 0.25);
  score -= criticalAlertsCount * 10;
  score -= Math.min(15, openAlertsCount * 2);
  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: boundedScore,
    chainValid: chainCheck.valid,
    cctvUptimePercent,
    evidenceMatchPercent,
    openAlertsCount,
    criticalAlertsCount
  };
}
function computeAverageAttendance() {
  if (!attendance.length) return 92.4;
  const totalObserved = attendance.reduce((sum, item) => sum + item.observed, 0);
  const totalExpected = attendance.reduce((sum, item) => sum + Math.max(1, item.expected), 0);
  return Math.round(totalObserved / totalExpected * 1e3) / 10;
}
function getOverview() {
  const highRisk = inspections.filter((item) => item.riskLevel === "HIGH" || item.riskLevel === "CRITICAL").length;
  const onlineCctv = institutes.filter((item) => item.cctvOnline).length;
  const openAlerts = alerts.filter((item) => item.status === "OPEN").length;
  const integrity = computeSystemIntegrityIndex();
  return {
    kpis: {
      projects: institutes.length,
      inspections: inspections.length,
      highRisk,
      openAlerts,
      evidenceVerified: evidence.filter((item) => item.verification === "MATCH").length,
      cctvOnline: onlineCctv
    },
    trend: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => ({ day, inspections: 18 + index * 3, alerts: [2, 4, 3, 6, 5, 7, 4][index] })),
    recentInspections: inspections.slice(0, 6),
    recentAlerts: alerts,
    cctvHealth: Math.round(onlineCctv / institutes.length * 100),
    systemIntegrityScore: integrity.score,
    chainValid: integrity.chainValid,
    avgAttendance: computeAverageAttendance()
  };
}
function startSurpriseInspection(instituteId) {
  const institute = institutes.find((item) => item.id === instituteId);
  if (!institute) throw new Error("Institute not found");
  const inspection = { id: `INSP-${String(inspections.length + 1).padStart(4, "0")}`, instituteId: institute.id, instituteName: institute.name, status: "ASSIGNMENT_PENDING", riskLevel: institute.riskLevel, inspectorName: "Unassigned", scheduledAt: (/* @__PURE__ */ new Date()).toISOString(), evidenceCount: 0, geofence: "LOCATION_UNAVAILABLE", riskScore: institute.riskLevel === "HIGH" ? 58 : 24 };
  inspections.unshift(inspection);
  appendAudit(auditLog, { type: "INSPECTION_CREATED", actor: "demo.department-admin", payload: { inspectionId: inspection.id, instituteId }, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
  return inspection;
}
function generateAssignment(inspectionId) {
  const inspection = inspections.find((item) => item.id === inspectionId);
  if (!inspection) throw new Error("Inspection not found");
  if (assignments.some((item) => item.inspectionId === inspectionId)) throw new Error("Assignment already exists");
  const candidate = securePick(inspectors.filter((item) => item.active && item.workload < 4 && !item.conflicts.includes(inspection.instituteId)));
  const assignment = { id: `ASN-${String(assignments.length + 1).padStart(4, "0")}`, inspectionId, instituteId: inspection.instituteId, inspectorId: candidate.id, inspectorName: candidate.name, status: "CREATED" };
  assignments.unshift(assignment);
  inspection.status = "ASSIGNMENT_PENDING";
  appendAudit(auditLog, { type: "ASSIGNMENT_GENERATED", actor: "demo.department-admin", payload: { assignmentId: assignment.id, inspectorId: candidate.id, sealed: false }, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
  return assignment;
}
function seal(assignmentId) {
  const assignment = assignments.find((item) => item.id === assignmentId);
  if (!assignment) throw new Error("Assignment not found");
  const sealed = sealAssignment(assignment);
  Object.assign(assignment, sealed);
  appendAudit(auditLog, { type: "ASSIGNMENT_SEALED", actor: "demo.department-admin", payload: { assignmentId }, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
  return assignment;
}
function reveal(assignmentId) {
  const assignment = assignments.find((item) => item.id === assignmentId);
  if (!assignment) throw new Error("Assignment not found");
  const revealed = revealAssignment(assignment);
  Object.assign(assignment, revealed);
  const inspection = inspections.find((item) => item.id === assignment.inspectionId);
  if (inspection) {
    inspection.status = "ASSIGNED";
    inspection.inspectorName = assignment.inspectorName;
  }
  appendAudit(auditLog, { type: "ASSIGNMENT_REVEALED", actor: "demo.department-admin", payload: { assignmentId, inspectorId: assignment.inspectorId }, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
  return assignment;
}
function captureGps(inspectionId, latitude, longitude, accuracy, deviceTimestamp) {
  const inspection = inspections.find((item) => item.id === inspectionId);
  const institute = institutes.find((item) => item.id === inspection?.instituteId);
  if (!inspection || !institute) throw new Error("Inspection not found");
  const geofenceEval = evaluateServerGeofence(
    institute,
    { latitude, longitude, accuracy, deviceTimestamp },
    inspectionId,
    100
  );
  if (geofenceEval.isSpoofed) {
    const alertId = `ALT-${1043 + alerts.length}`;
    alerts.unshift({
      id: alertId,
      type: "GPS_SPOOF_ATTEMPT",
      severity: "CRITICAL",
      title: "GPS Spoofing Anomaly Detected",
      detail: `${inspection.id} at ${institute.name}: ${geofenceEval.spoofReason}`,
      status: "OPEN",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    inspection.geofence = "OUTSIDE_GEOFENCE";
    appendAudit(auditLog, {
      type: "GPS_SPOOF_DETECTED",
      actor: "demo.mobile-inspector",
      payload: { inspectionId, spoofReason: geofenceEval.spoofReason, latitude, longitude, accuracy },
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return {
      status: "SPOOF_DETECTED",
      isSpoofed: true,
      reason: geofenceEval.spoofReason,
      radiusMeters: 100,
      distanceMeters: geofenceEval.distanceMeters,
      note: "Server-side heuristic flagged client GPS spoofing attempt."
    };
  }
  const status = geofenceEval.status;
  inspection.geofence = status;
  if (status === "OUTSIDE_GEOFENCE") {
    alerts.unshift({
      id: `ALT-${1043 + alerts.length}`,
      type: "OUTSIDE_GEOFENCE",
      severity: "HIGH",
      title: "GPS outside configured geofence",
      detail: `${inspection.id} is ${geofenceEval.distanceMeters ?? "N/A"}m from ${institute.name} (exceeds 100m radius).`,
      status: "OPEN",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  appendAudit(auditLog, {
    type: "GPS_CAPTURED",
    actor: "demo.mobile-inspector",
    payload: { inspectionId, status, distanceMeters: geofenceEval.distanceMeters },
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  return {
    status,
    radiusMeters: 100,
    distanceMeters: geofenceEval.distanceMeters,
    note: status === "LOCATION_UNAVAILABLE" ? "Location unavailable is not automatically fraud." : "GPS provides a location-based verification signal."
  };
}
function requestEvidenceNonce(inspectionId) {
  return createEvidenceNonce(inspectionId);
}
function submitLiveCapture(inspectionId, nonce, imageBase64, gps) {
  const inspection = inspections.find((item2) => item2.id === inspectionId);
  if (!inspection) throw new Error("Inspection record not found");
  const institute = institutes.find((item2) => item2.id === inspection.instituteId);
  const instCoords = institute ? { latitude: institute.latitude, longitude: institute.longitude } : { latitude: 28.6139, longitude: 77.209 };
  const serverTime = Date.now();
  const nonceRecord = getNonceRecord(nonce);
  if (!nonceRecord) {
    appendAudit(auditLog, {
      type: "NONCE_INVALID_REJECTED",
      actor: "demo.mobile-inspector",
      payload: { inspectionId, nonce },
      createdAt: new Date(serverTime).toISOString()
    });
    alerts.unshift({
      id: `ALT-${1050 + alerts.length}`,
      type: "ANOMALY_NONCE_REPLAY",
      severity: "CRITICAL",
      title: "Evidence Ingest Rejected",
      detail: `Inspection ${inspectionId}: Invalid or missing camera nonce (${nonce}).`,
      status: "OPEN",
      createdAt: new Date(serverTime).toISOString()
    });
    throw new Error("Capture rejected: Invalid or unknown camera nonce.");
  }
  if (nonceRecord.used) {
    appendAudit(auditLog, {
      type: "NONCE_REPLAY_ATTEMPT",
      actor: "demo.mobile-inspector",
      payload: { inspectionId, nonce },
      createdAt: new Date(serverTime).toISOString()
    });
    alerts.unshift({
      id: `ALT-${1050 + alerts.length}`,
      type: "ANOMALY_NONCE_REPLAY",
      severity: "CRITICAL",
      title: "Replay Attack Blocked",
      detail: `Attempted reuse of single-use nonce ${nonce} for inspection ${inspectionId}.`,
      status: "OPEN",
      createdAt: new Date(serverTime).toISOString()
    });
    throw new Error("Capture rejected: Replayed nonce detected! Camera session nonces are strictly single-use.");
  }
  if (nonceRecord.expiresAt < serverTime) {
    nonceRecord.used = true;
    appendAudit(auditLog, {
      type: "NONCE_EXPIRED_REJECTED",
      actor: "demo.mobile-inspector",
      payload: { inspectionId, nonce },
      createdAt: new Date(serverTime).toISOString()
    });
    throw new Error("Capture rejected: Nonce expired (valid for 2 minutes). Please recapture.");
  }
  nonceRecord.used = true;
  const geofenceResult = evaluateServerGeofence(instCoords, gps, inspectionId);
  if (geofenceResult.isSpoofed || geofenceResult.status === "OUTSIDE_GEOFENCE" || geofenceResult.status === "LOCATION_UNAVAILABLE") {
    const reason = geofenceResult.spoofReason || `GPS geofence status: ${geofenceResult.status}`;
    appendAudit(auditLog, {
      type: "LIVE_CAPTURE_GEOFENCE_REJECTED",
      actor: "demo.mobile-inspector",
      payload: { inspectionId, nonce, reason, gps },
      createdAt: new Date(serverTime).toISOString()
    });
    alerts.unshift({
      id: `ALT-${1050 + alerts.length}`,
      type: "GPS_SPOOF_ATTEMPT",
      severity: "CRITICAL",
      title: "Geofence Violation / Spoof Rejected",
      detail: `Inspection ${inspectionId}: ${reason}`,
      status: "OPEN",
      createdAt: new Date(serverTime).toISOString()
    });
    throw new Error(`Live capture rejected: ${reason}`);
  }
  const bundle = `${imageBase64}:${nonce}:${serverTime}:${gps.latitude}:${gps.longitude}`;
  const imageHash = sha256(bundle);
  const item = {
    id: `EVD-${String(evidence.length + 1).padStart(4, "0")}`,
    inspectionId,
    filename: `live-capture-${Date.now()}.jpg`,
    mimeType: "image/jpeg",
    originalHash: imageHash,
    storageRef: `live-camera://${inspectionId}/${nonce}`,
    capturedAt: new Date(serverTime).toISOString(),
    gpsStatus: "INSIDE_GEOFENCE",
    verification: "MATCH"
  };
  evidence.unshift(item);
  inspection.evidenceCount += 1;
  appendAudit(auditLog, {
    type: "EVIDENCE_LIVE_CAPTURED",
    actor: "demo.mobile-inspector",
    payload: {
      evidenceId: item.id,
      inspectionId,
      imageHash,
      nonce,
      distanceMeters: geofenceResult.distanceMeters
    },
    createdAt: new Date(serverTime).toISOString()
  });
  return { success: true, evidence: item, imageHash };
}
function submitInspection(inspectionId, observation, evidenceHash) {
  const inspection = inspections.find((item) => item.id === inspectionId);
  if (!inspection) throw new Error("Inspection not found");
  let matchedEvidence = evidence.find((e) => e.inspectionId === inspectionId && e.originalHash === evidenceHash);
  if (!matchedEvidence) {
    matchedEvidence = evidence.find((e) => e.inspectionId === inspectionId);
  }
  const finalEvidenceHash = evidenceHash || matchedEvidence?.originalHash || "EVD-PENDING-VERIFICATION";
  inspection.status = "SUBMITTED";
  inspection.evidenceCount = Math.max(inspection.evidenceCount, 1);
  inspection.observation = observation;
  inspection.lastObservedAt = (/* @__PURE__ */ new Date()).toISOString();
  appendAudit(auditLog, {
    type: "INSPECTION_SUBMITTED",
    actor: "demo.mobile-inspector",
    payload: {
      inspectionId,
      observation: observation.slice(0, 140),
      evidenceHash: finalEvidenceHash
    },
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  return inspection;
}
function verifyEvidenceDemo(evidenceId, tamper = false) {
  const item = evidence.find((entry) => entry.id === evidenceId);
  if (!item) throw new Error("Evidence not found");
  const content = tamper ? `tampered-${item.filename}-${Date.now()}` : item.id.replace("EVD-", "demo-evidence-") + "-secure-sight";
  const result = verifyEvidence(item.originalHash, content);
  item.verification = result.result;
  if (result.result === "TAMPERED") {
    alerts.unshift({ id: `ALT-${1043 + alerts.length}`, type: "TAMPERED_EVIDENCE", severity: "CRITICAL", title: "Tampered evidence detected", detail: `${item.id} recomputed hash does not match the original server hash.`, status: "OPEN", createdAt: (/* @__PURE__ */ new Date()).toISOString() });
    appendAudit(auditLog, { type: "EVIDENCE_TAMPER_DETECTED", actor: "demo.verification-service", payload: { evidenceId: item.id, originalHash: item.originalHash, recomputedHash: result.recomputedHash }, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
  } else {
    appendAudit(auditLog, { type: "EVIDENCE_VERIFIED", actor: "demo.verification-service", payload: { evidenceId: item.id, result: result.result }, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
  }
  return { ...item, ...result };
}
function runRiskAnalysis(inspectionId) {
  const inspection = inspections.find((item2) => item2.id === inspectionId);
  if (!inspection) throw new Error("Inspection not found");
  const item = evidence.find((entry) => entry.inspectionId === inspectionId);
  const institute = institutes.find((entry) => entry.id === inspection.instituteId);
  const attendanceResult = analyzeAttendance(attendance.filter((entry) => entry.instituteId === inspection.instituteId));
  const risk = scoreRisk({ geofence: inspection.geofence, evidence: item?.verification ?? "PENDING", timestamp: "TIMESTAMP_VALID", cctvOnline: institute?.cctvOnline ?? false, attendanceAnomaly: attendanceResult.anomalyScore });
  inspection.riskScore = risk.riskScore;
  inspection.riskLevel = risk.riskLevel;
  appendAudit(auditLog, { type: "AI_RISK_ANALYSIS", actor: "demo.mock-ai-provider", payload: { inspectionId, ...risk, modelVersion: "mock-ai-1.0" }, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
  return { ...risk, explanation: "AI identifies risk indicators and anomalies; it is advisory and does not modify assignments, evidence hashes, audit logs, or verification results.", modelVersion: "mock-ai-1.0", analysisTimestamp: (/* @__PURE__ */ new Date()).toISOString(), attendanceAnomaly: attendanceResult };
}
function seedNewEvidence(inspectionId) {
  const content = `new-evidence-${Date.now()}`;
  const item = { id: `EVD-${String(evidence.length + 1).padStart(4, "0")}`, inspectionId, filename: "mobile-capture.jpg", mimeType: "image/jpeg", originalHash: sha256(content), storageRef: `demo://evidence/${evidence.length + 1}`, capturedAt: (/* @__PURE__ */ new Date()).toISOString(), gpsStatus: "INSIDE_GEOFENCE", verification: "PENDING" };
  evidence.unshift(item);
  appendAudit(auditLog, { type: "EVIDENCE_CAPTURED", actor: "demo.mobile-inspector", payload: { evidenceId: item.id, sha256: item.originalHash }, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
  return item;
}
function getAttendanceSummary() {
  const byInstitute = institutes.slice(0, 8).map((institute) => {
    const result = analyzeAttendance(attendance.filter((entry) => entry.instituteId === institute.id));
    return { institute: institute.name, ...result, observedDays: attendance.filter((entry) => entry.instituteId === institute.id).length };
  });
  return { rows: byInstitute, sourceNote: "Observed register and attendance records are kept separate from inferred anomaly scores." };
}
function getAudit() {
  return { events: auditLog.slice(0, 40), verification: verifyAuditChain(auditLog) };
}
var checklistTemplates = {
  NAPDDR: [
    { id: "NAP-01", label: "Beneficiary register matches observed attendance", required: true },
    { id: "NAP-02", label: "Counselling and rehabilitation records available", required: true },
    { id: "NAP-03", label: "Safety, hygiene, and accessibility controls observed", required: true }
  ],
  SMILE: [
    { id: "SMI-01", label: "Skill-training schedule and trainer presence verified", required: true },
    { id: "SMI-02", label: "Beneficiary consent and grievance register reviewed", required: true },
    { id: "SMI-03", label: "Outcome documentation sampled", required: false }
  ],
  AVYAY: [
    { id: "AVY-01", label: "Shelter occupancy and basic services verified", required: true },
    { id: "AVY-02", label: "Medical and care escalation records reviewed", required: true },
    { id: "AVY-03", label: "Visitor and incident register sampled", required: false }
  ]
};
function getChecklistForInspection(inspectionId) {
  const inspection = inspections.find((item) => item.id === inspectionId);
  const institute = institutes.find((item) => item.id === inspection?.instituteId);
  const scheme = institute?.scheme ?? "NAPDDR";
  return { scheme, items: checklistTemplates[scheme] ?? checklistTemplates.NAPDDR };
}
function reportCctvFeedStatus(instituteId, status, reason = "Watchdog detection") {
  const institute = institutes.find((i) => i.id === instituteId);
  if (!institute) throw new Error("Institute not found");
  const serverTime = (/* @__PURE__ */ new Date()).toISOString();
  institute.cctvOnline = status === "ONLINE";
  institute.cctvLastSeen = serverTime;
  if (status === "OFFLINE" || status === "FROZEN") {
    alerts.unshift({
      id: `ALT-${1070 + alerts.length}`,
      type: "CCTV_FEED_DISRUPTED",
      severity: status === "OFFLINE" ? "CRITICAL" : "HIGH",
      title: `CCTV Surveillance Feed ${status}`,
      detail: `Institute ${institute.name} (${instituteId}): ${reason}`,
      status: "OPEN",
      createdAt: serverTime
    });
    appendAudit(auditLog, {
      type: `CCTV_FEED_${status}`,
      actor: "system.cctv-watchdog",
      payload: { instituteId, instituteName: institute.name, status, reason },
      createdAt: serverTime
    });
  }
  return { success: true, instituteId, status, lastSeen: serverTime };
}
function updateAlertStatus(alertId, status) {
  const item = alerts.find((entry) => entry.id === alertId);
  if (!item) throw new Error("Alert not found");
  item.status = status;
  appendAudit(auditLog, { type: `ALERT_${status}`, actor: "demo.department-admin", payload: { alertId, status }, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
  return item;
}
function getRegionalOverview(stateScope) {
  const filteredInstitutes = stateScope ? institutes.filter((i) => i.state.toLowerCase() === stateScope.toLowerCase()) : institutes;
  const instituteIds = new Set(filteredInstitutes.map((i) => i.id));
  const filteredInspections = inspections.filter((i) => instituteIds.has(i.instituteId));
  const filteredAlerts = alerts.filter((a) => {
    const matchInst = institutes.find((inst) => a.detail.includes(inst.name) || a.detail.includes(inst.id));
    return matchInst ? instituteIds.has(matchInst.id) : true;
  });
  const filteredVcOutcomes = activeVcSessions.filter((s) => instituteIds.has(s.instituteId));
  const doneCount = filteredInspections.filter((i) => i.status === "SUBMITTED" || i.status === "COMPLETED").length;
  const pendingCount = filteredInspections.filter((i) => i.status !== "SUBMITTED" && i.status !== "COMPLETED").length;
  const onlineCctvCount = filteredInstitutes.filter((i) => i.cctvOnline).length;
  const cctvPercentage = filteredInstitutes.length > 0 ? Math.round(onlineCctvCount / filteredInstitutes.length * 100) : 100;
  const totalBeneficiaries = filteredInstitutes.reduce((sum, i) => sum + i.beneficiaryCount, 0);
  const openAnomalies = filteredAlerts.filter((a) => a.status === "OPEN").length;
  const baseScore = 95 - openAnomalies * 5 - (pendingCount > 2 ? 10 : 0);
  const complianceScore = Math.max(40, Math.min(100, baseScore));
  return {
    stateScope: stateScope || "ALL_JURISDICTIONS",
    institutes: filteredInstitutes,
    inspections: filteredInspections,
    alerts: filteredAlerts,
    vcOutcomes: filteredVcOutcomes,
    kpis: {
      institutesCount: filteredInstitutes.length,
      inspectionsDone: doneCount,
      inspectionsPending: pendingCount,
      openAnomalies,
      complianceScore,
      cctvHealth: cctvPercentage,
      totalBeneficiaries
    }
  };
}
var activeVcSessions = [];
var CONTACT_ROLES = ["Project Incharge", "Staff Supervisor", "Beneficiary Representative"];
var SAMPLE_CONTACTS = [
  "Dr. Rajesh Kumar (Project Incharge)",
  "Smt. Ananya Sen (Staff Superintendent)",
  "Shri Ramesh Chand (Beneficiary Rep)",
  "Dr. Priya Nair (Resident Officer)"
];
function triggerRandomVc(requestedBy = "demo.department-admin") {
  const targetInstitute = securePick(institutes);
  const contactName = securePick(SAMPLE_CONTACTS);
  const contactRole = securePick(CONTACT_ROLES);
  const rawRoomId = sha256(`vc-${targetInstitute.id}-${Date.now()}`);
  const roomId = `dosje-nigrani-${rawRoomId.slice(0, 12)}`;
  const jitsiUrl = `https://meet.jit.si/${roomId}`;
  const session = {
    id: `VC-${String(activeVcSessions.length + 1).padStart(4, "0")}`,
    roomId,
    instituteId: targetInstitute.id,
    instituteName: targetInstitute.name,
    contactName,
    contactRole,
    status: "RINGING",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    jitsiUrl
  };
  activeVcSessions.unshift(session);
  appendAudit(auditLog, {
    type: "VC_CALL_REQUESTED",
    actor: requestedBy,
    payload: {
      sessionId: session.id,
      roomId,
      instituteId: targetInstitute.id,
      instituteName: targetInstitute.name,
      contactName,
      contactRole
    },
    createdAt: session.createdAt
  });
  return session;
}
function answerVcCall(sessionId, actor = "demo.target-user") {
  const session = activeVcSessions.find((s) => s.id === sessionId);
  if (!session) throw new Error("VC Session not found");
  session.status = "ANSWERED";
  session.answeredAt = (/* @__PURE__ */ new Date()).toISOString();
  appendAudit(auditLog, {
    type: "VC_CALL_ANSWERED",
    actor,
    payload: { sessionId: session.id, roomId: session.roomId, instituteId: session.instituteId },
    createdAt: session.answeredAt
  });
  return session;
}
function declineVcCall(sessionId, actor = "demo.target-user") {
  const session = activeVcSessions.find((s) => s.id === sessionId);
  if (!session) throw new Error("VC Session not found");
  session.status = "DECLINED";
  session.endedAt = (/* @__PURE__ */ new Date()).toISOString();
  alerts.unshift({
    id: `ALT-${1060 + alerts.length}`,
    type: "VC_CALL_DECLINED",
    severity: "HIGH",
    title: "Surprise Inspection VC Call Declined",
    detail: `Random call to ${session.instituteName} (${session.contactName}) was DECLINED by target.`,
    status: "OPEN",
    createdAt: session.endedAt
  });
  appendAudit(auditLog, {
    type: "VC_CALL_DECLINED",
    actor,
    payload: { sessionId: session.id, roomId: session.roomId, instituteId: session.instituteId, reason: "USER_DECLINED" },
    createdAt: session.endedAt
  });
  return session;
}
function missVcCall(sessionId) {
  const session = activeVcSessions.find((s) => s.id === sessionId);
  if (!session || session.status !== "RINGING") return session;
  session.status = "MISSED";
  session.endedAt = (/* @__PURE__ */ new Date()).toISOString();
  alerts.unshift({
    id: `ALT-${1060 + alerts.length}`,
    type: "VC_CALL_MISSED",
    severity: "CRITICAL",
    title: "Unanswered Surprise VC Inspection Call",
    detail: `Random VC inspection call to ${session.instituteName} (${session.contactName}) timed out with NO RESPONSE after 30s.`,
    status: "OPEN",
    createdAt: session.endedAt
  });
  appendAudit(auditLog, {
    type: "VC_CALL_MISSED",
    actor: "system.vc-monitor",
    payload: { sessionId: session.id, roomId: session.roomId, instituteId: session.instituteId, anomalyFlag: "UNANSWERED_CALL" },
    createdAt: session.endedAt
  });
  return session;
}
function endVcCall(sessionId, actor = "demo.user") {
  const session = activeVcSessions.find((s) => s.id === sessionId);
  if (!session) throw new Error("VC Session not found");
  session.status = "ENDED";
  session.endedAt = (/* @__PURE__ */ new Date()).toISOString();
  appendAudit(auditLog, {
    type: "VC_CALL_ENDED",
    actor,
    payload: { sessionId: session.id, roomId: session.roomId, instituteId: session.instituteId },
    createdAt: session.endedAt
  });
  return session;
}

// server/domain/providers.ts
import { randomUUID as randomUUID2 } from "node:crypto";
var MockCCTVProvider = class {
  async getStatus(cameraId, streamUrl) {
    if (streamUrl?.startsWith("invalid:")) return { cameraId, status: "INVALID_STREAM", lastSeen: null, provider: "DEMO" };
    return { cameraId, status: cameraId.endsWith("OFFLINE") ? "OFFLINE" : "ONLINE", lastSeen: (/* @__PURE__ */ new Date()).toISOString(), provider: "DEMO" };
  }
};
var MockVideoConferenceProvider = class {
  async createSession(input) {
    if (!input.participantId.trim()) return { sessionId: "", participantId: input.participantId, status: "FAILED", provider: "DEMO", reason: "PARTICIPANT_REQUIRED" };
    return { sessionId: `DEMO-VC-${randomUUID2()}`, participantId: input.participantId, status: "CREATED", provider: "DEMO" };
  }
};

// server/routers/routers.ts
function actorRole(user) {
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
function roleProcedure(...allowed) {
  return protectedProcedure.use(({ ctx, next }) => {
    const role = actorRole(ctx.user);
    if (!allowed.includes(role)) throw new TRPCError3({ code: "FORBIDDEN", message: `Role ${role} is not authorized for this operation` });
    return next({ ctx: { ...ctx, actorRole: role } });
  });
}
function assertInstituteScope(role, organizationId, instituteId) {
  if (role === "INSTITUTE_ADMIN" && (!organizationId || organizationId !== instituteId)) {
    throw new TRPCError3({ code: "FORBIDDEN", message: "Institute administrator cannot access another organization's records" });
  }
}
function getUserStateScope(user) {
  const openId = user.openId.toLowerCase();
  const email = (user.email ?? "").toLowerCase();
  if (openId.includes("maharashtra") || email.includes("maharashtra")) return "Maharashtra";
  if (openId.includes("karnataka") || email.includes("karnataka")) return "Karnataka";
  if (openId.includes("up") || email.includes("uttar-pradesh")) return "Uttar Pradesh";
  return "Delhi";
}
var readProcedure = protectedProcedure;
var departmentProcedure = roleProcedure("DEPARTMENT_ADMIN");
var fieldProcedure = roleProcedure("DEPARTMENT_ADMIN", "PMU_INSPECTOR");
var verificationProcedure = roleProcedure("DEPARTMENT_ADMIN", "AUDITOR");
var evidenceVerificationProcedure = roleProcedure("DEPARTMENT_ADMIN", "PMU_INSPECTOR", "AUDITOR");
var cctv = new MockCCTVProvider();
var vc = new MockVideoConferenceProvider();
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    demoCredentials: publicProcedure.query(() => {
      const isDemoMode = process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production";
      if (!isDemoMode) {
        return { demoMode: false, credentials: null };
      }
      return {
        demoMode: true,
        credentials: SERVER_DEMO_CREDENTIALS
      };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
    login: publicProcedure.input(
      z2.object({
        role: z2.enum(["official", "pmu", "ngo", "beneficiary", "state"]),
        identifier: z2.string().trim().min(1, "Identifier is required"),
        password: z2.string().min(1, "Password is required"),
        rememberMe: z2.boolean().default(false)
      })
    ).mutation(async ({ ctx, input }) => {
      const authCheck = verifyServerRoleCredentials(input.role, input.identifier, input.password);
      if (!authCheck.valid || !authCheck.credential) {
        throw new TRPCError3({
          code: "UNAUTHORIZED",
          message: authCheck.error || "Authentication failed. Invalid credentials for the selected role."
        });
      }
      const cred = authCheck.credential;
      const role = cred.dbRole;
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
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const user = await getUserByOpenId(openId);
      if (!user) {
        throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Failed to establish user session" });
      }
      const expiresInMs = input.rememberMe ? ONE_YEAR_MS : 24 * 60 * 60 * 1e3;
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || defaultName,
        expiresInMs
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: expiresInMs
      });
      return {
        success: true,
        token: sessionToken,
        user
      };
    })
  }),
  dashboard: router({
    overview: readProcedure.query(() => getOverview()),
    institutes: readProcedure.query(() => institutes),
    inspections: readProcedure.query(() => inspections),
    alerts: readProcedure.query(() => alerts),
    assignments: readProcedure.query(() => assignments),
    evidence: readProcedure.query(() => evidence.slice(0, 36)),
    attendance: readProcedure.query(() => getAttendanceSummary()),
    checklist: readProcedure.input(z2.object({ inspectionId: z2.string().regex(/^INSP-\d{4,}$/) })).query(({ input }) => getChecklistForInspection(input.inspectionId)),
    audit: verificationProcedure.query(() => getAudit())
  }),
  workflow: router({
    startInspection: departmentProcedure.input(z2.object({ instituteId: z2.string().regex(/^INS-\d{3}$/) })).mutation(async ({ ctx, input }) => {
      assertInstituteScope(ctx.actorRole, ctx.user.organizationId, input.instituteId);
      const result = startSurpriseInspection(input.instituteId);
      queuePersistence();
      await flushPersistence();
      return result;
    }),
    generateAssignment: departmentProcedure.input(z2.object({ inspectionId: z2.string().regex(/^INSP-\d{4,}$/), requestedInspectorId: z2.string().optional() })).mutation(async ({ input }) => {
      const claimed = await claimAssignment(input.inspectionId, randomUUID3());
      if (!claimed) throw new TRPCError3({ code: "CONFLICT", message: "This inspection is already being assigned by another operator" });
      const result = generateAssignment(input.inspectionId);
      queuePersistence();
      await flushPersistence();
      return result;
    }),
    sealAssignment: departmentProcedure.input(z2.object({ assignmentId: z2.string().regex(/^ASN-\d{4,}$/) })).mutation(async ({ input }) => {
      const result = seal(input.assignmentId);
      queuePersistence();
      await flushPersistence();
      return result;
    }),
    revealAssignment: departmentProcedure.input(z2.object({ assignmentId: z2.string().regex(/^ASN-\d{4,}$/) })).mutation(async ({ input }) => {
      const result = reveal(input.assignmentId);
      queuePersistence();
      await flushPersistence();
      return result;
    }),
    captureGps: fieldProcedure.input(z2.object({ inspectionId: z2.string().regex(/^INSP-\d{4,}$/), latitude: z2.number().min(-90).max(90).nullable(), longitude: z2.number().min(-180).max(180).nullable(), accuracy: z2.number().nullable().optional(), deviceTimestamp: z2.number().nullable().optional() })).mutation(async ({ input }) => {
      const result = captureGps(input.inspectionId, input.latitude, input.longitude, input.accuracy, input.deviceTimestamp);
      queuePersistence();
      await flushPersistence();
      return result;
    }),
    captureEvidence: fieldProcedure.input(z2.object({ inspectionId: z2.string().regex(/^INSP-\d{4,}$/) })).mutation(async ({ input }) => {
      const result = seedNewEvidence(input.inspectionId);
      queuePersistence();
      await flushPersistence();
      return result;
    }),
    requestNonce: fieldProcedure.input(z2.object({ inspectionId: z2.string().regex(/^INSP-\d{4,}$/) })).mutation(({ input }) => requestEvidenceNonce(input.inspectionId)),
    submitLiveEvidence: fieldProcedure.input(z2.object({
      inspectionId: z2.string().regex(/^INSP-\d{4,}$/),
      nonce: z2.string().min(1),
      imageBase64: z2.string().min(1),
      gps: z2.object({
        latitude: z2.number().min(-90).max(90).nullable(),
        longitude: z2.number().min(-180).max(180).nullable(),
        accuracy: z2.number().nullable().optional(),
        deviceTimestamp: z2.number().nullable().optional()
      })
    })).mutation(async ({ input }) => {
      const result = submitLiveCapture(input.inspectionId, input.nonce, input.imageBase64, {
        latitude: input.gps.latitude,
        longitude: input.gps.longitude,
        accuracy: input.gps.accuracy ?? null,
        deviceTimestamp: input.gps.deviceTimestamp ?? null
      });
      queuePersistence();
      await flushPersistence();
      return result;
    }),
    submitInspection: fieldProcedure.input(z2.object({ inspectionId: z2.string().regex(/^INSP-\d{4,}$/), observation: z2.string().trim().min(3).max(1e3), evidenceHash: z2.string().optional() })).mutation(async ({ input }) => {
      const result = submitInspection(input.inspectionId, input.observation, input.evidenceHash);
      queuePersistence();
      await flushPersistence();
      return result;
    }),
    verifyEvidence: evidenceVerificationProcedure.input(z2.object({ evidenceId: z2.string().regex(/^EVD-\d{4,}$/), tamper: z2.boolean().default(false) })).mutation(async ({ input }) => {
      const result = verifyEvidenceDemo(input.evidenceId, input.tamper);
      queuePersistence();
      await flushPersistence();
      return result;
    }),
    analyzeRisk: verificationProcedure.input(z2.object({ inspectionId: z2.string().regex(/^INSP-\d{4,}$/) })).mutation(async ({ input }) => {
      const result = runRiskAnalysis(input.inspectionId);
      queuePersistence();
      await flushPersistence();
      return result;
    }),
    verifyAudit: verificationProcedure.mutation(() => verifyAuditChain(getAudit().events)),
    createVideoSession: fieldProcedure.input(z2.object({ participantId: z2.string().trim().min(1).max(120) })).mutation(({ input }) => vc.createSession(input)),
    acknowledgeAlert: departmentProcedure.input(z2.object({ alertId: z2.string().regex(/^ALT-\d{4,}$/) })).mutation(async ({ input }) => {
      const result = updateAlertStatus(input.alertId, "ACKNOWLEDGED");
      queuePersistence();
      await flushPersistence();
      return result;
    }),
    resolveAlert: departmentProcedure.input(z2.object({ alertId: z2.string().regex(/^ALT-\d{4,}$/) })).mutation(async ({ input }) => {
      const result = updateAlertStatus(input.alertId, "RESOLVED");
      queuePersistence();
      await flushPersistence();
      return result;
    })
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
          delete entry.payload._TAMPERED_BY_ATTACKER;
        }
      });
      queuePersistence();
      await flushPersistence();
      return verifyAuditChain(auditLog);
    })
  }),
  vc: router({
    triggerRandom: departmentProcedure.mutation(async ({ ctx }) => {
      const session = triggerRandomVc(ctx.user.email ?? ctx.user.openId);
      queuePersistence();
      await flushPersistence();
      return session;
    }),
    activeCalls: readProcedure.query(() => activeVcSessions),
    answerCall: readProcedure.input(z2.object({ sessionId: z2.string() })).mutation(async ({ ctx, input }) => {
      const session = answerVcCall(input.sessionId, ctx.user.email ?? ctx.user.openId);
      queuePersistence();
      await flushPersistence();
      return session;
    }),
    declineCall: readProcedure.input(z2.object({ sessionId: z2.string() })).mutation(async ({ ctx, input }) => {
      const session = declineVcCall(input.sessionId, ctx.user.email ?? ctx.user.openId);
      queuePersistence();
      await flushPersistence();
      return session;
    }),
    missCall: readProcedure.input(z2.object({ sessionId: z2.string() })).mutation(async ({ input }) => {
      const session = missVcCall(input.sessionId);
      queuePersistence();
      await flushPersistence();
      return session;
    }),
    endCall: readProcedure.input(z2.object({ sessionId: z2.string() })).mutation(async ({ ctx, input }) => {
      const session = endVcCall(input.sessionId, ctx.user.email ?? ctx.user.openId);
      queuePersistence();
      await flushPersistence();
      return session;
    })
  }),
  cctv: router({
    reportFeedStatus: readProcedure.input(z2.object({
      instituteId: z2.string().regex(/^INS-\d{3}$/),
      status: z2.enum(["ONLINE", "OFFLINE", "FROZEN"]),
      reason: z2.string().optional()
    })).mutation(async ({ input }) => {
      const result = reportCctvFeedStatus(input.instituteId, input.status, input.reason);
      queuePersistence();
      await flushPersistence();
      return result;
    })
  }),
  stateAuthority: router({
    overview: protectedProcedure.query(({ ctx }) => {
      const userRole = actorRole(ctx.user);
      const scopeState = userRole === "STATE_AUTHORITY" ? getUserStateScope(ctx.user) : null;
      return getRegionalOverview(scopeState);
    }),
    getRegionalData: protectedProcedure.input(z2.object({ requestedState: z2.string() })).query(({ ctx, input }) => {
      const userRole = actorRole(ctx.user);
      const userState = getUserStateScope(ctx.user);
      if (userRole === "STATE_AUTHORITY" && input.requestedState.toLowerCase() !== userState.toLowerCase()) {
        throw new TRPCError3({
          code: "FORBIDDEN",
          message: `Access Denied: State Authority for '${userState}' cannot fetch out-of-scope data for region '${input.requestedState}'`
        });
      }
      return getRegionalOverview(input.requestedState);
    })
  }),
  providers: router({
    cctvStatus: readProcedure.input(z2.object({ cameraId: z2.string().min(1).max(120), streamUrl: z2.string().max(500).optional() })).query(({ input }) => cctv.getStatus(input.cameraId, input.streamUrl))
  }),
  administration: router({
    users: departmentProcedure.query(() => listUsers()),
    updateUser: departmentProcedure.input(z2.object({ userId: z2.number().int().positive(), role: z2.enum(["DEPARTMENT_ADMIN", "PMU_INSPECTOR", "INSTITUTE_ADMIN", "AUDITOR"]), organizationId: z2.string().regex(/^INS-\d{3}$/).nullable() })).mutation(({ input }) => updateUserAccess(input.userId, input.role, input.organizationId)),
    inviteUser: departmentProcedure.input(z2.object({ openId: z2.string().trim().min(3).max(64), name: z2.string().trim().min(2).max(120), email: z2.string().email(), role: z2.enum(["DEPARTMENT_ADMIN", "PMU_INSPECTOR", "INSTITUTE_ADMIN", "AUDITOR"]), organizationId: z2.string().regex(/^INS-\d{3}$/).nullable() })).mutation(({ input }) => createInvitedUser(input)),
    permissionMatrix: departmentProcedure.query(() => ({
      DEPARTMENT_ADMIN: ["dashboard:read", "inspection:create", "assignment:generate", "assignment:seal", "assignment:reveal", "evidence:verify", "alerts:triage", "users:manage"],
      PMU_INSPECTOR: ["dashboard:read", "inspection:field-update", "gps:capture", "evidence:capture", "inspection:submit"],
      INSTITUTE_ADMIN: ["dashboard:read", "institute:own-scope"],
      AUDITOR: ["dashboard:read", "evidence:verify", "audit:verify", "risk:review"]
    }))
  }),
  security: router({
    whoAmI: readProcedure.query(({ ctx }) => ({ role: actorRole(ctx.user), serverAuthoritative: true }))
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path3 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path2 from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path2.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path2.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path2.resolve(import.meta.dirname, "client", "src"),
      "@shared": path2.resolve(import.meta.dirname, "shared"),
      "@assets": path2.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path2.resolve(import.meta.dirname),
  root: path2.resolve(import.meta.dirname, "client"),
  publicDir: path2.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path2.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    // WebDev exposes the app through an HTTPS reverse proxy. Without the
    // external client port/protocol Vite advertises localhost:5173, which
    // makes the browser's HMR websocket fail even though HTTP works.
    hmr: {
      server,
      protocol: "wss",
      clientPort: 443
    },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/app/main.tsx"`,
        `src="/src/app/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path3.resolve(import.meta.dirname, "../..", "dist", "public") : path3.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}

// server/domain/storage.ts
import crypto from "node:crypto";
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error("Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY");
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function assertReadableKey(relKey) {
  const key = normalizeKey(relKey);
  if (!key || key.includes("\0") || key.includes("..")) throw new Error("Storage key is invalid");
  if (!(key.startsWith("users/") || key.startsWith("shared/") || key.startsWith("securesight/") || key.startsWith("health/"))) {
    throw new Error("Storage keys must use a scoped users/ or approved system prefix");
  }
  return key;
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  return lastDot === -1 ? `${relKey}_${hash}` : `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", `${forgeUrl}/`);
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!presignResp.ok) throw new Error(`Storage presign failed (${presignResp.status})`);
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
  if (!uploadResp.ok) throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  return { key, url: `/manus-storage/${key}` };
}
async function storageGetSignedUrl(relKey) {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = assertReadableKey(relKey);
  const getUrl = new URL("v1/storage/presign/get", `${forgeUrl}/`);
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!resp.ok) throw new Error(`Storage signed URL failed (${resp.status})`);
  const { url } = await resp.json();
  if (!url) throw new Error("Forge returned empty signed URL");
  return url;
}

// server/_core/index.ts
import path4 from "node:path";
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const persistence = await hydrateDemoState();
  console.log(`[Persistence] Domain state loaded from ${persistence.source}: ${persistence.count} records`);
  await seedDemoAccounts();
  const app = express2();
  const server = createServer(app);
  const isDev = process.env.NODE_ENV !== "production";
  app.use(
    helmet({
      contentSecurityPolicy: isDev ? false : {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://meet.jit.si", "https://*.jit.si"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          imgSrc: ["'self'", "data:", "blob:", "https://*"],
          mediaSrc: ["'self'", "blob:", "https://*.mux.dev", "https://*"],
          frameSrc: ["'self'", "https://meet.jit.si", "https://*.jit.si"],
          connectSrc: ["'self'", "wss:", "https:", "http:"]
        }
      },
      crossOriginEmbedderPolicy: false
    })
  );
  const authLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    max: 10,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          json: {
            message: "Too many login attempts. Please wait 15 minutes before trying again.",
            code: -32005,
            data: { code: "TOO_MANY_REQUESTS", httpStatus: 429 }
          }
        }
      });
    }
  });
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie, x-trpc-source");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health/ready", async (_req, res) => {
    let database = false;
    let storage = false;
    try {
      const db = await getDb();
      if (db) {
        await db.execute("SELECT 1");
        database = true;
      }
    } catch {
      database = false;
    }
    const ready = database && storage;
    return res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "degraded", database, storage, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  const sseClients = /* @__PURE__ */ new Set();
  app.get("/api/events/sse", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write(`event: connected
data: ${JSON.stringify({ timestamp: (/* @__PURE__ */ new Date()).toISOString(), protocol: "SSE" })}

`);
    sseClients.add(res);
    const heartbeat = setInterval(() => {
      res.write(`event: ping
data: ${JSON.stringify({ timestamp: (/* @__PURE__ */ new Date()).toISOString() })}

`);
    }, 15e3);
    req.on("close", () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });
  const sendLoginHtml = (_req, res) => {
    return res.sendFile(path4.resolve(process.cwd(), "dosje-login.html"));
  };
  app.get("/dosje-login.html", sendLoginHtml);
  app.get("/api/auth/demo-credentials", (_req, res) => {
    const isDemoMode = process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production";
    if (!isDemoMode) return res.json({ demoMode: false, credentials: null });
    return res.json({ demoMode: true, credentials: SERVER_DEMO_CREDENTIALS });
  });
  app.post("/api/auth/login", authLoginLimiter, async (req, res) => {
    try {
      const { role, identifier, employeeId, email: userEmail, password, rememberMe } = req.body ?? {};
      const id = identifier || employeeId || userEmail;
      if (!role || !id || !password) {
        return res.status(400).json({ error: "Role, identifier, and password are required" });
      }
      const authCheck = verifyServerRoleCredentials(String(role), String(id), String(password));
      if (!authCheck.valid || !authCheck.credential) {
        return res.status(401).json({ error: authCheck.error || "Authentication failed. Invalid credentials for the selected role." });
      }
      const cred = authCheck.credential;
      const dbRole = cred.dbRole;
      const defaultName = cred.name;
      const email = cred.email;
      const organizationId = cred.organizationId;
      const sanitizedId = String(id).replace(/[^a-zA-Z0-9_-]/g, "");
      const openId = `dosje-${cred.roleKey}-${sanitizedId.toLowerCase() || cred.primaryId.toLowerCase()}`;
      await upsertUser({
        openId,
        name: defaultName,
        email,
        role: dbRole,
        organizationId,
        loginMethod: "dosje-login-html",
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const user = await getUserByOpenId(openId);
      if (!user) {
        return res.status(500).json({ error: "Failed to establish user session" });
      }
      const expiresInMs = rememberMe ? ONE_YEAR_MS : 24 * 60 * 60 * 1e3;
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || defaultName,
        expiresInMs
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: expiresInMs
      });
      return res.json({
        success: true,
        token: sessionToken,
        user
      });
    } catch (error) {
      console.error("[Login API Error]", error);
      return res.status(500).json({ error: error instanceof Error ? error.message : "Authentication failed" });
    }
  });
  const handleLogout = (req, res) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, path: "/" });
    res.clearCookie("app_session_id", { ...cookieOptions, path: "/" });
    if (req.accepts("html") && !req.xhr && !req.path.startsWith("/api/")) {
      return res.redirect("/login");
    }
    return res.json({ success: true, message: "Logged out successfully" });
  };
  app.post("/api/auth/logout", handleLogout);
  app.get("/api/auth/logout", handleLogout);
  app.get("/logout", handleLogout);
  app.get("/signout", handleLogout);
  const evidenceUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => callback(null, ["image/jpeg", "image/png", "application/pdf"].includes(file.mimetype))
  });
  app.post("/api/evidence/upload", evidenceUpload.single("file"), async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const role = actorRole(user);
      if (!["DEPARTMENT_ADMIN", "PMU_INSPECTOR"].includes(role)) return res.status(403).json({ error: "Role not authorized for evidence capture" });
      const inspectionId = String(req.body.inspectionId ?? "");
      const inspection = inspections.find((item2) => item2.id === inspectionId);
      if (!inspection || !req.file) return res.status(400).json({ error: "inspectionId and supported file are required" });
      const safeFilename = req.file.originalname.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 120) || "evidence.bin";
      const scopedKey = scopedStorageKey(user.openId, `evidence/${inspectionId}/${safeFilename}`);
      const stored = await storagePut(scopedKey, req.file.buffer, req.file.mimetype);
      const item = {
        id: `EVD-${String(evidence.length + 1).padStart(4, "0")}`,
        inspectionId,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        originalHash: createHash2("sha256").update(req.file.buffer).digest("hex"),
        storageRef: stored.key,
        capturedAt: (/* @__PURE__ */ new Date()).toISOString(),
        gpsStatus: "LOCATION_UNAVAILABLE",
        verification: "PENDING"
      };
      evidence.unshift(item);
      inspection.evidenceCount += 1;
      appendAudit(auditLog, { type: "EVIDENCE_MULTIPART_UPLOADED", actor: user.email ?? user.openId, payload: { evidenceId: item.id, inspectionId, fileSize: req.file.size, fileType: item.mimeType }, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
      queuePersistence();
      await flushPersistence();
      return res.status(201).json({ evidence: item, metadata: { fileSize: req.file.size, createdBy: user.id, storageMode: "S3_COMPATIBLE_MANUS_STORAGE", downloadUrl: `/api/evidence/${item.id}/download` } });
    } catch (error) {
      return res.status(401).json({ error: error instanceof Error ? error.message : "Upload unauthorized" });
    }
  });
  app.get("/api/evidence/:evidenceId/download", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const role = actorRole(user);
      if (!["DEPARTMENT_ADMIN", "PMU_INSPECTOR", "AUDITOR", "INSTITUTE_ADMIN"].includes(role)) return res.status(403).json({ error: "Role not authorized for evidence download" });
      const item = evidence.find((entry) => entry.id === req.params.evidenceId);
      if (!item) return res.status(404).json({ error: "Evidence not found" });
      const inspection = inspections.find((entry) => entry.id === item.inspectionId);
      if (!inspection) return res.status(404).json({ error: "Evidence inspection not found" });
      if (role === "INSTITUTE_ADMIN" && !user.email?.toLowerCase().includes("ins-001")) return res.status(403).json({ error: "Evidence is outside the user's institute scope" });
      return res.redirect(307, await storageGetSignedUrl(item.storageRef));
    } catch (error) {
      return res.status(502).json({ error: error instanceof Error ? error.message : "Evidence download unavailable" });
    }
  });
  app.post("/api/evidence/:evidenceId/verify-storage", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!["DEPARTMENT_ADMIN", "AUDITOR"].includes(actorRole(user))) return res.status(403).json({ error: "Role not authorized for evidence verification" });
      const item = evidence.find((entry) => entry.id === req.params.evidenceId);
      if (!item) return res.status(404).json({ error: "Evidence not found" });
      const signedUrl = await storageGetSignedUrl(item.storageRef);
      const objectResponse = await fetch(signedUrl);
      if (!objectResponse.ok) return res.status(502).json({ error: `Stored object unavailable (${objectResponse.status})` });
      const bytes = Buffer.from(await objectResponse.arrayBuffer());
      const recomputedHash = createHash2("sha256").update(bytes).digest("hex");
      item.verification = recomputedHash === item.originalHash ? "MATCH" : "TAMPERED";
      if (item.verification === "TAMPERED") alerts.unshift({ id: `ALT-${1043 + alerts.length}`, type: "TAMPERED_EVIDENCE", severity: "CRITICAL", title: "Stored evidence integrity mismatch", detail: `${item.id} does not match its server hash after object retrieval.`, status: "OPEN", createdAt: (/* @__PURE__ */ new Date()).toISOString() });
      appendAudit(auditLog, { type: item.verification === "MATCH" ? "EVIDENCE_STORAGE_VERIFIED" : "EVIDENCE_STORAGE_TAMPER_DETECTED", actor: user.email ?? user.openId, payload: { evidenceId: item.id, recomputedHash, result: item.verification }, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
      queuePersistence();
      await flushPersistence();
      return res.json({ evidenceId: item.id, result: item.verification, recomputedHash, bytes: bytes.length });
    } catch (error) {
      return res.status(502).json({ error: error instanceof Error ? error.message : "Stored evidence verification unavailable" });
    }
  });
  app.get("/api/evidence/sample", (_req, res) => {
    const sampleBytes = Buffer.from(
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
      "base64"
    );
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Disposition", 'attachment; filename="dosje-sample-audit-evidence.jpg"');
    return res.status(200).send(sampleBytes);
  });
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use("/api/trpc", (req, res, next) => {
    if (req.path.includes("auth.login") || req.url.includes("auth.login")) {
      return authLoginLimiter(req, res, next);
    }
    next();
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV !== "production") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
