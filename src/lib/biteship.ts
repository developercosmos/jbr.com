// Biteship API client (rates + pickup orders + tracking).
// Server-only lib: no DB writes here — actions own persistence/authorization.
//
// Configuration comes from the admin integration_settings row "biteship" with
// env overrides (same pattern as RajaOngkir/Xendit):
//   BITESHIP_API_KEY        overrides credentials.api_key
//   BITESHIP_API_URL        overrides config.base_url (default https://api.biteship.com;
//                           point it at the Biteship sandbox key/URL for testing)
//   BITESHIP_COURIERS       overrides config.couriers (comma list, e.g. "jne,jnt,sicepat")
//   BITESHIP_WEBHOOK_TOKEN  overrides credentials.webhook_token (shared secret for
//                           /api/webhooks/biteship?token=...)

import { db } from "@/db";
import { integration_settings } from "@/db/schema";
import { eq } from "drizzle-orm";

const DEFAULT_BASE_URL = "https://api.biteship.com";
const DEFAULT_COURIERS = "jne,jnt,sicepat,anteraja";
const RATES_TIMEOUT_MS = 15_000;
const ORDER_TIMEOUT_MS = 30_000;

/** Human labels for courier codes we expose in the UI. */
export const BITESHIP_COURIER_LABELS: Record<string, string> = {
    jne: "JNE",
    jnt: "J&T Express",
    sicepat: "SiCepat",
    anteraja: "AnterAja",
    pos: "POS Indonesia",
    tiki: "TIKI",
    idexpress: "ID Express",
    ninja: "Ninja Xpress",
    lion: "Lion Parcel",
    sap: "SAP Express",
    wahana: "Wahana",
    rpx: "RPX",
    paxel: "Paxel",
    grab: "GrabExpress",
    gojek: "GoSend",
    lalamove: "Lalamove",
    deliveree: "Deliveree",
};

export interface BiteshipSettings {
    enabled: boolean;
    apiKey: string;
    apiUrl: string;
    couriers: string[]; // courier_company codes offered at checkout
    webhookToken: string;
    fallbackCost: number;
    origin: {
        postalCode: string;
        latitude: string;
        longitude: string;
        contactName: string;
        contactPhone: string;
        address: string;
    };
}

export async function getBiteshipSettings(): Promise<BiteshipSettings> {
    const setting = await db.query.integration_settings.findFirst({
        where: eq(integration_settings.key, "biteship"),
    });
    const config = (setting?.config as Record<string, unknown> | null) ?? {};
    const credentials = (setting?.credentials as Record<string, string> | null) ?? {};

    const couriersRaw =
        process.env.BITESHIP_COURIERS?.trim() || String(config.couriers ?? "").trim() || DEFAULT_COURIERS;

    return {
        enabled: setting?.enabled ?? false,
        apiKey: process.env.BITESHIP_API_KEY?.trim() || credentials.api_key || "",
        apiUrl: (process.env.BITESHIP_API_URL?.trim() || String(config.base_url ?? "").trim() || DEFAULT_BASE_URL).replace(/\/$/, ""),
        couriers: couriersRaw
            .split(",")
            .map((c) => c.trim().toLowerCase())
            .filter(Boolean),
        webhookToken: process.env.BITESHIP_WEBHOOK_TOKEN?.trim() || credentials.webhook_token || "",
        fallbackCost: Number(config.fallback_cost ?? process.env.CHECKOUT_SHIPPING_FALLBACK_COST ?? 20000),
        origin: {
            postalCode: String(config.origin_postal_code ?? "").trim(),
            latitude: String(config.origin_latitude ?? "").trim(),
            longitude: String(config.origin_longitude ?? "").trim(),
            contactName: String(config.origin_contact_name ?? "").trim(),
            contactPhone: String(config.origin_contact_phone ?? "").trim(),
            address: String(config.origin_address ?? "").trim(),
        },
    };
}

async function biteshipFetch<T>(settings: BiteshipSettings, path: string, init: RequestInit, timeoutMs: number): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
        res = await fetch(`${settings.apiUrl}${path}`, {
            ...init,
            headers: {
                // Biteship uses the raw API key in the authorization header (no Bearer).
                authorization: settings.apiKey,
                "Content-Type": "application/json",
                ...(init.headers ?? {}),
            },
            cache: "no-store",
            signal: controller.signal,
        });
    } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
            throw new Error(`Biteship timeout after ${timeoutMs}ms (${path})`);
        }
        throw new Error(`Biteship request failed (${path}): ${err instanceof Error ? err.message : String(err)}`);
    } finally {
        clearTimeout(timer);
    }

    const body = (await res.json().catch(() => null)) as (T & { success?: boolean; error?: string; message?: string }) | null;
    if (!res.ok || !body || body.success === false) {
        const detail = body?.error || body?.message || `HTTP ${res.status}`;
        throw new Error(`Biteship ${path}: ${detail}`);
    }
    return body;
}

// ============================================
// COURIERS (account-enabled list, for admin checklist)
// ============================================

export interface BiteshipCourierOption {
    code: string; // courier_code, e.g. "jne"
    name: string; // courier_name, e.g. "JNE"
    services: number; // number of service tiers available under this courier
    cod: boolean; // any service supports cash-on-delivery
}

/**
 * GET /v1/couriers — couriers/services enabled on the Biteship account. Deduped
 * to one entry per courier company (courier_code) so the admin can tick which
 * companies to offer at checkout. Read-only; does NOT consume balance.
 */
export async function biteshipCouriers(settings: BiteshipSettings): Promise<BiteshipCourierOption[]> {
    const body = await biteshipFetch<{
        couriers?: Array<{
            courier_code?: string;
            courier_name?: string;
            available_for_cash_on_delivery?: boolean;
        }>;
    }>(settings, "/v1/couriers", { method: "GET" }, RATES_TIMEOUT_MS);

    const byCode = new Map<string, BiteshipCourierOption>();
    for (const row of body.couriers ?? []) {
        const code = String(row.courier_code ?? "").trim().toLowerCase();
        if (!code) continue;
        const existing = byCode.get(code);
        if (existing) {
            existing.services += 1;
            existing.cod = existing.cod || Boolean(row.available_for_cash_on_delivery);
        } else {
            byCode.set(code, {
                code,
                name: row.courier_name?.trim() || BITESHIP_COURIER_LABELS[code] || code.toUpperCase(),
                services: 1,
                cod: Boolean(row.available_for_cash_on_delivery),
            });
        }
    }
    return Array.from(byCode.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ============================================
// RATES
// ============================================

export interface BiteshipRateItem {
    name: string;
    value: number; // IDR
    weight: number; // grams
    quantity: number;
}

export interface BiteshipRatesInput {
    origin: { latitude?: string; longitude?: string; postalCode?: string };
    destination: { latitude?: string; longitude?: string; postalCode?: string };
    couriers: string[]; // courier_company codes
    items: BiteshipRateItem[];
}

export interface BiteshipPricing {
    courierCompany: string;
    courierName: string;
    serviceCode: string;
    serviceName: string;
    price: number;
    duration: string;
}

function locationParams(prefix: "origin" | "destination", loc: { latitude?: string; longitude?: string; postalCode?: string }) {
    // Prefer coordinates (works for instant + regular couriers); fall back to postal code.
    if (loc.latitude && loc.longitude) {
        return {
            [`${prefix}_latitude`]: Number(loc.latitude),
            [`${prefix}_longitude`]: Number(loc.longitude),
        };
    }
    if (loc.postalCode) {
        return { [`${prefix}_postal_code`]: Number(loc.postalCode) || loc.postalCode };
    }
    return null;
}

export async function biteshipRates(settings: BiteshipSettings, input: BiteshipRatesInput): Promise<BiteshipPricing[]> {
    const origin = locationParams("origin", input.origin);
    const destination = locationParams("destination", input.destination);
    if (!origin) throw new Error("Origin tidak punya koordinat/kode pos");
    if (!destination) throw new Error("Tujuan tidak punya koordinat/kode pos");

    const body = {
        ...origin,
        ...destination,
        couriers: input.couriers.join(","),
        items: input.items.map((item) => ({
            name: item.name.slice(0, 100),
            value: Math.max(0, Math.round(item.value)),
            weight: Math.max(1, Math.round(item.weight)),
            quantity: Math.max(1, item.quantity),
        })),
    };

    const data = await biteshipFetch<{
        pricing?: Array<{
            courier_code?: string;
            courier_name?: string;
            courier_service_code?: string;
            courier_service_name?: string;
            price?: number;
            duration?: string;
        }>;
    }>(settings, "/v1/rates/couriers", { method: "POST", body: JSON.stringify(body) }, RATES_TIMEOUT_MS);

    return (data.pricing ?? []).map((p) => ({
        courierCompany: (p.courier_code ?? "").toLowerCase(),
        courierName: p.courier_name ?? p.courier_code ?? "",
        serviceCode: p.courier_service_code ?? "",
        serviceName: p.courier_service_name ?? "",
        price: Number(p.price ?? 0),
        duration: p.duration ?? "-",
    }));
}

// ============================================
// ORDERS (pickup booking)
// ============================================

export interface BiteshipCreateOrderInput {
    referenceId: string; // our order id — Biteship enforces uniqueness (idempotency)
    origin: {
        contactName: string;
        contactPhone: string;
        address: string;
        latitude?: string;
        longitude?: string;
        postalCode?: string;
        note?: string;
    };
    destination: {
        contactName: string;
        contactPhone: string;
        address: string;
        latitude?: string;
        longitude?: string;
        postalCode?: string;
        note?: string;
    };
    courierCompany: string;
    courierType: string; // service code from rates (e.g. "reg")
    items: BiteshipRateItem[];
}

export interface BiteshipOrderResult {
    id: string;
    status: string;
    trackingId: string | null;
    waybillId: string | null;
    courierCompany: string;
    courierType: string;
    price: number;
}

function coordParam(loc: { latitude?: string; longitude?: string; postalCode?: string }, prefix: "origin" | "destination") {
    const out: Record<string, unknown> = {};
    if (loc.latitude && loc.longitude) {
        out[`${prefix}_coordinate`] = { latitude: Number(loc.latitude), longitude: Number(loc.longitude) };
    }
    if (loc.postalCode) {
        out[`${prefix}_postal_code`] = Number(loc.postalCode) || loc.postalCode;
    }
    if (!out[`${prefix}_coordinate`] && !out[`${prefix}_postal_code`]) {
        throw new Error(`${prefix === "origin" ? "Alamat pickup" : "Alamat tujuan"} tidak punya koordinat/kode pos`);
    }
    return out;
}

export async function biteshipCreateOrder(settings: BiteshipSettings, input: BiteshipCreateOrderInput): Promise<BiteshipOrderResult> {
    const body = {
        reference_id: input.referenceId,
        origin_contact_name: input.origin.contactName.slice(0, 100),
        origin_contact_phone: input.origin.contactPhone,
        origin_address: input.origin.address.slice(0, 500),
        ...(input.origin.note ? { origin_note: input.origin.note.slice(0, 200) } : {}),
        ...coordParam(input.origin, "origin"),
        destination_contact_name: input.destination.contactName.slice(0, 100),
        destination_contact_phone: input.destination.contactPhone,
        destination_address: input.destination.address.slice(0, 500),
        ...(input.destination.note ? { destination_note: input.destination.note.slice(0, 200) } : {}),
        ...coordParam(input.destination, "destination"),
        courier_company: input.courierCompany,
        courier_type: input.courierType,
        delivery_type: "now",
        items: input.items.map((item) => ({
            name: item.name.slice(0, 100),
            value: Math.max(0, Math.round(item.value)),
            weight: Math.max(1, Math.round(item.weight)),
            quantity: Math.max(1, item.quantity),
        })),
    };

    const data = await biteshipFetch<{
        id?: string;
        status?: string;
        price?: number;
        courier?: { tracking_id?: string; waybill_id?: string | null; company?: string; type?: string };
    }>(settings, "/v1/orders", { method: "POST", body: JSON.stringify(body) }, ORDER_TIMEOUT_MS);

    if (!data.id) throw new Error("Biteship /v1/orders: respons tanpa order id");
    return {
        id: data.id,
        status: data.status ?? "confirmed",
        trackingId: data.courier?.tracking_id ?? null,
        waybillId: data.courier?.waybill_id ?? null,
        courierCompany: data.courier?.company ?? input.courierCompany,
        courierType: data.courier?.type ?? input.courierType,
        price: Number(data.price ?? 0),
    };
}

/** Retrieve a Biteship order (manual tracking refresh / webhook reconciliation). */
export interface BiteshipOrderStatus {
    status: string;
    waybillId: string | null;
    trackingId: string | null;
}

export async function biteshipGetOrder(settings: BiteshipSettings, orderId: string): Promise<BiteshipOrderStatus> {
    const data = await biteshipFetch<{
        status?: string;
        courier?: { tracking_id?: string; waybill_id?: string | null };
    }>(settings, `/v1/orders/${encodeURIComponent(orderId)}`, { method: "GET" }, RATES_TIMEOUT_MS);
    return {
        status: (data.status ?? "unknown").toLowerCase(),
        waybillId: data.courier?.waybill_id ?? null,
        trackingId: data.courier?.tracking_id ?? null,
    };
}

// ============================================
// TRACKING
// ============================================

export interface BiteshipTracking {
    status: string;
    waybillId: string | null;
    history: Array<{ note: string; status: string; updatedAt: string }>;
}

export async function biteshipGetTracking(settings: BiteshipSettings, trackingId: string): Promise<BiteshipTracking> {
    const data = await biteshipFetch<{
        status?: string;
        waybill_id?: string | null;
        history?: Array<{ note?: string; status?: string; updated_at?: string }>;
    }>(settings, `/v1/trackings/${encodeURIComponent(trackingId)}`, { method: "GET" }, RATES_TIMEOUT_MS);

    return {
        status: data.status ?? "unknown",
        waybillId: data.waybill_id ?? null,
        history: (data.history ?? []).map((h) => ({
            note: h.note ?? "",
            status: h.status ?? "",
            updatedAt: h.updated_at ?? "",
        })),
    };
}
