/**
 * Storage Configuration
 * Determines whether to use AWS S3 or local filesystem storage
 */

export const storageConfig = {
    // S3 Configuration
    s3: {
        bucket: process.env.AWS_S3_BUCKET || "",
        region: process.env.AWS_S3_REGION || "ap-southeast-1",
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },

    // Local Storage Configuration
    local: {
        uploadDir: process.env.LOCAL_UPLOAD_DIR || "public/uploads",
        baseUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    },

    // Maximum file size in bytes (10MB default)
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"),

    // Allowed file types
    allowedMimeTypes: [
        // Images
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/svg+xml",
        // Video
        "video/mp4",
        "video/webm",
        "video/quicktime",
        // Audio
        "audio/mpeg",
        "audio/wav",
        "audio/ogg",
        "audio/mp3",
        // Documents
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
        "text/csv",
    ],
};

/**
 * Check if S3 is properly configured
 */
export function isS3Configured(): boolean {
    const { bucket, accessKeyId, secretAccessKey } = storageConfig.s3;
    return !!(bucket && accessKeyId && secretAccessKey);
}

/**
 * Get the storage type being used
 */
export function getStorageType(): "s3" | "local" {
    return isS3Configured() ? "s3" : "local";
}
