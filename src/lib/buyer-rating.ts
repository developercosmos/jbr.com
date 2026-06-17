/**
 * Shared 1–5 scale for the seller-rates-buyer "interaction rating" (offer/chat/
 * order contexts). Keeps the legend identical across every surface so sellers
 * always know what each number means.
 */
export const BUYER_RATING_OPTIONS: ReadonlyArray<{ value: number; label: string; short: string }> = [
    { value: 1, label: "1 — Sangat buruk", short: "Sangat buruk" },
    { value: 2, label: "2 — Buruk", short: "Buruk" },
    { value: 3, label: "3 — Cukup", short: "Cukup" },
    { value: 4, label: "4 — Baik", short: "Baik" },
    { value: 5, label: "5 — Sangat baik", short: "Sangat baik" },
];

/** One-line helper shown next to the rating control. */
export const BUYER_RATING_HELP =
    "Nilai keseriusan, kesopanan & responsivitas calon buyer — 1 = sangat buruk, 5 = sangat baik. Ikut menentukan reputasi buyer.";
