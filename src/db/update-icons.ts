// Load environment first before any imports
require("dotenv").config({ path: ".env.local" });

async function main() {
    const { db } = await import("./index");
    const { categories } = await import("./schema");
    const { eq } = await import("drizzle-orm");

    const iconMap: Record<string, string> = {
        rackets: "Target",
        shoes: "Footprints",
        bags: "Backpack",
        apparel: "Shirt",
        shuttlecocks: "Circle",
        grips: "Zap",
        strings: "Gauge",
        accessories: "Sparkles",
    };

    console.log("🎨 Updating category icons...\n");

    for (const [slug, icon] of Object.entries(iconMap)) {
        const result = await db
            .update(categories)
            .set({ icon })
            .where(eq(categories.slug, slug))
            .returning();

        if (result.length > 0) {
            console.log(`   ✅ ${slug} → ${icon}`);
        } else {
            console.log(`   ⏭️  ${slug} not found`);
        }
    }

    console.log("\n✨ Done!");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Error:", err);
        process.exit(1);
    });
