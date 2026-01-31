import { Star, ShieldCheck, Truck, Heart, Share2 } from "lucide-react";
import Image from "next/image";

export function ProductInfo() {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        Tennis
                    </span>
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 border border-green-100">
                        Condition: Pre-loved - Good
                    </span>
                </div>
                <h1 className="text-3xl font-bold text-slate-900 font-heading leading-tight">
                    Yonex Ezone 98 Tennis Racket (305g)
                </h1>
                <div className="flex items-center gap-4 mt-3 text-sm">
                    <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-bold text-slate-900">4.8</span>
                        <span className="text-slate-500 underline decoration-slate-300 underline-offset-2 cursor-pointer hover:text-brand-primary">
                            (12 reviews)
                        </span>
                    </div>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500">ID: #829102</span>
                </div>
            </div>

            <div className="flex items-baseline gap-3 pb-6 border-b border-slate-100">
                <span className="text-4xl font-bold text-brand-primary font-heading">
                    Rp 1.500.000
                </span>
                <span className="text-lg text-slate-400 line-through">
                    Rp 2.800.000
                </span>
                <span className="text-sm font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    -46%
                </span>
            </div>

            {/* Seller Info */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden border border-white shadow-sm">
                        <Image
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCwMhnTxkU39OZcBzkGXc0JD3POuCyM5R6UBZheVTqYQ_xBk0F-tmVFLaCPuuwkA9LaHHbVHbRarujUByPjRFYcMmge95FShdkmzndkA8wEZUAw89Z_2u-WgKWQYBYeut0RhACug3fY5rNeiT0jidAnvW9JJ2rtzc8JtKohRbf4XOIogvha-0mhmYlPk-e7ohYbOwFIhtXns-AQp7BkX0Hu90uA-wawXAHDw6_eYgWyN0YvO0QM25U2vz4X_PCosWpyO-d5KP1-BSo"
                            alt="Seller"
                            fill
                            className="object-cover"
                        />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">Sarah Tennis</span>
                            <ShieldCheck className="w-4 h-4 text-brand-primary" />
                        </div>
                        <p className="text-xs text-slate-500">Joined 2021 • Jakarta Selatan</p>
                    </div>
                </div>
                <button className="text-sm font-semibold text-brand-primary hover:underline">
                    View Profile
                </button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                    <button className="flex-1 bg-brand-primary hover:bg-slate-800 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-brand-primary/20 transition-all active:scale-[0.98]">
                        Buy Now
                    </button>
                    <button className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 font-bold py-3.5 px-6 rounded-xl transition-all active:scale-[0.98]">
                        Chat Seller
                    </button>
                </div>
                <div className="flex gap-3">
                    <button className="flex-1 flex items-center justify-center gap-2 text-slate-600 hover:text-red-500 py-2.5 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium">
                        <Heart className="w-4 h-4" /> Add to Wishlist
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 text-slate-600 hover:text-brand-primary py-2.5 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium">
                        <Share2 className="w-4 h-4" /> Share
                    </button>
                </div>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                    <ShieldCheck className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-xs font-bold text-slate-900">Authenticity Guarantee</h4>
                        <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                            Verified by our experts or money back.
                        </p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50/50 border border-green-100">
                    <Truck className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-xs font-bold text-slate-900">Secure Shipping</h4>
                        <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                            Tracked delivery with insurance included.
                        </p>
                    </div>
                </div>
            </div>

            {/* Description */}
            <div className="pt-6 border-t border-slate-100">
                <h3 className="font-bold text-slate-900 mb-3">Description</h3>
                <div className="text-sm text-slate-600 leading-relaxed space-y-4">
                    <p>
                        Selling my spare Yonex Ezone 98. It&apos;s the 2022 model, 305g unstrung.
                        Grip size L2 (4 1/4).
                    </p>
                    <p>
                        Condition is good, just some minor paint chips on the hoop from normal play (see photos).
                        No cracks or structural damage.
                    </p>
                    <p>
                        Strung with Yonex Poly Tour Pro at 52lbs about a month ago.
                        Fresh overgrip installed. Ready to play!
                    </p>
                </div>
            </div>
        </div>
    );
}
