import { appendAudit, analyzeAttendance, geofenceStatus, evaluateServerGeofence, scoreRisk, securePick, sealAssignment, sha256, verifyAuditChain, verifyEvidence, revealAssignment, createEvidenceNonce, getNonceRecord } from "./secureEngine";
import { getAllDomainRecords, replaceDomainRecords, upsertDomainRecords } from "../db/db";

export type Institute = {
  id: string;
  name: string;
  district: string;
  state: string;
  scheme: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  cctvOnline: boolean;
  cctvLastSeen: string;
  latitude: number;
  longitude: number;
  beneficiaryCount: number;
  lastInspection: string;
};

export type Inspector = { id: string; name: string; region: string; workload: number; active: boolean; conflicts: string[] };
export type Inspection = {
  id: string;
  instituteId: string;
  instituteName: string;
  status: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  inspectorName: string;
  scheduledAt: string;
  evidenceCount: number;
  geofence: string;
  riskScore: number;
  observation?: string;
  lastObservedAt?: string;
};
export type Alert = { id: string; type: string; severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; title: string; detail: string; status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED"; createdAt: string };
export type Assignment = { id: string; inspectionId: string; instituteId: string; inspectorId: string; inspectorName: string; status: "CREATED" | "SEALED" | "REVEALED" | "COMPLETED"; sealedAt?: string; revealedAt?: string };
export type Evidence = { id: string; inspectionId: string; filename: string; mimeType: string; originalHash: string; storageRef: string; capturedAt: string; gpsStatus: string; verification: "PENDING" | "MATCH" | "TAMPERED" };

const now = new Date();
const isoHoursAgo = (hours: number) => new Date(now.getTime() - hours * 3600000).toISOString();

export const institutes: Institute[] = [
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
  ["INS-012", "Vikas Integrated Centre", "Ahmedabad", "Gujarat", "NAPDDR", "HIGH", true, 23.0225, 72.5714, 174],
].map(([id, name, district, state, scheme, riskLevel, cctvOnline, latitude, longitude, beneficiaryCount], index) => ({ id: id as string, name: name as string, district: district as string, state: state as string, scheme: scheme as string, riskLevel: riskLevel as Institute["riskLevel"], cctvOnline: cctvOnline as boolean, cctvLastSeen: cctvOnline ? isoHoursAgo(index % 3) : isoHoursAgo(30 + index), latitude: latitude as number, longitude: longitude as number, beneficiaryCount: beneficiaryCount as number, lastInspection: isoHoursAgo(8 + index * 3) }));

export const inspectors: Inspector[] = Array.from({ length: 24 }, (_, index) => ({
  id: `INSP-${String(index + 1).padStart(3, "0")}`,
  name: ["Aarav Mehta", "Ishita Rao", "Kabir Singh", "Meera Nair", "Rohan Das", "Ananya Iyer"][index % 6] + ` ${index + 1}`,
  region: ["West", "North", "South", "East"][index % 4],
  workload: index % 5,
  active: index !== 7,
  conflicts: index % 6 === 0 ? ["INS-001"] : [],
}));

export const inspections: Inspection[] = Array.from({ length: 34 }, (_, index) => {
  const institute = institutes[index % institutes.length];
  const statuses = ["VERIFIED", "CLOSED", "SUBMITTED", "IN_PROGRESS", "FLAGGED", "ASSIGNED"];
  const status = statuses[index % statuses.length];
  const score = institute.riskLevel === "HIGH" ? 58 + (index % 34) : 18 + (index % 36);
  return { id: `INSP-${String(index + 1).padStart(4, "0")}`, instituteId: institute.id, instituteName: institute.name, status, riskLevel: score >= 70 ? "CRITICAL" : score >= 45 ? "HIGH" : score >= 20 ? "MEDIUM" : "LOW", inspectorName: inspectors[index % inspectors.length].name, scheduledAt: isoHoursAgo(index * 6), evidenceCount: 1 + (index % 4), geofence: index % 7 === 0 ? "OUTSIDE_GEOFENCE" : "INSIDE_GEOFENCE", riskScore: score };
});

export const evidence: Evidence[] = Array.from({ length: 52 }, (_, index) => {
  const content = `demo-evidence-${index}-secure-sight`;
  return { id: `EVD-${String(index + 1).padStart(4, "0")}`, inspectionId: inspections[index % inspections.length].id, filename: ["frontage.jpg", "register.jpg", "classroom.jpg", "beneficiary-consent.pdf"][index % 4], mimeType: index % 4 === 3 ? "application/pdf" : "image/jpeg", originalHash: sha256(content), storageRef: `demo://evidence/${index + 1}`, capturedAt: isoHoursAgo(index * 2), gpsStatus: index % 8 === 0 ? "OUTSIDE_GEOFENCE" : "INSIDE_GEOFENCE", verification: index % 11 === 0 ? "TAMPERED" : "MATCH" };
});

export const alerts: Alert[] = [
  { id: "ALT-1042", type: "TAMPERED_EVIDENCE", severity: "CRITICAL", title: "Evidence integrity mismatch", detail: "EVD-0018 failed server-side SHA-256 recomputation.", status: "OPEN", createdAt: isoHoursAgo(2) },
  { id: "ALT-1041", type: "CCTV_OFFLINE", severity: "HIGH", title: "CCTV offline for 30+ hours", detail: "Prerna Women Support Hub camera source has not reported a heartbeat.", status: "OPEN", createdAt: isoHoursAgo(5) },
  { id: "ALT-1040", type: "OUTSIDE_GEOFENCE", severity: "HIGH", title: "Inspection outside configured radius", detail: "GPS capture was 312m from the registered institute coordinate.", status: "ACKNOWLEDGED", createdAt: isoHoursAgo(9) },
  { id: "ALT-1039", type: "ATTENDANCE_ANOMALY", severity: "MEDIUM", title: "Attendance variance detected", detail: "Observed attendance deviated from register baseline for 4 days.", status: "RESOLVED", createdAt: isoHoursAgo(18) },
];

export const assignments: Assignment[] = [];
export const auditLog = [] as import("./secureEngine").AuditEvent[];
export const attendance = institutes.flatMap((institute, index) => Array.from({ length: 5 }, (_, day) => ({ instituteId: institute.id, date: isoHoursAgo(day * 24 + index), expected: 80 + (index % 40), observed: 74 + ((index * 7 + day * 3) % 45), source: "OBSERVED_REGISTER" as const })));

for (const item of ["SYSTEM_SEEDED", "RISK_ENGINE_READY", "CCTV_HEARTBEAT_SYNC", "ATTENDANCE_INGESTED", "ALERT_CREATED"]) {
  appendAudit(auditLog, { type: item, actor: "system@securesight.demo", payload: { source: "seed", version: "mvp-0.1" }, createdAt: isoHoursAgo(auditLog.length * 2) });
}

const persistenceEntities = ["institutes", "inspectors", "inspections", "evidence", "alerts", "assignments", "attendance", "auditEvents"] as const;
let persistenceTail = Promise.resolve();

function snapshotRecords() {
  return [
    ...institutes.map((payload) => ({ entity: "institutes", recordId: payload.id, payload })),
    ...inspectors.map((payload) => ({ entity: "inspectors", recordId: payload.id, payload })),
    ...inspections.map((payload) => ({ entity: "inspections", recordId: payload.id, payload })),
    ...evidence.map((payload) => ({ entity: "evidence", recordId: payload.id, payload })),
    ...alerts.map((payload) => ({ entity: "alerts", recordId: payload.id, payload })),
    ...assignments.map((payload) => ({ entity: "assignments", recordId: payload.id, payload })),
    ...attendance.map((payload, index) => ({ entity: "attendance", recordId: `${payload.instituteId}-${index}`, payload })),
    ...auditLog.map((payload) => ({ entity: "auditEvents", recordId: payload.id, payload })),
  ].map((record) => ({ ...record, recordKey: `${record.entity}:${record.recordId}` }));
}

export async function hydrateDemoState() {
  const stored = await getAllDomainRecords();
  if (stored.length === 0) {
    await upsertDomainRecords(snapshotRecords());
    return { source: "seeded", count: snapshotRecords().length } as const;
  }
  const byEntity = new Map<string, unknown[]>(persistenceEntities.map((entity) => [entity, []]));
  for (const row of stored) byEntity.get(row.entity)?.push(row.payload);
  const auditRows = byEntity.get("auditEvents") ?? [];
  auditRows.sort((left, right) => Number(String((left as { id?: string }).id ?? "").replace("AUD-", "")) - Number(String((right as { id?: string }).id ?? "").replace("AUD-", "")));
  const replace = <T>(target: T[], entity: string) => { const values = byEntity.get(entity) ?? []; if (values.length) { target.splice(0, target.length, ...(values as T[])); } };
  replace(institutes, "institutes"); replace(inspectors, "inspectors"); replace(inspections, "inspections"); replace(evidence, "evidence"); replace(alerts, "alerts"); replace(assignments, "assignments"); replace(attendance, "attendance"); replace(auditLog, "auditEvents");
  return { source: "database", count: stored.length } as const;
}

export function queuePersistence() {
  persistenceTail = persistenceTail.then(() => replaceDomainRecords(snapshotRecords()));
  return persistenceTail;
}

export function flushPersistence() { return persistenceTail; }

export function computeSystemIntegrityIndex(): { score: number; chainValid: boolean; cctvUptimePercent: number; evidenceMatchPercent: number; openAlertsCount: number; criticalAlertsCount: number } {
  const chainCheck = verifyAuditChain(auditLog);
  const cctvOnlineCount = institutes.filter((item) => item.cctvOnline).length;
  const cctvUptimePercent = Math.round((cctvOnlineCount / Math.max(institutes.length, 1)) * 100);
  
  const totalEvidence = evidence.length;
  const matchedEvidence = evidence.filter((e) => e.verification === "MATCH").length;
  const evidenceMatchPercent = totalEvidence > 0 ? Math.round((matchedEvidence / totalEvidence) * 100) : 100;

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
    criticalAlertsCount,
  };
}

export function computeAverageAttendance(): number {
  if (!attendance.length) return 92.4;
  const totalObserved = attendance.reduce((sum, item) => sum + item.observed, 0);
  const totalExpected = attendance.reduce((sum, item) => sum + Math.max(1, item.expected), 0);
  return Math.round((totalObserved / totalExpected) * 1000) / 10;
}

export function getOverview() {
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
    cctvHealth: Math.round((onlineCctv / institutes.length) * 100),
    systemIntegrityScore: integrity.score,
    chainValid: integrity.chainValid,
    avgAttendance: computeAverageAttendance(),
  };
}

export function startSurpriseInspection(instituteId: string) {
  const institute = institutes.find((item) => item.id === instituteId);
  if (!institute) throw new Error("Institute not found");
  const inspection: Inspection = { id: `INSP-${String(inspections.length + 1).padStart(4, "0")}`, instituteId: institute.id, instituteName: institute.name, status: "ASSIGNMENT_PENDING", riskLevel: institute.riskLevel, inspectorName: "Unassigned", scheduledAt: new Date().toISOString(), evidenceCount: 0, geofence: "LOCATION_UNAVAILABLE", riskScore: institute.riskLevel === "HIGH" ? 58 : 24 };
  inspections.unshift(inspection);
  appendAudit(auditLog, { type: "INSPECTION_CREATED", actor: "demo.department-admin", payload: { inspectionId: inspection.id, instituteId }, createdAt: new Date().toISOString() });
  return inspection;
}

export function generateAssignment(inspectionId: string) {
  const inspection = inspections.find((item) => item.id === inspectionId);
  if (!inspection) throw new Error("Inspection not found");
  if (assignments.some((item) => item.inspectionId === inspectionId)) throw new Error("Assignment already exists");
  const candidate = securePick(inspectors.filter((item) => item.active && item.workload < 4 && !item.conflicts.includes(inspection.instituteId)));
  const assignment: Assignment = { id: `ASN-${String(assignments.length + 1).padStart(4, "0")}`, inspectionId, instituteId: inspection.instituteId, inspectorId: candidate.id, inspectorName: candidate.name, status: "CREATED" };
  assignments.unshift(assignment);
  inspection.status = "ASSIGNMENT_PENDING";
  appendAudit(auditLog, { type: "ASSIGNMENT_GENERATED", actor: "demo.department-admin", payload: { assignmentId: assignment.id, inspectorId: candidate.id, sealed: false }, createdAt: new Date().toISOString() });
  return assignment;
}

export function seal(assignmentId: string) {
  const assignment = assignments.find((item) => item.id === assignmentId);
  if (!assignment) throw new Error("Assignment not found");
  const sealed = sealAssignment(assignment);
  Object.assign(assignment, sealed);
  appendAudit(auditLog, { type: "ASSIGNMENT_SEALED", actor: "demo.department-admin", payload: { assignmentId }, createdAt: new Date().toISOString() });
  return assignment;
}

export function reveal(assignmentId: string) {
  const assignment = assignments.find((item) => item.id === assignmentId);
  if (!assignment) throw new Error("Assignment not found");
  const revealed = revealAssignment(assignment);
  Object.assign(assignment, revealed);
  const inspection = inspections.find((item) => item.id === assignment.inspectionId);
  if (inspection) { inspection.status = "ASSIGNED"; inspection.inspectorName = assignment.inspectorName; }
  appendAudit(auditLog, { type: "ASSIGNMENT_REVEALED", actor: "demo.department-admin", payload: { assignmentId, inspectorId: assignment.inspectorId }, createdAt: new Date().toISOString() });
  return assignment;
}

export function captureGps(
  inspectionId: string, 
  latitude: number | null, 
  longitude: number | null,
  accuracy?: number | null,
  deviceTimestamp?: number | null
) {
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
      createdAt: new Date().toISOString()
    });
    inspection.geofence = "OUTSIDE_GEOFENCE";
    appendAudit(auditLog, {
      type: "GPS_SPOOF_DETECTED",
      actor: "demo.mobile-inspector",
      payload: { inspectionId, spoofReason: geofenceEval.spoofReason, latitude, longitude, accuracy },
      createdAt: new Date().toISOString()
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
      createdAt: new Date().toISOString()
    });
  }
  appendAudit(auditLog, {
    type: "GPS_CAPTURED",
    actor: "demo.mobile-inspector",
    payload: { inspectionId, status, distanceMeters: geofenceEval.distanceMeters },
    createdAt: new Date().toISOString()
  });
  return {
    status,
    radiusMeters: 100,
    distanceMeters: geofenceEval.distanceMeters,
    note: status === "LOCATION_UNAVAILABLE" ? "Location unavailable is not automatically fraud." : "GPS provides a location-based verification signal."
  };
}

export function requestEvidenceNonce(inspectionId: string) {
  return createEvidenceNonce(inspectionId);
}

export function submitLiveCapture(
  inspectionId: string,
  nonce: string,
  imageBase64: string,
  gps: { latitude: number | null; longitude: number | null; accuracy: number | null; deviceTimestamp: number | null }
) {
  const inspection = inspections.find((item) => item.id === inspectionId);
  if (!inspection) throw new Error("Inspection record not found");
  const institute = institutes.find((item) => item.id === inspection.instituteId);
  const instCoords = institute ? { latitude: institute.latitude, longitude: institute.longitude } : { latitude: 28.6139, longitude: 77.209 };

  const serverTime = Date.now();
  const nonceRecord = getNonceRecord(nonce);

  if (!nonceRecord) {
    appendAudit(auditLog, {
      type: "NONCE_INVALID_REJECTED",
      actor: "demo.mobile-inspector",
      payload: { inspectionId, nonce },
      createdAt: new Date(serverTime).toISOString(),
    });
    alerts.unshift({
      id: `ALT-${1050 + alerts.length}`,
      type: "ANOMALY_NONCE_REPLAY",
      severity: "CRITICAL",
      title: "Evidence Ingest Rejected",
      detail: `Inspection ${inspectionId}: Invalid or missing camera nonce (${nonce}).`,
      status: "OPEN",
      createdAt: new Date(serverTime).toISOString(),
    });
    throw new Error("Capture rejected: Invalid or unknown camera nonce.");
  }

  if (nonceRecord.used) {
    appendAudit(auditLog, {
      type: "NONCE_REPLAY_ATTEMPT",
      actor: "demo.mobile-inspector",
      payload: { inspectionId, nonce },
      createdAt: new Date(serverTime).toISOString(),
    });
    alerts.unshift({
      id: `ALT-${1050 + alerts.length}`,
      type: "ANOMALY_NONCE_REPLAY",
      severity: "CRITICAL",
      title: "Replay Attack Blocked",
      detail: `Attempted reuse of single-use nonce ${nonce} for inspection ${inspectionId}.`,
      status: "OPEN",
      createdAt: new Date(serverTime).toISOString(),
    });
    throw new Error("Capture rejected: Replayed nonce detected! Camera session nonces are strictly single-use.");
  }

  if (nonceRecord.expiresAt < serverTime) {
    nonceRecord.used = true;
    appendAudit(auditLog, {
      type: "NONCE_EXPIRED_REJECTED",
      actor: "demo.mobile-inspector",
      payload: { inspectionId, nonce },
      createdAt: new Date(serverTime).toISOString(),
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
      createdAt: new Date(serverTime).toISOString(),
    });
    alerts.unshift({
      id: `ALT-${1050 + alerts.length}`,
      type: "GPS_SPOOF_ATTEMPT",
      severity: "CRITICAL",
      title: "Geofence Violation / Spoof Rejected",
      detail: `Inspection ${inspectionId}: ${reason}`,
      status: "OPEN",
      createdAt: new Date(serverTime).toISOString(),
    });
    throw new Error(`Live capture rejected: ${reason}`);
  }

  const bundle = `${imageBase64}:${nonce}:${serverTime}:${gps.latitude}:${gps.longitude}`;
  const imageHash = sha256(bundle);

  const item: Evidence = {
    id: `EVD-${String(evidence.length + 1).padStart(4, "0")}`,
    inspectionId,
    filename: `live-capture-${Date.now()}.jpg`,
    mimeType: "image/jpeg",
    originalHash: imageHash,
    storageRef: `live-camera://${inspectionId}/${nonce}`,
    capturedAt: new Date(serverTime).toISOString(),
    gpsStatus: "INSIDE_GEOFENCE",
    verification: "MATCH",
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
      distanceMeters: geofenceResult.distanceMeters,
    },
    createdAt: new Date(serverTime).toISOString(),
  });

  return { success: true, evidence: item, imageHash };
}

export function submitInspection(inspectionId: string, observation: string, evidenceHash?: string) {
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
  inspection.lastObservedAt = new Date().toISOString();

  appendAudit(auditLog, {
    type: "INSPECTION_SUBMITTED",
    actor: "demo.mobile-inspector",
    payload: {
      inspectionId,
      observation: observation.slice(0, 140),
      evidenceHash: finalEvidenceHash,
    },
    createdAt: new Date().toISOString(),
  });
  return inspection;
}

export function verifyEvidenceDemo(evidenceId: string, tamper = false) {
  const item = evidence.find((entry) => entry.id === evidenceId);
  if (!item) throw new Error("Evidence not found");
  const content = tamper ? `tampered-${item.filename}-${Date.now()}` : item.id.replace("EVD-", "demo-evidence-") + "-secure-sight";
  const result = verifyEvidence(item.originalHash, content);
  item.verification = result.result;
  if (result.result === "TAMPERED") {
    alerts.unshift({ id: `ALT-${1043 + alerts.length}`, type: "TAMPERED_EVIDENCE", severity: "CRITICAL", title: "Tampered evidence detected", detail: `${item.id} recomputed hash does not match the original server hash.`, status: "OPEN", createdAt: new Date().toISOString() });
    appendAudit(auditLog, { type: "EVIDENCE_TAMPER_DETECTED", actor: "demo.verification-service", payload: { evidenceId: item.id, originalHash: item.originalHash, recomputedHash: result.recomputedHash }, createdAt: new Date().toISOString() });
  } else {
    appendAudit(auditLog, { type: "EVIDENCE_VERIFIED", actor: "demo.verification-service", payload: { evidenceId: item.id, result: result.result }, createdAt: new Date().toISOString() });
  }
  return { ...item, ...result };
}

export function runRiskAnalysis(inspectionId: string) {
  const inspection = inspections.find((item) => item.id === inspectionId);
  if (!inspection) throw new Error("Inspection not found");
  const item = evidence.find((entry) => entry.inspectionId === inspectionId);
  const institute = institutes.find((entry) => entry.id === inspection.instituteId);
  const attendanceResult = analyzeAttendance(attendance.filter((entry) => entry.instituteId === inspection.instituteId));
  const risk = scoreRisk({ geofence: inspection.geofence, evidence: item?.verification ?? "PENDING", timestamp: "TIMESTAMP_VALID", cctvOnline: institute?.cctvOnline ?? false, attendanceAnomaly: attendanceResult.anomalyScore });
  inspection.riskScore = risk.riskScore;
  inspection.riskLevel = risk.riskLevel as Inspection["riskLevel"];
  appendAudit(auditLog, { type: "AI_RISK_ANALYSIS", actor: "demo.mock-ai-provider", payload: { inspectionId, ...risk, modelVersion: "mock-ai-1.0" }, createdAt: new Date().toISOString() });
  return { ...risk, explanation: "AI identifies risk indicators and anomalies; it is advisory and does not modify assignments, evidence hashes, audit logs, or verification results.", modelVersion: "mock-ai-1.0", analysisTimestamp: new Date().toISOString(), attendanceAnomaly: attendanceResult };
}

export function seedNewEvidence(inspectionId: string) {
  const content = `new-evidence-${Date.now()}`;
  const item: Evidence = { id: `EVD-${String(evidence.length + 1).padStart(4, "0")}`, inspectionId, filename: "mobile-capture.jpg", mimeType: "image/jpeg", originalHash: sha256(content), storageRef: `demo://evidence/${evidence.length + 1}`, capturedAt: new Date().toISOString(), gpsStatus: "INSIDE_GEOFENCE", verification: "PENDING" };
  evidence.unshift(item);
  appendAudit(auditLog, { type: "EVIDENCE_CAPTURED", actor: "demo.mobile-inspector", payload: { evidenceId: item.id, sha256: item.originalHash }, createdAt: new Date().toISOString() });
  return item;
}

export function getAttendanceSummary() {
  const byInstitute = institutes.slice(0, 8).map((institute) => {
    const result = analyzeAttendance(attendance.filter((entry) => entry.instituteId === institute.id));
    return { institute: institute.name, ...result, observedDays: attendance.filter((entry) => entry.instituteId === institute.id).length };
  });
  return { rows: byInstitute, sourceNote: "Observed register and attendance records are kept separate from inferred anomaly scores." };
}

export function getAudit() { return { events: auditLog.slice(0, 40), verification: verifyAuditChain(auditLog) }; }

export const checklistTemplates: Record<string, Array<{ id: string; label: string; required: boolean }>> = {
  NAPDDR: [
    { id: "NAP-01", label: "Beneficiary register matches observed attendance", required: true },
    { id: "NAP-02", label: "Counselling and rehabilitation records available", required: true },
    { id: "NAP-03", label: "Safety, hygiene, and accessibility controls observed", required: true },
  ],
  SMILE: [
    { id: "SMI-01", label: "Skill-training schedule and trainer presence verified", required: true },
    { id: "SMI-02", label: "Beneficiary consent and grievance register reviewed", required: true },
    { id: "SMI-03", label: "Outcome documentation sampled", required: false },
  ],
  AVYAY: [
    { id: "AVY-01", label: "Shelter occupancy and basic services verified", required: true },
    { id: "AVY-02", label: "Medical and care escalation records reviewed", required: true },
    { id: "AVY-03", label: "Visitor and incident register sampled", required: false },
  ],
};

export function getChecklistForInspection(inspectionId: string) {
  const inspection = inspections.find((item) => item.id === inspectionId);
  const institute = institutes.find((item) => item.id === inspection?.instituteId);
  const scheme = institute?.scheme ?? "NAPDDR";
  return { scheme, items: checklistTemplates[scheme] ?? checklistTemplates.NAPDDR };
}

export function reportCctvFeedStatus(
  instituteId: string,
  status: "ONLINE" | "OFFLINE" | "FROZEN",
  reason = "Watchdog detection"
) {
  const institute = institutes.find((i) => i.id === instituteId);
  if (!institute) throw new Error("Institute not found");

  const serverTime = new Date().toISOString();
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
      createdAt: serverTime,
    });

    appendAudit(auditLog, {
      type: `CCTV_FEED_${status}`,
      actor: "system.cctv-watchdog",
      payload: { instituteId, instituteName: institute.name, status, reason },
      createdAt: serverTime,
    });
  }

  return { success: true, instituteId, status, lastSeen: serverTime };
}

export function updateAlertStatus(alertId: string, status: Alert["status"]) {
  const item = alerts.find((entry) => entry.id === alertId);
  if (!item) throw new Error("Alert not found");
  item.status = status;
  appendAudit(auditLog, { type: `ALERT_${status}`, actor: "demo.department-admin", payload: { alertId, status }, createdAt: new Date().toISOString() });
  return item;
}

export function getRegionalOverview(stateScope?: string | null) {
  const filteredInstitutes = stateScope
    ? institutes.filter((i) => i.state.toLowerCase() === stateScope.toLowerCase())
    : institutes;

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
  const cctvPercentage = filteredInstitutes.length > 0 ? Math.round((onlineCctvCount / filteredInstitutes.length) * 100) : 100;

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
      totalBeneficiaries,
    },
  };
}

export type VcCallStatus = "RINGING" | "ANSWERED" | "DECLINED" | "MISSED" | "ENDED";

export type VcSession = {
  id: string;
  roomId: string;
  instituteId: string;
  instituteName: string;
  contactName: string;
  contactRole: string;
  status: VcCallStatus;
  createdAt: string;
  answeredAt?: string;
  endedAt?: string;
  jitsiUrl: string;
};

export const activeVcSessions: VcSession[] = [];

const CONTACT_ROLES = ["Project Incharge", "Staff Supervisor", "Beneficiary Representative"] as const;
const SAMPLE_CONTACTS = [
  "Dr. Rajesh Kumar (Project Incharge)",
  "Smt. Ananya Sen (Staff Superintendent)",
  "Shri Ramesh Chand (Beneficiary Rep)",
  "Dr. Priya Nair (Resident Officer)",
];

export function triggerRandomVc(requestedBy = "demo.department-admin") {
  const targetInstitute = securePick(institutes);
  const contactName = securePick(SAMPLE_CONTACTS);
  const contactRole = securePick(CONTACT_ROLES);
  
  const rawRoomId = sha256(`vc-${targetInstitute.id}-${Date.now()}`);
  const roomId = `dosje-nigrani-${rawRoomId.slice(0, 12)}`;
  const jitsiUrl = `https://meet.jit.si/${roomId}`;

  const session: VcSession = {
    id: `VC-${String(activeVcSessions.length + 1).padStart(4, "0")}`,
    roomId,
    instituteId: targetInstitute.id,
    instituteName: targetInstitute.name,
    contactName,
    contactRole,
    status: "RINGING",
    createdAt: new Date().toISOString(),
    jitsiUrl,
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
      contactRole,
    },
    createdAt: session.createdAt,
  });

  return session;
}

export function answerVcCall(sessionId: string, actor = "demo.target-user") {
  const session = activeVcSessions.find((s) => s.id === sessionId);
  if (!session) throw new Error("VC Session not found");
  session.status = "ANSWERED";
  session.answeredAt = new Date().toISOString();

  appendAudit(auditLog, {
    type: "VC_CALL_ANSWERED",
    actor,
    payload: { sessionId: session.id, roomId: session.roomId, instituteId: session.instituteId },
    createdAt: session.answeredAt,
  });

  return session;
}

export function declineVcCall(sessionId: string, actor = "demo.target-user") {
  const session = activeVcSessions.find((s) => s.id === sessionId);
  if (!session) throw new Error("VC Session not found");
  session.status = "DECLINED";
  session.endedAt = new Date().toISOString();

  alerts.unshift({
    id: `ALT-${1060 + alerts.length}`,
    type: "VC_CALL_DECLINED",
    severity: "HIGH",
    title: "Surprise Inspection VC Call Declined",
    detail: `Random call to ${session.instituteName} (${session.contactName}) was DECLINED by target.`,
    status: "OPEN",
    createdAt: session.endedAt,
  });

  appendAudit(auditLog, {
    type: "VC_CALL_DECLINED",
    actor,
    payload: { sessionId: session.id, roomId: session.roomId, instituteId: session.instituteId, reason: "USER_DECLINED" },
    createdAt: session.endedAt,
  });

  return session;
}

export function missVcCall(sessionId: string) {
  const session = activeVcSessions.find((s) => s.id === sessionId);
  if (!session || session.status !== "RINGING") return session;
  session.status = "MISSED";
  session.endedAt = new Date().toISOString();

  alerts.unshift({
    id: `ALT-${1060 + alerts.length}`,
    type: "VC_CALL_MISSED",
    severity: "CRITICAL",
    title: "Unanswered Surprise VC Inspection Call",
    detail: `Random VC inspection call to ${session.instituteName} (${session.contactName}) timed out with NO RESPONSE after 30s.`,
    status: "OPEN",
    createdAt: session.endedAt,
  });

  appendAudit(auditLog, {
    type: "VC_CALL_MISSED",
    actor: "system.vc-monitor",
    payload: { sessionId: session.id, roomId: session.roomId, instituteId: session.instituteId, anomalyFlag: "UNANSWERED_CALL" },
    createdAt: session.endedAt,
  });

  return session;
}

export function endVcCall(sessionId: string, actor = "demo.user") {
  const session = activeVcSessions.find((s) => s.id === sessionId);
  if (!session) throw new Error("VC Session not found");
  session.status = "ENDED";
  session.endedAt = new Date().toISOString();

  appendAudit(auditLog, {
    type: "VC_CALL_ENDED",
    actor,
    payload: { sessionId: session.id, roomId: session.roomId, instituteId: session.instituteId },
    createdAt: session.endedAt,
  });

  return session;
}
