import { requireAdminFinanceReader } from "@/lib/admin-finance";
import { verifyGlIntegrity } from "@/actions/accounting/verify";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    await requireAdminFinanceReader();
    const url = new URL(req.url);
    const includeRecon = url.searchParams.get("recon") !== "0";
    const report = await verifyGlIntegrity({ includeReconciliation: includeRecon });
    return new Response(JSON.stringify(report, null, 2), {
        status: report.passed ? 200 : 422,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
}
