import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { DomainRecord, InsertUser, User, assignmentClaims, domainRecords, users } from "../../drizzle/schema";
import { ENV } from '../_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
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

const inMemoryUsers = new Map<string, User>();
const inMemoryClaims = new Set<string>();
let inMemoryUserIdCounter = 1;

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    const existing = inMemoryUsers.get(user.openId);
    const now = new Date();
    const resolvedRole = user.role ?? (user.openId === ENV.ownerOpenId ? "DEPARTMENT_ADMIN" : (existing?.role ?? "PMU_INSPECTOR"));
    const updatedUser: User = {
      id: existing ? existing.id : inMemoryUserIdCounter++,
      openId: user.openId,
      name: user.name !== undefined ? user.name : (existing?.name ?? null),
      email: user.email !== undefined ? user.email : (existing?.email ?? null),
      loginMethod: user.loginMethod !== undefined ? user.loginMethod : (existing?.loginMethod ?? null),
      role: resolvedRole as User["role"],
      organizationId: user.organizationId !== undefined ? user.organizationId : (existing?.organizationId ?? null),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastSignedIn: user.lastSignedIn ?? now,
    };
    inMemoryUsers.set(user.openId, updatedUser);
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'DEPARTMENT_ADMIN';
      updateSet.role = 'DEPARTMENT_ADMIN';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    return inMemoryUsers.get(openId);
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function listUsers() {
  const db = await getDb();
  if (!db) {
    return Array.from(inMemoryUsers.values()).map(u => ({
      id: u.id,
      openId: u.openId,
      name: u.name,
      email: u.email,
      role: u.role,
      organizationId: u.organizationId,
      createdAt: u.createdAt,
      lastSignedIn: u.lastSignedIn,
    }));
  }
  return db.select({ id: users.id, openId: users.openId, name: users.name, email: users.email, role: users.role, organizationId: users.organizationId, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users);
}

export async function updateUserAccess(userId: number, role: "DEPARTMENT_ADMIN" | "PMU_INSPECTOR" | "INSTITUTE_ADMIN" | "STATE_AUTHORITY" | "AUDITOR", organizationId: string | null) {
  const db = await getDb();
  if (!db) {
    const user = Array.from(inMemoryUsers.values()).find(u => u.id === userId);
    if (!user) throw new Error("User not found");
    user.role = role;
    user.organizationId = organizationId;
    user.updatedAt = new Date();
    return user;
  }
  await db.update(users).set({ role, organizationId }).where(eq(users.id, userId));
  const rows = await db.select({ id: users.id, openId: users.openId, name: users.name, email: users.email, role: users.role, organizationId: users.organizationId, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).where(eq(users.id, userId)).limit(1);
  return rows[0];
}

export async function createInvitedUser(input: { openId: string; name: string; email: string; role: "DEPARTMENT_ADMIN" | "PMU_INSPECTOR" | "INSTITUTE_ADMIN" | "STATE_AUTHORITY" | "AUDITOR"; organizationId: string | null }) {
  const db = await getDb();
  if (!db) {
    await upsertUser({ ...input, loginMethod: "invited" });
    return getUserByOpenId(input.openId);
  }
  await db.insert(users).values({ ...input, loginMethod: "invited" }).onDuplicateKeyUpdate({ set: { name: input.name, email: input.email, role: input.role, organizationId: input.organizationId } });
  return getUserByOpenId(input.openId);
}

export async function seedDemoAccounts() {
  const accounts: InsertUser[] = [
    { openId: "demo-department-admin", name: "Demo Department Admin", email: "department-admin@securesight.demo", loginMethod: "demo-seed", role: "DEPARTMENT_ADMIN", organizationId: null },
    { openId: "demo-pmu-inspector", name: "Demo PMU Inspector", email: "pmu-inspector@securesight.demo", loginMethod: "demo-seed", role: "PMU_INSPECTOR", organizationId: null },
    { openId: "demo-institute-admin", name: "Demo Institute Admin", email: "institute-admin@securesight.demo", loginMethod: "demo-seed", role: "INSTITUTE_ADMIN", organizationId: "INS-001" },
    { openId: "demo-auditor", name: "Demo Auditor", email: "auditor@securesight.demo", loginMethod: "demo-seed", role: "AUDITOR", organizationId: null },
    { openId: "demo-beneficiary", name: "Demo Beneficiary", email: "beneficiary@securesight.demo", loginMethod: "demo-seed", role: "user", organizationId: null },
  ];
  for (const account of accounts) await upsertUser(account);
}

export async function claimAssignment(inspectionId: string, claimId: string) {
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
    const wrapped = error as { code?: string; cause?: { code?: string } };
    if (wrapped.code === "ER_DUP_ENTRY" || wrapped.cause?.code === "ER_DUP_ENTRY") return false;
    throw error;
  }
}

export async function getAllDomainRecords() {
  const db = await getDb();
  if (!db) return [] as DomainRecord[];
  return db.select().from(domainRecords);
}

export async function upsertDomainRecord(input: { recordKey: string; entity: string; recordId: string; payload: unknown }) {
  const db = await getDb();
  if (!db) throw new Error("Database is required for domain persistence");
  await db.insert(domainRecords).values(input).onDuplicateKeyUpdate({
    set: { entity: input.entity, recordId: input.recordId, payload: input.payload },
  });
}

export async function upsertDomainRecords(records: Array<{ recordKey: string; entity: string; recordId: string; payload: unknown }>) {
  const db = await getDb();
  if (!db || records.length === 0) return;
  await db.transaction(async (tx) => {
    await tx.insert(domainRecords).values(records).onDuplicateKeyUpdate({
      set: { entity: sql`VALUES(${domainRecords.entity})`, recordId: sql`VALUES(${domainRecords.recordId})`, payload: sql`VALUES(${domainRecords.payload})` },
    });
  });
}

export async function replaceDomainRecords(records: Array<{ recordKey: string; entity: string; recordId: string; payload: unknown }>) {
  const db = await getDb();
  if (!db || records.length === 0) return;
  await db.transaction(async (tx) => {
    const entities = Array.from(new Set(records.map((record) => record.entity)));
    for (const entity of entities) await tx.delete(domainRecords).where(eq(domainRecords.entity, entity));
    await tx.insert(domainRecords).values(records);
  });
}
