export type OfflineQueueItem = { id: string; type: string; createdAt: string; status: "queued" | "syncing" | "synced" | "failed"; payload?: unknown; error?: string };
type StoredQueueItem = Omit<OfflineQueueItem, "payload"> & { payloadCiphertext?: string; iv?: string };

const DB_NAME = "securesight-field";
const STORE = "outbox";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function sessionKeyMaterial(fallback?: string) {
  const session = sessionStorage.getItem("manus-cookie") ?? fallback;
  if (!session) throw new Error("Offline queue requires an authenticated session");
  return new TextEncoder().encode(session);
}

async function deriveKey(fallback?: string) {
  const base = await crypto.subtle.importKey("raw", await sessionKeyMaterial(fallback), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: new TextEncoder().encode(`${location.origin}:securesight-field-v1`), iterations: 100_000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array) { let binary = ""; for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index] ?? 0); return btoa(binary); }
function fromBase64(value: string) { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); }

async function encryptPayload(payload: unknown, fallback?: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await deriveKey(fallback), new TextEncoder().encode(JSON.stringify(payload)));
  return { payloadCiphertext: toBase64(new Uint8Array(ciphertext)), iv: toBase64(iv) };
}

async function decryptPayload(item: StoredQueueItem, fallback?: string) {
  if (!item.payloadCiphertext || !item.iv) return undefined;
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(item.iv) }, await deriveKey(fallback), fromBase64(item.payloadCiphertext));
  return JSON.parse(new TextDecoder().decode(plaintext));
}

export async function listOfflineQueue(secret?: string): Promise<OfflineQueueItem[]> {
  const db = await openDb();
  const rows = await new Promise<StoredQueueItem[]>((resolve, reject) => { const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll(); request.onsuccess = () => resolve(request.result as StoredQueueItem[]); request.onerror = () => reject(request.error); });
  const items = await Promise.all(rows.map(async (row) => ({ ...row, payload: await decryptPayload(row, secret) })));
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function enqueueOffline(item: Omit<OfflineQueueItem, "id" | "status">, secret?: string): Promise<OfflineQueueItem> {
  const value: OfflineQueueItem = { ...item, id: crypto.randomUUID(), status: "queued" };
  const encrypted = await encryptPayload(value.payload, secret);
  const stored: StoredQueueItem = { id: value.id, type: value.type, createdAt: value.createdAt, status: value.status, error: value.error, ...encrypted };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => { const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(stored); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
  return value;
}

export async function updateOffline(id: string, patch: Partial<OfflineQueueItem>, secret?: string) {
  const db = await openDb();
  const current = await new Promise<StoredQueueItem>((resolve, reject) => { const request = db.transaction(STORE, "readonly").objectStore(STORE).get(id); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  const value = { ...current, ...patch } as OfflineQueueItem;
  const encrypted = patch.payload === undefined ? {} : await encryptPayload(patch.payload, secret);
  const stored: StoredQueueItem = { id: value.id, type: value.type, createdAt: value.createdAt, status: value.status, error: value.error, payloadCiphertext: current.payloadCiphertext, iv: current.iv, ...encrypted };
  await new Promise<void>((resolve, reject) => { const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(stored); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
}

export async function syncOfflineQueue(sync: (item: OfflineQueueItem) => Promise<void>, secret?: string) {
  for (const item of await listOfflineQueue(secret)) {
    if (item.status === "synced") continue;
    await updateOffline(item.id, { status: "syncing" }, secret);
    try { await sync(item); await updateOffline(item.id, { status: "synced", error: undefined }, secret); }
    catch (error) { await updateOffline(item.id, { status: "failed", error: error instanceof Error ? error.message : "Sync failed" }, secret); }
  }
}
