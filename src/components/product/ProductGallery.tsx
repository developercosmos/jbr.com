"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ZoomIn } from "lucide-react";

interface ProductGalleryProps {
    images: string[];
}

export function ProductGallery({ images }: ProductGalleryProps) {
    const [activeImage, setActiveImage] = useState(images[0]);

    return (
        <div className="flex flex-col gap-4">
            {/* Main Image */}
            <div className="group relative w-full aspect-[4/3] bg-surface-dark rounded-xl overflow-hidden border border-slate-200 dark:border-gray-800">
                {/* Condition Tag */}
                <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
                    Pre-loved
                </div>
                <div
                    className="w-full h-full bg-center bg-cover transition-transform duration-500 group-hover:scale-110 cursor-zoom-in"
                    style={{ backgroundImage: `url('${activeImage}')` }}
                ></div>
                {/* Zoom Hint */}
                <div className="absolute bottom-4 right-4 bg-black/50 p-2 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <ZoomIn className="w-4 h-4" />
                </div>
            </div>
            {/* Thumbnails */}
            <div className="grid grid-cols-5 gap-3">
                {images.map((img, index) => (
                    <button
                        key={index}
                        onClick={() => setActiveImage(img)}
                        className={cn(
                            "relative aspect-square rounded-lg overflow-hidden transition-all",
                            activeImage === img
                                ? "border-2 border-brand-primary ring-2 ring-brand-primary/20 ring-offset-2 ring-offset-background-light dark:ring-offset-background-dark"
                                : "border border-slate-200 dark:border-gray-800 opacity-70 hover:opacity-100"
                        )}
                    >
                        <div
                            className="w-full h-full bg-center bg-cover"
                            style={{ backgroundImage: `url('${img}')` }}
                        ></div>
                    </button>
                ))}
            </div>
        </div>
    );
}
