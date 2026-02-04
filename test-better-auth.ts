// Set DATABASE_URL BEFORE any imports to ensure it's used
process.env.DATABASE_URL = "postgresql://jbr_user:jbr_dev_password@localhost:5555/jualbeliraket";
process.env.BETTER_AUTH_SECRET = "supersecretkey123456789012345678901234567890";

// Import auth after setting env vars
import { auth } from "./src/lib/auth";

async function test() {
    console.log("=== BETTER AUTH TEST ===\n");

    // Test 1: Sign-in with buyer
    console.log("1. Testing sign-in with buyer1@demo.com...");
    try {
        const result = await auth.api.signInEmail({
            body: { email: "buyer1@demo.com", password: "demo123" }
        });
        console.log("   ✅ SUCCESS:", result.user?.email);
    } catch (e: any) {
        console.log("   ❌ FAILED:", e.message || e);
    }

    // Test 2: Sign-in with seller
    console.log("\n2. Testing sign-in with seller1@demo.com...");
    try {
        const result = await auth.api.signInEmail({
            body: { email: "seller1@demo.com", password: "demo123" }
        });
        console.log("   ✅ SUCCESS:", result.user?.email);
    } catch (e: any) {
        console.log("   ❌ FAILED:", e.message || e);
    }

    // Test 3: Sign-up new user
    console.log("\n3. Testing sign-up new user...");
    const testEmail = "newuser" + Date.now() + "@test.com";
    try {
        const result = await auth.api.signUpEmail({
            body: { email: testEmail, password: "TestPass123", name: "New Test User" }
        });
        console.log("   ✅ SUCCESS:", result.user?.email);

        // Test 4: Sign-in with newly created user
        console.log("\n4. Testing sign-in with newly created user...");
        const signIn = await auth.api.signInEmail({
            body: { email: testEmail, password: "TestPass123" }
        });
        console.log("   ✅ SUCCESS:", signIn.user?.email);
    } catch (e: any) {
        console.log("   ❌ FAILED:", e.message || e);
    }

    // Test 5: Get session (should fail without cookie)
    console.log("\n5. Testing getSession (should return null without session)...");
    try {
        const session = await auth.api.getSession({
            headers: new Headers()
        });
        console.log("   ✅ Result:", session ? "Has session" : "No session (expected)");
    } catch (e: any) {
        console.log("   ❌ FAILED:", e.message || e);
    }

    console.log("\n=== TEST COMPLETE ===");
    process.exit(0);
}

test();
