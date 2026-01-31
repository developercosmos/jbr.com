import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function WishlistPage() {
    return (
        <div className="flex-1">
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white uppercase mb-2">
                    Wishlist
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Barang impian yang Anda simpan.
                </p>
            </div>

            {/* Wishlist Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Product 1 */}
                <div className="group bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-lg transition-all">
                    <div className="relative aspect-square bg-slate-100 dark:bg-slate-800">
                        <Image
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAIaF_lSZ7Pxl2d96PA8BCRBrdPH42wW783ImbT7w8ufOm4cteDQpCZAMda9XdBG6RDdX8tDO7X-mF1iBrDebNfjwGQQbdSn4oW_7r3a2KvC6ZgmE6WB2s_YFz5vO2n1Jy4h0QRpg9NH4vIt-9y5oQ9ScsGsrRi1uqxZ8ErOTAeG4i9JIinF9qS6bs7GZdsaY2BIBmDuMAx8_uKaTTy37FIbrdDQdyb8njxQdGNT3NofDa8FOV9p7fTY2HAdVcX3UuQxcP0b-UnqO4"
                            alt="Product"
                            fill
                            className="object-cover"
                        />
                        <button className="absolute top-3 right-3 p-2 rounded-full bg-white/80 dark:bg-black/50 text-red-500 hover:bg-white dark:hover:bg-black/70 transition-colors">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-4">
                        <Link href="/product/nike-air-jordan-red">
                            <h3 className="font-bold text-slate-900 dark:text-white mb-1 truncate group-hover:text-brand-primary transition-colors">
                                Nike Air Jordan Red
                            </h3>
                        </Link>
                        <p className="text-sm text-slate-500 mb-3">Sepatu Olahraga</p>
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-lg text-slate-900 dark:text-white">
                                Rp 2.500.000
                            </span>
                            <button className="p-2 rounded-lg bg-brand-primary text-white hover:bg-blue-600 transition-colors shadow-lg shadow-brand-primary/20">
                                <ShoppingCart className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Product 2 */}
                <div className="group bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-lg transition-all">
                    <div className="relative aspect-square bg-slate-100 dark:bg-slate-800">
                        <Image
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAOQy9vRJqIQMmAmWRCB1SGC99BPsLlljsIZ2755XuqU-0grLUuh4vsiJkgUtxxNduBzXhAfSaZ0UeAQY6km0V7iYhiwjE-yfZ66E2ncSSpXM2KQOz40uPBHmQxXD2Z0edwc5Rbv2pinPtLyRfr22CrKr-SKbKEeeqm4bQqGmw3-ZsUnTk1SX14i3bdns3s-gjWtR536hpIJDJ5kgQZpBN7qc3UYqMUca54kPDiBDHXcVMr8oplziatKZjjrisrIGliYLBxSVNggws"
                            alt="Product"
                            fill
                            className="object-cover"
                        />
                        <button className="absolute top-3 right-3 p-2 rounded-full bg-white/80 dark:bg-black/50 text-red-500 hover:bg-white dark:hover:bg-black/70 transition-colors">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-4">
                        <Link href="/product/nike-air-zoom-pegasus">
                            <h3 className="font-bold text-slate-900 dark:text-white mb-1 truncate group-hover:text-brand-primary transition-colors">
                                Nike Air Zoom Pegasus
                            </h3>
                        </Link>
                        <p className="text-sm text-slate-500 mb-3">Sepatu Lari</p>
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-lg text-slate-900 dark:text-white">
                                Rp 1.200.000
                            </span>
                            <button className="p-2 rounded-lg bg-brand-primary text-white hover:bg-blue-600 transition-colors shadow-lg shadow-brand-primary/20">
                                <ShoppingCart className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Product 3 */}
                <div className="group bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-lg transition-all">
                    <div className="relative aspect-square bg-slate-100 dark:bg-slate-800">
                        <Image
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBs0GkRmYjsiWzaO4wQT9HcN9T65beA7GTvR4zLZ-W9QBG-e4Pr01t6w8CSIFe-oRNjOp7WF1CVwYqcmg7iX2KwiMoxcchp6CkhwpqgMGxI_LpKmJ_9Os6wjS4lGkaIA__q1G7tlWuLzzjBsI3yqTTCJMSYo3IKMET1w7KM26K_1Je4_hfa_v3f-O0UQeWCsOvwMAE2KSdPP7ABBffZGB9dXZ8fBNh6scx6TrZj5Zsf6zt7CR5aEq1shkwtrocFKq2uER0srdH0kow"
                            alt="Product"
                            fill
                            className="object-cover"
                        />
                        <button className="absolute top-3 right-3 p-2 rounded-full bg-white/80 dark:bg-black/50 text-red-500 hover:bg-white dark:hover:bg-black/70 transition-colors">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-4">
                        <Link href="/product/wilson-tennis-racket">
                            <h3 className="font-bold text-slate-900 dark:text-white mb-1 truncate group-hover:text-brand-primary transition-colors">
                                Wilson Tennis Racket
                            </h3>
                        </Link>
                        <p className="text-sm text-slate-500 mb-3">Raket Tenis</p>
                        <div className="flex items-center justify-between">
                            <span className="font-bold text-lg text-slate-900 dark:text-white">
                                Rp 850.000
                            </span>
                            <button className="p-2 rounded-lg bg-brand-primary text-white hover:bg-blue-600 transition-colors shadow-lg shadow-brand-primary/20">
                                <ShoppingCart className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
