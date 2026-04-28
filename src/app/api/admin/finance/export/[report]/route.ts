import { NextRequest } from "next/server";
import { requireAdminFinanceReader } from "@/lib/admin-finance";
import {
    getTrialBalance,
    getProfitLoss,
    getBalanceSheet,
    getGlForAccount,
    getCashFlow,
    type ProfitLossSection,
} from "@/actions/accounting/reports";
import { csvResponse, rowsToCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

function parseDate(s: string | null, endOfDay = false): Date | undefined {
    if (!s) return undefined;
    const iso = endOfDay ? `${s}T23:59:59` : s;
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d : undefined;
}

function bookOf(req: NextRequest): "PLATFORM" | "SELLER" {
    return req.nextUrl.searchParams.get("book") === "SELLER" ? "SELLER" : "PLATFORM";
}

export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ report: string }> }
) {
    await requireAdminFinanceReader();
    const { report } = await ctx.params;
    const sp = req.nextUrl.searchParams;
    const book = bookOf(req);
    const stamp = new Date().toISOString().slice(0, 10);

    if (report === "trial-balance") {
        const tb = await getTrialBalance({
            from: parseDate(sp.get("from")),
            to: parseDate(sp.get("to"), true),
            book,
        });
        const csv = rowsToCsv(
            ["code", "name", "class", "normal_balance", "debit", "credit", "balance"],
            tb.rows.map((r) => [r.code, r.name, r.class, r.normalBalance, r.debit, r.credit, r.balance])
        );
        return csvResponse(`trial-balance_${book}_${stamp}.csv`, csv);
    }

    if (report === "profit-loss") {
        const pl = await getProfitLoss({
            from: parseDate(sp.get("from")),
            to: parseDate(sp.get("to"), true),
            book,
        });
        const flat: (string | number)[][] = [];
        const push = (s: ProfitLossSection) => {
            for (const r of s.rows) flat.push([s.label, r.code, r.name, r.balance]);
            flat.push([s.label, "", `SUBTOTAL ${s.label}`, s.subtotal]);
        };
        push(pl.revenue);
        push(pl.contraRevenue);
        push(pl.cogs);
        flat.push(["Laba Kotor", "", "", pl.grossProfit]);
        push(pl.opex);
        flat.push(["Laba Operasi", "", "", pl.operatingProfit]);
        push(pl.otherIncome);
        push(pl.otherExpense);
        flat.push(["Laba Sebelum Pajak", "", "", pl.profitBeforeTax]);
        push(pl.taxExpense);
        flat.push(["Laba Bersih", "", "", pl.netProfit]);
        const csv = rowsToCsv(["section", "code", "name", "amount"], flat);
        return csvResponse(`profit-loss_${book}_${stamp}.csv`, csv);
    }

    if (report === "balance-sheet") {
        const bs = await getBalanceSheet({
            asOf: parseDate(sp.get("asOf"), true) ?? new Date(),
            book,
        });
        const flat: (string | number)[][] = [];
        const push = (s: ProfitLossSection) => {
            for (const r of s.rows) flat.push([s.label, r.code, r.name, r.balance]);
            flat.push([s.label, "", `SUBTOTAL ${s.label}`, s.subtotal]);
        };
        push(bs.assets);
        push(bs.liabilities);
        push(bs.equity);
        flat.push(["Ekuitas", "", "Laba Ditahan YTD", bs.retainedEarningsYtd]);
        flat.push(["Ringkasan", "", "Total Aset", bs.assets.subtotal]);
        flat.push(["Ringkasan", "", "Total Liabilitas + Ekuitas", bs.totalLiabilitiesAndEquity]);
        const csv = rowsToCsv(["section", "code", "name", "amount"], flat);
        return csvResponse(`balance-sheet_${book}_${stamp}.csv`, csv);
    }

    if (report === "general-ledger") {
        const account = sp.get("account");
        if (!account) return new Response("missing account", { status: 400 });
        const gl = await getGlForAccount({
            accountCode: account,
            from: parseDate(sp.get("from")),
            to: parseDate(sp.get("to"), true),
            book,
        });
        if (!gl.account) return new Response("account not found", { status: 404 });
        const flat: (string | number)[][] = [
            ["", "", "OPENING", "", "", "", gl.openingBalance],
            ...gl.rows.map((r) => [
                r.postedAt,
                r.journalNo,
                r.description,
                r.refType ?? "",
                r.debit,
                r.credit,
                r.runningBalance,
            ]),
            ["", "", "CLOSING", "", "", "", gl.closingBalance],
        ];
        const csv = rowsToCsv(
            ["posted_at", "journal_no", "description", "ref", "debit", "credit", "running_balance"],
            flat
        );
        return csvResponse(`gl_${gl.account.code}_${book}_${stamp}.csv`, csv);
    }

    if (report === "cash-flow") {
        const cf = await getCashFlow({
            from: parseDate(sp.get("from")),
            to: parseDate(sp.get("to"), true),
            book,
        });
        const flat: (string | number)[][] = [];
        for (const s of cf.sections) {
            for (const l of s.lines) flat.push([s.section, l.bucket, l.inflow, l.outflow, l.net]);
            flat.push([s.section, `SUBTOTAL ${s.label}`, s.inflow, s.outflow, s.net]);
        }
        flat.push(["", "NET CASH CHANGE", "", "", cf.netCashChange]);
        flat.push(["", "OPENING CASH", "", "", cf.openingCash]);
        flat.push(["", "CLOSING CASH", "", "", cf.closingCash]);
        const csv = rowsToCsv(["section", "bucket", "inflow", "outflow", "net"], flat);
        return csvResponse(`cash-flow_${book}_${stamp}.csv`, csv);
    }

    return new Response("unknown report", { status: 404 });
}
