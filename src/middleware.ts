import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Suspicious patterns in request paths/query strings
const SUSPICIOUS_PATTERNS = [
    /(\.|%2e)(\.|%2e)(\/|%2f)/i, // Path traversal
    /<script[^>]*>/i, // XSS attempts
    /javascript:/i, // JavaScript injection
    // Event handler injection. Match KNOWN HTML event handlers explicitly so
    // legit query params don't false-positive — the old /on\w+\s*=/ blocked any
    // word with "on"+letters before "=", breaking e.g. ?condition=NEW (the
    // condition filter), ?version=, ?region=, etc.
    /on(error|load|abort|click|dblclick|focus(?:in|out)?|blur|change|input|submit|reset|select|keydown|keypress|keyup|mouse(?:over|out|enter|leave|move|down|up)|pointer(?:over|out|enter|leave|move|down|up)|touch(?:start|end|move|cancel)|drag(?:start|end|enter|leave|over)?|drop|wheel|scroll|resize|toggle|play|playing|pause|ended|canplay|animation(?:start|end|iteration)|transition(?:start|end|run|cancel)|contextmenu|copy|cut|paste|beforeunload|hashchange|popstate|message)\s*=/i, // Event handler injection
    /union\s+select/i, // SQL injection
    /exec\s*\(/i, // Command execution
    /\$\{.*\}/i, // Template injection
];

// Blocked user agents (vulnerability scanners/bots)
const BLOCKED_USER_AGENTS = [
    /nikto/i,
    /sqlmap/i,
    /nmap/i,
    /masscan/i,
    /dirbuster/i,
    /gobuster/i,
    /wpscan/i,
    /havij/i,
    /acunetix/i,
];

// Rate limiting state (in-memory, per-instance).
//
// NOTE ON ARCHITECTURE: this is intentionally an in-memory, best-effort SECOND
// layer. The authoritative distributed rate limiting lives in nginx (`limit_req`
// zones — see deploy.md) which sees all traffic before it reaches any app
// instance. We do NOT use Redis here because Next.js middleware runs in the Edge
// runtime, where a TCP client like ioredis is unavailable. Per-instance counters
// are acceptable for this defense-in-depth layer; nginx provides the global cap.
//
// Each bucket key is `${ip}|${tier}` where tier is one of the configured tiers
// below or "global" for the catch-all browsing budget.
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 300; // global per-IP browsing budget per window

// Endpoint-tier rate limits (per IP per window). Tightest specific match wins.
// These supplement the global limit and are intentionally strict on auth surfaces.
const ENDPOINT_RATE_TIERS: Array<{
    tier: string;
    test: (pathname: string, method: string) => boolean;
    limit: number;
}> = [
        {
            tier: "auth-write",
            test: (p, m) =>
                p.startsWith("/api/auth/") && (m === "POST" || m === "PUT" || m === "DELETE" || m === "PATCH"),
            limit: 10,
        },
        {
            tier: "password-reset",
            test: (p, m) =>
                (p.startsWith("/auth/forgot-password") || p.startsWith("/auth/reset-password")) &&
                (m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE"),
            limit: 5,
        },
        {
            tier: "upload",
            test: (p, m) => (p.startsWith("/api/upload") || p.startsWith("/api/uploadthing")) && m === "POST",
            limit: 30,
        },
        {
            tier: "search",
            test: (p) => p.startsWith("/api/search") || p === "/search",
            limit: 60,
        },
        {
            tier: "messages-write",
            test: (p, m) => (p.startsWith("/api/messages") || p.startsWith("/api/chat")) && m === "POST",
            limit: 30,
        },
        {
            // Affiliate referral redirect /r/<code>: each hit does a DB lookup +
            // (deduped) insert. Cap per-IP so a spammer can't pump click volume /
            // amplify DB load. Generous enough for real human click-throughs.
            tier: "affiliate-click",
            test: (p) => p.startsWith("/r/"),
            limit: 60,
        },
    ];

function getClientIp(request: NextRequest): string | null {
    // Prefer headers set by our trusted edge (Cloudflare → nginx). A client CANNOT
    // forge these because nginx/Cloudflare overwrite them on ingress. The raw
    // `x-forwarded-for` FIRST hop is attacker-controlled (anyone can send
    // `X-Forwarded-For: 1.2.3.4`) so it must NOT be trusted for rate-limit keys —
    // it would let an attacker rotate the key on every request and bypass limits.
    const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
    if (cloudflareIp) {
        return cloudflareIp;
    }

    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) {
        return realIp;
    }

    // Last resort (e.g. local dev with no proxy): take the LEFTMOST XFF entry.
    // In production CF/nginx headers above always win, so this path isn't reachable
    // for untrusted traffic.
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
        const firstIp = forwardedFor.split(",")[0]?.trim();
        if (firstIp) {
            return firstIp;
        }
    }

    return null;
}

function isNextInternalPost(request: NextRequest): boolean {
    // SECURITY: a Server Action POST also carries `Next-Router-State-Tree`, so the
    // generic checks below would wrongly exempt it. Server Actions are user-initiated
    // writes (login, password reset, email, payouts, …) and MUST stay rate-limited —
    // detect them via `Next-Action` and treat as NOT internal.
    if (request.headers.get("Next-Action") !== null) return false;
    // Exempt ONLY framework-driven navigation (RSC payload fetches, prefetches,
    // router-state hydration).
    return (
        request.headers.get("RSC") === "1" ||
        request.headers.get("Next-Router-Prefetch") === "1" ||
        request.headers.get("Next-Router-State-Tree") !== null
    );
}

function shouldApplyGlobalRateLimit(pathname: string, method: string, request: NextRequest): boolean {
    const upperMethod = method.toUpperCase();

    // Better Auth polls this endpoint on focus/refresh to keep client session fresh.
    // Treat it as a low-risk read path so normal browsing does not get 429.
    if (
        upperMethod === "GET" &&
        (pathname === "/api/auth/get-session" || pathname === "/api/auth/session" || pathname === "/api/auth/list-sessions")
    ) {
        return false;
    }

    // Next.js 16 internal POSTs (RSC fetch, prefetch, server actions, router state)
    // are framework-driven, not user-initiated writes — exempt them.
    if (upperMethod === "POST" && isNextInternalPost(request)) {
        return false;
    }

    if (pathname.startsWith("/api/")) {
        return true;
    }

    // Keep write operations protected even outside /api to prevent abuse on server actions.
    return upperMethod !== "GET" && upperMethod !== "HEAD" && upperMethod !== "OPTIONS";
}

function checkRateLimit(key: string, limit: number, now: number): { ok: true } | { ok: false; retryAfter: number } {
    const data = ipRequestCounts.get(key);
    if (!data || now > data.resetTime) {
        ipRequestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return { ok: true };
    }
    if (data.count >= limit) {
        return { ok: false, retryAfter: Math.max(1, Math.ceil((data.resetTime - now) / 1000)) };
    }
    data.count++;
    return { ok: true };
}

export function middleware(request: NextRequest) {
    const { pathname, search } = request.nextUrl;
    const userAgent = request.headers.get("user-agent") || "";
    const ip = getClientIp(request);

    // 1. Block suspicious user agents
    for (const pattern of BLOCKED_USER_AGENTS) {
        if (pattern.test(userAgent)) {
            return new NextResponse("Forbidden", { status: 403 });
        }
    }

    // 2. Check for suspicious patterns in URL
    const fullPath = pathname + search;
    for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(fullPath)) {
            console.warn(`[Security] Blocked suspicious request from ${ip}: ${fullPath}`);
            return new NextResponse("Forbidden", { status: 403 });
        }
    }

    // 3. Endpoint-tier rate limit (TRUST-04): apply tightest matching tier first,
    //    then enforce the global per-IP browsing budget as the last line of defense.
    const now = Date.now();
    const method = request.method.toUpperCase();

    // Next.js 16 framework-internal POSTs (RSC, prefetch, server actions, router
    // state) are exempt from BOTH endpoint-tier and global rate limits. They are
    // framework-driven, not user-initiated traffic.
    const isNextRsc = method === "POST" && isNextInternalPost(request);

    if (!isNextRsc) {
    for (const tier of ENDPOINT_RATE_TIERS) {
        if (tier.test(pathname, method)) {
            const decision = checkRateLimit(`${ip}|${tier.tier}`, tier.limit, now);
            if (!decision.ok) {
                console.warn(`[RateLimit] ${ip} exceeded ${tier.tier} (${tier.limit}/min) on ${method} ${pathname}`);
                return new NextResponse("Too Many Requests", {
                    status: 429,
                    headers: {
                        "Retry-After": String(decision.retryAfter),
                        "X-RateLimit-Tier": tier.tier,
                    },
                });
            }
            break;
        }
    }

    if (ip && shouldApplyGlobalRateLimit(pathname, method, request)) {
        const globalDecision = checkRateLimit(`${ip}|global`, RATE_LIMIT_MAX_REQUESTS, now);
        if (!globalDecision.ok) {
            return new NextResponse("Too Many Requests", {
                status: 429,
                headers: {
                    "Retry-After": String(globalDecision.retryAfter),
                    "X-RateLimit-Tier": "global",
                },
            });
        }
    }
    } // end !isNextRsc

    // 4. CSP nonce (staged rollout). A per-request nonce is generated and placed on
    //    the REQUEST `Content-Security-Policy` header so Next auto-nonces its own
    //    inline bootstrap scripts; the RESPONSE carries it as `*-Report-Only` so the
    //    strict (no unsafe-inline) policy is MONITORED, not enforced — the nginx CSP
    //    (with unsafe-inline) is still the enforced one, so nothing breaks. To finish
    //    the migration: confirm violation reports are clean, then rename the response
    //    header to `Content-Security-Policy` and drop the CSP from nginx.
    const nonce = crypto.randomUUID().replace(/-/g, "");
    const cspNonce = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' https://static.cloudflareinsights.com https://*.cloudflare.com`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https: blob:",
        "media-src 'self' blob:",
        "connect-src 'self' https:",
        "frame-src 'self' https://www.openstreetmap.org",
        "frame-ancestors 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests",
    ].join("; ");

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", cspNonce);

    // Add security headers that aren't set by nginx (defense in depth)
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy-Report-Only", cspNonce);

    // TECH-03: stamp every request with a correlation ID for log tracing.
    const incomingId = request.headers.get("x-request-id");
    const requestId = incomingId && /^[a-zA-Z0-9_-]{4,64}$/.test(incomingId)
        ? incomingId
        : `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    response.headers.set("X-Request-Id", requestId);

    // AFF-02: capture affiliate ref from query into cookie (last-click attribution).
    const refParam = request.nextUrl.searchParams.get("ref");
    if (refParam && /^[a-zA-Z0-9_-]{3,40}$/.test(refParam)) {
        const ttlDays = Number(process.env.AFFILIATE_ATTRIBUTION_DAYS || 30);
        response.cookies.set("jbr_aff", refParam, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge: ttlDays * 24 * 60 * 60,
            secure: process.env.NODE_ENV === "production",
        });
    }

    // Prevent caching of sensitive pages
    if (
        pathname.startsWith("/profile") ||
        pathname.startsWith("/seller") ||
        pathname.startsWith("/admin") ||
        pathname.startsWith("/affiliate")
    ) {
        response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
        response.headers.set("Pragma", "no-cache");
        if (pathname.startsWith("/admin")) {
            response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
        }
    }

    return response;
}

// Only run middleware on specific paths
export const config = {
    matcher: [
        // Skip static files and API routes that handle their own security
        "/((?!_next/static|_next/image|favicon.ico|public/).*)",
    ],
};
