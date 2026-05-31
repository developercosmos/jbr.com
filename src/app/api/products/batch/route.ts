import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { inArray, eq, and } from "drizzle-orm";

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
            // Only expose published listings — never DRAFT / MODERATED / ARCHIVED
            // (those would leak unlisted products by guessing an id).
            .where(and(inArray(products.id, ids), eq(products.status, "PUBLISHED")));

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
