import { config } from "dotenv";
// Load env before any other imports
config({ path: ".env.local" });

import { db } from "./index";
import { users, accounts } from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

// ============================================
// ADMIN CREDENTIALS
// ============================================
const ADMIN_EMAIL = "admin@jbr.com";
const ADMIN_PASSWORD = "admin123";
const ADMIN_NAME = "Administrator";

async function createAdmin() {
    console.log("🔐 Creating admin account...\n");

    try {
        // Check if admin already exists
        const existingAdmin = await db.query.users.findFirst({
            where: eq(users.email, ADMIN_EMAIL),
        });

        if (existingAdmin) {
            console.log(`⚠️  Admin with email ${ADMIN_EMAIL} already exists!`);
            
            // Update role to ADMIN if not already
            if (existingAdmin.role !== "ADMIN") {
                await db
                    .update(users)
                    .set({ role: "ADMIN" })
                    .where(eq(users.id, existingAdmin.id));
                console.log(`✅ Updated ${ADMIN_EMAIL} role to ADMIN`);
            } else {
                console.log(`✅ ${ADMIN_EMAIL} is already an ADMIN`);
            }
            
            process.exit(0);
        }

        // Generate unique IDs
        const userId = crypto.randomUUID();
        const accountId = crypto.randomUUID();

        // Hash password with bcrypt (same as Better Auth config)
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

        // Create admin user
        await db.insert(users).values({
            id: userId,
            name: ADMIN_NAME,
            email: ADMIN_EMAIL,
            email_verified: true,
            role: "ADMIN",
            created_at: new Date(),
            updated_at: new Date(),
        });

        // Create account for credential login (Better Auth format)
        await db.insert(accounts).values({
            id: accountId,
            user_id: userId,
            account_id: userId,
            provider_id: "credential",
            password: hashedPassword,
            created_at: new Date(),
            updated_at: new Date(),
        });

        console.log("✅ Admin account created successfully!\n");
        console.log("📧 Email:", ADMIN_EMAIL);
        console.log("🔑 Password:", ADMIN_PASSWORD);
        console.log("👤 Role: ADMIN\n");
        console.log("🎉 You can now login at /auth/login with these credentials.\n");

    } catch (error) {
        console.error("❌ Error creating admin:", error);
        process.exit(1);
    }

    process.exit(0);
}

createAdmin();
