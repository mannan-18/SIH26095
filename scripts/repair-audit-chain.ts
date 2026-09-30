import { appendAudit, type AuditEvent, verifyAuditChain } from "../server/domain/secureEngine";
import { getAllDomainRecords, upsertDomainRecords } from "../server/db/db";

export function checkRepairAllowed(env: Record<string, string | undefined> = process.env): boolean {
  const isDemoMode = env.DEMO_MODE === "true";
  const isDev = env.NODE_ENV !== "production";
  return isDemoMode || isDev;
}

export async function executeAuditRepair(env: Record<string, string | undefined> = process.env) {
  if (!checkRepairAllowed(env)) {
    throw new Error("REFUSED: Audit chain repair rewrites historical hashes and is strictly allowed only when DEMO_MODE=true");
  }

  const rows = await getAllDomainRecords();
  const events = rows
    .filter((row) => row.entity === "auditEvents")
    .map((row) => row.payload as AuditEvent)
    .sort((a, b) => Number(a.id.replace("AUD-", "")) - Number(b.id.replace("AUD-", "")));

  const rebuilt: AuditEvent[] = [];
  for (const event of events) {
    appendAudit(rebuilt, { type: event.type, actor: event.actor, payload: event.payload, createdAt: event.createdAt });
  }

  if (!verifyAuditChain(rebuilt).valid) {
    throw new Error("Rebuilt audit chain is invalid");
  }

  await upsertDomainRecords(
    rebuilt.map((payload) => ({
      recordKey: `auditEvents:${payload.id}`,
      entity: "auditEvents",
      recordId: payload.id,
      payload,
    }))
  );

  return { repaired: rebuilt.length, verification: verifyAuditChain(rebuilt) };
}

// Auto-run when executed directly via CLI
if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, "/") || "")) {
  executeAuditRepair()
    .then((result) => {
      console.log(JSON.stringify(result));
      process.exit(0);
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
