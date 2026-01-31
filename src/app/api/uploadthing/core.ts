import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const f = createUploadthing();

const getUser = async () => {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    return session?.user;
};

export const ourFileRouter = {
    // Product image uploader
    productImageUploader: f({
        image: { maxFileSize: "4MB", maxFileCount: 10 },
    })
        .middleware(async () => {
            const user = await getUser();
            if (!user) throw new Error("Unauthorized");
            return { userId: user.id };
        })
        .onUploadComplete(async ({ metadata, file }) => {
            console.log("Upload complete for userId:", metadata.userId);
            console.log("File URL:", file.ufsUrl);
            return { uploadedBy: metadata.userId, url: file.ufsUrl };
        }),

    // Avatar uploader
    avatarUploader: f({
        image: { maxFileSize: "2MB", maxFileCount: 1 },
    })
        .middleware(async () => {
            const user = await getUser();
            if (!user) throw new Error("Unauthorized");
            return { userId: user.id };
        })
        .onUploadComplete(async ({ metadata, file }) => {
            return { uploadedBy: metadata.userId, url: file.ufsUrl };
        }),

    // Chat attachment uploader
    chatAttachmentUploader: f({
        image: { maxFileSize: "4MB", maxFileCount: 1 },
        pdf: { maxFileSize: "4MB", maxFileCount: 1 },
    })
        .middleware(async () => {
            const user = await getUser();
            if (!user) throw new Error("Unauthorized");
            return { userId: user.id };
        })
        .onUploadComplete(async ({ metadata, file }) => {
            return { uploadedBy: metadata.userId, url: file.ufsUrl };
        }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
