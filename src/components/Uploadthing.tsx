"use client";

import { UploadButton, UploadDropzone } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

export { UploadButton, UploadDropzone };

// Re-export typed versions
export const ProductImageUploader = (props: {
    onUploadComplete: (urls: string[]) => void;
    onUploadError?: (error: Error) => void;
}) => {
    return (
        <UploadDropzone<OurFileRouter, "productImageUploader">
            endpoint="productImageUploader"
            onClientUploadComplete={(res) => {
                if (res) {
                    const urls = res.map((file) => file.ufsUrl);
                    props.onUploadComplete(urls);
                }
            }}
            onUploadError={(error: Error) => {
                props.onUploadError?.(error);
            }}
            appearance={{
                container: "border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 transition-colors hover:border-brand-primary cursor-pointer bg-slate-50 dark:bg-black/20",
                uploadIcon: "text-brand-primary w-12 h-12",
                label: "text-slate-900 dark:text-white font-semibold",
                allowedContent: "text-slate-500 text-sm",
                button: "px-5 py-2.5 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-lg text-sm font-bold transition-colors ut-uploading:bg-slate-400",
            }}
            content={{
                label: "Drag & drop foto di sini",
                allowedContent: "Format JPG, PNG. Max 4MB per file, Max 10 foto.",
                button: "Pilih Foto",
            }}
        />
    );
};
