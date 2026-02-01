import Link from "next/link";
import { ArrowLeft, Star, Reply, Package } from "lucide-react";
import Image from "next/image";
import { getSellerReviews, getSellerRatingStats } from "@/actions/reviews";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ReviewReplyForm } from "./ReviewReplyForm";

type SellerReview = Awaited<ReturnType<typeof getSellerReviews>>[number];
type RatingStats = Awaited<ReturnType<typeof getSellerRatingStats>>;

export default async function SellerReviewsPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/auth/login?redirect=/seller/reviews");
    }

    let reviews: SellerReview[] = [];
    let stats: RatingStats = { average: 0, total: 0 };
    try {
        [reviews, stats] = await Promise.all([
            getSellerReviews(),
            getSellerRatingStats(session.user.id),
        ]);
    } catch {
        // Use defaults
    }

    const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <Link
                        href="/seller/dashboard"
                        className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900">Ulasan Toko</h1>
                </div>

                {/* Stats Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                    <div className="flex items-center gap-8">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-slate-900">
                                {stats.average.toFixed(1)}
                            </div>
                            <div className="flex items-center justify-center gap-1 mt-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                        key={star}
                                        className={`w-4 h-4 ${star <= Math.round(stats.average)
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
                        <div className="flex-1 border-l border-slate-200 pl-8">
                            <p className="text-slate-600">
                                Balas ulasan pelanggan untuk meningkatkan kepercayaan pembeli.
                                Ulasan yang dibalas menunjukkan toko yang responsif.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Reviews List */}
                {reviews.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                        <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h2 className="text-lg font-bold text-slate-700 mb-2">
                            Belum Ada Ulasan
                        </h2>
                        <p className="text-slate-500">
                            Ulasan dari pembeli akan muncul di sini setelah pesanan selesai.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {reviews.map((review) => (
                            <div
                                key={review.id}
                                className="bg-white rounded-xl border border-slate-200 p-5"
                            >
                                {/* Product Info */}
                                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-4">
                                    {review.product?.images?.[0] && (
                                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100">
                                            <Image
                                                src={review.product.images[0]}
                                                alt={review.product.title}
                                                width={48}
                                                height={48}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <Link
                                            href={`/product/${review.product?.slug}`}
                                            className="font-medium text-slate-900 hover:text-brand-primary transition-colors"
                                        >
                                            {review.product?.title}
                                        </Link>
                                    </div>
                                </div>

                                {/* Review Content */}
                                <div className="flex gap-4">
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

                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-medium text-slate-900">
                                                {review.buyer?.name || "Anonymous"}
                                            </p>
                                            <span className="text-slate-400">•</span>
                                            <span className="text-xs text-slate-500">
                                                {formatDate(review.created_at)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-0.5 mb-2">
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
                                        {review.comment && (
                                            <p className="text-slate-700">{review.comment}</p>
                                        )}

                                        {/* Seller Reply */}
                                        {review.seller_reply ? (
                                            <div className="mt-4 p-3 bg-slate-50 rounded-lg border-l-4 border-brand-primary">
                                                <p className="text-xs font-medium text-brand-primary mb-1">
                                                    Balasan Anda
                                                </p>
                                                <p className="text-sm text-slate-600">
                                                    {review.seller_reply}
                                                </p>
                                            </div>
                                        ) : (
                                            <ReviewReplyForm reviewId={review.id} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
