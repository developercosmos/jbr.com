import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ENCRYPTION_PREFIX = "enc:v1";

function getEncryptionKey(): Buffer {
    const raw =
        process.env.PDP_FIELD_ENCRYPTION_KEY ||
        process.env.APP_FIELD_ENCRYPTION_KEY ||
        process.env.BETTER_AUTH_SECRET;
    if (!raw) {
        throw new Error("Missing PDP field encryption key (set PDP_FIELD_ENCRYPTION_KEY).");
    }

    // Allow raw passphrase or 32-byte base64 key.
    const maybeBase64 = Buffer.from(raw, "base64");
    if (maybeBase64.length === 32 && maybeBase64.toString("base64") === raw.replace(/\s+/g, "")) {
        return maybeBase64;
    }

    return createHash("sha256").update(raw, "utf8").digest();
}

export function encryptPdpField(value: string | null | undefined): string | null {
    if (value === undefined) return null;
    if (value === null) return null;
    if (value === "") return "";

    const key = getEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${ENCRYPTION_PREFIX}:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptPdpField(value: string | null | undefined): string | null {
    if (value === undefined || value === null || value === "") return value ?? null;
    if (!value.startsWith(`${ENCRYPTION_PREFIX}:`)) {
        // Backward compatibility for existing plaintext rows.
        return value;
    }

    const parts = value.split(":");
    if (parts.length !== 5) {
        throw new Error("Invalid encrypted field format.");
    }

    const iv = Buffer.from(parts[2] || "", "base64");
    const tag = Buffer.from(parts[3] || "", "base64");
    const ciphertext = Buffer.from(parts[4] || "", "base64");
    const key = getEncryptionKey();

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
}
