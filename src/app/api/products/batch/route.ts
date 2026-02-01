import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { inArray, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get("ids")?.split(",").filter(Boolean);

    if (!ids || ids.length === 0) {
        return NextResponse.json({ products: [] });
    }

    try {
        const foundProducts = await db
            .select({
                id: products.id,
                title: products.title,
                slug: products.slug,
                price: products.price,
                images: products.images,
            })
            .from(products)
            .where(inArray(products.id, ids));

        // Sort by the order of IDs requested
        const sortedProducts = ids
            .map((id) => foundProducts.find((p) => p.id === id))
            .filter(Boolean);

        return NextResponse.json({ products: sortedProducts });
    } catch (error) {
        console.error("Error fetching products:", error);
        return NextResponse.json({ products: [] }, { status: 500 });
    }
}
