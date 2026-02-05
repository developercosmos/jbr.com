"use server";

import { db } from "@/db";
import { orders, order_items, carts, products } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, desc, and, sql, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
    notes: z.string().optional(),
});

export async function createOrderFromCart(input: z.infer<typeof createOrderSchema>) {
    const user = await getCurrentUser();
    const validated = createOrderSchema.parse(input);

    // Get cart items
    const cartItems = await db.query.carts.findMany({
        where: eq(carts.user_id, user.id),
        with: {
            product: true,
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

    const createdOrders = [];

    // Create an order for each seller
    for (const sellerId of Object.keys(itemsBySeller)) {
        const items = itemsBySeller[sellerId];
        const subtotal = items.reduce((sum: number, item: CartItemWithProduct) => {
            return sum + parseFloat(item.product.price) * item.quantity;
        }, 0);

        const [order] = await db
            .insert(orders)
            .values({
                order_number: generateOrderNumber(),
                buyer_id: user.id,
                seller_id: sellerId,
                shipping_address_id: validated.shipping_address_id,
                status: "PENDING_PAYMENT",
                subtotal: subtotal.toString(),
                shipping_cost: "0",
                total: subtotal.toString(),
                notes: validated.notes,
            })
            .returning();

        // Create order items
        for (const item of items) {
            await db.insert(order_items).values({
                order_id: order.id,
                product_id: item.product.id,
                quantity: item.quantity,
                price: item.product.price,
            });

            // Update product stock
            await db
                .update(products)
                .set({
                    stock: item.product.stock - item.quantity,
                })
                .where(eq(products.id, item.product.id));
        }

        createdOrders.push(order);
    }

    // Clear cart
    await db.delete(carts).where(eq(carts.user_id, user.id));

    revalidatePath("/cart");
    revalidatePath("/profile/orders");
    revalidatePath("/seller/orders");

    return { success: true, orders: createdOrders };
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

    return {
        totalRevenue,
        todayRevenue,
        newOrdersCount,
        pendingShipment,
        totalItemsSold,
        productCount,
        lowStockCount,
        rating: null as number | null, // Will be calculated from reviews when available
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

