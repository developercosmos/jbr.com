import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { GiPaddles, GiTennisRacket, GiShuttlecock, GiSoccerBall } from "react-icons/gi";
import { IoShirtOutline } from "react-icons/io5";
import { TbPackage } from "react-icons/tb";

// "Browse by Sport" — top-level sport groups. Until products carry a dedicated
// `sport` attribute, each chip routes to a search for that sport so it works
// immediately; the labels/order are the source of truth here.
type SportChip = {
    label: string;
    href: string;
    Icon: React.ComponentType<{ className?: string }>;
};

const SPORTS: SportChip[] = [
    { label: "Padel", href: "/search?q=padel", Icon: GiPaddles },
    { label: "Pickleball", href: "/search?q=pickleball", Icon: GiPaddles },
    { label: "Tennis", href: "/search?q=tennis", Icon: GiTennisRacket },
    { label: "Badminton", href: "/search?q=badminton", Icon: GiShuttlecock },
    { label: "Squash", href: "/search?q=squash", Icon: GiTennisRacket },
    { label: "Sepak Bola", href: "/search?q=sepak%20bola", Icon: GiSoccerBall },
    { label: "Others", href: "/search", Icon: TbPackage },
    { label: "Fashion & Accessories", href: "/search?q=fashion", Icon: IoShirtOutline },
];

export function Categories() {
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
                {SPORTS.map((sport, index) => {
                    const Icon = sport.Icon;
                    return (
                        <Link
                            key={sport.label}
                            href={sport.href}
                            className={`flex shrink-0 items-center gap-2 rounded-full px-5 py-3 transition-all hover:scale-105 ${index === 0
                                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-slate-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                }`}
                        >
                            <Icon className="w-5 h-5" />
                            <span className={`text-sm whitespace-nowrap ${index === 0 ? "font-bold" : "font-medium"}`}>
                                {sport.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
