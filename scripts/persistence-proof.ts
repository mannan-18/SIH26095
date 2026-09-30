import { auditLog, assignments, generateAssignment, getAudit, hydrateDemoState, inspections, queuePersistence, flushPersistence, startSurpriseInspection } from "../server/demoStore";

const mode = process.argv[2] ?? "write";
if (mode === "write") {
  await hydrateDemoState();
  const inspection = inspections.find((item) => !assignments.some((candidate) => candidate.inspectionId === item.id)) ?? startSurpriseInspection("INS-001");
  const assignment = assignments.find((item) => item.inspectionId === inspection.id) ?? generateAssignment(inspection.id);
  queuePersistence();
  await flushPersistence();
  console.log(JSON.stringify({ inspectionId: inspection.id, assignmentId: assignment.id, auditCount: auditLog.length }));
  process.exit(0);
}

const inspectionId = process.argv[3];
const assignmentId = process.argv[4];
const source = await hydrateDemoState();
const inspection = inspections.find((item) => item.id === inspectionId);
const assignment = assignments.find((item) => item.id === assignmentId);
const audit = getAudit().verification;
if (source.source !== "database" || !inspection || !assignment || !audit.valid) {
  console.error(JSON.stringify({ ok: false, source: source.source, inspectionFound: Boolean(inspection), assignmentFound: Boolean(assignment), audit }));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, source: source.source, inspectionId, assignmentId, auditChain: audit, persistedInspection: inspection.id, persistedAssignment: assignment.id }));
process.exit(0);
