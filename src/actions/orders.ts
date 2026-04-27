"use server";

import { db } from "@/db";
import { orders, order_items, carts, products, product_variants, reviews, addresses, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, desc, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCheckoutShippingQuoteForUser } from "@/actions/shipping";
import { ensureSellerWithinMonthlyGmvCap } from "@/actions/kyc";
import { calculatePlatformFee } from "@/actions/fees";
import { tryAttributeOrderFromCookie } from "@/actions/affiliate";
import { notify } from "@/lib/notify";
import { formatCurrency } from "@/lib/format";
import { logger } from "@/lib/logger";
import { offers as offersTable, product_variants as productVariantsTable } from "@/db/schema";
import { resolveCheckoutToken, consumeCheckoutToken } from "@/actions/offers";
import { getCheckoutShippingQuoteForUser as _getQuote } from "@/actions/shipping";

void _getQuote;
void offersTable;
void productVariantsTable;

// Get current user
async function getCurrentUser() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    if (!session?.user) {
        throw new Error("Unauthorized");
    }
    return session.user;
}

// Generate order number
function generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}${random}`;
}

// ============================================
// ORDER ACTIONS
// ============================================

const createOrderSchema = z.object({
    shipping_address_id: z.string().uuid().optional(),
    shipping_courier: z.enum(["jne", "pos", "tiki"]),
    notes: z.string().optional(),
});

export async function createOrderFromCart(input: z.infer<typeof createOrderSchema>) {
    const user = await getCurrentUser();
    const validated = createOrderSchema.parse(input);

    if (!validated.shipping_address_id) {
        throw new Error("Alamat pengiriman wajib dipilih");
    }

    const shippingQuote = await getCheckoutShippingQuoteForUser(
        user.id,
        validated.shipping_address_id,
        validated.shipping_courier
    );

    const shippingQuoteBySeller = new Map(
        shippingQuote.quotesBySeller.map((quote) => [quote.sellerId, quote])
    );

    const shippingAddress = await db.query.addresses.findFirst({
        where: and(
            eq(addresses.id, validated.shipping_address_id),
            eq(addresses.user_id, user.id)
        ),
    });

    if (!shippingAddress) {
        throw new Error("Alamat pengiriman tidak valid");
    }

    // Get cart items
    const cartItems = await db.query.carts.findMany({
        where: eq(carts.user_id, user.id),
        with: {
            product: {
                with: {
                    variants: {
                        columns: {
                            id: true,
                        },
                    },
                    seller: {
                        columns: { id: true, tier: true },
                    },
                },
            },
            variant: true,
        },
    });

    if (cartItems.length === 0) {
        throw new Error("Cart is empty");
    }

    // Group cart items by seller
    type CartItemWithProduct = typeof cartItems[number];
    const itemsBySeller = cartItems.reduce(
        (acc: Record<string, CartItemWithProduct[]>, item: CartItemWithProduct) => {
            const sellerId = item.product.seller_id;
            if (!acc[sellerId]) {
                acc[sellerId] = [];
            }
            acc[sellerId].push(item);
            return acc;
        },
        {} as Record<string, CartItemWithProduct[]>
    );

    const buyer = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: { id: true, email: true, name: true },
    });

    if (!buyer?.email) {
        throw new Error("Profil pembeli tidak lengkap");
    }

    const createdOrders = [];

    // Create an order for each seller
    for (const sellerId of Object.keys(itemsBySeller)) {
        const items = itemsBySeller[sellerId];
        const subtotal = items.reduce((sum: number, item: CartItemWithProduct) => {
            const linePrice = parseFloat(item.variant?.price ?? item.product.price);
            return sum + linePrice * item.quantity;
        }, 0);
        const sellerShippingQuote = shippingQuoteBySeller.get(sellerId);

        if (!sellerShippingQuote) {
            throw new Error("Gagal menentukan ongkir untuk seller");
        }

        const orderTotal = subtotal + sellerShippingQuote.cost;

        // Enforce per-seller monthly GMV cap based on KYC tier (TRUST-01).
        await ensureSellerWithinMonthlyGmvCap(sellerId, orderTotal);

        // Pre-validate stock and required variant selection before any inserts
        // so we never persist a partial order if the buyer needs to reselect.
        for (const item of items) {
            if (!item.variant && item.product.variants.length > 0) {
                throw new Error("Produk dengan varian harus dipilih ulang sebelum checkout");
            }
            const availableStock = item.variant?.stock ?? item.product.stock;
            if (availableStock < item.quantity) {
                throw new Error(`Stok tidak cukup untuk ${item.product.title}`);
            }
        }

        const [order] = await db
            .insert(orders)
            .values({
                order_number: generateOrderNumber(),
                buyer_id: user.id,
                seller_id: sellerId,
                shipping_address_id: shippingAddress.id,
                status: "PENDING_PAYMENT",
                subtotal: subtotal.toString(),
                shipping_cost: sellerShippingQuote.cost.toString(),
                shipping_provider: sellerShippingQuote.shippingProvider,
                shipping_quote_at: new Date(),
                total: orderTotal.toString(),
                notes: validated.notes,
            })
            .returning();

        // Create order items
        for (const item of items) {
            const linePrice = item.variant?.price ?? item.product.price;

            // MON-01: snapshot platform fee per item using the calculator.
            const unitPrice = parseFloat(linePrice);
            const sellerTier = (item.product.seller?.tier ?? "T0") as "T0" | "T1" | "T2";
            const feeResolution = await calculatePlatformFee({
                price: unitPrice,
                categoryId: item.product.category_id ?? null,
                sellerTier,
            });
            const lineFee = feeResolution.fee * item.quantity;

            await db.insert(order_items).values({
                order_id: order.id,
                product_id: item.product.id,
                variant_id: item.variant?.id,
                quantity: item.quantity,
                price: linePrice,
                fee_rule_id: feeResolution.breakdown?.ruleId ?? null,
                resolved_fee_value: String(lineFee),
                resolved_fee_currency: feeResolution.currency,
            });

            if (item.variant) {
                await db
                    .update(product_variants)
                    .set({
                        stock: item.variant.stock - item.quantity,
                        updated_at: new Date(),
                    })
                    .where(eq(product_variants.id, item.variant.id));
            } else {
                await db
                    .update(products)
                    .set({
                        stock: item.product.stock - item.quantity,
                    })
                    .where(eq(products.id, item.product.id));
            }
        }

        createdOrders.push(order);

        // AFF-02: try affiliate attribution from cookie. Idempotent on order.id.
        try {
            await tryAttributeOrderFromCookie(order.id, user.id, orderTotal);
        } catch (affErr) {
            logger.error("affiliate:attribution_failed", { orderId: order.id, error: String(affErr) });
        }

        // Dispatch ORDER_CREATED notifications to both buyer and seller (AUDIT-02).
        // notify() is idempotent on (event, key); a later re-emit (e.g. when the
        // payment invoice is created) is a safe no-op.
        const buyerItems = items.map((item: CartItemWithProduct) => ({
            title: item.product.title,
            quantity: item.quantity,
            price: formatCurrency(parseFloat(item.variant?.price ?? item.product.price) * item.quantity),
        }));

        await notify({
            event: "ORDER_CREATED",
            audience: "buyer",
            recipientUserId: user.id,
            recipientEmail: buyer.email,
            recipientName: buyer.name,
            orderId: order.id,
            orderNumber: order.order_number,
            items: buyerItems,
            subtotal: formatCurrency(subtotal),
            shippingCost: formatCurrency(sellerShippingQuote.cost),
            total: formatCurrency(orderTotal),
        });

        const seller = await db.query.users.findFirst({
            where: eq(users.id, sellerId),
            columns: { id: true, email: true, name: true, store_name: true },
        });

        if (seller?.email) {
            const sellerItems = items.map((item: CartItemWithProduct) => ({
                name: item.product.title,
                quantity: item.quantity,
                price: parseFloat(item.variant?.price ?? item.product.price) * item.quantity,
            }));

            await notify({
                event: "ORDER_CREATED",
                audience: "seller",
                recipientUserId: sellerId,
                recipientEmail: seller.email,
                recipientName: seller.store_name || seller.name || "Penjual",
                orderId: order.id,
                orderNumber: order.order_number,
                buyerName: buyer.name || "Pembeli",
                items: sellerItems,
                total: orderTotal,
            });
        }
    }

    // Clear cart
    await db.delete(carts).where(eq(carts.user_id, user.id));

    revalidatePath("/cart");
    revalidatePath("/profile/orders");
    revalidatePath("/seller/orders");

    return { success: true, orders: createdOrders };
}

// ============================================
// BARG-03: Create order from accepted offer (locked-price checkout)
// ============================================
const createOrderFromOfferSchema = z.object({
    token: z.string().min(8),
    shipping_address_id: z.string().uuid(),
    shipping_courier: z.enum(["jne", "pos", "tiki"]),
    notes: z.string().max(500).optional(),
});

export async function createOrderFromOffer(input: z.infer<typeof createOrderFromOfferSchema>) {
    const user = await getCurrentUser();
    const validated = createOrderFromOfferSchema.parse(input);

    const resolved = await resolveCheckoutToken(validated.token);
    if (resolved.listing.status !== "PUBLISHED") {
        throw new Error("Produk sudah tidak tersedia.");
    }

    const shippingAddress = await db.query.addresses.findFirst({
        where: and(eq(addresses.id, validated.shipping_address_id), eq(addresses.user_id, user.id)),
    });
    if (!shippingAddress) {
        throw new Error("Alamat pengiriman tidak valid");
    }

    const [productRow] = await db
        .select({
            id: products.id,
            title: products.title,
            seller_id: products.seller_id,
            category_id: products.category_id,
        })
        .from(products)
        .where(eq(products.id, resolved.listing.id));

    if (!productRow) throw new Error("Produk tidak ditemukan.");

    const sellerUser = await db.query.users.findFirst({
        where: eq(users.id, productRow.seller_id),
        columns: { id: true, email: true, name: true, store_name: true, tier: true },
    });
    if (!sellerUser) throw new Error("Penjual tidak ditemukan.");

    // Use locked price from offer; shipping computed live for chosen address+courier.
    const { getCheckoutShippingQuoteForUser } = await import("@/actions/shipping");
    const shippingQuote = await getCheckoutShippingQuoteForUser(
        user.id,
        validated.shipping_address_id,
        validated.shipping_courier
    );
    const sellerQuote = shippingQuote.quotesBySeller.find((q) => q.sellerId === productRow.seller_id);
    if (!sellerQuote) {
        throw new Error("Gagal menentukan ongkir untuk seller ini.");
    }

    const subtotal = resolved.amount;
    const orderTotal = subtotal + sellerQuote.cost;

    await ensureSellerWithinMonthlyGmvCap(productRow.seller_id, orderTotal);

    const feeResolution = await calculatePlatformFee({
        price: subtotal,
        categoryId: productRow.category_id ?? null,
        sellerTier: (sellerUser.tier ?? "T0") as "T0" | "T1" | "T2",
    });

    const [order] = await db
        .insert(orders)
        .values({
            order_number: generateOrderNumber(),
            buyer_id: user.id,
            seller_id: productRow.seller_id,
            shipping_address_id: shippingAddress.id,
            status: "PENDING_PAYMENT",
            subtotal: subtotal.toString(),
            shipping_cost: sellerQuote.cost.toString(),
            shipping_provider: sellerQuote.shippingProvider,
            shipping_quote_at: new Date(),
            total: orderTotal.toString(),
            notes: validated.notes,
        })
        .returning();

    await db.insert(order_items).values({
        order_id: order.id,
        product_id: productRow.id,
        variant_id: resolved.variant?.id ?? null,
        quantity: 1,
        price: subtotal.toString(),
        fee_rule_id: feeResolution.breakdown?.ruleId ?? null,
        resolved_fee_value: String(feeResolution.fee),
        resolved_fee_currency: feeResolution.currency,
    });

    // Stamp the offer as consumed and stop further token reuse.
    await consumeCheckoutToken(resolved.offerId, order.id);

    const buyer = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: { id: true, email: true, name: true },
    });

    if (buyer?.email) {
        await notify({
            event: "ORDER_CREATED",
            audience: "buyer",
            recipientUserId: user.id,
            recipientEmail: buyer.email,
            recipientName: buyer.name,
            orderId: order.id,
            orderNumber: order.order_number,
            items: [{ title: productRow.title, quantity: 1, price: formatCurrency(subtotal) }],
            subtotal: formatCurrency(subtotal),
            shippingCost: formatCurrency(sellerQuote.cost),
            total: formatCurrency(orderTotal),
        });
    }

    if (sellerUser.email) {
        await notify({
            event: "ORDER_CREATED",
            audience: "seller",
            recipientUserId: sellerUser.id,
            recipientEmail: sellerUser.email,
            recipientName: sellerUser.store_name || sellerUser.name || "Penjual",
            orderId: order.id,
            orderNumber: order.order_number,
            buyerName: buyer?.name || "Pembeli",
            items: [{ name: productRow.title, quantity: 1, price: subtotal }],
            total: orderTotal,
        });
    }

    logger.info("order:created_from_offer", {
        offerId: resolved.offerId,
        orderId: order.id,
        amount: subtotal,
    });

    revalidatePath("/profile/orders");
    revalidatePath("/profile/offers");

    return { success: true, orderId: order.id };
}

export async function getBuyerOrders() {
    const user = await getCurrentUser();

    const buyerOrders = await db.query.orders.findMany({
        where: eq(orders.buyer_id, user.id),
        orderBy: [desc(orders.created_at)],
        with: {
            seller: {
                columns: {
                    id: true,
                    name: true,
                    store_name: true,
                },
            },
            items: {
                with: {
                    product: true,
                },
            },
        },
    });

    return buyerOrders;
}

export async function getSellerOrders() {
    const user = await getCurrentUser();

    const sellerOrders = await db.query.orders.findMany({
        where: eq(orders.seller_id, user.id),
        orderBy: [desc(orders.created_at)],
        with: {
            buyer: {
                columns: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            items: {
                with: {
                    product: true,
                },
            },
            shipping_address: true,
        },
    });

    return sellerOrders;
}

export async function updateOrderStatus(
    orderId: string,
    status: "PROCESSING" | "SHIPPED" | "DELIVERED" | "COMPLETED" | "CANCELLED"
) {
    const user = await getCurrentUser();

    // Verify seller ownership
    const order = await db.query.orders.findFirst({
        where: and(eq(orders.id, orderId), eq(orders.seller_id, user.id)),
    });

    if (!order) {
        throw new Error("Order not found or unauthorized");
    }

    const [updated] = await db
        .update(orders)
        .set({
            status,
            updated_at: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

    revalidatePath("/seller/orders");
    revalidatePath("/profile/orders");

    return { success: true, order: updated };
}

export async function getOrderById(orderId: string) {
    const user = await getCurrentUser();

    const order = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
        with: {
            buyer: {
                columns: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            seller: {
                columns: {
                    id: true,
                    name: true,
                    store_name: true,
                },
            },
            items: {
                with: {
                    product: true,
                },
            },
            shipping_address: true,
        },
    });

    if (!order) {
        throw new Error("Order not found");
    }

    // Verify access (buyer or seller)
    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
        throw new Error("Unauthorized");
    }

    return order;
}

// ============================================
// SELLER DASHBOARD STATS
// ============================================

export async function getSellerStats() {
    const user = await getCurrentUser();

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all seller orders
    const allOrders = await db.query.orders.findMany({
        where: eq(orders.seller_id, user.id),
        with: {
            items: true,
        },
    });

    // Calculate stats
    const totalRevenue = allOrders.reduce((sum, order) => {
        if (order.status !== "CANCELLED") {
            return sum + parseFloat(order.total);
        }
        return sum;
    }, 0);

    const todayOrders = allOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= today;
    });

    const newOrdersCount = todayOrders.length;
    const todayRevenue = todayOrders.reduce((sum, order) => {
        if (order.status !== "CANCELLED") {
            return sum + parseFloat(order.total);
        }
        return sum;
    }, 0);

    const pendingShipment = allOrders.filter(order =>
        order.status === "PROCESSING" || order.status === "PENDING_PAYMENT"
    ).length;

    const totalItemsSold = allOrders.reduce((sum, order) => {
        if (order.status !== "CANCELLED") {
            return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
        }
        return sum;
    }, 0);

    // Get seller's products count
    const sellerProducts = await db.query.products.findMany({
        where: eq(products.seller_id, user.id),
    });

    const productCount = sellerProducts.length;
    const lowStockCount = sellerProducts.filter(p => p.stock <= 5).length;

    // Calculate average rating from reviews
    const ratingResult = await db
        .select({
            avgRating: sql<number>`ROUND(AVG(${reviews.rating})::numeric, 1)`,
            totalReviews: sql<number>`COUNT(*)`,
        })
        .from(reviews)
        .where(eq(reviews.seller_id, user.id));

    const avgRating = ratingResult[0]?.avgRating ?? null;
    const totalReviews = Number(ratingResult[0]?.totalReviews ?? 0);

    return {
        totalRevenue,
        todayRevenue,
        newOrdersCount,
        pendingShipment,
        totalItemsSold,
        productCount,
        lowStockCount,
        rating: avgRating,
        totalReviews,
    };
}

export async function getRecentSellerOrders(limit = 5) {
    const user = await getCurrentUser();

    const recentOrders = await db.query.orders.findMany({
        where: eq(orders.seller_id, user.id),
        orderBy: [desc(orders.created_at)],
        limit,
        with: {
            buyer: {
                columns: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            items: {
                with: {
                    product: {
                        columns: {
                            id: true,
                            title: true,
                            images: true,
                            condition: true,
                        },
                    },
                },
            },
        },
    });

    return recentOrders;
}

