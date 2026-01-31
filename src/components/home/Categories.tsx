import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getCategories } from "@/actions/categories";

// Icon mapping for categories (fallback to default)
const categoryIcons: Record<string, string> = {
    rackets: "🏸",
    shoes: "👟",
    bags: "🎒",
    shuttlecocks: "🪶",
    apparel: "👕",
    grips: "🧵",
    strings: "🎯",
    accessories: "⚡",
    // Sports
    olahraga: "🏸",
    sepakbola: "⚽",
    basketball: "🏀",
    tennis: "🎾",
    running: "🏃",
    gym: "🏋️",
    swimming: "🏊",
    cycling: "🚴",
};

export async function Categories() {
    const categories = await getCategories();

    // If no categories in database, show placeholder
    if (categories.length === 0) {
        return (
            <section className="px-4 md:px-10 py-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-slate-900 dark:text-white text-xl md:text-2xl font-bold tracking-tight">
                        Browse by Sport
                    </h2>
                    <Link
                        href="/equipment"
                        className="text-brand-primary text-sm font-semibold hover:underline flex items-center gap-1"
                    >
                        View All <ArrowRight className="w-[18px] h-[18px]" />
                    </Link>
                </div>
                <div className="text-center py-8 text-slate-500">
                    <p>Belum ada kategori. Admin dapat menambahkan di dashboard.</p>
                </div>
            </section>
        );
    }

    return (
        <section className="px-4 md:px-10 py-4">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-slate-900 dark:text-white text-xl md:text-2xl font-bold tracking-tight">
                    Browse by Sport
                </h2>
                <Link
                    href="/equipment"
                    className="text-brand-primary text-sm font-semibold hover:underline flex items-center gap-1"
                >
                    View All <ArrowRight className="w-[18px] h-[18px]" />
                </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar py-2 -mx-4 px-4 md:mx-0 md:px-0">
                {categories.map((category, index) => {
                    const icon = categoryIcons[category.slug] || "📦";
                    return (
                        <Link
                            key={category.id}
                            href={`/category/${category.slug}`}
                            className={`flex shrink-0 items-center gap-2 rounded-full px-5 py-3 transition-all hover:scale-105 ${index === 0
                                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-slate-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                }`}
                        >
                            <span className="text-lg">{icon}</span>
                            <span className={`text-sm whitespace-nowrap ${index === 0 ? "font-bold" : "font-medium"}`}>
                                {category.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
