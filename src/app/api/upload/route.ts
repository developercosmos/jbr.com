import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { uploadFile, getStorageInfo } from "@/lib/storage";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Parse form data
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const folder = (formData.get("folder") as string) || "uploads";
        // Optional: persist the resulting URL to the user's profile in THIS same
        // request, so the file-write and DB-write are atomic (can't half-complete
        // like the old route-then-Server-Action two-step did → banner saved file
        // but not the DB column → banner never showed).
        const persistAs = (formData.get("persistAs") as string) || "";

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            );
        }

        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Upload file
        const result = await uploadFile(
            folder,
            file.name,
            buffer,
            file.type,
            session.user.id
        );

        // Atomically persist to the seller's profile when requested.
        if (persistAs === "store-banner" || persistAs === "store-logo") {
            const column = persistAs === "store-banner" ? { store_banner_url: result.url } : { image: result.url };
            await db.update(users).set({ ...column, updated_at: new Date() }).where(eq(users.id, session.user.id));
            revalidatePath("/seller/settings");
            revalidatePath("/seller");
            revalidatePath("/store/[slug]", "page");
            console.log(`[upload] persisted ${persistAs} user=${session.user.id} url=${result.url}`);
        }

        return NextResponse.json({
            success: true,
            url: result.url,
            key: result.key,
            storageType: result.storageType,
            filename: file.name,
            size: file.size,
            type: file.type,
        });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Upload failed",
            },
            { status: 500 }
        );
    }
}

export async function GET() {
    // Return storage configuration info (for debugging)
    const info = getStorageInfo();

    return NextResponse.json({
        storage: info.type,
        s3Configured: info.s3Configured,
        maxFileSize: `${info.maxFileSize / 1024 / 1024}MB`,
        allowedTypes: info.allowedTypes,
    });
}
