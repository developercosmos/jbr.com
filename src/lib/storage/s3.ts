import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageConfig } from "./config";

let s3Client: S3Client | null = null;

/**
 * Get or create S3 client instance (singleton)
 */
export function getS3Client(): S3Client {
    if (!s3Client) {
        s3Client = new S3Client({
            region: storageConfig.s3.region,
            credentials: {
                accessKeyId: storageConfig.s3.accessKeyId,
                secretAccessKey: storageConfig.s3.secretAccessKey,
            },
        });
    }
    return s3Client;
}

/**
 * Upload file to S3
 */
export async function uploadToS3(
    key: string,
    body: Buffer | Uint8Array,
    contentType: string
): Promise<string> {
    const client = getS3Client();
    const bucket = storageConfig.s3.bucket;

    await client.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
            ACL: "public-read", // Make publicly accessible
        })
    );

    // Return the public URL
    return `https://${bucket}.s3.${storageConfig.s3.region}.amazonaws.com/${key}`;
}

/**
 * Delete file from S3
 */
export async function deleteFromS3(key: string): Promise<void> {
    const client = getS3Client();

    await client.send(
        new DeleteObjectCommand({
            Bucket: storageConfig.s3.bucket,
            Key: key,
        })
    );
}

/**
 * Get a presigned URL for private file access
 */
export async function getPresignedUrl(
    key: string,
    expiresIn: number = 3600
): Promise<string> {
    const client = getS3Client();

    const command = new GetObjectCommand({
        Bucket: storageConfig.s3.bucket,
        Key: key,
    });

    return getSignedUrl(client, command, { expiresIn });
}

/**
 * Generate a unique key for S3 storage
 */
export function generateS3Key(
    folder: string,
    filename: string,
    userId?: string
): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = filename.split(".").pop() || "";
    const safeFilename = filename
        .replace(/[^a-zA-Z0-9.-]/g, "_")
        .substring(0, 50);

    const parts = [folder];
    if (userId) parts.push(userId);
    parts.push(`${timestamp}-${random}-${safeFilename}`);

    return parts.join("/");
}
