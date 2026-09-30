import { createHash, randomInt, randomUUID } from "node:crypto";

export type NonceRecord = {
  nonce: string;
  inspectionId: string;
  expiresAt: number;
  used: boolean;
};

const activeNonces = new Map<string, NonceRecord>();

export function createEvidenceNonce(inspectionId: string): NonceRecord {
  const nonce = `nonce-${randomUUID()}`;
  const expiresAt = Date.now() + 120_000; // 2 minutes expiry
  const record: NonceRecord = { nonce, inspectionId, expiresAt, used: false };
  activeNonces.set(nonce, record);
  return record;
}

export function getNonceRecord(nonce: string): NonceRecord | undefined {
  return activeNonces.get(nonce);
}

export type AssignmentStatus = "CREATED" | "SEALED" | "REVEALED" | "COMPLETED";
export type AuditEvent = {
  id: string;
  type: string;
  actor: string;
  payload: Record<string, unknown>;
  createdAt: string;
  previousHash: string | null;
  currentHash: string;
};

const canonicalize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function securePick<T>(items: readonly T[]): T {
  if (!items.length) throw new Error("No eligible candidates");
  return items[randomInt(items.length)];
}

export function chooseEligibleInspector(
  inspectors: Array<{ id: string; name: string; active: boolean; workload: number; conflicts: string[] }>,
  instituteId: string,
) {
  const eligible = inspectors.filter(
    (inspector) => inspector.active && inspector.workload < 4 && !inspector.conflicts.includes(instituteId),
  );
  return securePick(eligible);
}

export function sealAssignment(assignment: { status: AssignmentStatus; inspectorId: string }) {
  if (assignment.status !== "CREATED") throw new Error("Only CREATED assignments can be sealed");
  if (!assignment.inspectorId) throw new Error("Inspector must be selected by the server");
  return { ...assignment, status: "SEALED" as const, sealedAt: new Date().toISOString() };
}

export function revealAssignment(assignment: { status: AssignmentStatus; inspectorId: string }) {
  if (assignment.status !== "SEALED") throw new Error("Assignment can only be revealed after sealing");
  return { ...assignment, status: "REVEALED" as const, revealedAt: new Date().toISOString() };
}

export type GpsFixInput = {
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  deviceTimestamp?: number | null;
};

export type GeofenceResult = {
  status: "INSIDE_GEOFENCE" | "OUTSIDE_GEOFENCE" | "LOCATION_UNAVAILABLE" | "SPOOF_DETECTED";
  distanceMeters: number | null;
  isSpoofed: boolean;
  spoofReason?: string;
};

const lastGpsFixStore = new Map<string, { latitude: number; longitude: number; timestamp: number }>();

export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const earthRadius = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadius * c * 10) / 10;
}

export function evaluateServerGeofence(
  institute: { latitude: number; longitude: number },
  captured: GpsFixInput,
  sessionId = "default-session",
  radiusMeters = 100
): GeofenceResult {
  if (captured.latitude == null || captured.longitude == null) {
    return { status: "LOCATION_UNAVAILABLE", distanceMeters: null, isSpoofed: false };
  }

  const serverTime = Date.now();

  // Heuristic 1: Timestamp skew check (> 120s)
  if (captured.deviceTimestamp != null) {
    const skewMs = Math.abs(serverTime - captured.deviceTimestamp);
    if (skewMs > 120_000) {
      return {
        status: "SPOOF_DETECTED",
        distanceMeters: null,
        isSpoofed: true,
        spoofReason: `GPS timestamp skew of ${(skewMs / 1000).toFixed(0)}s exceeds 120s limit`,
      };
    }
  }

  // Heuristic 2: Accuracy threshold check (> 50m)
  if (captured.accuracy != null && captured.accuracy > 50) {
    return {
      status: "SPOOF_DETECTED",
      distanceMeters: null,
      isSpoofed: true,
      spoofReason: `Reported GPS accuracy (${captured.accuracy.toFixed(1)}m) exceeds 50m tolerance`,
    };
  }

  // Heuristic 3: Speed anomaly check (> 150 km/h)
  const prevFix = lastGpsFixStore.get(sessionId);
  if (prevFix) {
    const timeDeltaSec = (serverTime - prevFix.timestamp) / 1000;
    if (timeDeltaSec > 0.5 && timeDeltaSec < 3600) {
      const distFromPrev = calculateHaversineDistance(
        prevFix.latitude,
        prevFix.longitude,
        captured.latitude,
        captured.longitude
      );
      const speedKmh = (distFromPrev / timeDeltaSec) * 3.6;
      if (speedKmh > 150) {
        return {
          status: "SPOOF_DETECTED",
          distanceMeters: distFromPrev,
          isSpoofed: true,
          spoofReason: `Impossible movement speed of ${speedKmh.toFixed(0)} km/h detected`,
        };
      }
    }
  }

  lastGpsFixStore.set(sessionId, {
    latitude: captured.latitude,
    longitude: captured.longitude,
    timestamp: serverTime,
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

export function geofenceStatus(
  institute: { latitude: number; longitude: number },
  captured: { latitude?: number | null; longitude?: number | null },
  radiusMeters = 100
): "INSIDE_GEOFENCE" | "OUTSIDE_GEOFENCE" | "LOCATION_UNAVAILABLE" {
  const result = evaluateServerGeofence(institute, captured, "legacy", radiusMeters);
  return result.status === "SPOOF_DETECTED" ? "OUTSIDE_GEOFENCE" : result.status;
}

export function verifyEvidence(originalHash: string, candidateContent: string) {
  const recomputedHash = sha256(candidateContent);
  return { recomputedHash, result: recomputedHash === originalHash ? "MATCH" as const : "TAMPERED" as const };
}

export function scoreRisk(signals: {
  geofence: string;
  evidence: string;
  timestamp: string;
  cctvOnline: boolean;
  attendanceAnomaly: number;
}) {
  const factors: string[] = [];
  let score = 8;
  if (signals.geofence === "OUTSIDE_GEOFENCE") { score += 28; factors.push("Outside configured geofence"); }
  if (signals.geofence === "LOCATION_UNAVAILABLE") { score += 7; factors.push("GPS unavailable"); }
  if (signals.evidence === "TAMPERED") { score += 42; factors.push("Evidence hash mismatch"); }
  if (signals.timestamp === "TIMESTAMP_SUSPICIOUS") { score += 12; factors.push("Timestamp plausibility indicator"); }
  if (!signals.cctvOnline) { score += 8; factors.push("CCTV source offline"); }
  if (signals.attendanceAnomaly >= 60) { score += 18; factors.push("Attendance anomaly score elevated"); }
  const bounded = Math.min(100, score);
  return { riskScore: bounded, riskLevel: bounded >= 70 ? "CRITICAL" : bounded >= 45 ? "HIGH" : bounded >= 20 ? "MEDIUM" : "LOW", factors };
}

export function computeEntryHash(prevHash: string, payload: Record<string, unknown>, timestamp: string): string {
  return sha256(`${prevHash}${canonicalize(payload)}${timestamp}`);
}

const GENESIS_HASH = "GENESIS-0000000000000000000000000000000000000000000000000000000000000000";

export function appendAudit(log: AuditEvent[], event: Omit<AuditEvent, "id" | "previousHash" | "currentHash">): AuditEvent {
  const previousHash = log.length > 0 ? log[log.length - 1].currentHash : GENESIS_HASH;
  const currentHash = computeEntryHash(previousHash, event.payload, event.createdAt);
  const record: AuditEvent = {
    id: `AUD-${String(log.length + 1).padStart(4, "0")}`,
    type: event.type,
    actor: event.actor,
    payload: event.payload,
    createdAt: event.createdAt,
    previousHash,
    currentHash,
  };
  log.push(record);
  return record;
}

export type ChainVerificationResult = {
  valid: boolean;
  brokenAtIndex: number | null;
  brokenEventId: string | null;
  totalEntries: number;
};

export function verifyAuditChain(log: AuditEvent[]): ChainVerificationResult {
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

export function analyzeAttendance(records: Array<{ expected: number; observed: number }>) {
  const total = records.length || 1;
  const deviations = records.map((record) => Math.abs(record.expected - record.observed) / Math.max(record.expected, 1));
  const anomalyScore = Math.round((deviations.reduce((sum, value) => sum + value, 0) / total) * 100);
  return { anomalyScore: Math.min(100, anomalyScore), flaggedDays: deviations.filter((value) => value > 0.2).length };
}

export type InstituteRiskFactors = {
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: string[];
  reason: string;
};

export function calculateInstituteRiskScore(input: {
  instituteId: string;
  district: string;
  recentAnomaliesCount: number;
  attendanceAnomalyScore: number;
  missedVcCallsCount: number;
  cctvOnline: boolean;
  daysSinceLastInspection: number;
}): InstituteRiskFactors {
  const factors: string[] = [];
  let score = 10;

  if (input.recentAnomaliesCount > 0) {
    const pts = Math.min(30, input.recentAnomaliesCount * 10);
    score += pts;
    factors.push(`${input.recentAnomaliesCount} open anomaly alert(s) (+${pts} pts)`);
  }

  if (input.attendanceAnomalyScore > 30) {
    const pts = Math.min(25, Math.round(input.attendanceAnomalyScore * 0.25));
    score += pts;
    factors.push(`Biometric attendance variance score ${input.attendanceAnomalyScore}% (+${pts} pts)`);
  }

  if (input.missedVcCallsCount > 0) {
    const pts = Math.min(20, input.missedVcCallsCount * 10);
    score += pts;
    factors.push(`${input.missedVcCallsCount} missed/declined VC call(s) (+${pts} pts)`);
  }

  if (!input.cctvOnline) {
    score += 15;
    factors.push("CCTV surveillance offline (+15 pts)");
  }

  if (input.daysSinceLastInspection > 30) {
    const pts = Math.min(15, Math.floor((input.daysSinceLastInspection - 30) / 10) * 5 + 5);
    score += pts;
    factors.push(`${input.daysSinceLastInspection} days since last inspection (+${pts} pts)`);
  }

  const boundedScore = Math.min(100, Math.max(5, score));
  const riskLevel =
    boundedScore >= 75 ? "CRITICAL" : boundedScore >= 50 ? "HIGH" : boundedScore >= 25 ? "MEDIUM" : "LOW";

  const reason = factors.length > 0 ? factors.join(" · ") : "Routine preventive inspection threshold reached.";

  return { riskScore: boundedScore, riskLevel, factors, reason };
}

export function weightedRiskPick<T extends { riskScore: number }>(items: T[]): T {
  if (!items.length) throw new Error("No candidates available for assignment");
  const totalWeight = items.reduce((sum, item) => sum + Math.max(1, item.riskScore), 0);
  let randomVal = Math.random() * totalWeight;
  for (const item of items) {
    randomVal -= Math.max(1, item.riskScore);
    if (randomVal <= 0) return item;
  }
  return items[0];
}

export function validateAssignmentConstraints(input: {
  inspectorId: string;
  inspectorDistrict?: string | null;
  instituteId: string;
  instituteDistrict: string;
  previousAssignments: Array<{ inspectorId: string; instituteId: string; assignedAt: string }>;
  windowDays?: number;
}): { valid: boolean; reason?: string } {
  if (input.inspectorDistrict && input.inspectorDistrict.toLowerCase() === input.instituteDistrict.toLowerCase()) {
    return {
      valid: false,
      reason: `Conflict of interest: Inspector district (${input.inspectorDistrict}) matches target institute district.`,
    };
  }

  const windowMs = (input.windowDays ?? 14) * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const recentPairing = input.previousAssignments.find(
    (a) =>
      a.inspectorId === input.inspectorId &&
      a.instituteId === input.instituteId &&
      now - new Date(a.assignedAt).getTime() < windowMs
  );

  if (recentPairing) {
    return {
      valid: false,
      reason: `Repeat assignment constraint: Inspector was assigned to this institute within the last ${input.windowDays ?? 14} days.`,
    };
  }

  return { valid: true };
}

export function analyzeAttendanceAdvanced(records: Array<{ expected: number; observed: number; timestamp?: string }>) {
  const base = analyzeAttendance(records);
  const flags: string[] = [];

  if (records.length >= 3) {
    const isUniform = records.every((r) => r.observed === records[0].observed);
    if (isUniform) {
      flags.push("SUSPICIOUSLY_UNIFORM_ATTENDANCE: Identical turnout count reported for all recorded days.");
    }

    const recent = records.slice(0, 2);
    const older = records.slice(2);
    const recentAvg = recent.reduce((s, r) => s + r.observed, 0) / recent.length;
    const olderAvg = older.reduce((s, r) => s + r.observed, 0) / older.length;
    if (olderAvg > 0 && (recentAvg - olderAvg) / olderAvg > 0.3) {
      flags.push(`SUDDEN_ATTENDANCE_SPIKE: ${Math.round(((recentAvg - olderAvg) / olderAvg) * 100)}% attendance jump prior to inspection.`);
    }
  }

  return {
    ...base,
    advancedFlags: flags,
    isSuspicious: flags.length > 0 || base.anomalyScore > 40,
  };
}
