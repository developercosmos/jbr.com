// Load environment first before any imports
require("dotenv").config({ path: ".env.local" });

// Now import and run seed
async function main() {
    const { seedDatabase } = await import("./seed-data");
    await seedDatabase();
}

main()
    .then(() => {
        console.log("\n🎉 Done!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
