process.env.DATABASE_URL = "postgresql://jbr_user:jbr_dev_password@localhost:5555/jualbeliraket";
process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || "your-super-secret-key-here-change-in-production";

type StepResult = {
    step: string;
    ok: boolean;
    details: string;
};

const baseUrl = "http://localhost:3000";

async function main() {
    const results: StepResult[] = [];

    // Lazy imports keep env assignment above effective for DB client.
    const { db } = await import("../src/db");
    const { users, products, carts } = await import("../src/db/schema");
    const { eq, and, ne } = await import("drizzle-orm");

    // 1) Authenticate buyer and capture session cookie.
    let sessionCookie = "";
    try {
        const loginResp = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "buyer1@demo.com",
                password: "demo123",
            }),
        });

        const setCookie = loginResp.headers.get("set-cookie") || "";
        const tokenMatch = setCookie.match(/better-auth\.session_token=([^;]+)/);
        if (!loginResp.ok || !tokenMatch?.[1]) {
            throw new Error(`login status ${loginResp.status}, cookie present: ${Boolean(tokenMatch?.[1])}`);
        }

        sessionCookie = `better-auth.session_token=${tokenMatch[1]}`;
        results.push({ step: "Login", ok: true, details: `HTTP ${loginResp.status}` });
    } catch (error) {
        results.push({ step: "Login", ok: false, details: error instanceof Error ? error.message : "unknown error" });
        printAndExit(results, 1);
        return;
    }

    // 2) Resolve buyer + a published product not owned by buyer.
    let buyerId = "";
    let productId = "";
    let productSlug = "";
    let productTitle = "";
    try {
        const buyer = await db.query.users.findFirst({
            where: eq(users.email, "buyer1@demo.com"),
        });

        if (!buyer) {
            throw new Error("buyer1@demo.com not found");
        }

        const product = await db.query.products.findFirst({
            where: and(eq(products.status, "PUBLISHED"), ne(products.seller_id, buyer.id)),
        });

        if (!product) {
            throw new Error("no published product available for buyer journey");
        }

        buyerId = buyer.id;
        productId = product.id;
        productSlug = product.slug;
        productTitle = product.title;

        results.push({ step: "Resolve Product", ok: true, details: `${productSlug}` });
    } catch (error) {
        results.push({ step: "Resolve Product", ok: false, details: error instanceof Error ? error.message : "unknown error" });
        printAndExit(results, 1);
        return;
    }

    // 3) Product page must be reachable with authenticated session.
    try {
        const productResp = await fetch(`${baseUrl}/product/${productSlug}`, {
            headers: { Cookie: sessionCookie },
            redirect: "manual",
        });

        if (productResp.status !== 200) {
            throw new Error(`HTTP ${productResp.status}`);
        }

        const productHtml = await productResp.text();
        if (!productHtml.includes(productTitle)) {
            throw new Error("product title not found in product page response");
        }

        results.push({ step: "Open Product", ok: true, details: `HTTP ${productResp.status}` });
    } catch (error) {
        results.push({ step: "Open Product", ok: false, details: error instanceof Error ? error.message : "unknown error" });
        printAndExit(results, 1);
        return;
    }

    // 4) Add to cart state transition for buyer-product pair.
    try {
        const existing = await db.query.carts.findFirst({
            where: and(eq(carts.user_id, buyerId), eq(carts.product_id, productId)),
        });

        if (existing) {
            await db.update(carts)
                .set({ quantity: existing.quantity + 1 })
                .where(eq(carts.id, existing.id));
        } else {
            await db.insert(carts).values({
                user_id: buyerId,
                product_id: productId,
                quantity: 1,
            });
        }

        const after = await db.query.carts.findFirst({
            where: and(eq(carts.user_id, buyerId), eq(carts.product_id, productId)),
        });

        if (!after || after.quantity < 1) {
            throw new Error("cart row not created/updated");
        }

        results.push({ step: "Add To Cart", ok: true, details: `quantity=${after.quantity}` });
    } catch (error) {
        results.push({ step: "Add To Cart", ok: false, details: error instanceof Error ? error.message : "unknown error" });
        printAndExit(results, 1);
        return;
    }

    // 5) Cart page should render for authenticated buyer and contain product title.
    try {
        const cartResp = await fetch(`${baseUrl}/cart`, {
            headers: { Cookie: sessionCookie },
            redirect: "manual",
        });

        if (cartResp.status !== 200) {
            throw new Error(`HTTP ${cartResp.status}`);
        }

        const cartHtml = await cartResp.text();
        if (!cartHtml.includes(productTitle)) {
            throw new Error("cart page does not contain added product title");
        }

        results.push({ step: "Open Cart", ok: true, details: `HTTP ${cartResp.status}` });
    } catch (error) {
        results.push({ step: "Open Cart", ok: false, details: error instanceof Error ? error.message : "unknown error" });
        printAndExit(results, 1);
        return;
    }

    // 6) Checkout page should be reachable and not redirect to login.
    try {
        const checkoutResp = await fetch(`${baseUrl}/checkout`, {
            headers: { Cookie: sessionCookie },
            redirect: "manual",
        });

        if (checkoutResp.status !== 200) {
            throw new Error(`HTTP ${checkoutResp.status}`);
        }

        const checkoutHtml = await checkoutResp.text();
        if (checkoutHtml.includes("/auth/login") || checkoutHtml.includes("Keranjang Kosong")) {
            throw new Error("checkout response indicates unauthenticated or empty-cart state");
        }

        results.push({ step: "Open Checkout", ok: true, details: `HTTP ${checkoutResp.status}` });
    } catch (error) {
        results.push({ step: "Open Checkout", ok: false, details: error instanceof Error ? error.message : "unknown error" });
        printAndExit(results, 1);
        return;
    }

    printAndExit(results, 0);
}

function printAndExit(results: StepResult[], code: number) {
    console.log("\n=== AUTHENTICATED BUYER JOURNEY QA ===");
    for (const r of results) {
        const icon = r.ok ? "PASS" : "FAIL";
        console.log(`${icon} | ${r.step} | ${r.details}`);
    }

    const allPass = results.length > 0 && results.every((r) => r.ok);
    console.log(`RESULT | ${allPass ? "GREEN" : "RED"}`);
    process.exit(code);
}

void main();
