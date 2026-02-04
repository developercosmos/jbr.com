import { config } from "dotenv";
// Load env before any other imports
config({ path: ".env.local" });

import { db } from "./index";
import { users, categories, products, accounts, conversations, messages } from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

// ============================================
// DEMO CREDENTIALS
// ============================================
// All demo accounts use the same password for easy testing
const DEMO_PASSWORD = "demo123";

// Sample product images from Unsplash (badminton related)
const productImages = {
    rackets: [
        "https://images.unsplash.com/photo-1617083934555-ac7b4d0c8be5?w=800",
        "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800",
        "https://images.unsplash.com/photo-1599577446220-b6542d8d2c92?w=800",
        "https://images.unsplash.com/photo-1613916975836-d7e16adc1cb2?w=800",
    ],
    shoes: [
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800",
        "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800",
        "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800",
        "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800",
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
    shuttlecocks: [
        "https://images.unsplash.com/photo-1613916975836-d7e16adc1cb2?w=800",
        "https://images.unsplash.com/photo-1617083934555-ac7b4d0c8be5?w=800",
    ],
    grips: [
        "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=800",
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800",
    ],
    strings: [
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800",
        "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=800",
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
    { name: "Shuttlecock", slug: "shuttlecocks", image: productImages.shuttlecocks[0] },
    { name: "Grip", slug: "grips", image: productImages.grips[0] },
    { name: "Senar", slug: "strings", image: productImages.strings[0] },
    { name: "Aksesoris", slug: "accessories", image: productImages.accessories[0] },
];

// Demo seller data with login credentials
const sellersData = [
    {
        name: "Badminton Pro Shop",
        email: "seller1@demo.com",
        store_name: "Badminton Pro Shop",
        store_slug: "badminton-pro-shop",
        store_description: "Toko resmi perlengkapan badminton berkualitas. Menjual raket, sepatu, dan aksesoris dari brand ternama.",
    },
    {
        name: "Sport Corner",
        email: "seller2@demo.com",
        store_name: "Sport Corner",
        store_slug: "sport-corner",
        store_description: "Preloved & new badminton equipment. Menyediakan perlengkapan badminton berkualitas dengan harga terjangkau.",
    },
    {
        name: "Racket World",
        email: "seller3@demo.com",
        store_name: "Racket World",
        store_slug: "racket-world",
        store_description: "Spesialis raket badminton original. Tersedia berbagai pilihan raket dari Yonex, Li-Ning, dan Victor.",
    },
];

// Demo customer data with login credentials
const customersData = [
    {
        name: "Budi Santoso",
        email: "buyer1@demo.com",
    },
    {
        name: "Siti Rahayu",
        email: "buyer2@demo.com",
    },
    {
        name: "Andi Pratama",
        email: "buyer3@demo.com",
    },
];

// Products data - 10 per category
const productsData = [
    // ===================== RACKETS (10) =====================
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
    {
        title: "Li-Ning Axforce 100",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "rackets",
        price: "2200000",
        condition: "NEW" as const,
        description: "Power raket dengan TB Nano technology. Head Heavy balance untuk smash yang powerful.",
        images: [productImages.rackets[0], productImages.rackets[3]],
    },
    {
        title: "Li-Ning Bladex 900 Moon Max",
        brand: "Li-Ning",
        gender: "MEN" as const,
        categorySlug: "rackets",
        price: "2750000",
        condition: "NEW" as const,
        description: "Signature racket Viktor Axelsen. Wing Stabilizer untuk kestabilan maksimal saat smash.",
        images: [productImages.rackets[1], productImages.rackets[2]],
    },
    {
        title: "Victor Thruster Ryuga II Pro",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "rackets",
        price: "2100000",
        condition: "PRELOVED" as const,
        conditionRating: 8,
        description: "Kondisi 8/10, grip sudah diganti baru. FREE-CORE technology untuk playability optimal.",
        images: [productImages.rackets[2], productImages.rackets[3]],
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
    {
        title: "Yonex Voltric Z Force II",
        brand: "Yonex",
        gender: "MEN" as const,
        categorySlug: "rackets",
        price: "1800000",
        condition: "PRELOVED" as const,
        conditionRating: 7,
        description: "Kondisi 7/10, sedikit goresan di frame. Legendary power racket dengan Tri-Voltage System.",
        images: [productImages.rackets[3], productImages.rackets[0]],
    },
    {
        title: "Li-Ning Turbocharging 75C",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "rackets",
        price: "1650000",
        condition: "NEW" as const,
        description: "All-around racket dengan Dynamic-Optimum Frame. Cocok untuk pemula hingga intermediate.",
        images: [productImages.rackets[1], productImages.rackets[3]],
    },
    {
        title: "Victor Jetspeed S12F",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "rackets",
        price: "1950000",
        condition: "NEW" as const,
        description: "Fast racket dengan Aerodynamic frame design. Grip size G5. String tension max 30 lbs.",
        images: [productImages.rackets[2], productImages.rackets[0]],
    },

    // ===================== SHOES (10) =====================
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
        images: [productImages.shoes[2], productImages.shoes[3]],
    },
    {
        title: "Victor A970ACE",
        brand: "Victor",
        gender: "MEN" as const,
        categorySlug: "shoes",
        price: "1650000",
        condition: "NEW" as const,
        description: "VSR rubber outsole dengan ENERGYMAX 3.0 untuk cushioning optimal. Size 40-44.",
        images: [productImages.shoes[0], productImages.shoes[3]],
    },
    {
        title: "Yonex Power Cushion 88 Dial 2",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "shoes",
        price: "2100000",
        condition: "NEW" as const,
        description: "Dial-wire system untuk quick fit adjustment. Power Cushion dan Double Raschel Mesh.",
        images: [productImages.shoes[1], productImages.shoes[2]],
    },
    {
        title: "Li-Ning Ranger TD",
        brand: "Li-Ning",
        gender: "MEN" as const,
        categorySlug: "shoes",
        price: "1250000",
        condition: "NEW" as const,
        description: "Entry level badminton shoes dengan Tuff Tip protection. Size 39-44 tersedia.",
        images: [productImages.shoes[3], productImages.shoes[0]],
    },
    {
        title: "Victor SH-A830II",
        brand: "Victor",
        gender: "WOMEN" as const,
        categorySlug: "shoes",
        price: "1350000",
        condition: "NEW" as const,
        description: "Women's badminton shoes dengan ENERGYMAX outsole. Warna pink/white. Size 36-40.",
        images: [productImages.shoes[2], productImages.shoes[1]],
    },
    {
        title: "Yonex Comfort Z3",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "shoes",
        price: "1550000",
        condition: "PRELOVED" as const,
        conditionRating: 8,
        description: "Kondisi 8/10, outsole masih tebal. Comfort-focused design dengan 3D Power Carbon. Size 42.",
        images: [productImages.shoes[0], productImages.shoes[2]],
    },
    {
        title: "Li-Ning AYAR003 Pro",
        brand: "Li-Ning",
        gender: "MEN" as const,
        categorySlug: "shoes",
        price: "1750000",
        condition: "NEW" as const,
        description: "Professional badminton shoes dengan BOUNSE+ technology. Carbon plate untuk explosiveness.",
        images: [productImages.shoes[1], productImages.shoes[3]],
    },
    {
        title: "Victor P9200II",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "shoes",
        price: "1450000",
        condition: "NEW" as const,
        description: "All-round performance shoes dengan REACTIVE-FOAM. Lightweight dan breathable.",
        images: [productImages.shoes[2], productImages.shoes[0]],
    },

    // ===================== BAGS (10) =====================
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
        images: [productImages.bags[1], productImages.bags[2]],
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
        images: [productImages.bags[2], productImages.bags[0]],
    },
    {
        title: "Yonex Tournament Bag BA31WEX",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "bags",
        price: "1100000",
        condition: "NEW" as const,
        description: "Tournament series bag dengan shoe compartment terpisah. Capacity 6 rackets.",
        images: [productImages.bags[0], productImages.bags[2]],
    },
    {
        title: "Li-Ning Rectangular Bag ABJR026",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "bags",
        price: "850000",
        condition: "NEW" as const,
        description: "Rectangular bag dengan 3 compartments. Fits up to 9 rackets. Waterproof material.",
        images: [productImages.bags[1], productImages.bags[0]],
    },
    {
        title: "Victor BR9712 Racket Bag",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "bags",
        price: "750000",
        condition: "NEW" as const,
        description: "Compact racket bag untuk 6 raket. Ventilated shoe pocket. Warna navy/orange.",
        images: [productImages.bags[2], productImages.bags[1]],
    },
    {
        title: "Yonex Pro Backpack",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "bags",
        price: "550000",
        condition: "PRELOVED" as const,
        conditionRating: 9,
        description: "Backpack ringkas, kondisi 9/10. Muat 2 raket dengan cover. Laptop sleeve 15 inch.",
        images: [productImages.bags[0], productImages.bags[1]],
    },
    {
        title: "Li-Ning Duffel Bag ABLT007",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "bags",
        price: "450000",
        condition: "NEW" as const,
        description: "Duffel bag serbaguna untuk gym dan badminton. Water-resistant fabric.",
        images: [productImages.bags[1], productImages.bags[2]],
    },
    {
        title: "Victor Backpack BR9014",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "bags",
        price: "500000",
        condition: "NEW" as const,
        description: "Sporty backpack dengan racket holder. Ergonomic shoulder straps.",
        images: [productImages.bags[2], productImages.bags[0]],
    },
    {
        title: "Yonex Active Series Bag",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "bags",
        price: "420000",
        condition: "NEW" as const,
        description: "Entry level racket bag. Fits 3 rackets. Adjustable shoulder strap.",
        images: [productImages.bags[0], productImages.bags[2]],
    },

    // ===================== APPAREL (10) =====================
    {
        title: "Yonex Game Shirt Men 10512",
        brand: "Yonex",
        gender: "MEN" as const,
        categorySlug: "apparel",
        price: "450000",
        condition: "NEW" as const,
        description: "Jersey badminton dengan Very Cool Dry technology. Size M-XXL tersedia.",
        images: [productImages.apparel[0], productImages.apparel[1]],
    },
    {
        title: "Li-Ning Competition Dress Women",
        brand: "Li-Ning",
        gender: "WOMEN" as const,
        categorySlug: "apparel",
        price: "550000",
        condition: "NEW" as const,
        description: "Dress badminton wanita dengan AT DRY technology. Size S-XL.",
        images: [productImages.apparel[1], productImages.apparel[2]],
    },
    {
        title: "Victor Game Shirt Unisex T-40002",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "apparel",
        price: "350000",
        condition: "NEW" as const,
        description: "Kaos olahraga ringan dengan ECO-DRY fabric. Quick dry dan anti-bacterial.",
        images: [productImages.apparel[2], productImages.apparel[0]],
    },
    {
        title: "Yonex Game Short Men 15122",
        brand: "Yonex",
        gender: "MEN" as const,
        categorySlug: "apparel",
        price: "380000",
        condition: "NEW" as const,
        description: "Celana pendek badminton dengan side pocket. Elastic waistband. Size M-XL.",
        images: [productImages.apparel[0], productImages.apparel[2]],
    },
    {
        title: "Li-Ning Skort Women ASKR162",
        brand: "Li-Ning",
        gender: "WOMEN" as const,
        categorySlug: "apparel",
        price: "420000",
        condition: "NEW" as const,
        description: "Skort (skirt + short) dengan inner pants. Breathable fabric. Size S-L.",
        images: [productImages.apparel[1], productImages.apparel[0]],
    },
    {
        title: "Victor Jacket Unisex J-20608",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "apparel",
        price: "650000",
        condition: "PRELOVED" as const,
        conditionRating: 9,
        description: "Jaket training kondisi 9/10. Windbreaker material dengan hood. Size L.",
        images: [productImages.apparel[2], productImages.apparel[1]],
    },
    {
        title: "Yonex Polo Shirt 12134",
        brand: "Yonex",
        gender: "MEN" as const,
        categorySlug: "apparel",
        price: "320000",
        condition: "NEW" as const,
        description: "Polo shirt casual untuk badminton. Collar design. Size M-XXL.",
        images: [productImages.apparel[0], productImages.apparel[1]],
    },
    {
        title: "Li-Ning Training Pants AKLT419",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "apparel",
        price: "480000",
        condition: "NEW" as const,
        description: "Celana training panjang dengan zipper ankle. Lightweight material.",
        images: [productImages.apparel[1], productImages.apparel[2]],
    },
    {
        title: "Victor Tank Top Women T-26200",
        brand: "Victor",
        gender: "WOMEN" as const,
        categorySlug: "apparel",
        price: "280000",
        condition: "NEW" as const,
        description: "Tank top badminton wanita dengan racerback design. Size S-XL.",
        images: [productImages.apparel[2], productImages.apparel[0]],
    },
    {
        title: "Yonex Track Suit 50098",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "apparel",
        price: "1250000",
        condition: "NEW" as const,
        description: "Set training jacket + pants. Official tournament design. Size S-XXL.",
        images: [productImages.apparel[0], productImages.apparel[2]],
    },

    // ===================== SHUTTLECOCKS (10) =====================
    {
        title: "Yonex Aerosensa 50 (AS-50)",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "shuttlecocks",
        price: "450000",
        condition: "NEW" as const,
        description: "Tournament grade goose feather shuttlecock. 12 pcs per tube. Speed 77.",
        images: [productImages.shuttlecocks[0], productImages.shuttlecocks[1]],
    },
    {
        title: "Li-Ning A+90 Competition",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "shuttlecocks",
        price: "380000",
        condition: "NEW" as const,
        description: "Official competition shuttlecock dengan premium goose feathers. 12 pcs.",
        images: [productImages.shuttlecocks[1], productImages.shuttlecocks[0]],
    },
    {
        title: "Victor Champion No.1 Gold",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "shuttlecocks",
        price: "420000",
        condition: "NEW" as const,
        description: "Premium tournament shuttlecock. Excellent durability dan flight stability.",
        images: [productImages.shuttlecocks[0], productImages.shuttlecocks[1]],
    },
    {
        title: "Yonex Mavis 350",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "shuttlecocks",
        price: "150000",
        condition: "NEW" as const,
        description: "Nylon shuttlecock untuk latihan. Durability tinggi, 6 pcs per tube.",
        images: [productImages.shuttlecocks[1], productImages.shuttlecocks[0]],
    },
    {
        title: "Li-Ning G500 Practice",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "shuttlecocks",
        price: "280000",
        condition: "NEW" as const,
        description: "Training grade feather shuttlecock. Good durability untuk latihan rutin. 12 pcs.",
        images: [productImages.shuttlecocks[0], productImages.shuttlecocks[1]],
    },
    {
        title: "Victor NS5000 Nylon",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "shuttlecocks",
        price: "120000",
        condition: "NEW" as const,
        description: "Nylon shuttlecock untuk pemula. Cocok untuk outdoor play. 6 pcs.",
        images: [productImages.shuttlecocks[1], productImages.shuttlecocks[0]],
    },
    {
        title: "Yonex Aerosensa 30 (AS-30)",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "shuttlecocks",
        price: "350000",
        condition: "NEW" as const,
        description: "Training & club level feather shuttlecock. Balance antara durability dan performance.",
        images: [productImages.shuttlecocks[0], productImages.shuttlecocks[1]],
    },
    {
        title: "Li-Ning A+300 Club",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "shuttlecocks",
        price: "320000",
        condition: "NEW" as const,
        description: "Club level shuttlecock dengan duck feather berkualitas. 12 pcs per tube.",
        images: [productImages.shuttlecocks[1], productImages.shuttlecocks[0]],
    },
    {
        title: "Victor Gold Champion 1",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "shuttlecocks",
        price: "390000",
        condition: "NEW" as const,
        description: "High-end competition shuttlecock. Hand-selected goose feathers. 12 pcs.",
        images: [productImages.shuttlecocks[0], productImages.shuttlecocks[1]],
    },
    {
        title: "Yonex Mavis 2000",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "shuttlecocks",
        price: "180000",
        condition: "NEW" as const,
        description: "Premium nylon shuttlecock dengan natural cork base. 6 pcs.",
        images: [productImages.shuttlecocks[1], productImages.shuttlecocks[0]],
    },

    // ===================== GRIPS (10) =====================
    {
        title: "Yonex Super Grap AC-102",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "grips",
        price: "85000",
        condition: "NEW" as const,
        description: "Overgrip populer dengan tacky feel. 3 pcs pack. Warna: hitam/putih/kuning.",
        images: [productImages.grips[0], productImages.grips[1]],
    },
    {
        title: "Li-Ning GP1000 Overgrip",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "grips",
        price: "65000",
        condition: "NEW" as const,
        description: "Soft feel overgrip dengan moisture absorption. 3 pcs pack.",
        images: [productImages.grips[1], productImages.grips[0]],
    },
    {
        title: "Victor GR262 Towel Grip",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "grips",
        price: "95000",
        condition: "NEW" as const,
        description: "Towel grip untuk penyerapan keringat maksimal. Cocok untuk pemain dengan tangan basah.",
        images: [productImages.grips[0], productImages.grips[1]],
    },
    {
        title: "Yonex Nanogy AC-150",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "grips",
        price: "75000",
        condition: "NEW" as const,
        description: "Thin overgrip (0.6mm) untuk feel yang lebih dekat dengan racket. 3 pcs.",
        images: [productImages.grips[1], productImages.grips[0]],
    },
    {
        title: "Li-Ning GP2000 Cushion Grip",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "grips",
        price: "55000",
        condition: "NEW" as const,
        description: "Replacement grip dengan cushion layer. Comfort untuk long play sessions.",
        images: [productImages.grips[0], productImages.grips[1]],
    },
    {
        title: "Victor GR234 Wet Overgrip",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "grips",
        price: "70000",
        condition: "NEW" as const,
        description: "Overgrip dengan wet feel, tacky surface. Pack of 3 dengan pilihan warna.",
        images: [productImages.grips[1], productImages.grips[0]],
    },
    {
        title: "Yonex Wave Grap AC-104",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "grips",
        price: "90000",
        condition: "NEW" as const,
        description: "Overgrip dengan wave texture untuk extra grip. Anti-slip design. 3 pcs.",
        images: [productImages.grips[0], productImages.grips[1]],
    },
    {
        title: "Li-Ning GP1100 Pro Grip",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "grips",
        price: "80000",
        condition: "NEW" as const,
        description: "Professional grade overgrip dengan durability tinggi. Used by pro players.",
        images: [productImages.grips[1], productImages.grips[0]],
    },
    {
        title: "Victor Fishbone Grip GR251",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "grips",
        price: "85000",
        condition: "NEW" as const,
        description: "Unique fishbone pattern untuk enhanced grip. 3 pieces pack.",
        images: [productImages.grips[0], productImages.grips[1]],
    },
    {
        title: "Yonex Clean Grap AC-146",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "grips",
        price: "95000",
        condition: "NEW" as const,
        description: "Antibacterial overgrip dengan clean feel. Hygienic design. 3 pcs pack.",
        images: [productImages.grips[1], productImages.grips[0]],
    },

    // ===================== STRINGS (10) =====================
    {
        title: "Yonex BG65",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "strings",
        price: "85000",
        condition: "NEW" as const,
        description: "Best-selling string dengan durability tinggi. Gauge: 0.70mm. All-round performance.",
        images: [productImages.strings[0], productImages.strings[1]],
    },
    {
        title: "Li-Ning No.1",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "strings",
        price: "95000",
        condition: "NEW" as const,
        description: "Premium string dengan repulsion tinggi. Gauge: 0.65mm. Power-oriented.",
        images: [productImages.strings[1], productImages.strings[0]],
    },
    {
        title: "Victor VBS-70",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "strings",
        price: "80000",
        condition: "NEW" as const,
        description: "All-round string dengan balance antara power dan control. Gauge: 0.70mm.",
        images: [productImages.strings[0], productImages.strings[1]],
    },
    {
        title: "Yonex BG80",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "strings",
        price: "110000",
        condition: "NEW" as const,
        description: "High repulsion string untuk power player. Gauge: 0.68mm. Braided construction.",
        images: [productImages.strings[1], productImages.strings[0]],
    },
    {
        title: "Li-Ning No.7",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "strings",
        price: "75000",
        condition: "NEW" as const,
        description: "Durable string untuk player yang sering putus senar. Gauge: 0.70mm.",
        images: [productImages.strings[0], productImages.strings[1]],
    },
    {
        title: "Victor VBS-66 Nano",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "strings",
        price: "90000",
        condition: "NEW" as const,
        description: "Thin gauge string untuk feel dan control. Gauge: 0.66mm. Nano technology.",
        images: [productImages.strings[1], productImages.strings[0]],
    },
    {
        title: "Yonex Aerosonic",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "strings",
        price: "125000",
        condition: "NEW" as const,
        description: "Thinnest string 0.61mm untuk repulsion maksimal. Pro player choice.",
        images: [productImages.strings[0], productImages.strings[1]],
    },
    {
        title: "Li-Ning No.5",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "strings",
        price: "85000",
        condition: "NEW" as const,
        description: "Popular string dengan balance properties. Gauge: 0.68mm. Good control.",
        images: [productImages.strings[1], productImages.strings[0]],
    },
    {
        title: "Victor VBS-68P Power",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "strings",
        price: "95000",
        condition: "NEW" as const,
        description: "Power-focused string dengan high repulsion. Gauge: 0.68mm. New material.",
        images: [productImages.strings[0], productImages.strings[1]],
    },
    {
        title: "Yonex NBG99",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "strings",
        price: "115000",
        condition: "NEW" as const,
        description: "Nanogy 99 untuk control dan feel. Gauge: 0.69mm. Multifilament core.",
        images: [productImages.strings[1], productImages.strings[0]],
    },

    // ===================== ACCESSORIES (10) =====================
    {
        title: "Yonex Wristband AC-489",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "accessories",
        price: "65000",
        condition: "NEW" as const,
        description: "Wristband cotton untuk menyerap keringat. Pair (2 pcs). Warna putih/hitam.",
        images: [productImages.accessories[0], productImages.accessories[1]],
    },
    {
        title: "Victor Headband SP131",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "accessories",
        price: "75000",
        condition: "NEW" as const,
        description: "Headband elastis dengan logo Victor embroidery. Sweat absorption.",
        images: [productImages.accessories[1], productImages.accessories[2]],
    },
    {
        title: "Yonex Racket Sack AC544",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "accessories",
        price: "125000",
        condition: "NEW" as const,
        description: "Cover raket single dengan padding ringan. Drawstring closure.",
        images: [productImages.accessories[2], productImages.accessories[0]],
    },
    {
        title: "Li-Ning Ankle Support AQAR044",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "accessories",
        price: "180000",
        condition: "NEW" as const,
        description: "Ankle support untuk proteksi cedera. Adjustable compression. Size S-XL.",
        images: [productImages.accessories[0], productImages.accessories[2]],
    },
    {
        title: "Victor Sport Socks VS-890",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "accessories",
        price: "85000",
        condition: "NEW" as const,
        description: "Badminton socks dengan cushion sole. Anti-slip design. Pack of 2 pairs.",
        images: [productImages.accessories[1], productImages.accessories[0]],
    },
    {
        title: "Yonex Knee Support MPS-80",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "accessories",
        price: "220000",
        condition: "NEW" as const,
        description: "Knee protector dengan compression support. Breathable material.",
        images: [productImages.accessories[2], productImages.accessories[1]],
    },
    {
        title: "Li-Ning Sport Cap AMXR010",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "accessories",
        price: "150000",
        condition: "NEW" as const,
        description: "Sport cap dengan adjustable strap. UV protection. Quick dry material.",
        images: [productImages.accessories[0], productImages.accessories[1]],
    },
    {
        title: "Victor Towel TW-163",
        brand: "Victor",
        gender: "UNISEX" as const,
        categorySlug: "accessories",
        price: "120000",
        condition: "NEW" as const,
        description: "Sport towel 100% cotton. Size 40x80cm. Soft dan absorbent.",
        images: [productImages.accessories[1], productImages.accessories[2]],
    },
    {
        title: "Yonex Vibration Stopper AC-165",
        brand: "Yonex",
        gender: "UNISEX" as const,
        categorySlug: "accessories",
        price: "45000",
        condition: "NEW" as const,
        description: "Dampener untuk mengurangi vibrasi senar. Pack of 2. Berbagai warna.",
        images: [productImages.accessories[2], productImages.accessories[0]],
    },
    {
        title: "Li-Ning Water Bottle AQAR058",
        brand: "Li-Ning",
        gender: "UNISEX" as const,
        categorySlug: "accessories",
        price: "95000",
        condition: "NEW" as const,
        description: "Sport water bottle 750ml. BPA-free plastic. Leak-proof cap.",
        images: [productImages.accessories[0], productImages.accessories[2]],
    },
];

// Sample chat messages for demo
const chatMessages = [
    // Conversation 1: Buyer asking about racket
    {
        messages: [
            { sender: "buyer", content: "Halo, saya tertarik dengan Yonex Astrox 99 Pro. Apakah masih tersedia?" },
            { sender: "seller", content: "Halo kak! Iya masih ready stock. Ini barang baru original ya dengan garansi resmi Yonex." },
            { sender: "buyer", content: "Bisa nego harganya kak?" },
            { sender: "seller", content: "Untuk Astrox 99 Pro sudah harga pas kak, ini sudah paling murah dibanding toko lain. Tapi saya kasih free grip Yonex Super Grap ya." },
            { sender: "buyer", content: "Oke deal. Saya order ya. Kirim ke Jakarta Selatan bisa?" },
            { sender: "seller", content: "Siap kak, bisa kirim pakai JNE atau SiCepat. Estimasi 2-3 hari sampai Jakarta. Silahkan checkout ya!" },
        ]
    },
    // Conversation 2: Buyer asking about preloved shoe
    {
        messages: [
            { sender: "buyer", content: "Kak, sepatu Li-Ning Saga II Lite kondisinya gimana ya?" },
            { sender: "seller", content: "Kondisi 9/10 kak, baru dipakai 3x aja. Sol masih tebal, tidak ada lecet. Saya jual karena kurang pas ukurannya." },
            { sender: "buyer", content: "Ada foto aslinya kak?" },
            { sender: "seller", content: "Sudah saya foto detail di gambar produk kak. Itu foto asli barang yang dijual. Mau foto dari angle lain?" },
            { sender: "buyer", content: "Boleh kak, dari bagian solnya" },
            { sender: "seller", content: "Oke siap, nanti saya kirim ya. Atau kalau mau video call untuk lihat langsung juga bisa." },
        ]
    },
    // Conversation 3: Buyer asking about shuttlecock
    {
        messages: [
            { sender: "buyer", content: "Yonex AS-50 buat kompetisi cocok ga kak?" },
            { sender: "seller", content: "Cocok banget kak! AS-50 ini grade tournament, biasa dipakai di pertandingan resmi. Flight stability-nya bagus." },
            { sender: "buyer", content: "Bedanya sama AS-30 apa ya?" },
            { sender: "seller", content: "AS-50 kualitas bulu angsa lebih premium, durability dan consistency-nya lebih baik. AS-30 lebih ke latihan/club level." },
            { sender: "buyer", content: "Kalau ambil 5 tube ada diskon?" },
            { sender: "seller", content: "Boleh kak, untuk 5 tube saya kasih harga Rp 420.000/tube ya. Total jadi Rp 2.100.000. Tertarik?" },
        ]
    },
];

function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .substring(0, 100);
}

async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

export async function seedDatabase() {
    console.log("🌱 Starting database seed...\n");
    console.log("📝 Demo credentials:");
    console.log("   Password for all accounts: " + DEMO_PASSWORD);
    console.log("   Sellers: seller1@demo.com, seller2@demo.com, seller3@demo.com");
    console.log("   Buyers: buyer1@demo.com, buyer2@demo.com, buyer3@demo.com\n");

    try {
        const hashedPassword = await hashPassword(DEMO_PASSWORD);

        // 1. Create demo sellers with login credentials
        console.log("👥 Creating demo sellers...");
        const createdSellers: { id: string; email: string }[] = [];

        for (const seller of sellersData) {
            const existing = await db.query.users.findFirst({
                where: eq(users.email, seller.email),
            });

            if (existing) {
                console.log(`   ⏭️  Seller ${seller.name} already exists`);
                createdSellers.push({ id: existing.id, email: seller.email });
            } else {
                const userId = crypto.randomUUID();
                const accountId = crypto.randomUUID();

                // Create user
                await db.insert(users).values({
                    id: userId,
                    name: seller.name,
                    email: seller.email,
                    email_verified: true,
                    role: "USER",
                    store_name: seller.store_name,
                    store_slug: seller.store_slug,
                    store_description: seller.store_description,
                });

                // Create account with password for login
                await db.insert(accounts).values({
                    id: accountId,
                    user_id: userId,
                    account_id: userId,
                    provider_id: "credential",
                    password: hashedPassword,
                });

                createdSellers.push({ id: userId, email: seller.email });
                console.log(`   ✅ Created seller: ${seller.name} (${seller.email})`);
            }
        }

        // 2. Create demo customers with login credentials
        console.log("\n👤 Creating demo customers...");
        const createdCustomers: { id: string; email: string }[] = [];

        for (const customer of customersData) {
            const existing = await db.query.users.findFirst({
                where: eq(users.email, customer.email),
            });

            if (existing) {
                console.log(`   ⏭️  Customer ${customer.name} already exists`);
                createdCustomers.push({ id: existing.id, email: customer.email });
            } else {
                const userId = crypto.randomUUID();
                const accountId = crypto.randomUUID();

                // Create user
                await db.insert(users).values({
                    id: userId,
                    name: customer.name,
                    email: customer.email,
                    email_verified: true,
                    role: "USER",
                });

                // Create account with password for login
                await db.insert(accounts).values({
                    id: accountId,
                    user_id: userId,
                    account_id: userId,
                    provider_id: "credential",
                    password: hashedPassword,
                });

                createdCustomers.push({ id: userId, email: customer.email });
                console.log(`   ✅ Created customer: ${customer.name} (${customer.email})`);
            }
        }

        // 3. Create categories
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

        // 4. Create products
        console.log("\n📦 Creating products...");
        let productCount = 0;
        const createdProducts: { id: string; title: string; sellerId: string }[] = [];

        for (const product of productsData) {
            const slug = generateSlug(product.title);
            const existing = await db.query.products.findFirst({
                where: eq(products.slug, slug),
            });

            if (existing) {
                console.log(`   ⏭️  Product ${product.title} already exists`);
                createdProducts.push({ id: existing.id, title: product.title, sellerId: existing.seller_id });
                continue;
            }

            // Assign seller based on product index for even distribution
            const sellerIndex = productCount % createdSellers.length;
            const sellerId = createdSellers[sellerIndex].id;
            const categoryId = categoryMap[product.categorySlug];

            const [newProduct] = await db.insert(products).values({
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
            }).returning();

            createdProducts.push({ id: newProduct.id, title: product.title, sellerId: sellerId });
            productCount++;
            console.log(`   ✅ Created product: ${product.title}`);
        }

        // 5. Create sample conversations and messages
        console.log("\n💬 Creating sample chats...");
        let chatCount = 0;

        // Only create if we have both customers and products
        if (createdCustomers.length > 0 && createdProducts.length > 0) {
            for (let i = 0; i < Math.min(chatMessages.length, createdCustomers.length); i++) {
                const customer = createdCustomers[i];
                const product = createdProducts[i * 3]; // Pick different products
                const seller = createdSellers.find(s => s.id === product.sellerId) || createdSellers[0];

                // Check if conversation exists
                const existingConv = await db.query.conversations.findFirst({
                    where: eq(conversations.buyer_id, customer.id),
                });

                if (existingConv) {
                    console.log(`   ⏭️  Conversation for ${customer.email} already exists`);
                    continue;
                }

                // Create conversation
                const [conv] = await db.insert(conversations).values({
                    buyer_id: customer.id,
                    seller_id: seller.id,
                    product_id: product.id,
                }).returning();

                // Add messages
                const chatData = chatMessages[i];
                for (const msg of chatData.messages) {
                    const senderId = msg.sender === "buyer" ? customer.id : seller.id;
                    await db.insert(messages).values({
                        conversation_id: conv.id,
                        sender_id: senderId,
                        content: msg.content,
                        is_read: true,
                    });
                }

                chatCount++;
                console.log(`   ✅ Created chat: ${customer.email} <-> ${seller.email} about "${product.title}"`);
            }
        }

        console.log("\n✨ Seed completed!");
        console.log(`   - Sellers: ${createdSellers.length}`);
        console.log(`   - Customers: ${createdCustomers.length}`);
        console.log(`   - Categories: ${Object.keys(categoryMap).length}`);
        console.log(`   - Products: ${productCount}`);
        console.log(`   - Conversations: ${chatCount}`);
        console.log("\n🔐 Login credentials:");
        console.log(`   All accounts use password: ${DEMO_PASSWORD}`);
        console.log("   Sellers: seller1@demo.com, seller2@demo.com, seller3@demo.com");
        console.log("   Buyers: buyer1@demo.com, buyer2@demo.com, buyer3@demo.com");

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
