// Local-LLM OCR for KYC documents (Gemma-class multimodal model over an
// OpenAI-compatible /v1/chat/completions endpoint, e.g. a llama.cpp server).
//
// This module is server-only and dependency-light: it builds the request,
// calls the configured endpoint with a hard timeout, parses the model's JSON,
// and cross-checks the extracted NIK against the seller-typed NIK. It performs
// NO database work and NO feature-flag checks — the caller (the sweep / admin
// action) owns gating, persistence, and notifications.
//
// The endpoint is configured via env (all optional; absent => OCR disabled):
//   KYC_OCR_LLM_URL      full chat-completions URL, e.g.
//                        http://10.0.28.77:8080/v1/chat/completions
//   KYC_OCR_LLM_MODEL    model id, e.g. gemma-4-26b-a4b
//   KYC_OCR_LLM_API_KEY  optional bearer token
//   KYC_OCR_TIMEOUT_MS   per-call timeout (default 90000)
//   KYC_OCR_MAX_TOKENS   max completion tokens (default 1024 — the model emits
//                        separate reasoning tokens, so leave generous headroom)
//   KYC_OCR_MAX_DIM      downscale longest image edge to this px before sending
//                        (default 1400; keeps detail while cutting payload/latency)
import { logger } from "@/lib/logger";

export interface OcrConfig {
    url: string;
    model: string;
    apiKey: string | null;
    timeoutMs: number;
    maxTokens: number;
    maxDim: number;
}

export interface KtpExtraction {
    isKtp: boolean | null;
    nik: string | null;
    nama: string | null;
    ttl: string | null; // tempat, tanggal lahir (free text as read)
}

export type NikVerdict = "match" | "near" | "mismatch" | "unreadable";

/** Feature-flag key gating the automatic OCR sweep. */
export const KYC_OCR_FEATURE_KEY = "kyc.ocr";

export interface NikCrossCheck {
    nikVerdict: NikVerdict;
    nikDistance: number | null;
}

const NEAR_MAX_DISTANCE = 2; // <=2 differing chars => likely OCR noise, not a different card

export function getOcrConfig(): OcrConfig | null {
    const url = (process.env.KYC_OCR_LLM_URL || "").trim();
    const model = (process.env.KYC_OCR_LLM_MODEL || "").trim();
    if (!url || !model) return null;
    const num = (raw: string | undefined, fallback: number) => {
        const n = Number.parseInt((raw || "").trim(), 10);
        return Number.isFinite(n) && n > 0 ? n : fallback;
    };
    return {
        url,
        model,
        apiKey: (process.env.KYC_OCR_LLM_API_KEY || "").trim() || null,
        timeoutMs: num(process.env.KYC_OCR_TIMEOUT_MS, 90_000),
        maxTokens: num(process.env.KYC_OCR_MAX_TOKENS, 1024),
        maxDim: num(process.env.KYC_OCR_MAX_DIM, 1400),
    };
}

/** True when an OCR endpoint is configured. Does NOT check the feature flag. */
export function isOcrConfigured(): boolean {
    return getOcrConfig() !== null;
}

const EXTRACTION_PROMPT =
    "Anda adalah pemeriksa dokumen. Gambar ini SEHARUSNYA adalah KTP (Kartu Tanda Penduduk) Indonesia. " +
    "Baca teks pada kartu dan kembalikan HANYA satu objek JSON valid, tanpa penjelasan, tanpa markdown. " +
    'Format persis: {"is_ktp": boolean, "nik": string, "nama": string, "tempat_lahir": string, "tanggal_lahir": string}. ' +
    'Aturan: "is_ktp" true hanya jika ini benar-benar KTP Indonesia. "nik" HANYA 16 digit angka (tanpa spasi/titik); ' +
    'jika tidak terbaca, isi "". "tanggal_lahir" format DD-MM-YYYY jika terbaca. Jangan menebak; kosongkan field yang tidak terbaca.';

function stripToJson(text: string): unknown | null {
    if (!text) return null;
    let t = text.trim();
    // Strip a leading/trailing markdown code fence if present.
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try {
        return JSON.parse(t);
    } catch {
        // Fall back to the first balanced-looking {...} block.
        const start = t.indexOf("{");
        const end = t.lastIndexOf("}");
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(t.slice(start, end + 1));
            } catch {
                return null;
            }
        }
        return null;
    }
}

function digitsOnly(value: unknown): string {
    return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

function asTrimmedString(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const t = value.trim();
    return t.length ? t : null;
}

async function preprocessImage(bytes: Buffer, mimeType: string, maxDim: number): Promise<{ b64: string; mime: string }> {
    // sharp is NOT a declared dependency (it's only present transitively via Next's
    // image optimizer). Load it lazily and optionally: a top-level import breaks the
    // server build when Next collects page data for the cron route. When sharp is
    // available we normalize to a downscaled JPEG (handles webp, big photos, EXIF
    // rotation); otherwise we send the original bytes untouched.
    try {
        const sharpMod = (await import("sharp")).default;
        const out = await sharpMod(bytes)
            .rotate() // honor EXIF orientation
            .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 90 })
            .toBuffer();
        return { b64: out.toString("base64"), mime: "image/jpeg" };
    } catch (err) {
        logger.warn?.("kyc-ocr:preprocess_skipped", { error: err instanceof Error ? err.message : String(err) });
        const safeMime = mimeType && mimeType.startsWith("image/") ? mimeType : "image/jpeg";
        return { b64: bytes.toString("base64"), mime: safeMime };
    }
}

/**
 * Send a KYC image to the local LLM and extract KTP fields.
 * Throws on transport/HTTP/timeout/parse failure so the caller can retry.
 */
export async function extractKtpFromImage(bytes: Buffer, mimeType: string): Promise<KtpExtraction> {
    const config = getOcrConfig();
    if (!config) throw new Error("OCR endpoint not configured");

    const { b64, mime } = await preprocessImage(bytes, mimeType, config.maxDim);

    const body = {
        model: config.model,
        temperature: 0,
        max_tokens: config.maxTokens,
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: EXTRACTION_PROMPT },
                    { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
                ],
            },
        ],
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    let res: Response;
    try {
        res = await fetch(config.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
    } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
            throw new Error(`OCR request timed out after ${config.timeoutMs}ms`);
        }
        throw new Error(`OCR request failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
        clearTimeout(timer);
    }

    if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`OCR endpoint HTTP ${res.status}: ${detail.slice(0, 200)}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = stripToJson(content) as Record<string, unknown> | null;
    if (!parsed) {
        throw new Error("OCR response was not parseable JSON");
    }

    const nikDigits = digitsOnly(parsed.nik);
    return {
        isKtp: typeof parsed.is_ktp === "boolean" ? parsed.is_ktp : null,
        nik: nikDigits.length ? nikDigits : null,
        nama: asTrimmedString(parsed.nama),
        ttl: [asTrimmedString(parsed.tempat_lahir), asTrimmedString(parsed.tanggal_lahir)]
            .filter(Boolean)
            .join(", ") || null,
    };
}

/** Levenshtein edit distance (small strings; iterative two-row). */
export function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    let curr = new Array<number>(b.length + 1);
    for (let i = 1; i <= a.length; i++) {
        curr[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        }
        [prev, curr] = [curr, prev];
    }
    return prev[b.length];
}

/** Compare the seller-typed NIK against the OCR-read NIK. */
export function crossCheckNik(typedNik: string, ocrNik: string | null): NikCrossCheck {
    const typed = digitsOnly(typedNik);
    const ocr = digitsOnly(ocrNik);
    if (ocr.length !== 16) return { nikVerdict: "unreadable", nikDistance: null };
    const distance = levenshtein(typed, ocr);
    if (distance === 0) return { nikVerdict: "match", nikDistance: 0 };
    if (distance <= NEAR_MAX_DISTANCE) return { nikVerdict: "near", nikDistance: distance };
    return { nikVerdict: "mismatch", nikDistance: distance };
}
