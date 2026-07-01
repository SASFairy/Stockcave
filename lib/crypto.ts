import crypto from "crypto";

// Retreive encryption secret from env and prepare a 32-byte key buffer
const getSecretKey = (): Buffer => {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET environment variable is missing.");
  }

  // If secret is a 64-character hex string (32 bytes), parse it as hex
  if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
    return Buffer.from(secret, "hex");
  }

  // Fallback: Hash the secret string using SHA-256 to guarantee a robust 32-byte key
  return crypto.createHash("sha256").update(secret).digest();
};

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 12 bytes IV is standard for GCM

/**
 * Encrypts a plain text string using AES-256-GCM.
 * Output format is: "iv_hex:ciphertext_hex:tag_hex"
 */
export function encrypt(text: string): string {
  try {
    const key = getSecretKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const tag = cipher.getAuthTag().toString("hex");

    return `${iv.toString("hex")}:${encrypted}:${tag}`;
  } catch (error) {
    console.error("Encryption failed:", error);
    throw new Error("Failed to encrypt credentials.");
  }
}

/**
 * Decrypts a cipher text formatted as "iv_hex:ciphertext_hex:tag_hex".
 */
export function decrypt(encryptedText: string): string {
  try {
    const key = getSecretKey();
    const parts = encryptedText.split(":");

    if (parts.length !== 3) {
      throw new Error("Invalid encrypted text format. Expected iv:ciphertext:tag");
    }

    const [ivHex, encryptedHex, tagHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt credentials. Make sure ENCRYPTION_SECRET matches.");
  }
}
