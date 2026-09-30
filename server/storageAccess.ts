import path from "node:path";

export function normalizeStorageKey(rawKey: string) {
  if (!rawKey || rawKey.includes("\0")) return null;
  const normalized = path.posix.normalize(rawKey).replace(/^\/+/, "");
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized.includes("/../")) return null;
  return normalized;
}

export function userStoragePrefix(openId: string) {
  return `users/${encodeURIComponent(openId)}/`;
}

export function canAccessStorageKey(openId: string, role: string, key: string) {
  if (["admin", "DEPARTMENT_ADMIN"].includes(role) && key.startsWith("shared/")) return true;
  return key.startsWith(userStoragePrefix(openId));
}

export function scopedStorageKey(openId: string, relativeKey: string) {
  const normalized = normalizeStorageKey(relativeKey);
  if (!normalized) throw new Error("Invalid storage key");
  return `${userStoragePrefix(openId)}${normalized}`;
}
