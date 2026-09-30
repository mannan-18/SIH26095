import { describe, expect, it } from "vitest";
import { 
  analyzeAttendance, 
  appendAudit, 
  chooseEligibleInspector, 
  evaluateServerGeofence,
  calculateHaversineDistance,
  sealAssignment, 
  sha256, 
  verifyAuditChain, 
  verifyEvidence, 
  revealAssignment,
  createEvidenceNonce,
  validateAssignmentConstraints,
  calculateInstituteRiskScore,
  analyzeAttendanceAdvanced,
} from "../domain/secureEngine";
import { submitLiveCapture, requestEvidenceNonce, getRegionalOverview } from "../domain/demoStore";
import { getUserStateScope } from "../routers";

describe("SecureSight Core Security & Credibility Unit Tests (Phase 8)", () => {
  it("computes accurate Haversine distance", () => {
    const lat1 = 28.6139; // New Delhi
    const lon1 = 77.209;
    const lat2 = 28.6145; // ~70m away
    const lon2 = 77.2095;
    const distance = calculateHaversineDistance(lat1, lon1, lat2, lon2);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(100);
  });

  it("detects GPS spoofing heuristics: accuracy threshold, impossible speed, and timestamp skew", () => {
    const institute = { latitude: 28.6139, longitude: 77.209 };
    
    // Test 1: Timestamp Skew (>120s skew)
    const skewFix = evaluateServerGeofence(institute, {
      latitude: 28.6139,
      longitude: 77.209,
      accuracy: 10,
      deviceTimestamp: Date.now() - 300_000, // 5 minutes ago
    });
    expect(skewFix.status).toBe("SPOOF_DETECTED");
    expect(skewFix.isSpoofed).toBe(true);
    expect(skewFix.spoofReason).toContain("skew");

    // Test 2: Accuracy Threshold (>50m accuracy)
    const badAccFix = evaluateServerGeofence(institute, {
      latitude: 28.6139,
      longitude: 77.209,
      accuracy: 150, // 150m accuracy
      deviceTimestamp: Date.now(),
    });
    expect(badAccFix.status).toBe("SPOOF_DETECTED");
    expect(badAccFix.isSpoofed).toBe(true);
    expect(badAccFix.spoofReason).toContain("accuracy");
  });

  it("builds and verifies a SHA-256 hash-chained audit ledger, detecting tampered records", () => {
    const log: any[] = [];
    const entry1 = appendAudit(log, { type: "INSPECTION_CREATED", actor: "admin", payload: { id: "INSP-001" }, createdAt: "2026-01-01T10:00:00.000Z" });
    const entry2 = appendAudit(log, { type: "EVIDENCE_CAPTURED", actor: "inspector", payload: { hash: "abc123" }, createdAt: "2026-01-01T10:05:00.000Z" });
    
    expect(log.length).toBe(2);
    expect(entry2.previousHash).toBe(entry1.currentHash);

    const initialVerify = verifyAuditChain(log);
    expect(initialVerify.valid).toBe(true);
    expect(initialVerify.brokenAtIndex).toBeNull();
    expect(initialVerify.totalEntries).toBe(2);

    // Tamper entry 1 payload
    log[0].payload.id = "INSP-001-TAMPERED";
    const tamperedVerify = verifyAuditChain(log);
    expect(tamperedVerify.valid).toBe(false);
    expect(tamperedVerify.brokenAtIndex).toBe(1);
    expect(tamperedVerify.brokenEventId).toBe("AUD-0001");
  });

  it("enforces single-use nonces and rejects replayed or expired camera nonces", () => {
    const nonceRecord = requestEvidenceNonce("INSP-0001");
    expect(nonceRecord.nonce).toBeDefined();
    expect(nonceRecord.used).toBe(false);

    // First live capture submission should succeed
    const validCapture = submitLiveCapture("INSP-0001", nonceRecord.nonce, "fake-image-base64-bytes", {
      latitude: 18.5204,
      longitude: 73.8567,
      accuracy: 10,
      deviceTimestamp: Date.now(),
    });

    expect(validCapture.success).toBe(true);
    expect(validCapture.imageHash).toBeDefined();

    // Replaying the same nonce must be rejected immediately
    expect(() =>
      submitLiveCapture("INSP-0001", nonceRecord.nonce, "fake-image-base64-bytes", {
        latitude: 18.5204,
        longitude: 73.8567,
        accuracy: 10,
        deviceTimestamp: Date.now(),
      })
    ).toThrow(/Replayed nonce detected/);
  });

  it("enforces assignment constraints: blocks repeat pairings and same-district conflicts", () => {
    // Conflict 1: Same district conflict of interest
    const conflictRes = validateAssignmentConstraints({
      inspectorId: "INSP-101",
      inspectorDistrict: "Central Delhi",
      instituteId: "INS-001",
      instituteDistrict: "Central Delhi",
      previousAssignments: [],
    });
    expect(conflictRes.valid).toBe(false);
    expect(conflictRes.reason).toContain("Conflict of interest");

    // Conflict 2: Repeat pairing within 14-day window
    const repeatRes = validateAssignmentConstraints({
      inspectorId: "INSP-101",
      inspectorDistrict: "North Delhi",
      instituteId: "INS-001",
      instituteDistrict: "Central Delhi",
      previousAssignments: [
        { inspectorId: "INSP-101", instituteId: "INS-001", assignedAt: new Date(Date.now() - 3600_000 * 24 * 5).toISOString() }
      ],
    });
    expect(repeatRes.valid).toBe(false);
    expect(repeatRes.reason).toContain("Repeat assignment constraint");

    // Valid assignment
    const validRes = validateAssignmentConstraints({
      inspectorId: "INSP-101",
      inspectorDistrict: "North Delhi",
      instituteId: "INS-002",
      instituteDistrict: "Central Delhi",
      previousAssignments: [],
    });
    expect(validRes.valid).toBe(true);
  });

  it("enforces region-scoping logic for State Authority role", () => {
    const delhiUser = { id: 1, openId: "dosje-state-delhi", role: "STATE_AUTHORITY" as const, email: "delhi@dosje.gov.in" };
    expect(getUserStateScope(delhiUser as any)).toBe("Delhi");

    const regionalData = getRegionalOverview("Delhi");
    expect(regionalData.stateScope).toBe("Delhi");
    expect(regionalData.institutes.every(i => i.state.toLowerCase() === "delhi")).toBe(true);
  });

  it("computes risk-weighted institute scores", () => {
    const risk = calculateInstituteRiskScore({
      instituteId: "INS-001",
      district: "Central Delhi",
      recentAnomaliesCount: 2,
      attendanceAnomalyScore: 60,
      missedVcCallsCount: 1,
      cctvOnline: false,
      daysSinceLastInspection: 45,
    });

    expect(risk.riskScore).toBeGreaterThan(60);
    expect(risk.factors.length).toBeGreaterThan(3);
    expect(["HIGH", "CRITICAL"]).toContain(risk.riskLevel);
  });
});
