import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SearchPaginationProps {
    currentPage: number;
    totalPages: number;
    baseUrl: string;
}

export function SearchPagination({
    currentPage,
    totalPages,
    baseUrl,
}: SearchPaginationProps) {
    // Generate page numbers to show
    const getPageNumbers = () => {
        const pages: (number | "...")[] = [];
        const delta = 2; // Pages to show on each side of current

        for (let i = 1; i <= totalPages; i++) {
            if (
                i === 1 ||
                i === totalPages ||
                (i >= currentPage - delta && i <= currentPage + delta)
            ) {
                pages.push(i);
            } else if (pages[pages.length - 1] !== "...") {
                pages.push("...");
            }
        }

        return pages;
    };

    const buildUrl = (page: number) => {
        const url = new URL(baseUrl, "http://localhost");
        url.searchParams.set("page", page.toString());
        return `${url.pathname}${url.search}`;
    };

    return (
        <div className="flex items-center justify-center gap-2 mt-8">
            {/* Previous */}
            {currentPage > 1 ? (
                <Link
                    href={buildUrl(currentPage - 1)}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                </Link>
            ) : (
                <span className="p-2 rounded-lg border border-slate-100 text-slate-300 cursor-not-allowed">
                    <ChevronLeft className="w-5 h-5" />
                </span>
            )}

            {/* Page Numbers */}
            {getPageNumbers().map((page, idx) => (
                page === "..." ? (
                    <span key={`ellipsis-${idx}`} className="px-3 py-1 text-slate-400">
                        ...
                    </span>
                ) : (
                    <Link
                        key={page}
                        href={buildUrl(page)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${page === currentPage
                                ? "bg-brand-primary text-white"
                                : "border border-slate-200 hover:bg-slate-100 text-slate-700"
                            }`}
                    >
                        {page}
                    </Link>
                )
            ))}

            {/* Next */}
            {currentPage < totalPages ? (
                <Link
                    href={buildUrl(currentPage + 1)}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                >
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                </Link>
            ) : (
                <span className="p-2 rounded-lg border border-slate-100 text-slate-300 cursor-not-allowed">
                    <ChevronRight className="w-5 h-5" />
                </span>
            )}
        </div>
    );
}
