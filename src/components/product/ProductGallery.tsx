"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ZoomIn, ZoomOut, X, Maximize2 } from "lucide-react";

interface ProductGalleryProps {
    images: string[];
    conditionLabel?: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function ProductGallery({ images, conditionLabel }: ProductGalleryProps) {
    const sanitizedImages = images.filter(
        (img): img is string => typeof img === "string" && img.trim().length > 0
    );
    const [activeImage, setActiveImage] = useState(sanitizedImages[0] ?? "");

    // Zoom + pan lightbox state
    const [zoomOpen, setZoomOpen] = useState(false);
    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);

    const openZoom = useCallback(() => {
        if (!activeImage) return;
        setScale(1.8); // open already zoomed so panning is meaningful
        setPos({ x: 0, y: 0 });
        setZoomOpen(true);
    }, [activeImage]);

    const closeZoom = useCallback(() => {
        setZoomOpen(false);
        drag.current = null;
    }, []);

    // Reset pan when scale returns to 1
    const setScaleClamped = useCallback((next: number) => {
        const s = clamp(next, MIN_SCALE, MAX_SCALE);
        setScale(s);
        if (s === 1) setPos({ x: 0, y: 0 });
    }, []);

    // Escape closes; lock body scroll while open
    useEffect(() => {
        if (!zoomOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeZoom();
            else if (e.key === "+" || e.key === "=") setScaleClamped(scale + 0.4);
            else if (e.key === "-") setScaleClamped(scale - 0.4);
        };
        window.addEventListener("keydown", onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [zoomOpen, scale, closeZoom, setScaleClamped]);

    const onPointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        (e.target as Element).setPointerCapture?.(e.pointerId);
        drag.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y };
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (!drag.current) return;
        setPos({
            x: drag.current.px + (e.clientX - drag.current.sx),
            y: drag.current.py + (e.clientY - drag.current.sy),
        });
    };
    const onPointerUp = () => {
        drag.current = null;
    };
    const onWheel = (e: React.WheelEvent) => {
        setScaleClamped(scale - e.deltaY * 0.0015);
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Main Image — fills the frame (crop ok); click to open zoom + pan */}
            <div className="group relative w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-gray-800">
                {conditionLabel && (
                    <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
                        {conditionLabel}
                    </div>
                )}
                {activeImage ? (
                    <button
                        type="button"
                        onClick={openZoom}
                        aria-label="Perbesar gambar"
                        className="w-full h-full bg-center bg-cover transition-transform duration-500 group-hover:scale-105 cursor-zoom-in"
                        style={{ backgroundImage: `url('${activeImage}')` }}
                    />
                ) : (
                    <div className="w-full h-full bg-slate-100 dark:bg-slate-800" />
                )}
                {activeImage && (
                    <div className="absolute bottom-4 right-4 bg-black/55 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <Maximize2 className="w-3.5 h-3.5" /> Klik untuk zoom & geser
                    </div>
                )}
            </div>

            {/* Thumbnails */}
            <div className="grid grid-cols-5 gap-3">
                {sanitizedImages.map((img, index) => (
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

            {/* Zoom + Pan lightbox */}
            {zoomOpen && activeImage && (
                <div
                    className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center select-none"
                    onClick={closeZoom}
                >
                    {/* Controls */}
                    <div className="absolute top-4 right-4 z-10 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => setScaleClamped(scale - 0.4)} className="rounded-full bg-white/15 hover:bg-white/25 text-white p-2" aria-label="Perkecil">
                            <ZoomOut className="w-5 h-5" />
                        </button>
                        <button type="button" onClick={() => setScaleClamped(scale + 0.4)} className="rounded-full bg-white/15 hover:bg-white/25 text-white p-2" aria-label="Perbesar">
                            <ZoomIn className="w-5 h-5" />
                        </button>
                        <button type="button" onClick={closeZoom} className="rounded-full bg-white/15 hover:bg-white/25 text-white p-2" aria-label="Tutup">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-white/70 text-xs" onClick={(e) => e.stopPropagation()}>
                        Seret untuk menggeser · scroll / tombol untuk zoom · Esc untuk tutup
                    </p>

                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={activeImage}
                        alt="Zoom produk"
                        draggable={false}
                        onClick={(e) => e.stopPropagation()}
                        onWheel={onWheel}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={onPointerUp}
                        style={{
                            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
                            touchAction: "none",
                        }}
                        className="max-h-[88vh] max-w-[92vw] object-contain cursor-grab active:cursor-grabbing will-change-transform"
                    />
                </div>
            )}
        </div>
    );
}
