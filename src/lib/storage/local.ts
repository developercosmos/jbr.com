import fs from "fs/promises";
import path from "path";
import { storageConfig } from "./config";

/**
 * Ensure upload directory exists
 */
async function ensureUploadDir(subFolder?: string): Promise<string> {
    const baseDir = path.join(process.cwd(), storageConfig.local.uploadDir);
    const targetDir = subFolder ? path.join(baseDir, subFolder) : baseDir;

    await fs.mkdir(targetDir, { recursive: true });
    return targetDir;
}

/**
 * Upload file to local filesystem
 */
export async function uploadToLocal(
    folder: string,
    filename: string,
    body: Buffer | Uint8Array,
    userId?: string
): Promise<string> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = filename.split(".").pop() || "";
    const safeFilename = filename
        .replace(/[^a-zA-Z0-9.-]/g, "_")
        .substring(0, 50);

    // Create subfolder path
    const subFolder = userId ? path.join(folder, userId) : folder;
    const uploadDir = await ensureUploadDir(subFolder);

    // Generate unique filename
    const newFilename = `${timestamp}-${random}-${safeFilename}`;
    const filePath = path.join(uploadDir, newFilename);

    // Write file
    await fs.writeFile(filePath, body);

    // Return the public URL path
    const relativePath = path.join(
        storageConfig.local.uploadDir.replace("public/", "/"),
        subFolder,
        newFilename
    );

    return relativePath.replace(/\\/g, "/"); // Normalize for URLs
}

/**
 * Delete file from local filesystem
 */
export async function deleteFromLocal(filePath: string): Promise<void> {
    // Convert URL path to filesystem path
    const relativePath = filePath.startsWith("/")
        ? filePath.substring(1)
        : filePath;
    const absolutePath = path.join(process.cwd(), "public", relativePath);

    try {
        await fs.unlink(absolutePath);
    } catch (error) {
        // File might not exist, ignore
        console.warn(`Failed to delete local file: ${absolutePath}`, error);
    }
}

/**
 * Check if a local file exists
 */
export async function localFileExists(filePath: string): Promise<boolean> {
    const relativePath = filePath.startsWith("/")
        ? filePath.substring(1)
        : filePath;
    const absolutePath = path.join(process.cwd(), "public", relativePath);

    try {
        await fs.access(absolutePath);
        return true;
    } catch {
        return false;
    }
}
