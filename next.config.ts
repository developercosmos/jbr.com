import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// nginx sets the edge security headers for ALL responses (X-Frame-Options,
// X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS), so setting them
// here too only duplicated the header line. They are removed; X-DNS-Prefetch-Control
// (which nginx does not set) stays. CSP is set per-request by the app middleware.
const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Type errors fail the build. The prior Drizzle relation typing regressions were
  // resolved (`tsc --noEmit` is clean and `next build` passes the type+route-validator
  // step). Keep this false so type safety is a real launch gate — do not re-enable to
  // paper over errors.
  typescript: {
    ignoreBuildErrors: false,
  },
  // Server Actions default to a 1MB body cap which is too small for KYC
  // document uploads (KTP/selfie/business doc — up to 8MB each).
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // PERF: rewrite barrel imports (icons, sentry) to per-module imports so a single
    // used icon doesn't pull the whole set into the client bundle.
    optimizePackageImports: [
      "lucide-react",
      "react-icons/fa",
      "react-icons/gi",
      "react-icons/io5",
      "react-icons/tb",
      "@sentry/nextjs",
    ],
  },
  images: {
    // TECH-04: image pipeline. Next/Image handles on-demand resize and format
    // conversion (WebP/AVIF) automatically. Allowed remote sources below; CDN
    // (e.g. Cloudflare Images) can be wired by setting NEXT_PUBLIC_IMAGE_CDN
    // and adding an `imageLoader` here when the CDN is provisioned.
    formats: ["image/avif", "image/webp"],
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1600, 1920],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "jualbeliraket.com",
      },
      {
        protocol: "https",
        hostname: "**.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "**.utfs.io",
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // Disable x-powered-by header (security best practice)
  poweredByHeader: false,
};

// Wrap with Sentry. Source-map upload only happens when SENTRY_AUTH_TOKEN/org/project
// are set (CI/prod); otherwise this gracefully degrades to a no-op so local builds
// and builds without Sentry credentials are unaffected. Runtime error capture is
// driven by instrumentation.ts / instrumentation-client.ts regardless.
export default withSentryConfig(nextConfig, {
    silent: !process.env.CI,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    disableLogger: true,
});
