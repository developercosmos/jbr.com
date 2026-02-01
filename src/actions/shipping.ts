"use server";

import { db } from "@/db";
import { orders, notifications, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sendShippingNotificationEmail } from "@/lib/email";
import { z } from "zod";

// RajaOngkir API configuration
const RAJAONGKIR_API_KEY = process.env.RAJAONGKIR_API_KEY;
const RAJAONGKIR_API_URL = "https://api.rajaongkir.com/starter";

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
    courier: z.enum(["jne", "pos", "tiki"]),
});

export async function getShippingCost(input: z.infer<typeof getShippingCostSchema>) {
    const validated = getShippingCostSchema.parse(input);

    if (!RAJAONGKIR_API_KEY) {
        // Return dummy data if API key not configured
        return {
            success: true,
            costs: [
                { service: "REG", description: "Layanan Reguler", cost: 20000, etd: "3-4" },
                { service: "YES", description: "Yakin Esok Sampai", cost: 35000, etd: "1-2" },
            ],
        };
    }

    try {
        const response = await fetch(`${RAJAONGKIR_API_URL}/cost`, {
            method: "POST",
            headers: {
                "key": RAJAONGKIR_API_KEY,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                origin: validated.origin,
                destination: validated.destination,
                weight: validated.weight.toString(),
                courier: validated.courier,
            }),
        });

        if (!response.ok) {
            throw new Error("Failed to get shipping cost");
        }

        const data = await response.json();
        const results = data.rajaongkir?.results?.[0]?.costs || [];

        return {
            success: true,
            costs: results.map((cost: { service: string; description: string; cost: { value: number; etd: string }[] }) => ({
                service: cost.service,
                description: cost.description,
                cost: cost.cost[0]?.value || 0,
                etd: cost.cost[0]?.etd || "-",
            })),
        };
    } catch (error) {
        console.error("RajaOngkir error:", error);
        return {
            success: false,
            error: "Failed to get shipping cost",
            costs: [],
        };
    }
}

// ============================================
// GET CITIES (for dropdown)
// ============================================
export async function getCities(provinceId?: string) {
    if (!RAJAONGKIR_API_KEY) {
        // Return dummy data if API key not configured
        return {
            success: true,
            cities: [
                { id: "1", name: "Jakarta Pusat", province: "DKI Jakarta" },
                { id: "2", name: "Bandung", province: "Jawa Barat" },
                { id: "3", name: "Surabaya", province: "Jawa Timur" },
            ],
        };
    }

    try {
        const url = provinceId
            ? `${RAJAONGKIR_API_URL}/city?province=${provinceId}`
            : `${RAJAONGKIR_API_URL}/city`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "key": RAJAONGKIR_API_KEY,
            },
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
            })),
        };
    } catch (error) {
        console.error("RajaOngkir error:", error);
        return {
            success: false,
            error: "Failed to get cities",
            cities: [],
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

    // Notify buyer
    if (order.buyer) {
        // Email notification
        await sendShippingNotificationEmail({
            orderNumber: order.order_number,
            buyerName: order.buyer.name,
            buyerEmail: order.buyer.email,
            trackingNumber: validated.trackingNumber,
            shippingProvider: validated.shippingProvider,
            trackingUrl: getTrackingUrl(validated.shippingProvider, validated.trackingNumber),
        });

        // In-app notification
        await db.insert(notifications).values({
            user_id: order.buyer_id,
            type: "ORDER_SHIPPED",
            title: "Pesanan Dikirim",
            message: `Pesanan ${order.order_number} telah dikirim dengan ${validated.shippingProvider}. No. Resi: ${validated.trackingNumber}`,
            data: {
                order_id: validated.orderId,
                order_number: order.order_number,
                tracking_number: validated.trackingNumber,
                shipping_provider: validated.shippingProvider,
            },
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
    });

    if (!order) {
        throw new Error("Order not found");
    }

    if (order.status !== "SHIPPED") {
        throw new Error("Order is not in shipped status");
    }

    // Update order
    const [updated] = await db
        .update(orders)
        .set({
            status: "DELIVERED",
            updated_at: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

    // Notify seller
    await db.insert(notifications).values({
        user_id: order.seller_id,
        type: "ORDER_DELIVERED",
        title: "Pesanan Terkirim",
        message: `Pembeli telah mengkonfirmasi penerimaan pesanan ${order.order_number}`,
        data: {
            order_id: orderId,
            order_number: order.order_number,
        },
    });

    revalidatePath("/seller/orders");
    revalidatePath("/profile/orders");

    return { success: true, order: updated };
}
