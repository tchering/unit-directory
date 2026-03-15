import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function buildEncryptionKey() {
  const configured = (process.env.CREDENTIALS_ENCRYPTION_KEY || "").trim();
  if (configured) {
    const asHex = /^[0-9a-fA-F]{64}$/.test(configured) ? Buffer.from(configured, "hex") : null;
    if (asHex) {
      return asHex;
    }
    return createHash("sha256").update(configured).digest();
  }

  const fallback = process.env.REFRESH_TOKEN_SECRET || process.env.ACCESS_TOKEN_SECRET || "dev-credential-fallback";
  return createHash("sha256").update(fallback).digest();
}

const ENCRYPTION_KEY = buildEncryptionKey();

export function encryptTemporaryPassword(plainText) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptTemporaryPassword(payload) {
  const [ivB64, tagB64, dataB64] = (payload || "").split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    return null;
  }

  try {
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const encrypted = Buffer.from(dataB64, "base64");
    const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (_error) {
    return null;
  }
}
