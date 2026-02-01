"use client";

import { useState } from "react";
import { X, Star, Camera, Loader2, CheckCircle } from "lucide-react";
import Image from "next/image";
import { createReview } from "@/actions/reviews";

interface ReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderItemId: string;
    productName: string;
    productImage?: string;
    onSuccess?: () => void;
}

export function ReviewModal({
    isOpen,
    onClose,
    orderItemId,
    productName,
    productImage,
    onSuccess,
}: ReviewModalProps) {
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (rating === 0) {
            setError("Silakan berikan rating");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await createReview({
                order_item_id: orderItemId,
                rating,
                comment: comment.trim() || undefined,
            });
            setIsSuccess(true);
            setTimeout(() => {
                onSuccess?.();
                onClose();
            }, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal mengirim ulasan");
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetAndClose = () => {
        setRating(0);
        setComment("");
        setError(null);
        setIsSuccess(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={resetAndClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-900">Tulis Ulasan</h2>
                    <button
                        onClick={resetAndClose}
                        className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Success State */}
                {isSuccess ? (
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8 text-green-500" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-1">
                            Terima Kasih!
                        </h3>
                        <p className="text-slate-600">
                            Ulasan Anda telah berhasil dikirim.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Content */}
                        <div className="p-4">
                            {/* Product Info */}
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-4">
                                <div className="w-16 h-16 rounded-lg bg-slate-200 overflow-hidden flex-shrink-0">
                                    {productImage ? (
                                        <Image
                                            src={productImage}
                                            alt={productName}
                                            width={64}
                                            height={64}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                                            <Camera className="w-6 h-6" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-900 line-clamp-2">
                                        {productName}
                                    </p>
                                </div>
                            </div>

                            {/* Rating Stars */}
                            <div className="mb-4">
                                <p className="text-sm font-medium text-slate-700 mb-2">
                                    Berikan Rating
                                </p>
                                <div className="flex items-center gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            onClick={() => setRating(star)}
                                            onMouseEnter={() => setHoverRating(star)}
                                            onMouseLeave={() => setHoverRating(0)}
                                            className="p-1 transition-transform hover:scale-110"
                                        >
                                            <Star
                                                className={`w-8 h-8 transition-colors ${star <= (hoverRating || rating)
                                                        ? "text-amber-400 fill-amber-400"
                                                        : "text-slate-300"
                                                    }`}
                                            />
                                        </button>
                                    ))}
                                    <span className="ml-2 text-sm text-slate-500">
                                        {rating === 1 && "Sangat Buruk"}
                                        {rating === 2 && "Buruk"}
                                        {rating === 3 && "Cukup"}
                                        {rating === 4 && "Bagus"}
                                        {rating === 5 && "Sangat Bagus"}
                                    </span>
                                </div>
                            </div>

                            {/* Comment */}
                            <div className="mb-4">
                                <p className="text-sm font-medium text-slate-700 mb-2">
                                    Tulis Komentar (Opsional)
                                </p>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Bagikan pengalaman Anda dengan produk ini..."
                                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none transition-all"
                                    rows={4}
                                    disabled={isSubmitting}
                                />
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={resetAndClose}
                                className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                                disabled={isSubmitting}
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || rating === 0}
                                className="flex-1 py-2.5 bg-brand-primary text-white font-medium rounded-xl hover:bg-blue-600 disabled:bg-slate-300 transition-colors flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Mengirim...
                                    </>
                                ) : (
                                    "Kirim Ulasan"
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
