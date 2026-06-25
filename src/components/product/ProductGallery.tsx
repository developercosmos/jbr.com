"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ZoomIn, ZoomOut, X, Maximize2, Play } from "lucide-react";
import { WishlistButton } from "@/components/product/WishlistButton";

interface ProductGalleryProps {
    images: string[];
    videoUrl?: string | null;
    /** Slide position of the video within the gallery (0 = first), seller-set. */
    videoPosition?: number | null;
    conditionLabel?: string;
    /** Wishlist heart overlay (bottom-right of the main image). */
    productId?: string;
    isAuthenticated?: boolean;
    /** Dim the image + show a "HABIS" badge when out of stock. */
    soldOut?: boolean;
}

type MediaItem = { type: "image" | "video"; url: string };

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function ProductGallery({ images, videoUrl, videoPosition, conditionLabel, productId, isAuthenticated, soldOut }: ProductGalleryProps) {
    const sanitizedImages = images.filter(
        (img): img is string => typeof img === "string" && img.trim().length > 0
    );
    const firstImage = sanitizedImages[0] ?? "";
    const video = typeof videoUrl === "string" && videoUrl.trim().length > 0 ? videoUrl.trim() : null;
    // Ordered media slides: photos in seller order, video spliced at the
    // seller-chosen position. The video autoplays (muted — browsers block
    // audible autoplay) whenever its slide is shown; leaving it unmounts it.
    const media: MediaItem[] = sanitizedImages.map((url) => ({ type: "image", url }));
    if (video) {
        media.splice(clamp(Math.round(videoPosition ?? 0), 0, media.length), 0, { type: "video", url: video });
    }
    const mediaRef = useRef(media);
    mediaRef.current = media;
    const [activeIndex, setActiveIndex] = useState(0);
    const active = media.length > 0 ? media[clamp(activeIndex, 0, media.length - 1)] : undefined;
    const showingVideo = active?.type === "video";
    const activeImage = active?.type === "image" ? active.url : "";

    // Zoom + pan lightbox state
    const [zoomOpen, setZoomOpen] = useState(false);
    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    // Active pointers (for pinch) + the current pan/pinch gesture anchors.
    const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
    const pinch = useRef<{ startDist: number; startScale: number } | null>(null);
    const pan = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);

    const openZoom = useCallback(() => {
        if (!activeImage || showingVideo) return;
        setScale(1.8); // open already zoomed so panning is meaningful
        setPos({ x: 0, y: 0 });
        setZoomOpen(true);
    }, [activeImage, showingVideo]);

    const closeZoom = useCallback(() => {
        setZoomOpen(false);
        pointers.current.clear();
        pinch.current = null;
        pan.current = null;
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

    // Swap the main image when a variant (color) is selected on the PDP.
    // VariantSelector → ProductInfo dispatches this event (decoupled across the
    // server-rendered gallery/info columns without a shared client wrapper).
    useEffect(() => {
        const onVariantImage = (e: Event) => {
            const detail = (e as CustomEvent).detail as { image?: string | null } | undefined;
            const url = detail?.image || firstImage;
            const list = mediaRef.current;
            const idx = list.findIndex((m) => m.type === "image" && m.url === url);
            const firstImageIdx = list.findIndex((m) => m.type === "image");
            setActiveIndex(idx >= 0 ? idx : Math.max(0, firstImageIdx));
        };
        window.addEventListener("pdp:variant-image", onVariantImage as EventListener);
        return () => window.removeEventListener("pdp:variant-image", onVariantImage as EventListener);
    }, [firstImage]);

    const pointerDist = () => {
        const pts = Array.from(pointers.current.values());
        if (pts.length < 2) return 0;
        return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };
    const onPointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        (e.target as Element).setPointerCapture?.(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
            // Two fingers → pinch-to-zoom.
            pinch.current = { startDist: pointerDist(), startScale: scale };
            pan.current = null;
        } else if (pointers.current.size === 1) {
            pan.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y };
        }
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size >= 2 && pinch.current && pinch.current.startDist > 0) {
            setScaleClamped(pinch.current.startScale * (pointerDist() / pinch.current.startDist));
        } else if (pan.current) {
            setPos({
                x: pan.current.px + (e.clientX - pan.current.sx),
                y: pan.current.py + (e.clientY - pan.current.sy),
            });
        }
    };
    const endPointer = (e: React.PointerEvent) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) pinch.current = null;
        if (pointers.current.size === 1) {
            // One finger left after a pinch → resume panning from it.
            const [rem] = Array.from(pointers.current.values());
            pan.current = { sx: rem.x, sy: rem.y, px: pos.x, py: pos.y };
        } else if (pointers.current.size === 0) {
            pan.current = null;
        }
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
                {showingVideo && active ? (
                    <video
                        key={active.url}
                        src={active.url}
                        controls
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-contain bg-black"
                    />
                ) : activeImage ? (
                    <button
                        type="button"
                        onClick={openZoom}
                        aria-label="Perbesar gambar"
                        className="relative w-full h-full transition-transform duration-500 group-hover:scale-105 cursor-zoom-in"
                    >
                        {/* LCP image — next/Image gives AVIF/WebP + responsive srcset. */}
                        <Image
                            src={activeImage}
                            alt="Foto produk"
                            fill
                            priority
                            sizes="(max-width: 1024px) 100vw, 50vw"
                            className="object-cover"
                        />
                    </button>
                ) : (
                    <div className="w-full h-full bg-slate-100 dark:bg-slate-800" />
                )}
                {activeImage && !showingVideo && (
                    <div className="absolute bottom-4 left-4 bg-black/55 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <Maximize2 className="w-3.5 h-3.5" /> Klik untuk zoom & geser
                    </div>
                )}
                {/* Wishlist heart — bottom-right overlay. */}
                {productId && (
                    <WishlistButton
                        variant="icon"
                        productId={productId}
                        isAuthenticated={Boolean(isAuthenticated)}
                        className="absolute bottom-4 right-4 z-20 p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg text-slate-600 hover:bg-red-50 hover:text-red-500 transition-colors"
                    />
                )}
                {/* Out-of-stock overlay. */}
                {soldOut && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 pointer-events-none">
                        <span className="px-6 py-2.5 rounded-lg bg-white/95 text-slate-900 text-xl font-black tracking-[0.2em] shadow-lg">
                            HABIS
                        </span>
                    </div>
                )}
            </div>

            {/* Thumbnails — single scrollable row, in seller-defined media order */}
            <div className="flex gap-3 overflow-x-auto pb-1.5 snap-x [scrollbar-width:thin]">
                {media.map((item, index) => (
                    <button
                        key={`${item.type}-${index}`}
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        aria-label={item.type === "video" ? "Putar video produk" : `Foto produk ${index + 1}`}
                        className={cn(
                            "relative w-20 h-20 shrink-0 snap-start rounded-lg overflow-hidden transition-all",
                            index === clamp(activeIndex, 0, media.length - 1)
                                ? "border-2 border-brand-primary ring-2 ring-brand-primary/20 ring-offset-2 ring-offset-background-light dark:ring-offset-background-dark"
                                : "border border-slate-200 dark:border-gray-800 opacity-70 hover:opacity-100"
                        )}
                    >
                        {item.type === "video" ? (
                            <>
                                <video
                                    src={item.url}
                                    muted
                                    playsInline
                                    preload="metadata"
                                    className="w-full h-full object-cover pointer-events-none bg-black"
                                />
                                <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                                    <span className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                                        <Play className="w-4 h-4 text-white fill-white translate-x-px" />
                                    </span>
                                </span>
                            </>
                        ) : (
                            <Image
                                src={item.url}
                                alt={`Foto produk ${index + 1}`}
                                fill
                                sizes="80px"
                                className="object-cover"
                            />
                        )}
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
                        onPointerUp={endPointer}
                        onPointerCancel={endPointer}
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
