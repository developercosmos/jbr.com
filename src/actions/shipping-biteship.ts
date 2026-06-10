"use server";

// Seller-side Biteship pickup booking + tracking sync.
//   - getBiteshipRatesForOrder : service options (with live prices) for ONE order
//   - requestBiteshipPickup    : book the courier pickup (reference_id = order id)
//   - syncBiteshipOrderStatus  : manual status refresh (webhook is the primary path)

import { db } from "@/db";
import { addresses, orders } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
    BITESHIP_COURIER_LABELS,
    biteshipCreateOrder,
    biteshipGetOrder,
    biteshipRates,
    getBiteshipSettings,
    type BiteshipRateItem,
} from "@/lib/biteship";
import { applyBiteshipStatusUpdate } from "@/lib/biteship-status";

async function getCurrentUser() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("Unauthorized");
    return session.user;
}

function toLocation(addr: { latitude: string | null; longitude: string | null; postal_code: string | null }) {
    if (addr.latitude && addr.longitude) {
        return { latitude: String(addr.latitude), longitude: String(addr.longitude) };
    }
    if (addr.postal_code) return { postalCode: addr.postal_code };
    return null;
}

/** Load + authorize an order for Biteship operations by the owning seller. */
async function loadSellerOrder(orderId: string, sellerId: string) {
    const order = await db.query.orders.findFirst({
        where: and(eq(orders.id, orderId), eq(orders.seller_id, sellerId)),
        with: {
            shipping_address: true,
            seller: { columns: { store_name: true, name: true, phone: true } },
            items: { with: { product: { columns: { title: true, weight_grams: true, price: true } } } },
        },
    });
    if (!order) throw new Error("Pesanan tidak ditemukan.");
    return order;
}

type LoadedOrder = Awaited<ReturnType<typeof loadSellerOrder>>;

function buildOrderItems(order: LoadedOrder): BiteshipRateItem[] {
    return order.items.map((item) => ({
        name: item.product_snapshot?.title ?? item.product?.title ?? "Produk",
        value: Number(item.price ?? item.product?.price ?? 0),
        weight: Math.max(item.product?.weight_grams ?? 1000, 1),
        quantity: item.quantity,
    }));
}

async function getSellerPickupAddress(sellerId: string) {
    return db.query.addresses.findFirst({
        where: and(eq(addresses.user_id, sellerId), eq(addresses.is_default_pickup, true)),
    });
}

export interface BiteshipOrderRateOption {
    courierCompany: string;
    courierName: string;
    serviceCode: string;
    serviceName: string;
    price: number;
    duration: string;
}

export interface BiteshipRatesForOrderResult {
    /** False when the admin hasn't enabled/configured Biteship — hide the panel. */
    configured: boolean;
    available: boolean;
    reason?: string;
    options: BiteshipOrderRateOption[];
}

/** Live service options for one order's route (shown in the seller booking panel). */
export async function getBiteshipRatesForOrder(orderId: string): Promise<BiteshipRatesForOrderResult> {
    const user = await getCurrentUser();
    const settings = await getBiteshipSettings();
    if (!settings.enabled || !settings.apiKey) {
        return { configured: false, available: false, reason: "Integrasi Biteship belum aktif.", options: [] };
    }

    const order = await loadSellerOrder(orderId, user.id);
    if (order.biteship_order_id) {
        return { configured: true, available: false, reason: "Pickup sudah dibooking untuk pesanan ini.", options: [] };
    }
    if (order.status !== "PAID" && order.status !== "PROCESSING") {
        return { configured: true, available: false, reason: "Pesanan belum/tidak dalam status yang bisa dikirim.", options: [] };
    }
    if (!order.shipping_address) {
        return { configured: true, available: false, reason: "Pesanan tidak memiliki alamat pengiriman.", options: [] };
    }
    const destination = toLocation(order.shipping_address);
    if (!destination) {
        return { configured: true, available: false, reason: "Alamat tujuan tidak punya koordinat/kode pos.", options: [] };
    }
    const pickup = await getSellerPickupAddress(user.id);
    const origin = pickup ? toLocation(pickup) : null;
    if (!origin) {
        return {
            configured: true,
            available: false,
            reason: "Set alamat pickup default Anda dulu (Profil → Alamat → tandai sebagai alamat pickup, lengkap dengan titik peta/kode pos).",
            options: [],
        };
    }

    try {
        const pricing = await biteshipRates(settings, {
            origin,
            destination,
            couriers: settings.couriers,
            items: buildOrderItems(order),
        });
        return {
            configured: true,
            available: pricing.length > 0,
            reason: pricing.length === 0 ? "Tidak ada layanan kurir untuk rute ini." : undefined,
            options: pricing.map((p) => ({
                courierCompany: p.courierCompany,
                courierName: p.courierName || (BITESHIP_COURIER_LABELS[p.courierCompany] ?? p.courierCompany.toUpperCase()),
                serviceCode: p.serviceCode,
                serviceName: p.serviceName,
                price: p.price,
                duration: p.duration,
            })),
        };
    } catch (e) {
        return {
            configured: true,
            available: false,
            reason: e instanceof Error ? e.message : "Gagal mengambil tarif Biteship.",
            options: [],
        };
    }
}

const requestPickupSchema = z.object({
    orderId: z.string().uuid(),
    courierCompany: z.string().trim().toLowerCase().regex(/^[a-z&_-]{2,24}$/),
    courierType: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{2,32}$/),
});

/** Book a Biteship pickup for the order. reference_id = our order id (idempotent at Biteship). */
export async function requestBiteshipPickup(input: z.infer<typeof requestPickupSchema>) {
    const user = await getCurrentUser();
    const validated = requestPickupSchema.parse(input);
    const settings = await getBiteshipSettings();
    if (!settings.enabled || !settings.apiKey) throw new Error("Integrasi Biteship belum aktif.");
    if (!settings.couriers.includes(validated.courierCompany)) {
        throw new Error("Kurir tidak ada dalam daftar yang diizinkan admin.");
    }

    const order = await loadSellerOrder(validated.orderId, user.id);
    if (order.biteship_order_id) throw new Error("Pickup sudah dibooking untuk pesanan ini.");
    if (order.status !== "PAID" && order.status !== "PROCESSING") {
        throw new Error("Pesanan tidak dalam status yang bisa dikirim.");
    }
    if (!order.shipping_address) throw new Error("Pesanan tidak memiliki alamat pengiriman.");
    const destination = toLocation(order.shipping_address);
    if (!destination) throw new Error("Alamat tujuan tidak punya koordinat/kode pos.");

    const pickup = await getSellerPickupAddress(user.id);
    const origin = pickup ? toLocation(pickup) : null;
    if (!pickup || !origin) {
        throw new Error("Set alamat pickup default Anda dulu (Profil → Alamat, tandai sebagai alamat pickup).");
    }
    const originPhone = pickup.phone || order.seller?.phone || "";
    if (!originPhone) throw new Error("Alamat pickup belum memiliki nomor telepon.");

    const result = await biteshipCreateOrder(settings, {
        referenceId: order.id,
        origin: {
            contactName: order.seller?.store_name || order.seller?.name || pickup.recipient_name || "Seller",
            contactPhone: originPhone,
            address: pickup.full_address || "",
            ...origin,
        },
        destination: {
            contactName: order.shipping_address.recipient_name || "Pembeli",
            contactPhone: order.shipping_address.phone || "",
            address: order.shipping_address.full_address || "",
            ...destination,
            note: order.notes ?? undefined,
        },
        courierCompany: validated.courierCompany,
        courierType: validated.courierType,
        items: buildOrderItems(order),
    });

    const providerLabel = `${BITESHIP_COURIER_LABELS[validated.courierCompany] ?? validated.courierCompany.toUpperCase()} ${validated.courierType.toUpperCase()}`;
    await db
        .update(orders)
        .set({
            biteship_order_id: result.id,
            shipping_provider: providerLabel,
            tracking_number: result.waybillId ?? order.tracking_number,
            updated_at: new Date(),
        })
        .where(eq(orders.id, order.id));

    revalidatePath(`/seller/orders/${order.id}`);
    revalidatePath("/seller/orders");

    return {
        success: true as const,
        biteshipOrderId: result.id,
        waybillId: result.waybillId,
        status: result.status,
        price: result.price,
        provider: providerLabel,
    };
}

/** Manual status refresh from Biteship (webhook is the primary channel). */
export async function syncBiteshipOrderStatus(orderId: string) {
    const user = await getCurrentUser();
    const settings = await getBiteshipSettings();
    if (!settings.enabled || !settings.apiKey) throw new Error("Integrasi Biteship belum aktif.");

    const order = await db.query.orders.findFirst({
        where: and(eq(orders.id, orderId), eq(orders.seller_id, user.id)),
        columns: { id: true, biteship_order_id: true },
    });
    if (!order?.biteship_order_id) throw new Error("Pesanan ini tidak memiliki booking Biteship.");

    const remote = await biteshipGetOrder(settings, order.biteship_order_id);
    const applied = await applyBiteshipStatusUpdate({
        biteshipOrderId: order.biteship_order_id,
        status: remote.status,
        waybillId: remote.waybillId,
    });

    revalidatePath(`/seller/orders/${orderId}`);
    revalidatePath("/seller/orders");

    return { success: true as const, biteshipStatus: remote.status, waybillId: remote.waybillId, action: applied.action };
}
