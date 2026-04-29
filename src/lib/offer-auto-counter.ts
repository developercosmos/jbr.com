export interface AutoCounterInput {
    offerAmount: number;
    floorPrice: number | null;
}

export function shouldTriggerAutoCounter(input: AutoCounterInput): boolean {
    if (!input.floorPrice || input.floorPrice <= 0) return false;
    if (!Number.isFinite(input.offerAmount) || input.offerAmount <= 0) return false;
    return input.offerAmount < input.floorPrice;
}

export function computeAutoCounterAmount(input: { offerAmount: number; floorPrice: number }): number {
    const midpoint = (input.offerAmount + input.floorPrice) / 2;
    return Math.max(1, Math.round(midpoint));
}
