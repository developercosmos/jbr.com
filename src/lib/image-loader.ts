/**
 * TECH-04: Custom image loader.
 *
 * When NEXT_PUBLIC_IMAGE_CDN is set (e.g. https://images.jualbeliraket.com),
 * route requests through that CDN with width + quality params. Otherwise
 * fall back to Next.js's built-in /_next/image optimizer.
 *
 * Cloudflare Images example:
 *   NEXT_PUBLIC_IMAGE_CDN=https://imagedelivery.net/<account-hash>
 *   path becomes <CDN>/<image-path>/w=<width>,q=<quality>,f=auto
 *
 * Generic CDN example:
 *   NEXT_PUBLIC_IMAGE_CDN=https://cdn.example.com
 *   path becomes <CDN>/<image-path>?w=<width>&q=<quality>
 */
import type { ImageLoaderProps } from "next/image";

const CDN_BASE = process.env.NEXT_PUBLIC_IMAGE_CDN;
const CDN_FORMAT = process.env.NEXT_PUBLIC_IMAGE_CDN_FORMAT ?? "querystring"; // "cloudflare" | "querystring"

export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
    if (!CDN_BASE) {
        // Fall back to Next.js default optimizer.
        const params = new URLSearchParams({ url: src, w: String(width), q: String(quality ?? 75) });
        return `/_next/image?${params.toString()}`;
    }

    const cleanSrc = src.startsWith("/") ? src.slice(1) : src;
    const q = quality ?? 75;

    if (CDN_FORMAT === "cloudflare") {
        return `${CDN_BASE.replace(/\/$/, "")}/${cleanSrc}/w=${width},q=${q},f=auto`;
    }
    const params = new URLSearchParams({ w: String(width), q: String(q) });
    return `${CDN_BASE.replace(/\/$/, "")}/${cleanSrc}?${params.toString()}`;
}
