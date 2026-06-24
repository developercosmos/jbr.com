/**
 * Xendit Disbursement client (money-OUT to seller bank accounts). Reuses the same
 * Xendit secret key resolution as inbound payments (env → integration_settings),
 * and sends an idempotency key so a retried approval never double-pays.
 */
import { getIntegrationCredentials } from "@/lib/integration-settings";

const XENDIT_API_URL = process.env.XENDIT_API_URL?.trim() || "https://api.xendit.co";

async function getXenditKey(): Promise<string | null> {
    if (process.env.XENDIT_SECRET_KEY?.trim()) return process.env.XENDIT_SECRET_KEY.trim();
    const creds = await getIntegrationCredentials("xendit");
    return creds?.api_key?.trim() || null;
}

export type DisbursementResult = { id: string; status: string };

/**
 * `ambiguous` = the request MAY have created a disbursement (timeout / network /
 * 5xx). The caller must NOT release the reservation in that case — only the
 * webhook (or a status check) may resolve it. `ambiguous=false` = the request was
 * rejected before any transfer (4xx / misconfig), so failing is safe.
 */
export class DisbursementError extends Error {
    constructor(message: string, public readonly ambiguous: boolean) {
        super(message);
        this.name = "DisbursementError";
    }
}

const DISBURSE_TIMEOUT_MS = 30_000;

/** Create a Xendit disbursement. Throws DisbursementError on failure. */
export async function createXenditDisbursement(input: {
    externalId: string;
    bankCode: string;
    accountHolderName: string;
    accountNumber: string;
    amount: number;
    description: string;
}): Promise<DisbursementResult> {
    const key = await getXenditKey();
    if (!key) throw new DisbursementError("Xendit belum dikonfigurasi (API key tidak tersedia).", false);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DISBURSE_TIMEOUT_MS);
    let res: Response;
    try {
        res = await fetch(`${XENDIT_API_URL}/disbursements`, {
            method: "POST",
            headers: {
                Authorization: `Basic ${Buffer.from(key + ":").toString("base64")}`,
                "Content-Type": "application/json",
                // Idempotency: Xendit dedupes on this key, so a retried approval is safe.
                "X-IDEMPOTENCY-KEY": input.externalId,
            },
            body: JSON.stringify({
                external_id: input.externalId,
                bank_code: input.bankCode,
                account_holder_name: input.accountHolderName,
                account_number: input.accountNumber,
                description: input.description,
                amount: Math.round(input.amount),
            }),
            signal: controller.signal,
        });
    } catch (e) {
        // Network error or timeout (abort): the transfer MAY have been submitted.
        throw new DisbursementError(
            `Koneksi ke Xendit gagal/timeout: ${e instanceof Error ? e.message : "unknown"}`,
            true,
        );
    } finally {
        clearTimeout(timer);
    }

    const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        status?: string;
        message?: string;
        error_code?: string;
    };
    if (!res.ok) {
        // 5xx → server-side uncertainty (money state unknown) → ambiguous.
        // 4xx → request rejected before any transfer → definitive (safe to fail).
        const msg = data.message || data.error_code || `Xendit disbursement gagal (HTTP ${res.status})`;
        throw new DisbursementError(typeof msg === "string" ? msg : "Xendit disbursement gagal", res.status >= 500);
    }
    return { id: String(data.id ?? ""), status: String(data.status ?? "PENDING") };
}
