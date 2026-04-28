/**
 * CACHE-03: image variant URL helper.
 *
 * The image_loader.ts module already produces width/quality-aware URLs at
 * render time via next/image. This helper persists pre-computed variant URLs
 * (4 standard sizes) into files.variants jsonb, so that consumer code can
 * pick the right size without an extra resize call when the same buffer is
 * served repeatedly.
 *
 * No external CDN required: variants point at the same /_next/image optimizer
 * URL with width=N&q=85 baked in. When NEXT_PUBLIC_IMAGE_CDN is set, the same
 * URLs route to the CDN via the custom loader.
 */
import imageLoader from "@/lib/image-loader";

export const VARIANT_SIZES: Record<string, number> = {
    thumb: 160,
    card: 400,
    pdp: 800,
    zoom: 1600,
};

export interface ImageVariantSet {
    thumb: string;
    card: string;
    pdp: string;
    zoom: string;
}

export function buildImageVariants(originalSrc: string): ImageVariantSet {
    const variants: Record<string, string> = {};
    for (const [name, width] of Object.entries(VARIANT_SIZES)) {
        variants[name] = imageLoader({ src: originalSrc, width, quality: 85 });
    }
    return variants as unknown as ImageVariantSet;
}

/**
 * Pick the best variant URL for a target render width. Falls back to original
 * if no variants object stored (legacy uploads).
 */
export function pickImageVariant(
    variants: Record<string, string> | null | undefined,
    fallback: string,
    targetWidth: number
): string {
    if (!variants) return fallback;
    if (targetWidth <= 200 && variants.thumb) return variants.thumb;
    if (targetWidth <= 500 && variants.card) return variants.card;
    if (targetWidth <= 1000 && variants.pdp) return variants.pdp;
    if (variants.zoom) return variants.zoom;
    return fallback;
}
