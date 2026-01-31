import Link from "next/link";
import { ArrowRight, ShieldCheck, Zap } from "lucide-react";

export function Hero() {
    return (
        <section className="relative overflow-hidden bg-white pt-16 pb-20 lg:pt-24 lg:pb-28">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-brand-primary mb-6 border border-blue-100">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verified Authentic Gear</span>
                    </div>
                    <h1 className="text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl lg:text-7xl font-heading mb-6">
                        Upgrade Your Game with <br />
                        <span className="text-brand-primary">JUALBELIRAKET.COM</span>
                    </h1>
                    <p className="mt-4 text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
                        The most trusted marketplace for buying and selling used sports equipment.
                        Find premium rackets, shoes, and gear at unbeatable prices.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link
                            href="#"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-brand-primary px-8 py-4 text-base font-bold text-white shadow-lg shadow-brand-primary/25 hover:bg-slate-800 transition-all hover:-translate-y-1"
                        >
                            Start Buying
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                        <Link
                            href="/seller/products/add"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 transition-all hover:-translate-y-1"
                        >
                            <Zap className="w-5 h-5 text-orange-500" />
                            Sell Your Gear
                        </Link>
                    </div>
                </div>
            </div>

            {/* Background Elements */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-[1440px] pointer-events-none">
                <div className="absolute top-20 left-10 w-72 h-72 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                <div className="absolute top-20 right-10 w-72 h-72 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-pink-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
            </div>
        </section>
    );
}
