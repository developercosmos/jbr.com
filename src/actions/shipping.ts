"use server";

import { db } from "@/db";
import { addresses, carts, integration_settings, orders } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { notify } from "@/lib/notify";

const SHIPPING_COURIERS = ["jne", "pos", "tiki"] as const;
const SHIPPING_QUOTE_TTL_MS = 10 * 60 * 1000;
const quoteCache = new Map<string, { expiresAt: number; value: CheckoutShippingQuoteResult }>();

// Helper to get current user
async function getCurrentUser() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    if (!session?.user) {
        throw new Error("Unauthorized");
    }
    return session.user;
}

// ============================================
// GET SHIPPING COST
// ============================================
const getShippingCostSchema = z.object({
    origin: z.string(), // City ID
    destination: z.string(), // City ID
    weight: z.number().min(1), // in grams
    courier: z.enum(SHIPPING_COURIERS),
});

const getCheckoutShippingQuoteSchema = z.object({
    addressId: z.string().uuid(),
    courier: z.enum(SHIPPING_COURIERS),
});

type ShippingCourier = z.infer<typeof getShippingCostSchema>["courier"];

type ShippingOption = {
    service: string;
    description: string;
    cost: number;
    etd: string;
};

type CheckoutShippingQuoteResult = {
    success: boolean;
    courier: ShippingCourier;
    totalCost: number;
    quotesBySeller: Array<{
        sellerId: string;
        shippingProvider: string;
        service: string;
        description: string;
        cost: number;
        etd: string;
    }>;
    warning?: string;
    usedFallback: boolean;
};

async function getRajaOngkirSettings() {
    const setting = await db.query.integration_settings.findFirst({
        where: eq(integration_settings.key, "rajaongkir"),
    });

    const config = (setting?.config as Record<string, unknown> | null) ?? {};
    const credentials = setting?.credentials ?? {};
    const accountType = String(config.account_type ?? "starter");

    return {
        enabled: setting?.enabled ?? false,
        apiKey: credentials.api_key || process.env.RAJAONGKIR_API_KEY || "",
        apiUrl: `https://api.rajaongkir.com/${accountType}`,
        originCityId: String(config.origin_city_id ?? process.env.RAJAONGKIR_ORIGIN_CITY_ID ?? "1"),
        fallbackCost: Number(config.fallback_cost ?? process.env.CHECKOUT_SHIPPING_FALLBACK_COST ?? 20000),
    };
}

function getFallbackOptions(fallbackCost: number): ShippingOption[] {
    return [
        {
            service: "FALLBACK",
            description: "Estimasi sementara",
            cost: fallbackCost,
            etd: "3-5",
        },
    ];
}

async function fetchShippingOptions(input: z.infer<typeof getShippingCostSchema>): Promise<{ options: ShippingOption[]; usedFallback: boolean; warning?: string }> {
    const validated = getShippingCostSchema.parse(input);
    const settings = await getRajaOngkirSettings();

    if (!settings.enabled || !settings.apiKey) {
        return {
            options: getFallbackOptions(settings.fallbackCost),
            usedFallback: true,
            warning: "RajaOngkir belum aktif. Menggunakan ongkir fallback sementara.",
        };
    }

    try {
        const response = await fetch(`${settings.apiUrl}/cost`, {
            method: "POST",
            headers: {
                key: settings.apiKey,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                origin: validated.origin,
                destination: validated.destination,
                weight: validated.weight.toString(),
                courier: validated.courier,
            }),
            cache: "no-store",
        });

        if (!response.ok) {
            throw new Error("Failed to get shipping cost");
        }

        const data = await response.json();
        const results = data.rajaongkir?.results?.[0]?.costs || [];
        const options = results.map((cost: { service: string; description: string; cost: { value: number; etd: string }[] }) => ({
            service: cost.service,
            description: cost.description,
            cost: cost.cost[0]?.value || 0,
            etd: cost.cost[0]?.etd || "-",
        }));

        if (options.length === 0) {
            throw new Error("No shipping options returned");
        }

        return {
            options,
            usedFallback: false,
        };
    } catch (error) {
        console.error("RajaOngkir error:", error);
        return {
            options: getFallbackOptions(settings.fallbackCost),
            usedFallback: true,
            warning: "Gagal mengambil ongkir live. Menggunakan ongkir fallback sementara.",
        };
    }
}

function buildQuoteCacheKey(userId: string, addressId: string, courier: ShippingCourier, sellerId: string, items: Array<{ productId: string; variantId: string | null; quantity: number }>) {
    const signature = items
        .map((item) => `${item.productId}:${item.variantId ?? "base"}:${item.quantity}`)
        .sort()
        .join("|");

    return `${userId}:${addressId}:${courier}:${sellerId}:${signature}`;
}

export async function getCheckoutShippingQuoteForUser(userId: string, addressId: string, courier: ShippingCourier): Promise<CheckoutShippingQuoteResult> {
    const validated = getCheckoutShippingQuoteSchema.parse({ addressId, courier });
    const settings = await getRajaOngkirSettings();

    const shippingAddress = await db.query.addresses.findFirst({
        where: and(eq(addresses.id, validated.addressId), eq(addresses.user_id, userId)),
    });

    if (!shippingAddress?.city_id) {
        throw new Error("Alamat pengiriman belum memiliki kota tujuan yang valid");
    }

    const cartItems = await db.query.carts.findMany({
        where: eq(carts.user_id, userId),
        with: {
            product: true,
        },
    });

    if (cartItems.length === 0) {
        throw new Error("Cart is empty");
    }

    const itemsBySeller = cartItems.reduce<Record<string, typeof cartItems>>((acc, item) => {
        const sellerId = item.product.seller_id;
        if (!acc[sellerId]) {
            acc[sellerId] = [];
        }
        acc[sellerId].push(item);
        return acc;
    }, {});

    let totalCost = 0;
    let usedFallback = false;
    const warnings = new Set<string>();
    const quotesBySeller: CheckoutShippingQuoteResult["quotesBySeller"] = [];

    for (const [sellerId, sellerItems] of Object.entries(itemsBySeller)) {
        const weight = sellerItems.reduce((sum, item) => {
            const baseWeight = item.product.weight_grams ?? 1000;
            return sum + Math.max(baseWeight, 1) * item.quantity;
        }, 0);

        const cacheKey = buildQuoteCacheKey(
            userId,
            validated.addressId,
            validated.courier,
            sellerId,
            sellerItems.map((item) => ({
                productId: item.product_id,
                variantId: item.variant_id,
                quantity: item.quantity,
            }))
        );

        const cached = quoteCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            totalCost += cached.value.totalCost;
            usedFallback = usedFallback || cached.value.usedFallback;
            if (cached.value.warning) {
                warnings.add(cached.value.warning);
            }
            quotesBySeller.push(...cached.value.quotesBySeller);
            continue;
        }

        const { options, usedFallback: sellerUsedFallback, warning } = await fetchShippingOptions({
            origin: settings.originCityId,
            destination: String(shippingAddress.city_id),
            weight,
            courier: validated.courier,
        });

        const selectedOption = options.reduce((lowest, option) => (option.cost < lowest.cost ? option : lowest), options[0]);
        const sellerQuote: CheckoutShippingQuoteResult = {
            success: true,
            courier: validated.courier,
            totalCost: selectedOption.cost,
            quotesBySeller: [
                {
                    sellerId,
                    shippingProvider: `${validated.courier.toUpperCase()} ${selectedOption.service}`,
                    service: selectedOption.service,
                    description: selectedOption.description,
                    cost: selectedOption.cost,
                    etd: selectedOption.etd,
                },
            ],
            warning,
            usedFallback: sellerUsedFallback,
        };

        quoteCache.set(cacheKey, {
            expiresAt: Date.now() + SHIPPING_QUOTE_TTL_MS,
            value: sellerQuote,
        });

        totalCost += sellerQuote.totalCost;
        usedFallback = usedFallback || sellerQuote.usedFallback;
        if (sellerQuote.warning) {
            warnings.add(sellerQuote.warning);
        }
        quotesBySeller.push(...sellerQuote.quotesBySeller);
    }

    return {
        success: true,
        courier: validated.courier,
        totalCost,
        quotesBySeller,
        usedFallback,
        warning: warnings.size > 0 ? Array.from(warnings).join(" ") : undefined,
    };
}

export async function getCheckoutShippingQuote(input: z.infer<typeof getCheckoutShippingQuoteSchema>) {
    const user = await getCurrentUser();
    return getCheckoutShippingQuoteForUser(user.id, input.addressId, input.courier);
}

export async function getShippingCost(input: z.infer<typeof getShippingCostSchema>) {
    const { options, usedFallback, warning } = await fetchShippingOptions(input);

    return {
        success: true,
        costs: options,
        usedFallback,
        warning,
    };
}

// ============================================
// GET CITIES (for dropdown)
// ============================================
export async function getCities(provinceId?: string) {
    const settings = await getRajaOngkirSettings();

    if (!settings.enabled || !settings.apiKey) {
        return {
            success: false,
            error: "Integrasi RajaOngkir belum aktif. Aktifkan di pengaturan admin untuk mengambil daftar kota.",
            cities: [] as Array<{ id: string; name: string; province: string }>,
        };
    }

    try {
        const url = provinceId
            ? `${settings.apiUrl}/city?province=${provinceId}`
            : `${settings.apiUrl}/city`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                key: settings.apiKey,
            },
            cache: "no-store",
        });

        if (!response.ok) {
            throw new Error("Failed to get cities");
        }

        const data = await response.json();
        const results = data.rajaongkir?.results || [];

        return {
            success: true,
            cities: results.map((city: { city_id: string; city_name: string; province: string }) => ({
                id: city.city_id,
                name: city.city_name,
                province: city.province,
            })) as Array<{ id: string; name: string; province: string }>,
        };
    } catch (error) {
        console.error("RajaOngkir error:", error);
        return {
            success: false,
            error: "Gagal mengambil daftar kota dari RajaOngkir.",
            cities: [] as Array<{ id: string; name: string; province: string }>,
        };
    }
}

// ============================================
// UPDATE SHIPPING INFO (Seller)
// ============================================
const updateShippingSchema = z.object({
    orderId: z.string().uuid(),
    trackingNumber: z.string().min(1),
    shippingProvider: z.string().min(1),
    estimatedDelivery: z.string().optional(),
});

export async function updateShippingInfo(input: z.infer<typeof updateShippingSchema>) {
    const user = await getCurrentUser();
    const validated = updateShippingSchema.parse(input);

    // Get order
    const order = await db.query.orders.findFirst({
        where: and(
            eq(orders.id, validated.orderId),
            eq(orders.seller_id, user.id)
        ),
        with: {
            buyer: true,
        },
    });

    if (!order) {
        throw new Error("Order not found");
    }

    if (order.status !== "PAID" && order.status !== "PROCESSING") {
        throw new Error("Order cannot be shipped in current status");
    }

    // Parse estimated delivery if provided
    let estimatedDelivery: Date | null = null;
    if (validated.estimatedDelivery) {
        estimatedDelivery = new Date(validated.estimatedDelivery);
    }

    // Update order
    const [updated] = await db
        .update(orders)
        .set({
            status: "SHIPPED",
            tracking_number: validated.trackingNumber,
            shipping_provider: validated.shippingProvider,
            shipped_at: new Date(),
            estimated_delivery: estimatedDelivery,
            updated_at: new Date(),
        })
        .where(eq(orders.id, validated.orderId))
        .returning();

    if (order.buyer) {
        await notify({
            event: "ORDER_SHIPPED",
            recipientUserId: order.buyer_id,
            recipientEmail: order.buyer.email,
            recipientName: order.buyer.name,
            orderId: validated.orderId,
            orderNumber: order.order_number,
            trackingNumber: validated.trackingNumber,
            shippingProvider: validated.shippingProvider,
            trackingUrl: getTrackingUrl(validated.shippingProvider, validated.trackingNumber),
        });
    }

    revalidatePath("/seller/orders");
    revalidatePath("/profile/orders");

    return { success: true, order: updated };
}

// Helper to get tracking URL
function getTrackingUrl(provider: string, trackingNumber: string): string {
    const lowerProvider = provider.toLowerCase();

    if (lowerProvider.includes("jne")) {
        return `https://www.jne.co.id/id/tracking/trace/${trackingNumber}`;
    }
    if (lowerProvider.includes("jnt") || lowerProvider.includes("j&t")) {
        return `https://www.jet.co.id/track/${trackingNumber}`;
    }
    if (lowerProvider.includes("sicepat")) {
        return `https://www.sicepat.com/checkAwb/${trackingNumber}`;
    }
    if (lowerProvider.includes("anteraja")) {
        return `https://anteraja.id/tracking/${trackingNumber}`;
    }
    if (lowerProvider.includes("pos")) {
        return `https://www.posindonesia.co.id/id/tracking?barcode=${trackingNumber}`;
    }

    return `https://cekresi.com/?noresi=${trackingNumber}`;
}

// ============================================
// CONFIRM DELIVERY (Buyer)
// ============================================
export async function confirmDelivery(orderId: string) {
    const user = await getCurrentUser();

    // Get order
    const order = await db.query.orders.findFirst({
        where: and(
            eq(orders.id, orderId),
            eq(orders.buyer_id, user.id)
        ),
        with: {
            buyer: true,
            seller: true,
        },
    });

    if (!order) {
        throw new Error("Order not found");
    }

    if (order.status !== "SHIPPED") {
        throw new Error("Order is not in shipped status");
    }

    // TRUST-02: arm the escrow auto-release timer. Configurable via env, default 3 days.
    const releaseHours = Number(process.env.ESCROW_RELEASE_HOURS || 72);
    const releaseDueAt = new Date(Date.now() + releaseHours * 60 * 60 * 1000);

    // Update order
    const [updated] = await db
        .update(orders)
        .set({
            status: "DELIVERED",
            release_due_at: releaseDueAt,
            updated_at: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

    if (order.buyer) {
        await notify({
            event: "ORDER_DELIVERED",
            audience: "buyer",
            recipientUserId: order.buyer_id,
            recipientEmail: order.buyer.email,
            recipientName: order.buyer.name,
            orderId,
            orderNumber: order.order_number,
        });
    }

    await notify({
        event: "ORDER_DELIVERED",
        audience: "seller",
        recipientUserId: order.seller_id,
        orderId,
        orderNumber: order.order_number,
    });

    revalidatePath("/seller/orders");
    revalidatePath("/profile/orders");

    return { success: true, order: updated };
}
