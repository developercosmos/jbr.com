import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { readOfferDraftCookie } from "@/lib/offer-draft";
import { FeatureFlagProvider } from "@/lib/use-flag";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { SimilarProducts } from "@/components/product/SimilarProducts";
import { ProductReviews } from "@/components/product/ProductReviews";
import { getProductBySlug } from "@/actions/products";
import { getSellerReputationSummary } from "@/actions/reputation";
import { getMatchScore } from "@/actions/niche";
import { PdpRecentlyViewedRecorder } from "@/components/RecentlyViewedStrip";
import { buildImageVariants, pickImageVariant } from "@/lib/image-variants";
import { PdpPresenceChip } from "@/components/product/PdpPresenceChip";

// CACHE-01: ISR — PDP is anonymous-safe (session-aware bits are all client-side
// useEffect inside PdpRecentlyViewedRecorder). 5 min revalidate; product
// mutations call revalidatePath("/product/<slug>") for faster propagation.
export const revalidate = 300;

interface ProductPageProps {
    params: Promise<{ slug: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
    const { slug } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    const product = await getProductBySlug(slug);

    if (!product) {
        notFound();
    }

    const flagContext = {
        userId: session?.user?.id,
        bucketKey: session?.user?.id,
    };
    const [
        inlineOfferEnabled,
        sellerBadgesEnabled,
        sellerJoinDateEnabled,
        reviewThumbnailEnabled,
        compareModeEnabled,
        matchScoreEnabled,
        livePresenceEnabled,
        smartQuestionsEnabled,
        intentScoreEnabled,
        offerDraft,
    ] = await Promise.all([
        isFeatureEnabled("pdp.inline_offer", flagContext),
        isFeatureEnabled("pdp.seller_badges", flagContext),
        isFeatureEnabled("pdp.seller_join_date", flagContext),
        isFeatureEnabled("pdp.review_thumbnail", flagContext),
        isFeatureEnabled("dif.compare_mode", flagContext),
        isFeatureEnabled("dif.match_score", flagContext),
        isFeatureEnabled("dif.live_presence", flagContext),
        isFeatureEnabled("dif.smart_questions", flagContext),
        isFeatureEnabled("dif.intent_score", flagContext),
        readOfferDraftCookie(product.id),
    ]);

    const sellerReputation = product.seller
        ? await getSellerReputationSummary(product.seller.id)
        : null;
    const matchScore = session?.user?.id && matchScoreEnabled
        ? await getMatchScore(product.id, session.user.id)
        : null;

    return (
        <main className="flex-grow w-full max-w-7xl mx-auto px-4 lg:px-10 py-6">
            {/* Breadcrumbs */}
            <nav className="flex items-center text-sm text-slate-500 dark:text-slate-400 mb-6 overflow-x-auto whitespace-nowrap pb-2">
                <Link href="/" className="hover:text-brand-primary transition-colors">
                    Home
                </Link>
                <span className="mx-2 text-slate-400">/</span>
                {product.category && (
                    <>
                        <Link href={`/category/${product.category.slug}`} className="hover:text-brand-primary transition-colors">
                            {product.category.name}
                        </Link>
                        <span className="mx-2 text-slate-400">/</span>
                    </>
                )}
                <span className="text-slate-900 dark:text-white font-medium">
                    {product.title}
                </span>
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                {/* Left Side: Gallery */}
                <div className="lg:col-span-7">
                    <ProductGallery images={product.images || []} />
                </div>

                {/* Right Side: Details & Actions */}
                <div className="lg:col-span-5">
                    <FeatureFlagProvider
                        flags={{
                            "pdp.inline_offer": inlineOfferEnabled,
                            "pdp.seller_badges": sellerBadgesEnabled,
                            "pdp.seller_join_date": sellerJoinDateEnabled,
                            "dif.live_presence": livePresenceEnabled,
                            "dif.smart_questions": smartQuestionsEnabled,
                            "dif.intent_score": intentScoreEnabled,
                        }}
                    >
                        {livePresenceEnabled && (
                            <div className="mb-3">
                                <PdpPresenceChip productId={product.id} />
                            </div>
                        )}
                        <ProductInfo
                            product={{
                                id: product.id,
                                slug: product.slug,
                                title: product.title,
                                description: product.description,
                                price: product.price,
                                condition: product.condition,
                                condition_rating: product.condition_rating,
                                condition_notes: product.condition_notes,
                                condition_checklist: product.condition_checklist,
                                stock: product.stock,
                                seller: product.seller,
                                category: product.category,
                                variants: product.variants,
                                bargain_enabled: product.bargain_enabled,
                                auto_decline_below: product.auto_decline_below,
                            }}
                            sellerReputation={sellerReputation}
                            isAuthenticated={Boolean(session?.user)}
                            initialOfferAmount={offerDraft?.amount ?? null}
                            sellerJoinedAt={product.seller?.store_reviewed_at ?? product.seller?.created_at ?? null}
                            sellerVerified={Boolean(product.seller?.email_verified && product.seller?.store_status === "ACTIVE")}
                            matchScore={matchScore?.score ?? null}
                        />
                    </FeatureFlagProvider>
                </div>
            </div>

            {/* REC-02: record this PDP visit into recently-viewed (server + local) */}
            <PdpRecentlyViewedRecorder
                productId={product.id}
                slug={product.slug}
                title={product.title}
                price={product.price}
                image={product.images?.[0] ?? null}
            />

            {/* Product Reviews — CACHE-03: prefer pre-baked thumb variant URL */}
            <ProductReviews
                productId={product.id}
                showProductThumbnail={reviewThumbnailEnabled}
                productThumbnailSrc={
                    product.images?.[0]
                        ? pickImageVariant({ ...buildImageVariants(product.images[0]) }, product.images[0], 80)
                        : null
                }
                productTitle={product.title}
            />

            {/* Similar Items Section */}
            <SimilarProducts currentProductId={product.id} currentProductSlug={product.slug} compareModeEnabled={compareModeEnabled} />
        </main>
    );
}
