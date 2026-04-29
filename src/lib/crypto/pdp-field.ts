import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ENCRYPTION_VERSION = "v1";
const ENCRYPTION_PREFIX = `enc:${ENCRYPTION_VERSION}`;
const DEFAULT_KEY_ID = "k1";

function normalizeKey(raw: string): Buffer {
    const trimmed = raw.trim();
    const maybeBase64 = Buffer.from(trimmed, "base64");
    if (maybeBase64.length === 32 && maybeBase64.toString("base64") === trimmed.replace(/\s+/g, "")) {
        return maybeBase64;
    }
    return createHash("sha256").update(trimmed, "utf8").digest();
}

function loadKeyRing(): { currentKeyId: string; keys: Record<string, Buffer> } {
    const keyRing: Record<string, Buffer> = {};
    const ringEnv = process.env.PDP_FIELD_ENCRYPTION_KEYS;
    if (ringEnv) {
        for (const pair of ringEnv.split(",")) {
            const [rawId, ...rawValueParts] = pair.split(":");
            const id = (rawId || "").trim();
            const value = rawValueParts.join(":").trim();
            if (!id || !value) continue;
            keyRing[id] = normalizeKey(value);
        }
    }

    const singleKey =
        process.env.PDP_FIELD_ENCRYPTION_KEY ||
        process.env.APP_FIELD_ENCRYPTION_KEY ||
        process.env.BETTER_AUTH_SECRET;

    if (singleKey) {
        keyRing[DEFAULT_KEY_ID] = normalizeKey(singleKey);
    }

    const configuredCurrentId = (process.env.PDP_FIELD_ENCRYPTION_KEY_ID || "").trim() || DEFAULT_KEY_ID;
    if (!keyRing[configuredCurrentId]) {
        const firstAvailableId = Object.keys(keyRing)[0];
        if (firstAvailableId) {
            return { currentKeyId: firstAvailableId, keys: keyRing };
        }
        throw new Error("Missing PDP field encryption key (set PDP_FIELD_ENCRYPTION_KEY).");
    }

    return { currentKeyId: configuredCurrentId, keys: keyRing };
}

export function encryptPdpField(value: string | null | undefined): string | null {
    if (value === undefined) return null;
    if (value === null) return null;
    if (value === "") return "";

    const { currentKeyId, keys } = loadKeyRing();
    const key = keys[currentKeyId];
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${ENCRYPTION_PREFIX}:${currentKeyId}:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptPdpField(value: string | null | undefined): string | null {
    if (value === undefined || value === null || value === "") return value ?? null;
    if (!value.startsWith("enc:")) {
        // Backward compatibility for existing plaintext rows.
        return value;
    }

    const parts = value.split(":");
    const { keys } = loadKeyRing();

    // Legacy format: enc:v1:<iv>:<tag>:<ciphertext> (without key id)
    if (parts.length === 5 && parts[0] === "enc" && parts[1] === ENCRYPTION_VERSION) {
        const iv = Buffer.from(parts[2] || "", "base64");
        const tag = Buffer.from(parts[3] || "", "base64");
        const ciphertext = Buffer.from(parts[4] || "", "base64");
        const legacyKey = keys[DEFAULT_KEY_ID] || keys[Object.keys(keys)[0] || ""];
        if (!legacyKey) {
            throw new Error("No encryption key available for legacy payload.");
        }
        const decipher = createDecipheriv("aes-256-gcm", legacyKey, iv);
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return plaintext.toString("utf8");
    }

    if (parts.length !== 6 || parts[0] !== "enc" || parts[1] !== ENCRYPTION_VERSION) {
        throw new Error("Invalid encrypted field format.");
    }

    const keyId = parts[2] || "";
    const iv = Buffer.from(parts[3] || "", "base64");
    const tag = Buffer.from(parts[4] || "", "base64");
    const ciphertext = Buffer.from(parts[5] || "", "base64");
    const key = keys[keyId];
    if (!key) {
        throw new Error(`Missing encryption key for key id: ${keyId}`);
    }

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
}

export function needsPdpFieldReencryption(value: string | null | undefined): boolean {
    if (!value) return false;
    if (!value.startsWith("enc:")) return true;

    const parts = value.split(":");
    if (parts.length === 5) return true; // legacy format, no key id
    if (parts.length !== 6 || parts[0] !== "enc" || parts[1] !== ENCRYPTION_VERSION) return true;

    const { currentKeyId } = loadKeyRing();
    return parts[2] !== currentKeyId;
}

export function reencryptPdpField(value: string | null | undefined): string | null {
    const plain = decryptPdpField(value);
    return encryptPdpField(plain);
}
