import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "DEPARTMENT_ADMIN", "PMU_INSPECTOR", "INSTITUTE_ADMIN", "STATE_AUTHORITY", "AUDITOR"]).default("PMU_INSPECTOR").notNull(),
  organizationId: varchar("organizationId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * MVP domain persistence envelope. Records are JSON-backed to preserve the
 * existing typed demo contracts while moving state out of process memory.
 * The entity key is stable and can be normalized into dedicated tables later.
 */
export const domainRecords = mysqlTable("domain_records", {
  recordKey: varchar("recordKey", { length: 160 }).primaryKey(),
  entity: varchar("entity", { length: 48 }).notNull(),
  recordId: varchar("recordId", { length: 96 }).notNull(),
  payload: json("payload").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DomainRecord = typeof domainRecords.$inferSelect;

export const assignmentClaims = mysqlTable("assignment_claims", {
  inspectionId: varchar("inspectionId", { length: 96 }).primaryKey(),
  claimId: varchar("claimId", { length: 96 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
