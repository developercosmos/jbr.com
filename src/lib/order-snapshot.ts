/**
 * Product snapshot captured into order_items.product_snapshot at the moment an
 * order is created. Gives every buyer a stable historical reference (image,
 * specs, variant, price) even if the seller later edits or deletes the product.
 *
 * Pure module (no server/db imports) so it can be used by the schema type, the
 * order-creation action, and order display pages alike.
 */

export interface OrderItemSnapshot {
    title: string;
    slug: string | null;
    image: string | null; // primary image at purchase time
    images: string[]; // all images at purchase time
    brand: string | null;
    condition: string | null;
    condition_rating: number | null;
    gender: string | null;
    specs: {
        weight_class: string | null;
        balance: string | null;
        shaft_flex: string | null;
        grip_size: string | null;
        max_string_tension_lbs: number | null;
    };
    variant: {
        name: string;
        option1_name: string | null;
        option1_value: string | null;
        option2_name: string | null;
        option2_value: string | null;
        image: string | null;
    } | null;
    price: string; // unit price paid (variant price or product price)
    captured_at: string; // ISO timestamp
}

// Loose input shapes (drizzle rows) — kept optional to avoid tight coupling.
interface SnapshotProductInput {
    title: string;
    slug?: string | null;
    images?: string[] | null;
    brand?: string | null;
    condition?: string | null;
    condition_rating?: number | null;
    gender?: string | null;
    weight_class?: string | null;
    balance?: string | null;
    shaft_flex?: string | null;
    grip_size?: string | null;
    max_string_tension_lbs?: number | null;
    price?: string | null;
}

interface SnapshotVariantInput {
    name: string;
    option1_name?: string | null;
    option1_value?: string | null;
    option2_name?: string | null;
    option2_value?: string | null;
    images?: string[] | null;
    price?: string | null;
}

export function buildOrderItemSnapshot(
    product: SnapshotProductInput,
    variant: SnapshotVariantInput | null,
    capturedAt: Date
): OrderItemSnapshot {
    const productImages = product.images ?? [];
    const variantImages = variant?.images ?? [];
    const image = variantImages[0] ?? productImages[0] ?? null;
    const images = variantImages.length > 0 ? variantImages : productImages;
    const unitPrice = variant?.price ?? product.price ?? "0";

    return {
        title: product.title,
        slug: product.slug ?? null,
        image,
        images,
        brand: product.brand ?? null,
        condition: product.condition ?? null,
        condition_rating: product.condition_rating ?? null,
        gender: product.gender ?? null,
        specs: {
            weight_class: product.weight_class ?? null,
            balance: product.balance ?? null,
            shaft_flex: product.shaft_flex ?? null,
            grip_size: product.grip_size ?? null,
            max_string_tension_lbs: product.max_string_tension_lbs ?? null,
        },
        variant: variant
            ? {
                  name: variant.name,
                  option1_name: variant.option1_name ?? null,
                  option1_value: variant.option1_value ?? null,
                  option2_name: variant.option2_name ?? null,
                  option2_value: variant.option2_value ?? null,
                  image: variantImages[0] ?? null,
              }
            : null,
        price: String(unitPrice || "0"),
        captured_at: capturedAt.toISOString(),
    };
}

// Human-readable variant label, e.g. "Merah / M".
export function snapshotVariantLabel(snap: OrderItemSnapshot | null): string | null {
    if (!snap?.variant) return null;
    const parts = [snap.variant.option1_value, snap.variant.option2_value].filter(Boolean);
    return parts.length ? parts.join(" / ") : snap.variant.name || null;
}

// Compact specs line, e.g. "4U · HEAD_HEAVY · G5".
export function snapshotSpecsLine(snap: OrderItemSnapshot | null): string | null {
    if (!snap) return null;
    const s = snap.specs;
    const parts = [s.weight_class, s.balance, s.shaft_flex, s.grip_size].filter(Boolean) as string[];
    if (s.max_string_tension_lbs) parts.push(`${s.max_string_tension_lbs} lbs`);
    return parts.length ? parts.join(" · ") : null;
}
