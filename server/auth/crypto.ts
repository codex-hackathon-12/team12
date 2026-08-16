import { getTokenEncryptionKey } from "@/server/config/env";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function base64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64Url(bytes);
}

export async function hashToken(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toBase64(new Uint8Array(digest));
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const keyValue = getTokenEncryptionKey();

  const rawKey = fromBase64(keyValue);
  if (rawKey.byteLength !== 32) {
    throw new Error("Token encryption key must be a base64-encoded 32-byte value.");
  }

  return crypto.subtle.importKey("raw", toArrayBuffer(rawKey), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(value: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getEncryptionKey();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    encoder.encode(value),
  );

  return {
    ciphertext: toBase64(new Uint8Array(encrypted)),
    iv: toBase64(iv),
  };
}

export async function decryptSecret(ciphertext: string, iv: string): Promise<string> {
  const key = await getEncryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(fromBase64(iv)) },
    key,
    toArrayBuffer(fromBase64(ciphertext)),
  );
  return decoder.decode(decrypted);
}
