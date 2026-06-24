/**
 * Xendit Disbursement client (money-OUT to seller bank accounts). Reuses the same
 * Xendit secret key resolution as inbound payments (env → integration_settings),
 * and sends an idempotency key so a retried approval never double-pays.
 */
import { getIntegrationCredentials } from "@/actions/settings";

const XENDIT_API_URL = process.env.XENDIT_API_URL?.trim() || "https://api.xendit.co";

async function getXenditKey(): Promise<string | null> {
    if (process.env.XENDIT_SECRET_KEY?.trim()) return process.env.XENDIT_SECRET_KEY.trim();
    const creds = await getIntegrationCredentials("xendit");
    return creds?.api_key?.trim() || null;
}

export type DisbursementResult = { id: string; status: string };

/** Create a Xendit disbursement. Throws on misconfig / API error (caller handles). */
export async function createXenditDisbursement(input: {
    externalId: string;
    bankCode: string;
    accountHolderName: string;
    accountNumber: string;
    amount: number;
    description: string;
}): Promise<DisbursementResult> {
    const key = await getXenditKey();
    if (!key) throw new Error("Xendit belum dikonfigurasi (API key tidak tersedia).");

    const res = await fetch(`${XENDIT_API_URL}/disbursements`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${Buffer.from(key + ":").toString("base64")}`,
            "Content-Type": "application/json",
            // Idempotency: Xendit dedupes on this key, so a re-approval is safe.
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
    });

    const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        status?: string;
        message?: string;
        error_code?: string;
    };
    if (!res.ok) {
        const msg = data.message || data.error_code || `Xendit disbursement gagal (HTTP ${res.status})`;
        throw new Error(typeof msg === "string" ? msg : "Xendit disbursement gagal");
    }
    return { id: String(data.id ?? ""), status: String(data.status ?? "PENDING") };
}
