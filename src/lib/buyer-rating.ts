/**
 * Shared 1–5 scale for the seller-rates-buyer "interaction rating" (offer/chat/
 * order contexts). One source of truth so the legend is identical everywhere.
 */
export interface BuyerRatingLevel {
    value: number;
    /** Indonesian persona name, e.g. "Pembeli Ideal". */
    title: string;
    /** English persona, e.g. "Excellent Buyer". */
    english: string;
    /** What earns this rating. */
    description: string;
}

/** Ascending 1 → 5. */
export const BUYER_RATING_LEVELS: BuyerRatingLevel[] = [
    {
        value: 1,
        title: "Pembeli Hit & Run",
        english: "Bad/Toxic Buyer",
        description:
            "Pembeli sudah sepakat harga tawar tetapi menghilang (ghosting), membatalkan pesanan sepihak, atau memberikan ulasan buruk ke penjual padahal salah sendiri.",
    },
    {
        value: 2,
        title: "Pembeli Bermasalah",
        english: "Difficult Buyer",
        description:
            "Pembeli menawar terlalu afgan (sadis), banyak menuntut di luar deskripsi barang, atau sengaja menunda pembayaran tanpa alasan.",
    },
    {
        value: 3,
        title: "Pembeli Standar",
        english: "Fair Buyer",
        description:
            "Pembeli cenderung pasif, lambat membalas chat, atau baru membayar mendekati batas waktu pembatalan otomatis.",
    },
    {
        value: 4,
        title: "Pembeli Baik",
        english: "Good Buyer",
        description:
            "Proses tawar-menawar lancar dan pembayaran dilakukan tepat waktu, meskipun komunikasi tergolong minim.",
    },
    {
        value: 5,
        title: "Pembeli Ideal",
        english: "Excellent Buyer",
        description:
            "Pembeli sangat ramah, negosiasi sopan, langsung bayar setelah sepakat harga, dan cepat konfirmasi terima barang.",
    },
];

/** Options for a <select> (value + "1 — Pembeli Hit & Run" label + short title). */
export const BUYER_RATING_OPTIONS = BUYER_RATING_LEVELS.map((l) => ({
    value: l.value,
    label: `${l.value} — ${l.title}`,
    short: l.title,
}));

/** One-line helper shown next to the rating control. */
export const BUYER_RATING_HELP =
    "Skala 1–5: 1 = Pembeli Hit & Run (toxic), 5 = Pembeli Ideal. Ikut menentukan reputasi buyer.";
