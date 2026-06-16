/**
 * Sport groups for "Browse by Sport" and the product `sport` attribute.
 * Single source of truth for the enum values, display labels and ordering used
 * by the product form, the search filter, and the homepage sport chips.
 */
export const SPORT_VALUES = [
    "PADEL",
    "PICKLEBALL",
    "TENNIS",
    "BADMINTON",
    "SQUASH",
    "SEPAK_BOLA",
    "OTHERS",
    "FASHION",
] as const;

export type Sport = (typeof SPORT_VALUES)[number];

export const SPORT_LABELS: Record<Sport, string> = {
    PADEL: "Padel",
    PICKLEBALL: "Pickleball",
    TENNIS: "Tennis",
    BADMINTON: "Badminton",
    SQUASH: "Squash",
    SEPAK_BOLA: "Sepak Bola",
    OTHERS: "Others",
    FASHION: "Fashion & Accessories",
};

/** URL slug per sport (lowercase enum value), used in /search?sport=<slug>. */
export const SPORT_SLUGS: Record<Sport, string> = {
    PADEL: "padel",
    PICKLEBALL: "pickleball",
    TENNIS: "tennis",
    BADMINTON: "badminton",
    SQUASH: "squash",
    SEPAK_BOLA: "sepak-bola",
    OTHERS: "others",
    FASHION: "fashion",
};

const SLUG_TO_SPORT: Record<string, Sport> = Object.fromEntries(
    SPORT_VALUES.map((s) => [SPORT_SLUGS[s], s])
) as Record<string, Sport>;

/** Resolve a URL ?sport= slug (e.g. "sepak-bola") back to the enum value. */
export function sportFromSlug(slug: string | undefined | null): Sport | undefined {
    if (!slug) return undefined;
    return SLUG_TO_SPORT[slug.trim().toLowerCase()];
}

export function isSport(value: unknown): value is Sport {
    return typeof value === "string" && (SPORT_VALUES as readonly string[]).includes(value);
}
