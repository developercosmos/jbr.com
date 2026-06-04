import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { files, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getFileUrl, isS3Configured, resolveStoredFilePath } from "@/lib/storage";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import fs from "fs/promises";

export const dynamic = "force-dynamic";

/**
 * Authorize access to a (possibly private) file.
 * Returns `null` when access is allowed, or a NextResponse error to return.
 * Public files: always allowed. Private files: require an authenticated caller
 * who is either the uploader OR an admin (admins/reviewers need this for KYC
 * review and the admin file manager; owners need it to view their own docs).
 * Role is re-read from the DB rather than trusting the session-cached value.
 */
async function authorizePrivateFile(file: {
    is_public: boolean;
    uploaded_by: string | null;
}): Promise<{ status: number; error: string } | null> {
    if (file.is_public) return null;

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        return { status: 401, error: "Unauthorized" };
    }
    if (file.uploaded_by && file.uploaded_by === session.user.id) {
        return null;
    }
    const u = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { role: true },
    });
    if (u?.role === "ADMIN") return null;

    return { status: 403, error: "Forbidden" };
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const file = await db.query.files.findFirst({
            where: eq(files.id, id),
        });

        if (!file) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        const denied = await authorizePrivateFile(file);
        if (denied) {
            return NextResponse.json({ error: denied.error }, { status: denied.status });
        }

        // Get file content
        if (isS3Configured()) {
            // For S3, redirect to a short-lived presigned URL
            const url = await getFileUrl(file.storage_key, 3600); // 1 hour expiry
            return NextResponse.redirect(url);
        } else {
            // For local storage, stream the file. Use the shared resolver so the
            // path is computed identically to upload/delete (handles both absolute
            // and relative uploadDir + the /uploads/ public prefix). The previous
            // path.join(cwd, uploadDir, …) double-prefixed when uploadDir was an
            // absolute path in production, 404-ing every private file.
            const filePath = resolveStoredFilePath(file.storage_key);

            try {
                const fileBuffer = await fs.readFile(filePath);

                return new NextResponse(new Uint8Array(fileBuffer), {
                    headers: {
                        "Content-Type": file.mime_type,
                        "Content-Disposition": `inline; filename="${file.original_name}"`,
                        // Private cache only — these bytes may be access-controlled.
                        "Cache-Control": file.is_public
                            ? "public, max-age=31536000, immutable"
                            : "private, no-store",
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

// Metadata endpoint — same authorization as GET so private metadata isn't leaked.
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

        const denied = await authorizePrivateFile(file);
        if (denied) {
            return new NextResponse(null, { status: denied.status });
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
