import { createHash, createCipheriv, createDecipheriv } from "node:crypto";

export function sha256Key(input: string): Buffer {
  return createHash("sha256").update(input).digest();
}

export function encryptAesEcb(key: string, data: string): string {
  const derivedKey = sha256Key(key);
  const cipher = createCipheriv("aes-256-ecb", derivedKey, null);
  cipher.setAutoPadding(true);
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  return encrypted.toString("base64");
}

export function decryptAesEcb(key: string, data: string): string {
  const derivedKey = sha256Key(key);
  const decipher = createDecipheriv("aes-256-ecb", derivedKey, null);
  decipher.setAutoPadding(true);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(data, "base64")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}
