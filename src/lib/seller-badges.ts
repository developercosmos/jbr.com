export type SellerBadgeType = "verified" | "topSeller" | "fastResponse" | "trusted";

export function getSellerBadgeTypes(input: {
    verified: boolean;
    responseTimeMinutes: number;
    avgRating: number;
    ratingCount: number;
    completionRate: number;
    sellerJoinedAt?: string | Date | null;
}): SellerBadgeType[] {
    const badges: SellerBadgeType[] = [];

    if (input.verified) badges.push("verified");
    if (input.responseTimeMinutes > 0 && input.responseTimeMinutes <= 30) badges.push("fastResponse");
    if (input.avgRating >= 4.8 && input.ratingCount >= 20) badges.push("topSeller");

    const joinedAt = input.sellerJoinedAt ? new Date(input.sellerJoinedAt) : null;
    const veteran = joinedAt ? Date.now() - joinedAt.getTime() >= 2 * 365 * 24 * 60 * 60 * 1000 : false;
    if (input.completionRate >= 95 || veteran) badges.push("trusted");

    return badges.slice(0, 3);
}