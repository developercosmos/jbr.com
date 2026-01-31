import Link from "next/link";
import Image from "next/image";
import { Heart, Star } from "lucide-react";

const products = [
    {
        id: 1,
        title: "Yonex Astrox 99 Pro",
        category: "Badminton",
        price: "Rp 2.400.000",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAGpIGIc7OPbDUH-8ukxsGLX_M1g0kfG-koocon5rVGIXRirllk5f2V3W1PA0awwn2JMdzaLa9tS4FTN7Ak-BzCPyKTWaDdBhMJ8MMQAJfSZWYm-8xtwGoniZ3fqTy9kLMzNeQPtegc30eY387gKV_3OXG4bEf14ja9OJgWcTxuPIyY5f_e0BZ5_3Bm6IRpahrb0iVELETAdVdLNrXnfiDoKdkXHIgBiR5qzei0VLRENsRGvuHgGrJqo3UrsreeYdMTViIEUr3A5zo",
        condition: "Pre-loved - Good",
        seller: "Badmintalk_ID",
        sellerAvatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBa8mSsHAuFonF5g3Za58AIyEY6kwasp0Bw7Q5YUa7Gd1j1aoe9kycxZYsmqKjDLe89pcVKa5S9MYoD7lqnMlzjqWQMXAEreacd9rPUQPcCne8JRaEAGE8dviTcXyPMJU8OR-ZRp_sIyUOEVbHTGzMlCtdWyoAEZP8VMFB4T-wrYiorZr2tVHGMB8jBw9q94oiaKylWvVKAj6dUvCVNcJSAyuWSX7QGQgmDG05kpxGVftN8_UshxXadMHP_6AgrdEqOtb32mThc7cw",
        rating: 4.9,
    },
    {
        id: 2,
        title: "Nike Air Zoom Pegasus 38",
        category: "Running",
        price: "Rp 1.250.000",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAjtvov4R-3D8xUXzpY1hYUmmQHEH_zW5bHXmlEgOCD3Zmj_Ju6smzyK-Q-s01pPNMYq_zROiv-kltWMCKK_p5Ic1PNstr_XOrWYNKuUnyC6RGtQkX4fjhEPJXTiwUOKUpgHwfoHhQC-ZsH2eAYzsVPYbFVvUeSvohcAHTw2eJYLZ_t2qmjJT07ACDeU96o9z0i9NsLe7bs_S_WyLL4-SMcMHE3U1xkB0i1fEuo-ZUDqf585xMl5aE8aqehhZJXedcrG4_KRnF7Ifg",
        condition: "Like New",
        seller: "RunFast_JKT",
        sellerAvatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuD57KBrW9H11lKFtCtp7VcixYT-ya1Hfjqc5w9zUs_17RhIkk_F99rht_DaLRL9y2in_xafEZ-XlDsKeGM2ULkaVBuOlf8PXCm3XFbnDRGo787WGkafeJiEUsjMCfxpss9bzkdul_KXTXe41Xzi7zFhh3mp3Aq72ebG4ksZhbrl1Kj4TnJ8dcqkc8SPcGNlHrSDQMhzvgYmrhpwNksdZx0jFCS7ZD55VvdKjOC7kY5-A7ICQg8AqFrG0Jtfx2BLXNfPjRInVSgb95A",
        rating: 4.8,
    },
    {
        id: 3,
        title: "Wilson Pro Staff 97 v13",
        category: "Tennis",
        price: "Rp 2.800.000",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuC4vV_u92Il_PefZ13ozfImA35P5jQPXkvuKBK0LpN1CFPf8FVWtoOELVUhEbZg7RmbGCjbgDbS9w-ORw9ifejQs8bvuVgzskqSlQ03SlYy5-g6P8lEAXt0CY70Mc_Q2sM4Q38Ae6xRERt2NfuY_zCYyYrScJfdTRkgDCjjOu2D-9dbv_PM3uUBKFdWntPkOcwCSQkFJgXM-r_8xW-f25mpjjb0K0gbVw7d0eH2DeFwSG2zMFZsgDXQRRVU5ksHWF3WID-g5aANI1k",
        condition: "Pre-loved - Fair",
        seller: "TennisPro_Bali",
        sellerAvatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCwMhnTxkU39OZcBzkGXc0JD3POuCyM5R6UBZheVTqYQ_xBk0F-tmVFLaCPuuwkA9LaHHbVHbRarujUByPjRFYcMmge95FShdkmzndkA8wEZUAw89Z_2u-WgKWQYBYeut0RhACug3fY5rNeiT0jidAnvW9JJ2rtzc8JtKohRbf4XOIogvha-0mhmYlPk-e7ohYbOwFIhtXns-AQp7BkX0Hu90uA-wawXAHDw6_eYgWyN0YvO0QM25U2vz4X_PCosWpyO-d5KP1-BSo",
        rating: 5.0,
    },
    {
        id: 4,
        title: "Adidas Al Rihla Pro Ball",
        category: "Soccer",
        price: "Rp 850.000",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBtMhoFfCBN0THEcr1xKuAdib2tRt1hEnQsg5_yU9lK9scptEpfOhr6ebZRnQEzoTVorPyaaus_NXa4vHqaaqNzRj6AzUUS9yK98w692XnL0I94YGRmzYzcCrj02Xjxa5xhTGwmT3lMK1XlgixCbdK-5IdDEx2Zn_HQnpYgoX11nV2rMj7p8PxfJ0NrB-SeabC5wzqHuqiek2q8GyX2OmYOfP-MdTsX2fdPyujksF9KHsOWI7NLqSVGB5mgKWW8t0fnXJqznpSsMrI",
        condition: "New",
        seller: "GoalKick_SBY",
        sellerAvatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuD9lcC_gyEv_1Dkn8vG-VUheNVIhACHnM8yVUs8-s7woQFgs6mpRFPzmCz9Y-aLezAhkj74yLKNxc31zasTqAniH27ZBUvUyQjLYzNeG3qJhL17IA9Z_uxA0oTC6K2tGfO9KJ7L9jJKBZ01j-Vos8BxeUIhfVYMmwatOvy0TkkO5TPFMQTsN07G2IeMf30XhdCx2RuuBqi54vv0DHJai03Ukias2GZhFbKDklaJyCJNftrKFa9tIYonxZg1hCP4qJCxV6xb9PkACiE",
        rating: 4.7,
    },
];

export function ProductGrid() {
    return (
        <section className="py-16 bg-slate-50">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-slate-900 font-heading">Featured Listings</h2>
                    <Link href="#" className="text-sm font-semibold text-brand-primary hover:text-blue-700 transition-colors">
                        View All Products &rarr;
                    </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {products.map((product) => (
                        <Link key={product.id} href={`/product/${product.id}`} className="group block">
                            <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                                <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                                    <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-slate-700 text-xs font-bold px-2 py-1 rounded shadow-sm z-10">
                                        {product.condition}
                                    </span>
                                    <button className="absolute top-3 right-3 p-1.5 bg-white/60 backdrop-blur-sm rounded-full text-slate-600 hover:bg-red-50 hover:text-red-500 transition-colors z-10">
                                        <Heart className="w-4 h-4" />
                                    </button>
                                    <Image
                                        src={product.image}
                                        alt={product.title}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                </div>

                                <div className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="text-xs font-medium text-slate-500 mb-1">{product.category}</p>
                                            <h3 className="font-bold text-slate-900 line-clamp-1 group-hover:text-brand-primary transition-colors">
                                                {product.title}
                                            </h3>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <div className="relative w-5 h-5 rounded-full overflow-hidden bg-slate-200">
                                                <Image src={product.sellerAvatar} alt={product.seller} fill className="object-cover" />
                                            </div>
                                            <span className="text-xs text-slate-600 truncate max-w-[80px]">{product.seller}</span>
                                        </div>
                                        <p className="font-bold text-brand-primary">{product.price}</p>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
