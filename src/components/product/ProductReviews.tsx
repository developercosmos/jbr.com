import { Star } from "lucide-react";
import { getProductReviews, getProductRatingStats } from "@/actions/reviews";
import Image from "next/image";

interface ProductReviewsProps {
    productId: string;
}

export async function ProductReviews({ productId }: ProductReviewsProps) {
    const [reviews, stats] = await Promise.all([
        getProductReviews(productId),
        getProductRatingStats(productId),
    ]);

    if (reviews.length === 0) {
        return (
            <section className="mt-8">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Ulasan Produk</h2>
                <div className="bg-slate-50 rounded-xl p-8 text-center border border-slate-200">
                    <Star className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">Belum ada ulasan untuk produk ini</p>
                </div>
            </section>
        );
    }

    const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    };

    return (
        <section className="mt-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
                Ulasan Produk ({stats.total})
            </h2>

            {/* Rating Summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                <div className="flex flex-col sm:flex-row gap-6 items-center">
                    {/* Average Rating */}
                    <div className="text-center">
                        <div className="text-5xl font-bold text-slate-900">
                            {stats.average.toFixed(1)}
                        </div>
                        <div className="flex items-center justify-center gap-1 mt-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                    key={star}
                                    className={`w-5 h-5 ${star <= Math.round(stats.average)
                                            ? "text-amber-400 fill-amber-400"
                                            : "text-slate-300"
                                        }`}
                                />
                            ))}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                            {stats.total} ulasan
                        </p>
                    </div>

                    {/* Rating Distribution */}
                    <div className="flex-1 w-full">
                        {[5, 4, 3, 2, 1].map((rating) => {
                            const count = stats.distribution[rating] || 0;
                            const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                            return (
                                <div key={rating} className="flex items-center gap-3 mb-2">
                                    <div className="flex items-center gap-1 w-12">
                                        <span className="text-sm text-slate-600">{rating}</span>
                                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                    </div>
                                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-amber-400 rounded-full transition-all"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-slate-500 w-8">
                                        {count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Reviews List */}
            <div className="space-y-4">
                {reviews.map((review) => (
                    <div
                        key={review.id}
                        className="bg-white rounded-xl border border-slate-200 p-5"
                    >
                        <div className="flex items-start gap-4">
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                                {review.buyer?.image ? (
                                    <Image
                                        src={review.buyer.image}
                                        alt={review.buyer.name || "User"}
                                        width={40}
                                        height={40}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold">
                                        {review.buyer?.name?.[0]?.toUpperCase() || "U"}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                {/* Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                                    <p className="font-medium text-slate-900">
                                        {review.buyer?.name || "Anonymous"}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-0.5">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star
                                                    key={star}
                                                    className={`w-4 h-4 ${star <= review.rating
                                                            ? "text-amber-400 fill-amber-400"
                                                            : "text-slate-300"
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-xs text-slate-400">•</span>
                                        <span className="text-xs text-slate-500">
                                            {formatDate(review.created_at)}
                                        </span>
                                    </div>
                                </div>

                                {/* Comment */}
                                {review.comment && (
                                    <p className="text-slate-700 mb-3">{review.comment}</p>
                                )}

                                {/* Images */}
                                {review.images && review.images.length > 0 && (
                                    <div className="flex gap-2 flex-wrap mb-3">
                                        {review.images.map((url, idx) => (
                                            <div
                                                key={idx}
                                                className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100"
                                            >
                                                <Image
                                                    src={url}
                                                    alt={`Review image ${idx + 1}`}
                                                    width={80}
                                                    height={80}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Seller Reply */}
                                {review.seller_reply && (
                                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border-l-4 border-brand-primary">
                                        <p className="text-xs font-medium text-brand-primary mb-1">
                                            Balasan Penjual
                                        </p>
                                        <p className="text-sm text-slate-600">
                                            {review.seller_reply}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
