import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "__jbr_offer_draft";
const TTL_SECONDS = 30 * 60;

interface OfferDraftPayload {
    productId: string;
    amount: string;
    returnPath: string;
    exp: number;
}

function getSecret(): string {
    return process.env.BETTER_AUTH_SECRET || process.env.PDP_FIELD_ENCRYPTION_KEY || "jbr-dev-secret";
}

function sign(encodedPayload: string): string {
    return createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url");
}

function serialize(payload: OfferDraftPayload): string {
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    return `${encoded}.${sign(encoded)}`;
}

function deserialize(raw: string | undefined): OfferDraftPayload | null {
    if (!raw) return null;
    const [encoded, signature] = raw.split(".");
    if (!encoded || !signature) return null;

    const expected = sign(encoded);
    if (Buffer.byteLength(expected) !== Buffer.byteLength(signature)) {
        return null;
    }
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OfferDraftPayload;
        if (!payload.exp || payload.exp < Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}

export async function setOfferDraftCookie(input: { productId: string; amount: string; returnPath: string }) {
    const jar = await cookies();
    const payload: OfferDraftPayload = {
        productId: input.productId,
        amount: input.amount,
        returnPath: input.returnPath,
        exp: Date.now() + TTL_SECONDS * 1000,
    };

    jar.set(COOKIE_NAME, serialize(payload), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: TTL_SECONDS,
    });
}

export async function readOfferDraftCookie(expectedProductId?: string) {
    const jar = await cookies();
    const payload = deserialize(jar.get(COOKIE_NAME)?.value);
    if (!payload) return null;
    if (expectedProductId && payload.productId !== expectedProductId) return null;
    return payload;
}

export async function clearOfferDraftCookie() {
    const jar = await cookies();
    jar.delete(COOKIE_NAME);
}