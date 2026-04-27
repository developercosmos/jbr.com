export function normalizeStoreSlug(input: string) {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

export function canAccessSellerCenter(status: string | null | undefined) {
    return status === "ACTIVE" || status === "VACATION" || status === "PENDING_REVIEW";
}