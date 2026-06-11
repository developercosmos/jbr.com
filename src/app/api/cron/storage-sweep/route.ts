import { NextRequest, NextResponse } from "next/server";
import { runStorageSweep } from "@/lib/storage-sweep";

export const dynamic = "force-dynamic";

// Orphan-upload sweep. Dry-run by default; pass ?execute=1 to delete.
// Schedule weekly (deletion guarded by a 48h min-age for in-flight forms):
//   0 20 * * 6  /usr/bin/flock -n /tmp/jbr-storage-sweep.lock /var/www/jbr/scripts/jbr-storage-sweep.sh
function isAuthorized(request: NextRequest): boolean {
    const expected = process.env.CRON_SECRET;
    if (!expected) return false; // fail-closed
    const header = request.headers.get("authorization") || "";
    const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
    return provided === expected;
}

const LIST_LIMIT = 300;

export async function POST(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const params = request.nextUrl.searchParams;
        const execute = params.get("execute") === "1";
        const minAgeHours = Number(params.get("minAgeHours")) || undefined;

        const report = await runStorageSweep({ execute, minAgeHours });
        console.log(
            `[storage-sweep] execute=${report.execute} refs=${report.refPaths} scanned=${report.scannedFiles} ` +
            `orphans=${report.orphans.length} (${Math.round(report.orphanBytes / 1024)} KB) ` +
            `deleted=${report.deletedFiles} (${Math.round(report.deletedBytes / 1024)} KB) errors=${report.errors.length}`
        );
        return NextResponse.json({
            ...report,
            orphans: report.orphans.slice(0, LIST_LIMIT),
            tooNew: report.tooNew.slice(0, LIST_LIMIT),
            orphansTruncated: Math.max(0, report.orphans.length - LIST_LIMIT),
            tooNewTruncated: Math.max(0, report.tooNew.length - LIST_LIMIT),
        });
    } catch (error) {
        console.error("[storage-sweep] failed:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Sweep failed" },
            { status: 500 }
        );
    }
}
