import fs from "fs/promises";
import path from "path";
import { storageConfig } from "./config";

function resolveUploadBaseDir(): string {
    const configured = storageConfig.local.uploadDir;
    if (path.isAbsolute(configured)) {
        return configured;
    }
    return path.join(process.cwd(), configured);
}

function resolveStoredFilePath(filePathOrUrl: string): string {
    const baseDir = resolveUploadBaseDir();
    const configuredPublicPath = storageConfig.local.publicPath || "/uploads";
    const normalizedPublicPath = configuredPublicPath.endsWith("/")
        ? configuredPublicPath
        : `${configuredPublicPath}/`;

    const pathname = (() => {
        if (filePathOrUrl.startsWith("http://") || filePathOrUrl.startsWith("https://")) {
            try {
                return new URL(filePathOrUrl).pathname;
            } catch {
                return filePathOrUrl;
            }
        }
        return filePathOrUrl;
    })();

    const relative = pathname.startsWith(normalizedPublicPath)
        ? pathname.slice(normalizedPublicPath.length)
        : pathname.startsWith("/uploads/")
            ? pathname.slice("/uploads/".length)
            : pathname.startsWith("/")
                ? pathname.slice(1)
                : pathname;

    return path.join(baseDir, relative);
}

/**
 * Ensure upload directory exists
 */
async function ensureUploadDir(subFolder?: string): Promise<string> {
    const baseDir = resolveUploadBaseDir();
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
    const publicPath = storageConfig.local.publicPath || "/uploads";
    const normalizedPublicPath = publicPath.endsWith("/")
        ? publicPath.slice(0, -1)
        : publicPath;
    const relativePath = path.posix.join(
        normalizedPublicPath,
        subFolder.replace(/\\/g, "/"),
        newFilename
    );

    return relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
}

/**
 * Delete file from local filesystem
 */
export async function deleteFromLocal(filePath: string): Promise<void> {
    const absolutePath = resolveStoredFilePath(filePath);

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
    const absolutePath = resolveStoredFilePath(filePath);

    try {
        await fs.access(absolutePath);
        return true;
    } catch {
        return false;
    }
}
