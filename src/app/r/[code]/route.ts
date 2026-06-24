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
// Public origin for the stored landing_url (analytics only). The redirect itself
// uses a RELATIVE Location, so it never depends on this being set/correct.
const PUBLIC_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

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

// Strip ASCII control chars (code <= 0x1F or 0x7F). Browsers strip tab/newline before
// parsing a URL, so a value like "/<TAB>//evil.com" could otherwise smuggle a
// protocol-relative "//evil.com" past a naive prefix check. Done via charCode (no
// literal control chars in source).
function stripControlChars(s: string): string {
    let out = "";
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (c > 0x1f && c !== 0x7f) out += s[i];
    }
    return out;
}

/**
 * Open-redirect guard: only allow a same-origin RELATIVE path. After stripping
 * control chars, require a single leading "/" that is not "//" (protocol-relative)
 * nor "/\" (backslash trick). Anything else → home. The returned value is emitted as
 * a relative Location, so the redirect can never leave our origin.
 */
function safeTarget(to: string | null): string {
    if (!to) return "/";
    const cleaned = stripControlChars(to);
    if (!cleaned.startsWith("/") || cleaned.startsWith("//") || cleaned.startsWith("/\\")) return "/";
    return cleaned;
}

/**
 * Affiliate referral redirect: GET /r/<code>[?to=/relative/path]
 * Records ONE click (deduped server-side), sets the last-click attribution cookie
 * for a valid ACTIVE code, then 302-redirects to the same-origin target.
 *
 * The Location is RELATIVE on purpose: the app binds 0.0.0.0:3000 behind the
 * Cloudflare→nginx proxy, so req.nextUrl.origin is the internal host. A relative
 * Location lets the browser resolve against the public request URL instead.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    const { code: raw } = await params;
    // Codes are generated lowercase; normalize so /r/MyCode still attributes.
    const code = (raw || "").trim().toLowerCase();
    const target = safeTarget(req.nextUrl.searchParams.get("to"));

    const res = new NextResponse(null, { status: 302, headers: { Location: target } });

    // Malformed code → still redirect the visitor, but record/attribute nothing.
    if (!CODE_RE.test(code)) return res;

    try {
        const result = await recordAffiliateClick(
            {
                code,
                referrer: req.headers.get("referer") ?? undefined,
                landingUrl: `${PUBLIC_ORIGIN}${target}`,
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
