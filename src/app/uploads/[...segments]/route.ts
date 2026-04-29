import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { storageConfig } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveUploadBaseDir(): string {
    const configured = storageConfig.local.uploadDir;
    if (path.isAbsolute(configured)) {
        return configured;
    }
    return path.join(process.cwd(), configured);
}

function contentTypeFor(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case ".jpg":
        case ".jpeg":
            return "image/jpeg";
        case ".png":
            return "image/png";
        case ".webp":
            return "image/webp";
        case ".gif":
            return "image/gif";
        case ".svg":
            return "image/svg+xml";
        case ".mp4":
            return "video/mp4";
        case ".webm":
            return "video/webm";
        case ".pdf":
            return "application/pdf";
        default:
            return "application/octet-stream";
    }
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ segments: string[] }> }
) {
    try {
        const { segments } = await params;
        if (!segments || segments.length === 0) {
            return new NextResponse("Not Found", { status: 404 });
        }

        const safeSegments = segments.map((segment) => path.basename(segment));
        const baseDir = resolveUploadBaseDir();
        const filePath = path.join(baseDir, ...safeSegments);
        const normalizedBase = path.resolve(baseDir);
        const normalizedFile = path.resolve(filePath);

        // Block path traversal attempts outside upload root.
        if (!normalizedFile.startsWith(normalizedBase + path.sep) && normalizedFile !== normalizedBase) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const fileBuffer = await fs.readFile(normalizedFile);
        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                "Content-Type": contentTypeFor(normalizedFile),
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch {
        return new NextResponse("Not Found", { status: 404 });
    }
}
