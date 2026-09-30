import { randomUUID } from "node:crypto";
import { basename } from "node:path";

export type EvidenceMetadata = {
  evidenceId: string;
  inspectionId: string;
  storageKey: string;
  fileHash: string;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  fileType: string;
  fileSize: number;
  createdBy: string;
};

export interface EvidenceStorageProvider {
  readonly mode: "LOCAL_DEMO" | "S3_COMPATIBLE";
  put(input: { filename: string; content: Uint8Array; mimeType: string }): Promise<{ storageKey: string; size: number }>;
  verify(storageKey: string): Promise<{ available: boolean; reason?: string }>;
}

export class LocalDemoEvidenceStorage implements EvidenceStorageProvider {
  readonly mode = "LOCAL_DEMO" as const;
  private readonly objects = new Map<string, Uint8Array>();

  async put(input: { filename: string; content: Uint8Array; mimeType: string }) {
    const safeName = basename(input.filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `demo/${randomUUID()}-${safeName}`;
    this.objects.set(storageKey, input.content);
    return { storageKey, size: input.content.byteLength };
  }

  async verify(storageKey: string) {
    return this.objects.has(storageKey) ? { available: true } : { available: false, reason: "OBJECT_NOT_FOUND" };
  }
}

export class S3CompatibleEvidenceStorage implements EvidenceStorageProvider {
  readonly mode = "S3_COMPATIBLE" as const;
  async put(_input: { filename: string; content: Uint8Array; mimeType: string }) {
    return Promise.reject<{ storageKey: string; size: number }>(new Error("S3 provider is not configured in this demo environment"));
  }
  async verify(_storageKey: string) {
    return { available: false, reason: "S3_NOT_CONFIGURED" };
  }
}

export type CctvStatus = { cameraId: string; status: "ONLINE" | "OFFLINE" | "INVALID_STREAM"; lastSeen: string | null; provider: "DEMO" | "CONFIGURED" };
export interface CCTVProvider { getStatus(cameraId: string, streamUrl?: string): Promise<CctvStatus>; }

export class MockCCTVProvider implements CCTVProvider {
  async getStatus(cameraId: string, streamUrl?: string): Promise<CctvStatus> {
    if (streamUrl?.startsWith("invalid:")) return { cameraId, status: "INVALID_STREAM", lastSeen: null, provider: "DEMO" };
    return { cameraId, status: cameraId.endsWith("OFFLINE") ? "OFFLINE" : "ONLINE", lastSeen: new Date().toISOString(), provider: "DEMO" };
  }
}

export class LiveCCTVProvider implements CCTVProvider {
  async getStatus(cameraId: string): Promise<CctvStatus> {
    return { cameraId, status: "INVALID_STREAM", lastSeen: null, provider: "CONFIGURED" };
  }
}

export type VideoSession = { sessionId: string; participantId: string; status: "CREATED" | "FAILED"; provider: "DEMO" | "CONFIGURED"; reason?: string };
export interface VideoConferenceProvider { createSession(input: { participantId: string }): Promise<VideoSession>; }

export class MockVideoConferenceProvider implements VideoConferenceProvider {
  async createSession(input: { participantId: string }) {
    if (!input.participantId.trim()) return { sessionId: "", participantId: input.participantId, status: "FAILED" as const, provider: "DEMO" as const, reason: "PARTICIPANT_REQUIRED" };
    return { sessionId: `DEMO-VC-${randomUUID()}`, participantId: input.participantId, status: "CREATED" as const, provider: "DEMO" as const };
  }
}

export class LiveVideoConferenceProvider implements VideoConferenceProvider {
  async createSession(input: { participantId: string }) {
    return { sessionId: "", participantId: input.participantId, status: "FAILED" as const, provider: "CONFIGURED" as const, reason: "VC_PROVIDER_NOT_CONFIGURED" };
  }
}
