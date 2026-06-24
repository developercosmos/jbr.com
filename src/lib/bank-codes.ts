/**
 * Map a free-text Indonesian bank name (as collected in KYC) to a Xendit
 * disbursement bank_code. Returns null when it can't be resolved — the caller
 * must block the payout rather than guess.
 */
const BANK_CODE_MAP: Record<string, string> = {
    bca: "BCA",
    "bank central asia": "BCA",
    bni: "BNI",
    "bank negara indonesia": "BNI",
    bri: "BRI",
    "bank rakyat indonesia": "BRI",
    mandiri: "MANDIRI",
    "bank mandiri": "MANDIRI",
    cimb: "CIMB",
    "cimb niaga": "CIMB",
    "bank cimb niaga": "CIMB",
    permata: "PERMATA",
    "bank permata": "PERMATA",
    danamon: "DANAMON",
    "bank danamon": "DANAMON",
    btn: "BTN",
    "bank tabungan negara": "BTN",
    bsi: "BSI",
    "bank syariah indonesia": "BSI",
    mega: "MEGA",
    "bank mega": "MEGA",
    panin: "PANIN",
    ocbc: "OCBC",
    "ocbc nisp": "OCBC",
    maybank: "MAYBANK",
    btpn: "BTPN",
    jenius: "BTPN",
    jago: "JAGO",
    "bank jago": "JAGO",
    seabank: "SEABANK",
    "bank neo commerce": "BNC",
    bnc: "BNC",
    "bank jago syariah": "JAGO",
    sinarmas: "SINARMAS",
    bukopin: "BUKOPIN",
};

export function resolveBankCode(bankName: string | null | undefined): string | null {
    if (!bankName) return null;
    const key = bankName.trim().toLowerCase();
    if (BANK_CODE_MAP[key]) return BANK_CODE_MAP[key];
    // Accept the value if it is already a known Xendit code (e.g. user typed "BCA").
    const upper = bankName.trim().toUpperCase();
    if (new Set(Object.values(BANK_CODE_MAP)).has(upper)) return upper;
    return null;
}
