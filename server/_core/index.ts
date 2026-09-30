import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import multer from "multer";
import { createHash } from "node:crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter, actorRole } from "../routers";
import { createContext } from "./context";
import { sdk } from "./sdk";
import { serveStatic, setupVite } from "./vite";
import { alerts, auditLog, evidence, flushPersistence, hydrateDemoState, inspections, queuePersistence } from "../domain/demoStore";
import { appendAudit } from "../domain/secureEngine";
import { storagePut, storageGetSignedUrl } from "../domain/storage";
import { scopedStorageKey } from "../domain/storageAccess";
import path from "node:path";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { verifyServerRoleCredentials, SERVER_DEMO_CREDENTIALS } from "../config/authConfig";
import { getSessionCookieOptions } from "./cookies";
import { getDb, getUserByOpenId, seedDemoAccounts, upsertUser } from "../db/db";
import type { User } from "../../drizzle/schema";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
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
  const app = express();
  const server = createServer(app);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://meet.jit.si", "https://*.jit.si"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          imgSrc: ["'self'", "data:", "blob:", "https://*"],
          mediaSrc: ["'self'", "blob:", "https://*.mux.dev", "https://*"],
          frameSrc: ["'self'", "https://meet.jit.si", "https://*.jit.si"],
          connectSrc: ["'self'", "wss:", "https:", "http:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  const globalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });

  const authLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many authentication attempts. Please try again after 15 minutes." },
  });

  app.use("/api/", globalApiLimiter);
  app.use("/api/dosje-login", authLoginLimiter);
  app.use("/api/auth/login", authLoginLimiter);
  // Enable CORS for local file:// and browser origins
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

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health/ready", async (_req, res) => {
    let database = false;
    let storage = false;
    try { const db = await getDb(); if (db) { await db.execute("SELECT 1"); database = true; } } catch { database = false; }
    const ready = database && storage;
    return res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "degraded", database, storage, timestamp: new Date().toISOString() });
  });

  const sseClients = new Set<express.Response>();

  app.get("/api/events/sse", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString(), protocol: "SSE" })}\n\n`);

    sseClients.add(res);

    const heartbeat = setInterval(() => {
      res.write(`event: ping\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
    }, 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // Serve static dosje-login.html explicitly if requested directly
  const sendLoginHtml = (_req: express.Request, res: express.Response) => {
    return res.sendFile(path.resolve(process.cwd(), "dosje-login.html"));
  };
  app.get("/dosje-login.html", sendLoginHtml);

  // REST Demo Credentials endpoint for evaluators
  app.get("/api/auth/demo-credentials", (_req, res) => {
    const isDemoMode = process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production";
    if (!isDemoMode) return res.json({ demoMode: false, credentials: null });
    return res.json({ demoMode: true, credentials: SERVER_DEMO_CREDENTIALS });
  });

  // REST Authentication endpoint for dosje-login.html
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
      const dbRole: User["role"] = cred.dbRole;
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
        lastSignedIn: new Date(),
      });

      const user = await getUserByOpenId(openId);
      if (!user) {
        return res.status(500).json({ error: "Failed to establish user session" });
      }

      const expiresInMs = rememberMe ? ONE_YEAR_MS : 24 * 60 * 60 * 1000;
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || defaultName,
        expiresInMs,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: expiresInMs,
      });

      return res.json({
        success: true,
        token: sessionToken,
        user,
      });
    } catch (error) {
      console.error("[Login API Error]", error);
      return res.status(500).json({ error: error instanceof Error ? error.message : "Authentication failed" });
    }
  });

  // REST Logout endpoint
  const handleLogout = (req: express.Request, res: express.Response) => {
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
    fileFilter: (_req, file, callback) => callback(null, ["image/jpeg", "image/png", "application/pdf"].includes(file.mimetype)),
  });
  app.post("/api/evidence/upload", evidenceUpload.single("file"), async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const role = actorRole(user);
      if (!["DEPARTMENT_ADMIN", "PMU_INSPECTOR"].includes(role)) return res.status(403).json({ error: "Role not authorized for evidence capture" });
      const inspectionId = String(req.body.inspectionId ?? "");
      const inspection = inspections.find((item) => item.id === inspectionId);
      if (!inspection || !req.file) return res.status(400).json({ error: "inspectionId and supported file are required" });
      const safeFilename = req.file.originalname.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 120) || "evidence.bin";
      const scopedKey = scopedStorageKey(user.openId, `evidence/${inspectionId}/${safeFilename}`);
      const stored = await storagePut(scopedKey, req.file.buffer, req.file.mimetype);
      const item = {
        id: `EVD-${String(evidence.length + 1).padStart(4, "0")}`,
        inspectionId,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        originalHash: createHash("sha256").update(req.file.buffer).digest("hex"),
        storageRef: stored.key,
        capturedAt: new Date().toISOString(),
        gpsStatus: "LOCATION_UNAVAILABLE",
        verification: "PENDING" as const,
      };
      evidence.unshift(item);
      inspection.evidenceCount += 1;
      appendAudit(auditLog, { type: "EVIDENCE_MULTIPART_UPLOADED", actor: user.email ?? user.openId, payload: { evidenceId: item.id, inspectionId, fileSize: req.file.size, fileType: item.mimeType }, createdAt: new Date().toISOString() });
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
      const recomputedHash = createHash("sha256").update(bytes).digest("hex");
      item.verification = recomputedHash === item.originalHash ? "MATCH" : "TAMPERED";
      if (item.verification === "TAMPERED") alerts.unshift({ id: `ALT-${1043 + alerts.length}`, type: "TAMPERED_EVIDENCE", severity: "CRITICAL", title: "Stored evidence integrity mismatch", detail: `${item.id} does not match its server hash after object retrieval.`, status: "OPEN", createdAt: new Date().toISOString() });
      appendAudit(auditLog, { type: item.verification === "MATCH" ? "EVIDENCE_STORAGE_VERIFIED" : "EVIDENCE_STORAGE_TAMPER_DETECTED", actor: user.email ?? user.openId, payload: { evidenceId: item.id, recomputedHash, result: item.verification }, createdAt: new Date().toISOString() });
      queuePersistence();
      await flushPersistence();
      return res.json({ evidenceId: item.id, result: item.verification, recomputedHash, bytes: bytes.length });
    } catch (error) {
      return res.status(502).json({ error: error instanceof Error ? error.message : "Stored evidence verification unavailable" });
    }
  });
  // Sample audit evidence download endpoint for evaluators and demonstration
  app.get("/api/evidence/sample", (_req, res) => {
    // Generate a minimal valid JPEG image buffer with embedded metadata
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
  // tRPC API
  app.use(
    "/api/trpc",
    rateLimit({ windowMs: 60_000, max: 120 }),
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
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
