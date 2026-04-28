import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), microphone=(), camera=(), payment=(self)",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Server Actions default to a 1MB body cap which is too small for KYC
  // document uploads (KTP/selfie/business doc — up to 8MB each).
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
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

export default nextConfig;
