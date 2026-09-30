import { appendAudit, type AuditEvent, verifyAuditChain } from "../server/secureEngine";
import { getAllDomainRecords, upsertDomainRecords } from "../server/db";

const rows = await getAllDomainRecords();
const events = rows.filter((row) => row.entity === "auditEvents").map((row) => row.payload as AuditEvent).sort((a, b) => Number(a.id.replace("AUD-", "")) - Number(b.id.replace("AUD-", "")));
const rebuilt: AuditEvent[] = [];
for (const event of events) appendAudit(rebuilt, { type: event.type, actor: event.actor, payload: event.payload, createdAt: event.createdAt });
if (!verifyAuditChain(rebuilt).valid) throw new Error("Rebuilt audit chain is invalid");
await upsertDomainRecords(rebuilt.map((payload) => ({ recordKey: `auditEvents:${payload.id}`, entity: "auditEvents", recordId: payload.id, payload })));
console.log(JSON.stringify({ repaired: rebuilt.length, verification: verifyAuditChain(rebuilt) }));
process.exit(0);
