import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "./index";
import { users, categories, products } from "./schema";
import { eq } from "drizzle-orm";

// Sample product images from Unsplash (badminton related)
const productImages = {
    rackets: [
        "https://images.unsplash.com/photo-1617083934555-ac7b4d0c8be5?w=800",
        "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800",
        "https://images.unsplash.com/photo-1599577446220-b6542d8d2c92?w=800",
    ],
    shoes: [
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800",
        "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800",
        "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800",
    ],
    bags: [
        "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800",
        "https://images.unsplash.com/photo-1622560480654-d96214fdc887?w=800",
        "https://images.unsplash.com/photo-1547949003-9792a18a2601?w=800",
    ],
    apparel: [
        "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800",
        "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800",
        "https://images.unsplash.com/photo-1571945153237-4929e783af4a?w=800",
    ],
    accessories: [
        "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=800",
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800",
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800",
    ],
};

// Categories data
const categoriesData = [
    { name: "Raket", slug: "rackets", image: productImages.rackets[0] },
    { name: "Sepatu", slug: "shoes", image: productImages.shoes[0] },
    { name: "Tas", slug: "bags", image: productImages.bags[0] },
    { name: "Pakaian", slug: "apparel", image: productImages.apparel[0] },
    { name: "Shuttlecock", slug: "shuttlecocks", image: productImages.accessories[0] },
    { name: "Grip", slug: "grips", image: productImages.accessories[1] },
    { name: "Senar", slug: "strings", image: productImages.accessories[2] },
    { name: "Aksesoris", slug: "accessories", image: productImages.accessories[0] },
];

// Demo seller data
const sellersData = [
    {
        name: "Badminton Pro Shop",
        email: "seller1@demo.com",
        store_name: "Badminton Pro Shop",
        store_slug: "badminton-pro-shop",
        store_description: "Toko resmi perlengkapan badminton berkualitas",
    },
    {
        name: "Sport Corner",
        email: "seller2@demo.com",
        store_name: "Sport Corner",
        store_slug: "sport-corner",
        store_description: "Preloved & new badminton equipment",
    },
    {
        name: "Racket World",
        email: "seller3@demo.com",
        store_name: "Racket World",
        store_slug: "racket-world",
        store_description: "Spesialis raket badminton original",
    },
];

// Products data
const productsData = [
    // Rackets - Yonex
    {
        title: "Yonex Astrox 99 Pro",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "rackets",
        price: "2850000",
        condition: "NEW" as const,
        description: "Raket badminton profesional dengan teknologi Rotational Generator System untuk power smash maksimal. Frame: HM Graphite + Namd + Tungsten. Flex: Stiff. Weight: 4U (83g).",
        images: [productImages.rackets[0], productImages.rackets[1]],
    },
    {
        title: "Yonex Nanoflare 800 Pro",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "rackets",
        price: "2650000",
        condition: "NEW" as const,
        description: "Raket speed terbaik dengan Sonic Flare System. Cocok untuk pemain all-around yang mengutamakan kecepatan. Frame: HM Graphite + Namd.",
        images: [productImages.rackets[1], productImages.rackets[2]],
    },
    {
        title: "Yonex Arcsaber 11 Pro",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "rackets",
        price: "2450000",
        condition: "PRELOVED" as const,
        conditionRating: 9,
        description: "Kondisi 9/10, baru dipakai 2 bulan. Control oriented racket dengan Pocketing Booster untuk akurasi tinggi.",
        images: [productImages.rackets[2], productImages.rackets[0]],
    },
    // Rackets - Li-Ning
    {
        title: "Li-Ning Axforce 100",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "rackets",
        price: "2200000",
        condition: "NEW" as const,
        description: "Power raket dengan TB Nano technology. Head Heavy balance untuk smash yang powerful.",
        images: [productImages.rackets[0]],
    },
    {
        title: "Li-Ning Bladex 900 Moon Max",
        brand: "Li-Ning",
        gender: "MEN" as const,
        categorySlug: "rackets",
        price: "2750000",
        condition: "NEW" as const,
        description: "Signature racket Viktor Axelsen. Wing Stabilizer untuk kestabilan maksimal.",
        images: [productImages.rackets[1]],
    },
    // Rackets - Victor
    {
        title: "Victor Thruster Ryuga II Pro",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "rackets",
        price: "2100000",
        condition: "PRELOVED" as const,
        conditionRating: 8,
        description: "Kondisi 8/10, grip sudah diganti baru. FREE-CORE technology untuk playability optimal.",
        images: [productImages.rackets[2]],
    },
    {
        title: "Victor Auraspeed 100X",
        brand: "Victor",
        gender: "WOMEN" as const,
        categorySlug: "rackets",
        price: "1950000",
        condition: "NEW" as const,
        description: "Raket ringan untuk pemain wanita. PYROFIL material dengan AERO-SWORD frame.",
        images: [productImages.rackets[0], productImages.rackets[1]],
    },
    // Shoes
    {
        title: "Yonex Power Cushion 65 Z3",
        brand: "Yonex",
        gender: "MEN" as const,
        categorySlug: "shoes",
        price: "1850000",
        condition: "NEW" as const,
        description: "Sepatu badminton dengan Power Cushion+ untuk shock absorption terbaik. Size tersedia: 40-45.",
        images: [productImages.shoes[0], productImages.shoes[1]],
    },
    {
        title: "Yonex Aerus Z2 Women",
        brand: "Yonex",
        gender: "WOMEN" as const,
        categorySlug: "shoes",
        price: "1950000",
        condition: "NEW" as const,
        description: "Sepatu ringan untuk wanita dengan GRAPHITE PLATE dan Power Cushion. Size: 36-40.",
        images: [productImages.shoes[1], productImages.shoes[2]],
    },
    {
        title: "Li-Ning Saga II Lite",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "shoes",
        price: "1450000",
        condition: "PRELOVED" as const,
        conditionRating: 9,
        description: "Kondisi 9/10, dipakai 3x. Carbon fiber shank untuk stability. Size 42.",
        images: [productImages.shoes[2]],
    },
    {
        title: "Victor A970ACE",
        brand: "Victor",
        gender: "MEN" as const,
        categorySlug: "shoes",
        price: "1650000",
        condition: "NEW" as const,
        description: "VSR rubber outsole dengan ENERGYMAX 3.0 untuk cushioning optimal.",
        images: [productImages.shoes[0]],
    },
    // Bags
    {
        title: "Yonex Pro Racket Bag 9R",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "bags",
        price: "950000",
        condition: "NEW" as const,
        description: "Tas raket profesional muat 9 raket. Kompartemen termal untuk melindungi senar.",
        images: [productImages.bags[0], productImages.bags[1]],
    },
    {
        title: "Li-Ning Backpack ABSS289",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "bags",
        price: "650000",
        condition: "NEW" as const,
        description: "Backpack multifungsi dengan kompartemen raket samping. Kapasitas 25L.",
        images: [productImages.bags[1]],
    },
    {
        title: "Victor BR9213 Racket Bag 12R",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "bags",
        price: "1250000",
        condition: "PRELOVED" as const,
        conditionRating: 8,
        description: "Tas besar muat 12 raket. Kondisi 8/10, ada sedikit noda di bagian bawah.",
        images: [productImages.bags[2]],
    },
    // Apparel
    {
        title: "Yonex Game Shirt Men 10512",
        brand: "Yonex",
        gender: "MEN" as const,
        categorySlug: "apparel",
        price: "450000",
        condition: "NEW" as const,
        description: "Jersey badminton dengan Very Cool Dry technology. Size M-XXL tersedia.",
        images: [productImages.apparel[0]],
    },
    {
        title: "Li-Ning Competition Dress Women",
        brand: "Li-Ning",
        gender: "WOMEN" as const,
        categorySlug: "apparel",
        price: "550000",
        condition: "NEW" as const,
        description: "Dress badminton wanita dengan AT DRY technology. Size S-XL.",
        images: [productImages.apparel[1]],
    },
    {
        title: "Victor Game Shirt Unisex T-40002",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "apparel",
        price: "380000",
        condition: "NEW" as const,
        description: "Kaos olahraga quick dry dengan print sublimation.",
        images: [productImages.apparel[2]],
    },
    {
        title: "Yonex Training Shorts Men",
        brand: "Yonex",
        gender: "MEN" as const,
        categorySlug: "apparel",
        price: "350000",
        condition: "PRELOVED" as const,
        conditionRating: 9,
        description: "Celana pendek latihan. Kondisi 9/10, dicuci dry clean. Size L.",
        images: [productImages.apparel[0]],
    },
    // Accessories - Shuttlecocks
    {
        title: "Yonex Aerosensa 50 (1 Tube)",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "shuttlecocks",
        price: "285000",
        condition: "NEW" as const,
        description: "Kok bulu angsa grade A+ untuk turnamen. Speed 77. Isi 12 pcs.",
        images: [productImages.accessories[0]],
    },
    {
        title: "Li-Ning A+90 Gold (1 Tube)",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "shuttlecocks",
        price: "265000",
        condition: "NEW" as const,
        description: "Shuttlecock premium untuk kompetisi. Bulu angsa pilihan.",
        images: [productImages.accessories[1]],
    },
    // Grips
    {
        title: "Yonex Super Grap AC102 (3 Pack)",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "grips",
        price: "85000",
        condition: "NEW" as const,
        description: "Overgrip anti-slip dengan absorption tinggi. Tersedia berbagai warna.",
        images: [productImages.accessories[1]],
    },
    {
        title: "Victor Cushion Wrap GR262",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "grips",
        price: "45000",
        condition: "NEW" as const,
        description: "Grip replacement dengan cushion tebal. Nyaman untuk long play.",
        images: [productImages.accessories[2]],
    },
    // Strings
    {
        title: "Yonex BG65 Titanium (10m)",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "strings",
        price: "95000",
        condition: "NEW" as const,
        description: "Senar durability tinggi dengan coating titanium. Gauge 0.70mm.",
        images: [productImages.accessories[2]],
    },
    {
        title: "Yonex Exbolt 65 (10m)",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "strings",
        price: "125000",
        condition: "NEW" as const,
        description: "Senar repulsion tinggi untuk power player. Gauge 0.65mm.",
        images: [productImages.accessories[0]],
    },
    {
        title: "Li-Ning No.1 String (10m)",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "strings",
        price: "85000",
        condition: "NEW" as const,
        description: "Senar all-around dengan control dan durability seimbang.",
        images: [productImages.accessories[1]],
    },
    // More accessories
    {
        title: "Yonex Wristband AC489 (2 Pack)",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "accessories",
        price: "95000",
        condition: "NEW" as const,
        description: "Wristband cotton absorbent untuk menyerap keringat.",
        images: [productImages.accessories[0]],
    },
    {
        title: "Victor Headband SP131",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "accessories",
        price: "75000",
        condition: "NEW" as const,
        description: "Headband elastis dengan logo Victor embroidery.",
        images: [productImages.accessories[1]],
    },
    {
        title: "Yonex Racket Sack AC544",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "accessories",
        price: "125000",
        condition: "NEW" as const,
        description: "Cover raket single dengan padding ringan. Drawstring closure.",
        images: [productImages.accessories[2]],
    },
];

function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .substring(0, 100);
}

export async function seedDatabase() {
    console.log("🌱 Starting database seed...\n");

    try {
        // 1. Create demo sellers
        console.log("👥 Creating demo sellers...");
        const createdSellers: string[] = [];

        for (const seller of sellersData) {
            const existing = await db.query.users.findFirst({
                where: eq(users.email, seller.email),
            });

            if (existing) {
                console.log(`   ⏭️  Seller ${seller.name} already exists`);
                createdSellers.push(existing.id);
            } else {
                const [newUser] = await db
                    .insert(users)
                    .values({
                        name: seller.name,
                        email: seller.email,
                        emailVerified: true,
                        role: "USER",
                        store_name: seller.store_name,
                        store_slug: seller.store_slug,
                        store_description: seller.store_description,
                    })
                    .returning();
                createdSellers.push(newUser.id);
                console.log(`   ✅ Created seller: ${seller.name}`);
            }
        }

        // 2. Create categories
        console.log("\n📁 Creating categories...");
        const categoryMap: Record<string, string> = {};

        for (const cat of categoriesData) {
            const existing = await db.query.categories.findFirst({
                where: eq(categories.slug, cat.slug),
            });

            if (existing) {
                categoryMap[cat.slug] = existing.id;
                console.log(`   ⏭️  Category ${cat.name} already exists`);
            } else {
                const [newCat] = await db
                    .insert(categories)
                    .values({
                        name: cat.name,
                        slug: cat.slug,
                        image: cat.image,
                    })
                    .returning();
                categoryMap[cat.slug] = newCat.id;
                console.log(`   ✅ Created category: ${cat.name}`);
            }
        }

        // 3. Create products
        console.log("\n📦 Creating products...");
        let productCount = 0;

        for (const product of productsData) {
            const slug = generateSlug(product.title);
            const existing = await db.query.products.findFirst({
                where: eq(products.slug, slug),
            });

            if (existing) {
                console.log(`   ⏭️  Product ${product.title} already exists`);
                continue;
            }

            // Assign random seller
            const sellerId = createdSellers[Math.floor(Math.random() * createdSellers.length)];
            const categoryId = categoryMap[product.categorySlug];

            await db.insert(products).values({
                seller_id: sellerId,
                category_id: categoryId,
                title: product.title,
                slug: slug,
                description: product.description,
                brand: product.brand,
                gender: product.gender,
                price: product.price,
                condition: product.condition,
                condition_rating: product.conditionRating || null,
                stock: 1,
                status: "PUBLISHED",
                images: product.images,
            });

            productCount++;
            console.log(`   ✅ Created product: ${product.title}`);
        }

        console.log("\n✨ Seed completed!");
        console.log(`   - Sellers: ${createdSellers.length}`);
        console.log(`   - Categories: ${Object.keys(categoryMap).length}`);
        console.log(`   - Products: ${productCount}`);

    } catch (error) {
        console.error("❌ Seed failed:", error);
        throw error;
    }
}

// Run if called directly
seedDatabase()
    .then(() => {
        console.log("\n🎉 Done!");
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
