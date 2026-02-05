"use server";

import { db } from "@/db";
import { files, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, desc, and, ilike, sql, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { uploadFile as uploadToStorage, deleteFile as deleteFromStorage, getStorageType } from "@/lib/storage";

// Helper to verify admin access
async function requireAdmin() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
    });

    if (!user || user.role !== "ADMIN") {
        throw new Error("Admin access required");
    }

    return user;
}

// Determine file type from MIME type
function getFileTypeFromMime(mimeType: string): "image" | "video" | "audio" | "document" | "other" {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if (
        mimeType.includes("pdf") ||
        mimeType.includes("document") ||
        mimeType.includes("word") ||
        mimeType.includes("excel") ||
        mimeType.includes("spreadsheet") ||
        mimeType.startsWith("text/")
    ) {
        return "document";
    }
    return "other";
}

// Format file size for display
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ============================================
// GET FILES WITH FILTERS
// ============================================
export async function getAdminFiles(filters?: {
    search?: string;
    fileType?: string;
    folder?: string;
    limit?: number;
    offset?: number;
}) {
    await requireAdmin();

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const conditions = [];

    if (filters?.search) {
        conditions.push(ilike(files.original_name, `%${filters.search}%`));
    }

    if (filters?.fileType && filters.fileType !== "all") {
        conditions.push(eq(files.file_type, filters.fileType as "image" | "video" | "audio" | "document" | "other"));
    }

    if (filters?.folder && filters.folder !== "all") {
        conditions.push(eq(files.folder, filters.folder));
    }

    const [fileList, totalResult] = await Promise.all([
        db.query.files.findMany({
            where: conditions.length > 0 ? and(...conditions) : undefined,
            orderBy: [desc(files.created_at)],
            limit,
            offset,
            with: {
                uploader: {
                    columns: { id: true, name: true, email: true },
                },
            },
        }),
        db.select({ count: count() }).from(files).where(
            conditions.length > 0 ? and(...conditions) : undefined
        ),
    ]);

    return {
        files: fileList,
        total: totalResult[0]?.count || 0,
        limit,
        offset,
    };
}

// ============================================
// GET FILE STATS
// ============================================
export async function getFileStats() {
    await requireAdmin();

    const [totalFiles, totalSize, byType] = await Promise.all([
        db.select({ count: count() }).from(files),
        db.select({ total: sql<number>`coalesce(sum(${files.size}), 0)` }).from(files),
        db.select({
            file_type: files.file_type,
            count: count(),
            size: sql<number>`coalesce(sum(${files.size}), 0)`,
        })
            .from(files)
            .groupBy(files.file_type),
    ]);

    return {
        totalFiles: totalFiles[0]?.count || 0,
        totalSize: Number(totalSize[0]?.total) || 0,
        byType: byType.reduce((acc, item) => {
            acc[item.file_type] = { count: item.count, size: Number(item.size) };
            return acc;
        }, {} as Record<string, { count: number; size: number }>),
    };
}

// ============================================
// GET UNIQUE FOLDERS
// ============================================
export async function getFileFolders() {
    await requireAdmin();

    const folders = await db
        .selectDistinct({ folder: files.folder })
        .from(files)
        .orderBy(files.folder);

    return folders.map((f) => f.folder).filter(Boolean) as string[];
}

// ============================================
// UPLOAD FILE
// ============================================
export async function uploadAdminFile(formData: FormData) {
    const admin = await requireAdmin();

    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "general";
    const isPublic = formData.get("isPublic") === "true";
    const altText = formData.get("altText") as string | null;
    const tagsRaw = formData.get("tags") as string | null;

    if (!file) {
        throw new Error("No file provided");
    }

    // Convert to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to storage
    const result = await uploadToStorage(
        folder,
        file.name,
        buffer,
        file.type,
        admin.id
    );

    // Parse tags
    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : null;

    // Save to database
    const [savedFile] = await db
        .insert(files)
        .values({
            filename: result.key.split("/").pop() || file.name,
            original_name: file.name,
            mime_type: file.type,
            file_type: getFileTypeFromMime(file.type),
            size: file.size,
            storage_type: result.storageType,
            storage_key: result.key,
            folder,
            tags,
            alt_text: altText,
            is_public: isPublic,
            uploaded_by: admin.id,
        })
        .returning();

    revalidatePath("/admin/files");

    return savedFile;
}

// ============================================
// UPDATE FILE METADATA
// ============================================
export async function updateFileMetadata(
    fileId: string,
    data: {
        folder?: string;
        tags?: string[];
        alt_text?: string;
        is_public?: boolean;
    }
) {
    await requireAdmin();

    await db
        .update(files)
        .set({
            ...data,
            updated_at: new Date(),
        })
        .where(eq(files.id, fileId));

    revalidatePath("/admin/files");
    return { success: true };
}

// ============================================
// DELETE FILE
// ============================================
export async function deleteAdminFile(fileId: string) {
    await requireAdmin();

    // Get file info
    const file = await db.query.files.findFirst({
        where: eq(files.id, fileId),
    });

    if (!file) {
        throw new Error("File not found");
    }

    // Delete from storage
    try {
        await deleteFromStorage(file.storage_key);
    } catch (error) {
        console.error("Failed to delete from storage:", error);
        // Continue to delete from database even if storage deletion fails
    }

    // Delete from database
    await db.delete(files).where(eq(files.id, fileId));

    revalidatePath("/admin/files");
    return { success: true };
}

// ============================================
// BULK DELETE FILES
// ============================================
export async function bulkDeleteFiles(fileIds: string[]) {
    await requireAdmin();

    // Get all files info
    const filesToDelete = await db.query.files.findMany({
        where: sql`${files.id} = ANY(${fileIds})`,
    });

    // Delete from storage
    for (const file of filesToDelete) {
        try {
            await deleteFromStorage(file.storage_key);
        } catch (error) {
            console.error(`Failed to delete ${file.storage_key} from storage:`, error);
        }
    }

    // Delete from database
    await db.delete(files).where(sql`${files.id} = ANY(${fileIds})`);

    revalidatePath("/admin/files");
    return { success: true, deletedCount: filesToDelete.length };
}

// ============================================
// GET FILE BY ID
// ============================================
export async function getFileById(fileId: string) {
    const file = await db.query.files.findFirst({
        where: eq(files.id, fileId),
    });

    return file;
}
