/**
 * GL-26 — CSV export utilities.
 *
 * Pure helpers used by export Route Handlers. No server-only imports here so
 * they are safe to also call from server actions.
 */

export function csvEscape(v: unknown): string {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : v instanceof Date ? v.toISOString() : JSON.stringify(v);
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

export function rowsToCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
    const head = headers.map(csvEscape).join(",");
    const body = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
    return `\uFEFF${head}\r\n${body}\r\n`;
}

export function csvResponse(filename: string, body: string): Response {
    return new Response(body, {
        status: 200,
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
            "Cache-Control": "no-store",
        },
    });
}
