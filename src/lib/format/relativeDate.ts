const DAY_MS = 24 * 60 * 60 * 1000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function toWibDayNumber(value: Date): number {
    return Math.floor((value.getTime() + WIB_OFFSET_MS) / DAY_MS);
}

/**
 * Formats a seller join date label in Indonesian locale with WIB day boundary
 * semantics to avoid off-by-one output near midnight UTC.
 */
export function formatSellerJoinRelativeDate(
    value: string | Date | null | undefined,
    nowInput?: Date
): string | null {
    if (!value) return null;

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const now = nowInput ?? new Date();
    const days = toWibDayNumber(now) - toWibDayNumber(date);
    if (!Number.isFinite(days) || days < 0) return null;

    const clampedDays = Math.max(1, days);
    if (clampedDays < 30) return `Bergabung ${clampedDays} hari lalu`;

    const months = Math.floor(clampedDays / 30);
    if (months < 12) return `Bergabung ${months} bulan lalu`;

    return `Bergabung ${Math.floor(months / 12)} tahun lalu`;
}
