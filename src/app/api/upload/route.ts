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
    // Entry trace (before anything) — distinguishes "request never arrived" from
    // "arrived but failed at auth/parse" when diagnosing a failing upload.
    const hasCookie = (request.headers.get("cookie") || "").length > 0;
    console.log(`[upload] HIT ct=${request.headers.get("content-type")?.slice(0, 40)} cookie=${hasCookie}`);
    try {
        // Check authentication
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user) {
            console.warn(`[upload] 401 unauthorized (cookie=${hasCookie})`);
            return NextResponse.json(
                { error: "Sesi tidak dikenali. Muat ulang halaman lalu coba lagi." },
                { status: 401 }
            );
        }

        // SECURITY: reject an oversized body via Content-Length BEFORE buffering it
        // into memory (memory-exhaustion DoS). This is a generous backstop — the
        // per-file type/size limits are enforced after parse, and nginx
        // client_max_body_size is the authoritative edge cap.
        const HARD_BODY_CAP = 100 * 1024 * 1024; // 100MB (accommodates product videos)
        const contentLength = Number(request.headers.get("content-length") || 0);
        if (contentLength > HARD_BODY_CAP) {
            return NextResponse.json({ error: "File terlalu besar." }, { status: 413 });
        }

        // Parse form data
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const folder = (formData.get("folder") as string) || "uploads";
        // SECURITY: folder is part of the storage path — reject anything that could
        // traverse out of the upload root (.., slashes). Single path segment only.
        if (!/^[a-z0-9_-]{1,40}$/i.test(folder)) {
            return NextResponse.json({ error: "Folder tidak valid." }, { status: 400 });
        }
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

        // SECURITY: reject SVG/HTML/script (stored-XSS vectors) regardless of the
        // client-claimed MIME — sniff the bytes + the filename extension.
        const head = buffer.subarray(0, 512).toString("utf8").toLowerCase();
        const dangerous =
            /\.(svg|svgz|html?|xht|xhtml|xml|js|mjs)$/i.test(file.name) ||
            file.type === "image/svg+xml" ||
            head.includes("<svg") ||
            head.includes("<!doctype html") ||
            head.includes("<html") ||
            head.includes("<?xml");
        if (dangerous) {
            return NextResponse.json({ error: "Tipe file tidak diizinkan (SVG/HTML)." }, { status: 400 });
        }

        // Diagnostic: trace each upload end-to-end (client bundle-agnostic) so a
        // "file landed but UI shows nothing" report can be pinned to server vs client.
        console.log(
            `[upload] recv user=${session.user.id} folder=${folder} name=${file.name} type=${file.type} size=${buffer.length}`
        );

        // Product videos get their own (configurable) size budget and must be video/*.
        let maxBytesOverride: number | undefined;
        if (folder === "product-videos") {
            if (!file.type.startsWith("video/")) {
                return NextResponse.json({ error: "Folder product-videos hanya menerima file video." }, { status: 400 });
            }
            const { getProductVideoLimits } = await import("@/actions/products");
            const limits = await getProductVideoLimits();
            maxBytesOverride = limits.maxMb * 1024 * 1024;
            if (buffer.length > maxBytesOverride) {
                return NextResponse.json(
                    { error: `Ukuran video maksimal ${limits.maxMb} MB.` },
                    { status: 400 }
                );
            }
        }

        // PERF: optimize raster images on ingest — cap dimensions + recompress so we
        // never store raw multi-MB phone photos (the root cause of heavy PDP loads).
        // Videos + non-raster types pass through unchanged. Best-effort: on any failure
        // we store the original. 2048px long-edge keeps full display + zoom quality.
        let uploadBuffer: Uint8Array = buffer;
        if (folder !== "product-videos" && /^image\/(jpeg|png|webp)$/i.test(file.type)) {
            try {
                const sharp = (await import("sharp")).default;
                const pipeline = sharp(buffer, { failOn: "none" })
                    .rotate() // bake EXIF orientation so resize is correct
                    .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true });
                const optimized =
                    file.type.toLowerCase() === "image/png"
                        ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
                        : file.type.toLowerCase() === "image/webp"
                            ? await pipeline.webp({ quality: 82 }).toBuffer()
                            : await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
                if (optimized.length > 0 && optimized.length < buffer.length) {
                    uploadBuffer = optimized;
                }
            } catch (err) {
                console.warn("[upload] image optimize failed, storing original:", err);
            }
        }

        // Upload file
        const result = await uploadFile(
            folder,
            file.name,
            uploadBuffer,
            file.type,
            session.user.id,
            true,
            maxBytesOverride
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

        console.log(`[upload] done folder=${folder} url=${result.url} -> sending 200`);
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
        // Log full detail server-side only; never return raw fs error messages
        // (they can contain absolute server paths / stack info) to the client.
        console.error("Upload error:", error);
        const message = error instanceof Error ? error.message : "";
        const isSafeValidationError =
            message.startsWith("File type not allowed:") || message.startsWith("File too large.");
        return NextResponse.json(
            { error: isSafeValidationError ? message : "Upload gagal, coba lagi." },
            { status: isSafeValidationError ? 400 : 500 }
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
