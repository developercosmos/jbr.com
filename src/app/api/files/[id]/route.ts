import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { files } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getFileUrl, isS3Configured, storageConfig } from "@/lib/storage";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import fs from "fs/promises";
import path from "path";

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Get file info from database
        const file = await db.query.files.findFirst({
            where: eq(files.id, id),
        });

        if (!file) {
            return NextResponse.json(
                { error: "File not found" },
                { status: 404 }
            );
        }

        // Check access for private files
        if (!file.is_public) {
            const session = await auth.api.getSession({
                headers: await headers(),
            });

            if (!session?.user) {
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 401 }
                );
            }
        }

        // Get file content
        if (isS3Configured()) {
            // For S3, redirect to presigned URL
            const url = await getFileUrl(file.storage_key, 3600); // 1 hour expiry
            return NextResponse.redirect(url);
        } else {
            // For local storage, stream the file
            const filePath = path.join(
                process.cwd(),
                storageConfig.local.uploadDir,
                file.storage_key.replace(/^\/uploads\//, "")
            );

            try {
                const fileBuffer = await fs.readFile(filePath);

                return new NextResponse(fileBuffer, {
                    headers: {
                        "Content-Type": file.mime_type,
                        "Content-Disposition": `inline; filename="${file.original_name}"`,
                        "Cache-Control": "public, max-age=31536000, immutable",
                    },
                });
            } catch {
                return NextResponse.json(
                    { error: "File not found on disk" },
                    { status: 404 }
                );
            }
        }
    } catch (error) {
        console.error("File proxy error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// Download endpoint
export async function HEAD(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const file = await db.query.files.findFirst({
            where: eq(files.id, id),
        });

        if (!file) {
            return new NextResponse(null, { status: 404 });
        }

        return new NextResponse(null, {
            headers: {
                "Content-Type": file.mime_type,
                "Content-Length": String(file.size),
                "Content-Disposition": `inline; filename="${file.original_name}"`,
            },
        });
    } catch {
        return new NextResponse(null, { status: 500 });
    }
}
