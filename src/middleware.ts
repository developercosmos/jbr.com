import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Suspicious patterns in request paths/query strings
const SUSPICIOUS_PATTERNS = [
    /(\.|%2e)(\.|%2e)(\/|%2f)/i, // Path traversal
    /<script[^>]*>/i, // XSS attempts
    /javascript:/i, // JavaScript injection
    /on\w+\s*=/i, // Event handler injection
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

// Rate limiting state (in-memory, resets on server restart)
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 300; // requests per window (tripled for normal browsing)

export function middleware(request: NextRequest) {
    const { pathname, search } = request.nextUrl;
    const userAgent = request.headers.get("user-agent") || "";
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ||
        request.headers.get("x-real-ip") ||
        "unknown";

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

    // 3. Simple in-memory rate limiting (backup to nginx)
    const now = Date.now();
    const ipData = ipRequestCounts.get(ip);

    if (ipData) {
        if (now > ipData.resetTime) {
            // Reset window
            ipRequestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        } else if (ipData.count >= RATE_LIMIT_MAX_REQUESTS) {
            // Rate limited
            return new NextResponse("Too Many Requests", {
                status: 429,
                headers: { "Retry-After": "60" }
            });
        } else {
            ipData.count++;
        }
    } else {
        ipRequestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    }

    // 4. Add security headers that aren't set by nginx (defense in depth)
    const response = NextResponse.next();

    // Prevent caching of sensitive pages
    if (pathname.startsWith("/profile") || pathname.startsWith("/seller") || pathname.startsWith("/admin")) {
        response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
        response.headers.set("Pragma", "no-cache");
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
