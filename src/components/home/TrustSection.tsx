import { ShieldCheck, Truck, Handshake } from "lucide-react";

export function TrustSection() {
    return (
        <section className="px-4 md:px-10 py-12 bg-white dark:bg-surface-dark border-y border-gray-100 dark:border-gray-800 mt-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center max-w-[960px] mx-auto">
                <div className="flex flex-col items-center gap-3">
                    <div className="size-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-brand-primary">
                        <ShieldCheck className="w-7 h-7" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Authenticity Guaranteed
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Every item is verified by our team of experts before it reaches you.
                    </p>
                </div>
                <div className="flex flex-col items-center gap-3">
                    <div className="size-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-brand-primary">
                        <Truck className="w-7 h-7" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Secure Shipping
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Tracked delivery with insurance for every purchase you make.
                    </p>
                </div>
                <div className="flex flex-col items-center gap-3">
                    <div className="size-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-brand-primary">
                        <Handshake className="w-7 h-7" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        Fair C2C Community
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Transparent pricing and direct chat with sellers you can trust.
                    </p>
                </div>
            </div>
        </section>
    );
}
