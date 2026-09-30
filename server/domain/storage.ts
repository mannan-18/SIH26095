// Preconfigured storage helpers for Manus WebDev templates.
// Evidence bytes are uploaded through Forge presigned URLs; downloads are
// served through the authenticated storage proxy.

import crypto from "node:crypto";
import { ENV } from "../_core/env";

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error("Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY");
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

function normalizeKey(relKey: string) {
  return relKey.replace(/^\/+/, "");
}

function assertReadableKey(relKey: string) {
  const key = normalizeKey(relKey);
  if (!key || key.includes("\0") || key.includes("..")) throw new Error("Storage key is invalid");
  if (!(key.startsWith("users/") || key.startsWith("shared/") || key.startsWith("securesight/") || key.startsWith("health/"))) {
    throw new Error("Storage keys must use a scoped users/ or approved system prefix");
  }
  return key;
}

function appendHashSuffix(relKey: string) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  return lastDot === -1 ? `${relKey}_${hash}` : `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(relKey: string, data: Buffer | Uint8Array | string, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", `${forgeUrl}/`);
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!presignResp.ok) throw new Error(`Storage presign failed (${presignResp.status})`);
  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data as BlobPart], { type: contentType });
  const uploadResp = await fetch(s3Url, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
  if (!uploadResp.ok) throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string) {
  const key = assertReadableKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string) {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = assertReadableKey(relKey);
  const getUrl = new URL("v1/storage/presign/get", `${forgeUrl}/`);
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!resp.ok) throw new Error(`Storage signed URL failed (${resp.status})`);
  const { url } = (await resp.json()) as { url: string };
  if (!url) throw new Error("Forge returned empty signed URL");
  return url;
}

export { assertReadableKey };

void getForgeConfig;
void normalizeKey;
void appendHashSuffix;
void storagePut;
void storageGet;
void storageGetSignedUrl;
void ENV;

export const STORAGE_POLICY_VERSION = "scoped-v1";
void STORAGE_POLICY_VERSION;

// End of server-only storage adapter.
