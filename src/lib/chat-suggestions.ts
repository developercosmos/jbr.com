/**
 * DIF-12: Smart question suggester for chat-to-seller flow from PDP.
 *
 * Each category maps to 3 short questions. When the buyer opens chat from
 * PDP, the UI renders 3 chips; clicking a chip pre-fills + sends the message.
 *
 * Keep questions:
 *   - In Bahasa Indonesia, casual register.
 *   - Specific enough to elicit a useful seller response (not generic).
 *   - Under 80 chars to fit nicely as a chip.
 */

export interface SuggestionContext {
    categorySlug?: string | null;
    productTitle?: string | null;
}

const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
    raket: [
        "Berapa berat aktual raket ini (gram)?",
        "Tegangan senar saat ini berapa lbs?",
        "Ada bekas tabrakan atau retak rambut?",
    ],
    "raket-badminton": [
        "Berapa berat aktual raket ini (gram)?",
        "Tegangan senar saat ini berapa lbs?",
        "Ada bekas tabrakan atau retak rambut?",
    ],
    sepatu: [
        "Berapa ukuran asli sepatu ini?",
        "Sole masih original atau sudah ganti?",
        "Sudah berapa kali dipakai?",
    ],
    "sepatu-badminton": [
        "Berapa ukuran asli sepatu ini?",
        "Sole masih original atau sudah ganti?",
        "Sudah berapa kali dipakai?",
    ],
    senar: [
        "Sisa senar berapa meter?",
        "Jenis dan tipe senar apa?",
        "Tahun produksi senar ini?",
    ],
    grip: [
        "Berapa stok grip yang tersedia?",
        "Ukuran grip yang dijual?",
        "Aslinya satu paket berapa pcs?",
    ],
    tas: [
        "Berapa kapasitas raket yang muat?",
        "Ada kerusakan zipper atau strap?",
        "Bahan luar masih bagus?",
    ],
};

const FALLBACK_SUGGESTIONS = [
    "Apakah barang ini masih tersedia?",
    "Bisa lihat foto tambahan kondisi barang?",
    "Apakah harga masih bisa nego?",
];

/**
 * Returns up to 3 suggested questions. If categorySlug is unknown, falls back
 * to the generic set so we never render an empty suggester.
 */
export function getChatSuggestions(ctx: SuggestionContext): string[] {
    const slug = (ctx.categorySlug ?? "").toLowerCase().trim();
    const direct = CATEGORY_SUGGESTIONS[slug];
    if (direct?.length) return direct.slice(0, 3);

    // Loose match: try first segment (e.g., "raket-yonex-arc" → "raket").
    const head = slug.split(/[-_/]/)[0];
    if (head && CATEGORY_SUGGESTIONS[head]) {
        return CATEGORY_SUGGESTIONS[head].slice(0, 3);
    }

    return FALLBACK_SUGGESTIONS.slice(0, 3);
}
