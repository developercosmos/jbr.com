import Link from "next/link";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { SimilarProducts } from "@/components/product/SimilarProducts";

// Mock data for the product
const productImages = [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBTNjOlA0I92zRdO3m89_FqqEhx2V-cHPs2uzaHzbGBw_Rl8gpf1gby_Pw4VSwr0N_EyI2dyH0vXYndOSYMbNzkr2yIvlhqlRY_GctFDwle7a1RHrVFUKjhdp-kQSXVfj8OH7kkKDd6yKXt34FEhOQE7DPdfD7XBCW7OZod_RSeWw0zY00oPI-Q9B4c76FXyIoBFSHaAMyeBD5s6d_sKgl6_DSa5-17Vi-OkRHnWdHyuGldTGZauBZpy223x1OT0h1vhRMgFu6Hc-M",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBizxJZ6BwnTRh9--m-rFQ7HEHjoT5xfk5Jn21xHvEILBFg94ZPVFax6aU48IcRCvuLgZHPUWrZTtq51lC0mw7tgGSXQgoQP2k9MArj-4OQYju1Otp0nBqRlDPz2UeDaQztkyvB_U5TZh8RJYePj-VHBlgbwZeCMrJAXC-aYJWcGUyAaxRMrlANSZTYbr412j7u8EBcDiGmqzZCduDr3Rl2lJMsgNZkKBhfBlc7ZFsvQquMKSG2V6IPUorq5lEd7P4sfguFC6ozekE",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBOdwyNQc4Kg6Jqf0bBbdcK-eDelAwWhERWKiV2LqAvaUP_hHg4zq81qYgI9fzwJvuLNYLtYdXuy_ugwogMrhYNMDPsFTKz8Cpz-apvEJatX6ibJFhRrTU5wnqpnkV3hNjFzLRPlYuen-EXa0KHWxrRMnh6Jisrw5zfWGtrT5cUM2OQV8lEF4nN_1VfNrnyibVHasF54lpoTNvk5bHQ4EC5Cjjuck9Kg4fg2dtPzDHJXO9F86wqzhC87OGud_miL2uyjb0SUo0XzwI",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDMWEmO4N9C64BAiB8zBa_qiPlnkw2wHPtUJqgzzxG_Ea1oU6lRxwVDsDbeXvRstY07RxrFE70Xt1nxnEEfKVt9uhGNkw2QM03RyEPiRdkytoKRX--4W4YQh4YRxOEM2zrxyL2KTKDzDp2d05EruTy8tvo3IWB4o3mzxASQHEScOyMZ8GbtJmfTtzP99woV42Jw29_4TBLfi-VlLcz16M3l6mXzsUAn0Y3EYGskwOSfcVgDUuJTvZtxnnBXeK543Ajz1blTjg-evDY",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAqEcoUCPzi-ian9ydzV38S2bLdDaBbCRybN7jaJbsYW8QAsl2RtpKVUDOOXKg7fT2Apct-NdLN6wjYT-TMO1JTnK8Dm8hLS7q8kbQ3QGoq2fIn45LMKyFCRgV2QiCTe2NjM67O8FMevxnRj5k1GavfFaka6rqd59w404AVexneJH_Q0RQh4FOyzB-rI66CkCxzymu7eVnPHULJd3tVQuPl4GWlGcDl1cMyWHJh9zEqSjkS4q0i66f7Lreim1YcyyePYt4QD2BdIPc",
];

export default function ProductPage() {
    return (
        <main className="flex-grow w-full max-w-7xl mx-auto px-4 lg:px-10 py-6">
            {/* Breadcrumbs */}
            <nav className="flex items-center text-sm text-slate-500 dark:text-slate-400 mb-6 overflow-x-auto whitespace-nowrap pb-2">
                <Link href="/" className="hover:text-brand-primary transition-colors">
                    Home
                </Link>
                <span className="mx-2 text-slate-400">/</span>
                <Link href="#" className="hover:text-brand-primary transition-colors">
                    Sepatu
                </Link>
                <span className="mx-2 text-slate-400">/</span>
                <Link href="#" className="hover:text-brand-primary transition-colors">
                    Lari
                </Link>
                <span className="mx-2 text-slate-400">/</span>
                <span className="text-slate-900 dark:text-white font-medium">
                    Nike Zoom Fly 5
                </span>
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                {/* Left Side: Gallery */}
                <div className="lg:col-span-7">
                    <ProductGallery images={productImages} />
                </div>

                {/* Right Side: Details & Actions */}
                <div className="lg:col-span-5">
                    <ProductInfo />
                </div>
            </div>

            {/* Similar Items Section */}
            <SimilarProducts />
        </main>
    );
}
