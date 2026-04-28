/** Indonesian currency formatter (IDR). */
export function formatIdr(n: number, opts?: { withSign?: boolean }): string {
    const sign = opts?.withSign && n > 0 ? "+" : "";
    return (
        sign +
        new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(n)
    );
}

export function formatIdrShort(n: number): string {
    return new Intl.NumberFormat("id-ID", {
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(n);
}
