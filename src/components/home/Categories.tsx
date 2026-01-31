import { ArrowRight, Trophy, Footprints, Dumbbell, Waves, Bike } from "lucide-react";
import Link from "next/link";

export function Categories() {
    return (
        <section className="px-4 md:px-10 py-4">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-slate-900 dark:text-white text-xl md:text-2xl font-bold tracking-tight">
                    Browse by Sport
                </h2>
                <Link
                    href="#"
                    className="text-brand-primary text-sm font-semibold hover:underline flex items-center gap-1"
                >
                    View All <ArrowRight className="w-[18px] h-[18px]" />
                </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar py-2 -mx-4 px-4 md:mx-0 md:px-0">
                {/* Active Chip */}
                <button className="flex shrink-0 items-center gap-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-3 transition-transform hover:scale-105">
                    <Trophy className="w-5 h-5" />
                    <span className="text-sm font-bold whitespace-nowrap">Sepakbola</span>
                </button>
                {/* Inactive Chips */}
                <button className="flex shrink-0 items-center gap-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-slate-700 dark:text-gray-200 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all hover:border-gray-300 dark:hover:border-gray-600">
                    <Footprints className="w-5 h-5" />
                    <span className="text-sm font-medium whitespace-nowrap">Lari</span>
                </button>
                <button className="flex shrink-0 items-center gap-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-slate-700 dark:text-gray-200 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all hover:border-gray-300 dark:hover:border-gray-600">
                    <Trophy className="w-5 h-5" />
                    <span className="text-sm font-medium whitespace-nowrap">Badminton</span>
                </button>
                <button className="flex shrink-0 items-center gap-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-slate-700 dark:text-gray-200 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all hover:border-gray-300 dark:hover:border-gray-600">
                    <Dumbbell className="w-5 h-5" />
                    <span className="text-sm font-medium whitespace-nowrap">Gym</span>
                </button>
                <button className="flex shrink-0 items-center gap-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-slate-700 dark:text-gray-200 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all hover:border-gray-300 dark:hover:border-gray-600">
                    <Trophy className="w-5 h-5" />
                    <span className="text-sm font-medium whitespace-nowrap">Basket</span>
                </button>
                <button className="flex shrink-0 items-center gap-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-slate-700 dark:text-gray-200 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all hover:border-gray-300 dark:hover:border-gray-600">
                    <Waves className="w-5 h-5" />
                    <span className="text-sm font-medium whitespace-nowrap">Renang</span>
                </button>
                <button className="flex shrink-0 items-center gap-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-slate-700 dark:text-gray-200 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all hover:border-gray-300 dark:hover:border-gray-600">
                    <Bike className="w-5 h-5" />
                    <span className="text-sm font-medium whitespace-nowrap">Sepeda</span>
                </button>
            </div>
        </section>
    );
}
