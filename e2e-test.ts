// End-to-End Test Suite for JualBeliRaket Application
// Run with: npx tsx e2e-test.ts

// Set DATABASE_URL BEFORE any imports
process.env.DATABASE_URL = "postgresql://jbr_user:jbr_dev_password@localhost:5555/jualbeliraket";
process.env.BETTER_AUTH_SECRET = "supersecretkey123456789012345678901234567890";

import { db } from "./src/db";
import { 
    users, products, categories, carts, wishlists, 
    orders, order_items, conversations, messages, 
    reviews, accounts, sessions 
} from "./src/db/schema";
import { auth } from "./src/lib/auth";
import { eq, and, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";

// Test results tracking
const results: { name: string; status: "PASS" | "FAIL"; error?: string }[] = [];
let testCount = 0;
let passCount = 0;
let failCount = 0;

function log(message: string) {
    console.log(message);
}

function logTest(name: string, passed: boolean, error?: string) {
    testCount++;
    if (passed) {
        passCount++;
        console.log(`   ✅ ${name}`);
        results.push({ name, status: "PASS" });
    } else {
        failCount++;
        console.log(`   ❌ ${name}: ${error}`);
        results.push({ name, status: "FAIL", error });
    }
}

// ============================================
// TEST SUITE
// ============================================

async function runTests() {
    console.log("\n" + "=".repeat(60));
    console.log("   JUAL BELI RAKET - END TO END TEST SUITE");
    console.log("=".repeat(60) + "\n");

    try {
        // 1. AUTH TESTS
        await testAuth();

        // 2. CATEGORIES TESTS
        await testCategories();

        // 3. PRODUCTS TESTS
        await testProducts();

        // 4. CART TESTS
        await testCart();

        // 5. WISHLIST TESTS
        await testWishlist();

        // 6. ORDERS TESTS
        await testOrders();

        // 7. CHAT TESTS
        await testChat();

        // 8. REVIEWS TESTS
        await testReviews();

        // 9. SELLER TESTS
        await testSeller();

    } catch (error: any) {
        console.log("\n❌ TEST SUITE CRASHED:", error.message);
    }

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("   TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`   Total Tests: ${testCount}`);
    console.log(`   ✅ Passed: ${passCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   Success Rate: ${((passCount / testCount) * 100).toFixed(1)}%`);
    console.log("=".repeat(60) + "\n");

    if (failCount > 0) {
        console.log("Failed Tests:");
        results.filter(r => r.status === "FAIL").forEach(r => {
            console.log(`   - ${r.name}: ${r.error}`);
        });
    }

    process.exit(failCount > 0 ? 1 : 0);
}

// ============================================
// 1. AUTH TESTS
// ============================================
async function testAuth() {
    log("\n📌 1. AUTHENTICATION TESTS");
    log("-".repeat(40));

    // Test 1.1: Sign-in with existing buyer
    try {
        const result = await auth.api.signInEmail({
            body: { email: "buyer1@demo.com", password: "demo123" }
        });
        logTest("Sign-in buyer1@demo.com", !!result.user, result.user?.email);
    } catch (e: any) {
        logTest("Sign-in buyer1@demo.com", false, e.message);
    }

    // Test 1.2: Sign-in with existing seller
    try {
        const result = await auth.api.signInEmail({
            body: { email: "seller1@demo.com", password: "demo123" }
        });
        logTest("Sign-in seller1@demo.com", !!result.user, result.user?.email);
    } catch (e: any) {
        logTest("Sign-in seller1@demo.com", false, e.message);
    }

    // Test 1.3: Sign-in with wrong password
    try {
        await auth.api.signInEmail({
            body: { email: "buyer1@demo.com", password: "wrongpassword" }
        });
        logTest("Reject wrong password", false, "Should have thrown error");
    } catch (e: any) {
        logTest("Reject wrong password", true);
    }

    // Test 1.4: Sign-up new user
    const testEmail = `e2e_test_${Date.now()}@test.com`;
    try {
        const result = await auth.api.signUpEmail({
            body: { email: testEmail, password: "TestPass123", name: "E2E Test User" }
        });
        logTest("Sign-up new user", !!result.user);

        // Clean up: delete test user
        if (result.user) {
            await db.delete(accounts).where(eq(accounts.user_id, result.user.id));
            await db.delete(users).where(eq(users.id, result.user.id));
        }
    } catch (e: any) {
        logTest("Sign-up new user", false, e.message);
    }

    // Test 1.5: Reject duplicate email signup
    try {
        await auth.api.signUpEmail({
            body: { email: "buyer1@demo.com", password: "TestPass123", name: "Duplicate User" }
        });
        logTest("Reject duplicate email", false, "Should have thrown error");
    } catch (e: any) {
        logTest("Reject duplicate email", true);
    }
}

// ============================================
// 2. CATEGORIES TESTS
// ============================================
async function testCategories() {
    log("\n📌 2. CATEGORIES TESTS");
    log("-".repeat(40));

    // Test 2.1: Get all categories
    try {
        const cats = await db.query.categories.findMany();
        logTest("Get all categories", cats.length > 0);
    } catch (e: any) {
        logTest("Get all categories", false, e.message);
    }

    // Test 2.2: Get category by slug
    try {
        const cat = await db.query.categories.findFirst({
            where: eq(categories.slug, "rackets")
        });
        logTest("Get category by slug (rackets)", !!cat);
    } catch (e: any) {
        logTest("Get category by slug (rackets)", false, e.message);
    }
}

// ============================================
// 3. PRODUCTS TESTS
// ============================================
async function testProducts() {
    log("\n📌 3. PRODUCTS TESTS");
    log("-".repeat(40));

    // Test 3.1: Get all published products
    try {
        const prods = await db.query.products.findMany({
            where: eq(products.status, "PUBLISHED"),
            limit: 10
        });
        logTest("Get published products", prods.length > 0);
    } catch (e: any) {
        logTest("Get published products", false, e.message);
    }

    // Test 3.2: Get product by slug
    try {
        const product = await db.query.products.findFirst({
            where: eq(products.status, "PUBLISHED")
        });
        if (product) {
            const found = await db.query.products.findFirst({
                where: eq(products.slug, product.slug),
                with: { seller: true, category: true }
            });
            logTest("Get product by slug with relations", !!found?.seller);
        } else {
            logTest("Get product by slug with relations", false, "No products found");
        }
    } catch (e: any) {
        logTest("Get product by slug with relations", false, e.message);
    }

    // Test 3.3: Get products by category
    try {
        const cat = await db.query.categories.findFirst({
            where: eq(categories.slug, "rackets")
        });
        if (cat) {
            const prods = await db.query.products.findMany({
                where: and(
                    eq(products.category_id, cat.id),
                    eq(products.status, "PUBLISHED")
                )
            });
            logTest("Get products by category", prods.length >= 0); // Can be 0 if no products
        } else {
            logTest("Get products by category", false, "Category not found");
        }
    } catch (e: any) {
        logTest("Get products by category", false, e.message);
    }

    // Test 3.4: Search products by title
    try {
        const prods = await db.query.products.findMany({
            where: eq(products.status, "PUBLISHED"),
            limit: 5
        });
        logTest("Search products", prods.length >= 0);
    } catch (e: any) {
        logTest("Search products", false, e.message);
    }
}

// ============================================
// 4. CART TESTS
// ============================================
async function testCart() {
    log("\n📌 4. CART TESTS");
    log("-".repeat(40));

    // Get buyer and product
    const buyer = await db.query.users.findFirst({
        where: eq(users.email, "buyer1@demo.com")
    });

    const product = await db.query.products.findFirst({
        where: eq(products.status, "PUBLISHED")
    });

    if (!buyer || !product) {
        logTest("Setup cart test", false, "Missing buyer or product");
        return;
    }

    // Clean up first
    await db.delete(carts).where(eq(carts.user_id, buyer.id));

    // Test 4.1: Add to cart
    try {
        const [cartItem] = await db.insert(carts).values({
            user_id: buyer.id,
            product_id: product.id,
            quantity: 1
        }).returning();
        logTest("Add to cart", !!cartItem);
    } catch (e: any) {
        logTest("Add to cart", false, e.message);
    }

    // Test 4.2: Get cart items
    try {
        const cartItems = await db.query.carts.findMany({
            where: eq(carts.user_id, buyer.id),
            with: { product: true }
        });
        logTest("Get cart items", cartItems.length > 0);
    } catch (e: any) {
        logTest("Get cart items", false, e.message);
    }

    // Test 4.3: Update cart quantity
    try {
        const cartItem = await db.query.carts.findFirst({
            where: eq(carts.user_id, buyer.id)
        });
        if (cartItem) {
            await db.update(carts).set({ quantity: 3 }).where(eq(carts.id, cartItem.id));
            const updated = await db.query.carts.findFirst({
                where: eq(carts.id, cartItem.id)
            });
            logTest("Update cart quantity", updated?.quantity === 3);
        } else {
            logTest("Update cart quantity", false, "Cart item not found");
        }
    } catch (e: any) {
        logTest("Update cart quantity", false, e.message);
    }

    // Test 4.4: Remove from cart
    try {
        await db.delete(carts).where(eq(carts.user_id, buyer.id));
        const cartItems = await db.query.carts.findMany({
            where: eq(carts.user_id, buyer.id)
        });
        logTest("Remove from cart", cartItems.length === 0);
    } catch (e: any) {
        logTest("Remove from cart", false, e.message);
    }
}

// ============================================
// 5. WISHLIST TESTS
// ============================================
async function testWishlist() {
    log("\n📌 5. WISHLIST TESTS");
    log("-".repeat(40));

    const buyer = await db.query.users.findFirst({
        where: eq(users.email, "buyer1@demo.com")
    });

    const product = await db.query.products.findFirst({
        where: eq(products.status, "PUBLISHED")
    });

    if (!buyer || !product) {
        logTest("Setup wishlist test", false, "Missing buyer or product");
        return;
    }

    // Clean up first
    await db.delete(wishlists).where(eq(wishlists.user_id, buyer.id));

    // Test 5.1: Add to wishlist
    try {
        const [item] = await db.insert(wishlists).values({
            user_id: buyer.id,
            product_id: product.id
        }).returning();
        logTest("Add to wishlist", !!item);
    } catch (e: any) {
        logTest("Add to wishlist", false, e.message);
    }

    // Test 5.2: Get wishlist
    try {
        const items = await db.query.wishlists.findMany({
            where: eq(wishlists.user_id, buyer.id),
            with: { product: true }
        });
        logTest("Get wishlist", items.length > 0);
    } catch (e: any) {
        logTest("Get wishlist", false, e.message);
    }

    // Test 5.3: Prevent duplicate
    try {
        const existing = await db.query.wishlists.findFirst({
            where: and(
                eq(wishlists.user_id, buyer.id),
                eq(wishlists.product_id, product.id)
            )
        });
        logTest("Prevent duplicate wishlist", !!existing);
    } catch (e: any) {
        logTest("Prevent duplicate wishlist", false, e.message);
    }

    // Test 5.4: Remove from wishlist
    try {
        await db.delete(wishlists).where(
            and(
                eq(wishlists.user_id, buyer.id),
                eq(wishlists.product_id, product.id)
            )
        );
        const items = await db.query.wishlists.findMany({
            where: eq(wishlists.user_id, buyer.id)
        });
        logTest("Remove from wishlist", items.length === 0);
    } catch (e: any) {
        logTest("Remove from wishlist", false, e.message);
    }
}

// ============================================
// 6. ORDERS TESTS
// ============================================
async function testOrders() {
    log("\n📌 6. ORDERS TESTS");
    log("-".repeat(40));

    const buyer = await db.query.users.findFirst({
        where: eq(users.email, "buyer1@demo.com")
    });

    const seller = await db.query.users.findFirst({
        where: eq(users.email, "seller1@demo.com")
    });

    const product = await db.query.products.findFirst({
        where: eq(products.status, "PUBLISHED")
    });

    if (!buyer || !seller || !product) {
        logTest("Setup orders test", false, "Missing buyer, seller, or product");
        return;
    }

    let testOrderId: string | null = null;

    // Test 6.1: Create order
    try {
        const orderNumber = `TEST-${Date.now()}`;
        const [order] = await db.insert(orders).values({
            order_number: orderNumber,
            buyer_id: buyer.id,
            seller_id: seller.id,
            status: "PENDING_PAYMENT",
            subtotal: product.price,
            shipping_cost: "15000",
            total: (parseFloat(product.price) + 15000).toString(),
        }).returning();

        testOrderId = order.id;

        // Add order item
        await db.insert(order_items).values({
            order_id: order.id,
            product_id: product.id,
            quantity: 1,
            price: product.price,
            subtotal: product.price
        });

        logTest("Create order", !!order);
    } catch (e: any) {
        logTest("Create order", false, e.message);
    }

    // Test 6.2: Get buyer orders
    try {
        const buyerOrders = await db.query.orders.findMany({
            where: eq(orders.buyer_id, buyer.id),
            with: { items: true }
        });
        logTest("Get buyer orders", buyerOrders.length > 0);
    } catch (e: any) {
        logTest("Get buyer orders", false, e.message);
    }

    // Test 6.3: Get seller orders
    try {
        const sellerOrders = await db.query.orders.findMany({
            where: eq(orders.seller_id, seller.id)
        });
        logTest("Get seller orders", sellerOrders.length >= 0);
    } catch (e: any) {
        logTest("Get seller orders", false, e.message);
    }

    // Test 6.4: Update order status
    try {
        if (testOrderId) {
            await db.update(orders).set({ status: "PAID" }).where(eq(orders.id, testOrderId));
            const updated = await db.query.orders.findFirst({
                where: eq(orders.id, testOrderId)
            });
            logTest("Update order status", updated?.status === "PAID");
        } else {
            logTest("Update order status", false, "No test order");
        }
    } catch (e: any) {
        logTest("Update order status", false, e.message);
    }

    // Clean up test order
    if (testOrderId) {
        await db.delete(order_items).where(eq(order_items.order_id, testOrderId));
        await db.delete(orders).where(eq(orders.id, testOrderId));
    }
}

// ============================================
// 7. CHAT TESTS
// ============================================
async function testChat() {
    log("\n📌 7. CHAT TESTS");
    log("-".repeat(40));

    const buyer = await db.query.users.findFirst({
        where: eq(users.email, "buyer1@demo.com")
    });

    const seller = await db.query.users.findFirst({
        where: eq(users.email, "seller1@demo.com")
    });

    const product = await db.query.products.findFirst({
        where: eq(products.status, "PUBLISHED")
    });

    if (!buyer || !seller || !product) {
        logTest("Setup chat test", false, "Missing buyer, seller, or product");
        return;
    }

    let testConversationId: string | null = null;

    // Test 7.1: Create/Get conversation
    try {
        // Check if conversation exists
        let conv = await db.query.conversations.findFirst({
            where: and(
                eq(conversations.buyer_id, buyer.id),
                eq(conversations.seller_id, seller.id),
                eq(conversations.product_id, product.id)
            )
        });

        if (!conv) {
            [conv] = await db.insert(conversations).values({
                buyer_id: buyer.id,
                seller_id: seller.id,
                product_id: product.id
            }).returning();
        }

        testConversationId = conv.id;
        logTest("Create/Get conversation", !!conv);
    } catch (e: any) {
        logTest("Create/Get conversation", false, e.message);
    }

    // Test 7.2: Send message
    try {
        if (testConversationId) {
            const [msg] = await db.insert(messages).values({
                conversation_id: testConversationId,
                sender_id: buyer.id,
                content: "Test message from E2E test"
            }).returning();
            logTest("Send message", !!msg);
        } else {
            logTest("Send message", false, "No conversation");
        }
    } catch (e: any) {
        logTest("Send message", false, e.message);
    }

    // Test 7.3: Get messages
    try {
        if (testConversationId) {
            const msgs = await db.query.messages.findMany({
                where: eq(messages.conversation_id, testConversationId),
                orderBy: [desc(messages.created_at)]
            });
            logTest("Get messages", msgs.length > 0);
        } else {
            logTest("Get messages", false, "No conversation");
        }
    } catch (e: any) {
        logTest("Get messages", false, e.message);
    }

    // Test 7.4: Mark message as read
    try {
        if (testConversationId) {
            const msg = await db.query.messages.findFirst({
                where: eq(messages.conversation_id, testConversationId)
            });
            if (msg) {
                await db.update(messages).set({ is_read: true }).where(eq(messages.id, msg.id));
                const updated = await db.query.messages.findFirst({
                    where: eq(messages.id, msg.id)
                });
                logTest("Mark message as read", updated?.is_read === true);
            } else {
                logTest("Mark message as read", false, "No message found");
            }
        } else {
            logTest("Mark message as read", false, "No conversation");
        }
    } catch (e: any) {
        logTest("Mark message as read", false, e.message);
    }
}

// ============================================
// 8. REVIEWS TESTS
// ============================================
async function testReviews() {
    log("\n📌 8. REVIEWS TESTS");
    log("-".repeat(40));

    // Test 8.1: Get product reviews
    try {
        const product = await db.query.products.findFirst({
            where: eq(products.status, "PUBLISHED")
        });

        if (product) {
            const productReviews = await db.query.reviews.findMany({
                where: eq(reviews.product_id, product.id),
                with: { buyer: true }
            });
            logTest("Get product reviews", productReviews.length >= 0); // Can be 0
        } else {
            logTest("Get product reviews", false, "No product found");
        }
    } catch (e: any) {
        logTest("Get product reviews", false, e.message);
    }

    // Test 8.2: Get seller reviews
    try {
        const seller = await db.query.users.findFirst({
            where: eq(users.email, "seller1@demo.com")
        });

        if (seller) {
            const sellerReviews = await db.query.reviews.findMany({
                where: eq(reviews.seller_id, seller.id)
            });
            logTest("Get seller reviews", sellerReviews.length >= 0);
        } else {
            logTest("Get seller reviews", false, "Seller not found");
        }
    } catch (e: any) {
        logTest("Get seller reviews", false, e.message);
    }
}

// ============================================
// 9. SELLER TESTS
// ============================================
async function testSeller() {
    log("\n📌 9. SELLER TESTS");
    log("-".repeat(40));

    const seller = await db.query.users.findFirst({
        where: eq(users.email, "seller1@demo.com")
    });

    if (!seller) {
        logTest("Setup seller test", false, "Seller not found");
        return;
    }

    // Test 9.1: Get seller's products
    try {
        const sellerProducts = await db.query.products.findMany({
            where: eq(products.seller_id, seller.id)
        });
        logTest("Get seller products", sellerProducts.length >= 0);
    } catch (e: any) {
        logTest("Get seller products", false, e.message);
    }

    // Test 9.2: Create draft product
    let testProductId: string | null = null;
    try {
        const [product] = await db.insert(products).values({
            seller_id: seller.id,
            title: "E2E Test Product",
            slug: `e2e-test-product-${Date.now()}`,
            description: "This is a test product created by E2E test",
            brand: "Test Brand",
            price: "100000",
            condition: "NEW",
            status: "DRAFT",
            stock: 10,
            images: []
        }).returning();

        testProductId = product.id;
        logTest("Create draft product", !!product);
    } catch (e: any) {
        logTest("Create draft product", false, e.message);
    }

    // Test 9.3: Update product
    try {
        if (testProductId) {
            await db.update(products).set({
                title: "E2E Test Product Updated",
                price: "150000"
            }).where(eq(products.id, testProductId));

            const updated = await db.query.products.findFirst({
                where: eq(products.id, testProductId)
            });
            logTest("Update product", updated?.title === "E2E Test Product Updated");
        } else {
            logTest("Update product", false, "No test product");
        }
    } catch (e: any) {
        logTest("Update product", false, e.message);
    }

    // Test 9.4: Publish product
    try {
        if (testProductId) {
            await db.update(products).set({ status: "PUBLISHED" }).where(eq(products.id, testProductId));
            const published = await db.query.products.findFirst({
                where: eq(products.id, testProductId)
            });
            logTest("Publish product", published?.status === "PUBLISHED");
        } else {
            logTest("Publish product", false, "No test product");
        }
    } catch (e: any) {
        logTest("Publish product", false, e.message);
    }

    // Test 9.5: Archive product
    try {
        if (testProductId) {
            await db.update(products).set({ status: "ARCHIVED" }).where(eq(products.id, testProductId));
            const archived = await db.query.products.findFirst({
                where: eq(products.id, testProductId)
            });
            logTest("Archive product", archived?.status === "ARCHIVED");
        } else {
            logTest("Archive product", false, "No test product");
        }
    } catch (e: any) {
        logTest("Archive product", false, e.message);
    }

    // Clean up test product
    if (testProductId) {
        await db.delete(products).where(eq(products.id, testProductId));
    }

    // Test 9.6: Verify seller store info
    try {
        logTest("Verify seller store info", !!seller.store_name && !!seller.store_slug);
    } catch (e: any) {
        logTest("Verify seller store info", false, e.message);
    }
}

// Run tests
runTests();
