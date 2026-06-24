import { NextRequest, NextResponse } from "next/server";
import { recordAffiliateClick } from "@/actions/affiliate";
import { INTERNAL_CALL_TOKEN } from "@/lib/internal-guard";
import { logger } from "@/lib/logger";

// Node runtime: recordAffiliateClick touches the DB (not available in edge middleware,
// which is exactly why click recording must live in a route, not in middleware).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same shape the middleware ?ref= capture accepts, so attribution stays consistent.
const CODE_RE = /^[a-zA-Z0-9_-]{3,40}$/;
const ATTRIBUTION_DAYS = Number(process.env.AFFILIATE_ATTRIBUTION_DAYS || 30);

// Trusted edge headers (Cloudflare → nginx overwrite these on ingress). Mirrors
// middleware.getClientIp; the raw x-forwarded-for first hop is client-spoofable so
// it is only used as a local-dev fallback.
function clientIp(req: NextRequest): string | undefined {
    return (
        req.headers.get("cf-connecting-ip")?.trim() ||
        req.headers.get("x-real-ip")?.trim() ||
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        undefined
    );
}

/**
 * Open-redirect guard: only allow a same-origin RELATIVE target (single leading
 * "/", not "//" protocol-relative nor "/\" backslash trick). Anything else → home.
 */
function safeTarget(to: string | null): string {
    if (!to) return "/";
    if (!to.startsWith("/") || to.startsWith("//") || to.startsWith("/\\")) return "/";
    return to;
}

/**
 * Affiliate referral redirect: GET /r/<code>[?to=/relative/path]
 * Records ONE click (deduped server-side), sets the last-click attribution cookie
 * for a valid ACTIVE code, then 302-redirects to the (same-origin) target.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    const { code: raw } = await params;
    // Codes are generated lowercase; normalize so /r/MyCode still attributes.
    const code = (raw || "").trim().toLowerCase();
    const target = safeTarget(req.nextUrl.searchParams.get("to"));
    let dest = new URL(target, req.nextUrl.origin);
    // Defense-in-depth: never redirect off-origin even if safeTarget is bypassed.
    if (dest.origin !== req.nextUrl.origin) dest = new URL("/", req.nextUrl.origin);
    const res = NextResponse.redirect(dest, 302);

    // Malformed code → still redirect the visitor, but record/attribute nothing.
    if (!CODE_RE.test(code)) return res;

    try {
        const result = await recordAffiliateClick(
            {
                code,
                referrer: req.headers.get("referer") ?? undefined,
                landingUrl: dest.toString(),
                ip: clientIp(req),
                userAgent: req.headers.get("user-agent") ?? undefined,
            },
            INTERNAL_CALL_TOKEN,
        );

        // Set the last-click cookie only for a valid ACTIVE code (recordAffiliateClick
        // returns success:false for unknown/inactive codes). Shape matches the
        // middleware ?ref= cookie so tryAttributeOrderFromCookie reads it at checkout.
        if (result.success) {
            res.cookies.set("jbr_aff", code, {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                maxAge: ATTRIBUTION_DAYS * 24 * 60 * 60,
                secure: process.env.NODE_ENV === "production",
            });
        }
    } catch (err) {
        // Tracking is best-effort — never break the visitor's redirect.
        logger.warn("affiliate:click_route_failed", { error: String(err) });
    }

    return res;
}
