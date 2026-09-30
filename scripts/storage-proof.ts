import { createHash } from "node:crypto";
import { storageGetSignedUrl, storagePut } from "../server/storage";

const payload = Buffer.from("securesight-phase2-storage-proof");
const expectedHash = createHash("sha256").update(payload).digest("hex");
const stored = await storagePut(`securesight-proof/${Date.now()}.txt`, payload, "text/plain");
const signedUrl = await storageGetSignedUrl(stored.key);
const response = await fetch(signedUrl);
if (!response.ok) throw new Error(`download failed: ${response.status}`);
const downloaded = Buffer.from(await response.arrayBuffer());
const actualHash = createHash("sha256").update(downloaded).digest("hex");
if (actualHash !== expectedHash) throw new Error(`hash mismatch: ${actualHash} != ${expectedHash}`);
console.log(JSON.stringify({ ok: true, key: stored.key, bytes: downloaded.length, hash: actualHash, presigned: true }));
