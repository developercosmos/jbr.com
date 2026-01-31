/**
 * Unified Storage Module
 * Automatically switches between S3 and local storage based on configuration
 */

import { isS3Configured, getStorageType, storageConfig } from "./config";
import { uploadToS3, deleteFromS3, generateS3Key, getPresignedUrl } from "./s3";
import { uploadToLocal, deleteFromLocal, localFileExists } from "./local";

export { storageConfig, isS3Configured, getStorageType };

export type UploadResult = {
    url: string;
    key: string;
    storageType: "s3" | "local";
};

/**
 * Upload a file to the configured storage (S3 or local)
 */
export async function uploadFile(
    folder: string,
    filename: string,
    body: Buffer | Uint8Array,
    contentType: string,
    userId?: string
): Promise<UploadResult> {
    // Validate file type
    if (!storageConfig.allowedMimeTypes.includes(contentType)) {
        throw new Error(`File type not allowed: ${contentType}`);
    }

    // Validate file size
    if (body.length > storageConfig.maxFileSize) {
        throw new Error(
            `File too large. Maximum size is ${storageConfig.maxFileSize / 1024 / 1024}MB`
        );
    }

    if (isS3Configured()) {
        // Use S3
        const key = generateS3Key(folder, filename, userId);
        const url = await uploadToS3(key, body, contentType);
        return { url, key, storageType: "s3" };
    } else {
        // Use local storage
        const url = await uploadToLocal(folder, filename, body, userId);
        return { url, key: url, storageType: "local" };
    }
}

/**
 * Delete a file from storage
 */
export async function deleteFile(keyOrPath: string): Promise<void> {
    if (isS3Configured()) {
        // If it's a full S3 URL, extract the key
        if (keyOrPath.includes(".s3.")) {
            const url = new URL(keyOrPath);
            keyOrPath = url.pathname.substring(1); // Remove leading slash
        }
        await deleteFromS3(keyOrPath);
    } else {
        await deleteFromLocal(keyOrPath);
    }
}

/**
 * Get a signed URL for private file access (S3 only)
 * For local storage, returns the direct path
 */
export async function getFileUrl(
    keyOrPath: string,
    expiresIn?: number
): Promise<string> {
    if (isS3Configured()) {
        return getPresignedUrl(keyOrPath, expiresIn);
    } else {
        // For local storage, return full URL
        return `${storageConfig.local.baseUrl}${keyOrPath}`;
    }
}

/**
 * Check if a file exists
 */
export async function fileExists(keyOrPath: string): Promise<boolean> {
    if (isS3Configured()) {
        // For S3, we'd need to make a HEAD request
        // For now, return true (assume exists)
        return true;
    } else {
        return localFileExists(keyOrPath);
    }
}

/**
 * Get storage info for debugging
 */
export function getStorageInfo() {
    return {
        type: getStorageType(),
        s3Configured: isS3Configured(),
        bucket: isS3Configured() ? storageConfig.s3.bucket : null,
        region: isS3Configured() ? storageConfig.s3.region : null,
        localDir: !isS3Configured() ? storageConfig.local.uploadDir : null,
        maxFileSize: storageConfig.maxFileSize,
        allowedTypes: storageConfig.allowedMimeTypes,
    };
}
