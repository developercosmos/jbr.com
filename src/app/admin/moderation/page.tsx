import Link from "next/link";
import Image from "next/image";
import { History, PlayCircle, Hourglass, TrendingUp, Flag, CheckCircle, Timer, ArrowDown, Search, Filter, MoreHorizontal, Ban, Gavel, ChevronDown } from "lucide-react";

export default function ModerationPage() {
    return (
        <>
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-white to-transparent pointer-events-none dark:from-white/5 dark:to-transparent"></div>
            <div className="container mx-auto max-w-[1600px] p-6 lg:p-10 flex flex-col gap-8 relative z-0">
                {/* Header */}
                <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                    <div>
                        <nav aria-label="Breadcrumb" className="flex mb-3">
                            <ol className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
                                <li>
                                    <Link
                                        href="/admin"
                                        className="hover:text-brand-primary transition-colors"
                                    >
                                        Dashboard
                                    </Link>
                                </li>
                                <li>
                                    <span className="text-slate-300 dark:text-slate-600">/</span>
                                </li>
                                <li>
                                    <span className="font-medium text-brand-primary">
                                        Product Moderation
                                    </span>
                                </li>
                            </ol>
                        </nav>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white uppercase">
                            Moderation Queue
                        </h1>
                        <p className="mt-2 text-slate-500 dark:text-slate-400 text-lg">
                            Ensure platform quality by reviewing incoming product listings.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                            <History className="w-5 h-5" />
                            History Log
                        </button>
                        <button className="flex items-center gap-2 rounded-xl bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-primary/25 hover:bg-blue-600 transition-all">
                            <PlayCircle className="w-5 h-5" />
                            Start Review Session
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Pending */}
                    <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-surface-dark p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                                    Pending
                                </p>
                                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white font-heading">
                                    142
                                </p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-500">
                                <Hourglass className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm">
                            <span className="flex items-center rounded-full bg-green-50 dark:bg-green-500/10 px-2 py-0.5 text-xs font-bold text-green-600 dark:text-green-400">
                                <TrendingUp className="w-3.5 h-3.5 mr-1" /> 12%
                            </span>
                            <span className="text-slate-400">vs yesterday</span>
                        </div>
                    </div>
                    {/* Flagged */}
                    <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-surface-dark p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                                    Flagged
                                </p>
                                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white font-heading">
                                    12
                                </p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10 text-red-500">
                                <Flag className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">
                                Critical Attention
                            </span>
                        </div>
                    </div>
                    {/* Processed */}
                    <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-surface-dark p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                                    Processed
                                </p>
                                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white font-heading">
                                    85
                                </p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 dark:bg-green-500/10 text-green-500">
                                <CheckCircle className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-4 w-full rounded-full bg-slate-100 dark:bg-slate-700 h-1.5">
                            <div
                                className="bg-green-500 h-1.5 rounded-full"
                                style={{ width: "85%" }}
                            ></div>
                        </div>
                        <p className="mt-1 text-xs text-slate-400 text-right">
                            85% of daily target
                        </p>
                    </div>
                    {/* Speed */}
                    <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-surface-dark p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                                    Speed
                                </p>
                                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white font-heading">
                                    2m 14s
                                </p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 text-brand-primary">
                                <Timer className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm">
                            <span className="flex items-center rounded-full bg-green-50 dark:bg-green-500/10 px-2 py-0.5 text-xs font-bold text-green-600 dark:text-green-400">
                                <ArrowDown className="w-3.5 h-3.5 mr-1" /> 15s
                            </span>
                            <span className="text-slate-400">faster avg</span>
                        </div>
                    </div>
                </div>

                {/* Filters & Table */}
                <div className="flex flex-col rounded-2xl bg-white dark:bg-surface-dark shadow-sm overflow-hidden border border-slate-100 dark:border-slate-800">
                    {/* Filters */}
                    <div className="border-b border-slate-100 dark:border-slate-800 p-5 flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-surface-dark">
                        <div className="relative w-full md:max-w-md group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors">
                                <Search className="w-5 h-5" />
                            </span>
                            <input
                                className="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-brand-primary focus:ring-brand-primary transition-shadow"
                                placeholder="Search by ID, Product Name, or Seller..."
                                type="text"
                            />
                        </div>
                        <div className="flex flex-wrap gap-3 w-full md:w-auto">
                            <div className="relative">
                                <select className="appearance-none cursor-pointer rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark py-2.5 pl-4 pr-10 text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-brand-primary focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all">
                                    <option>All Categories</option>
                                    <option>Footwear</option>
                                    <option>Apparel</option>
                                    <option>Equipment</option>
                                </select>
                                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <ChevronDown className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="relative">
                                <select className="appearance-none cursor-pointer rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark py-2.5 pl-4 pr-10 text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-brand-primary focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all">
                                    <option>Status: Pending</option>
                                    <option>Flagged</option>
                                    <option>Approved</option>
                                    <option>Rejected</option>
                                </select>
                                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <ChevronDown className="w-5 h-5" />
                                </div>
                            </div>
                            <button className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-brand-primary">
                                <Filter className="w-5 h-5" />
                                More Filters
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-black/20 border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="w-14 px-6 py-4">
                                        <input
                                            className="h-5 w-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                                            type="checkbox"
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 font-heading">
                                        Product Info
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 font-heading">
                                        Seller
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 font-heading">
                                        Pricing
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 font-heading">
                                        Condition & Status
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 font-heading text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {/* Row 1 */}
                                <tr className="group hover:bg-blue-50/50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-5 align-top">
                                        <input
                                            className="mt-2 h-5 w-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                                            type="checkbox"
                                        />
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-start gap-4">
                                            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark shadow-sm">
                                                <Image
                                                    alt="Red Nike running shoe side profile"
                                                    className="object-cover transition-transform group-hover:scale-105"
                                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAjtvov4R-3D8xUXzpY1hYUmmQHEH_zW5bHXmlEgOCD3Zmj_Ju6smzyK-Q-s01pPNMYq_zROiv-kltWMCKK_p5Ic1PNstr_XOrWYNKuUnyC6RGtQkX4fjhEPJXTiwUOKUpgHwfoHhQC-ZsH2eAYzsVPYbFVvUeSvohcAHTw2eJYLZ_t2qmjJT07ACDeU96o9z0i9NsLe7bs_S_WyLL4-SMcMHE3U1xkB0i1fEuo-ZUDqf585xMl5aE8aqehhZJXedcrG4_KRnF7Ifg"
                                                    fill
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <span className="font-bold text-slate-900 dark:text-white text-base line-clamp-1">
                                                    Nike Air Zoom Pegasus 38
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                        Running
                                                    </span>
                                                    <span className="text-xs text-slate-400 font-mono">
                                                        ID: 8291
                                                    </span>
                                                </div>
                                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    Posted 2 mins ago
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 align-top">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 font-bold text-xs">
                                                SO
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-900 dark:text-white">
                                                    SportySpice_Official
                                                </span>
                                                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                                    <span className="text-orange-500">★</span>
                                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                                        4.9
                                                    </span>
                                                    <span>(1.2k)</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 align-top">
                                        <span className="font-bold text-slate-900 dark:text-white font-heading text-lg">
                                            Rp 1.850.000
                                        </span>
                                        <div className="text-xs text-slate-400 mt-1">
                                            Retail: Rp 2.100.000
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 align-top">
                                        <div className="flex flex-col gap-2 items-start">
                                            <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-500/10 px-3 py-1 text-xs font-bold text-green-700 dark:text-green-400 ring-1 ring-inset ring-green-600/20">
                                                New Condition
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 dark:bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-700 dark:text-yellow-400 ring-1 ring-inset ring-yellow-600/20">
                                                <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
                                                Pending Review
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right align-top">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 transition-colors"
                                                title="Reject"
                                            >
                                                <Ban className="w-5 h-5" />
                                            </button>
                                            <button
                                                className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white hover:shadow-lg hover:shadow-brand-primary/20 transition-all"
                                                title="Approve"
                                            >
                                                <CheckCircle className="w-5 h-5" />
                                            </button>
                                            <button className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-white transition-colors">
                                                <MoreHorizontal className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {/* Row 2 - Flagged */}
                                <tr className="group hover:bg-blue-50/50 dark:hover:bg-white/5 transition-colors bg-red-50/30 dark:bg-red-500/5">
                                    <td className="px-6 py-5 align-top">
                                        <input
                                            className="mt-2 h-5 w-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                                            type="checkbox"
                                        />
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-start gap-4">
                                            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-surface-dark shadow-sm">
                                                <div className="absolute inset-0 bg-red-500/10 z-10"></div>
                                                <Image
                                                    alt="Badminton racket grip close up"
                                                    className="object-cover transition-transform group-hover:scale-105"
                                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAGpIGIc7OPbDUH-8ukxsGLX_M1g0kfG-koocon5rVGIXRirllk5f2V3W1PA0awwn2JMdzaLa9tS4FTN7Ak-BzCPyKTWaDdBhMJ8MMQAJfSZWYm-8xtwGoniZ3fqTy9kLMzNeQPtegc30eY387gKV_3OXG4bEf14ja9OJgWcTxuPIyY5f_e0BZ5_3Bm6IRpahrb0iVELETAdVdLNrXnfiDoKdkXHIgBiR5qzei0VLRENsRGvuHgGrJqo3UrsreeYdMTViIEUr3A5zo"
                                                    fill
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-900 dark:text-white text-base line-clamp-1">
                                                        Yonex Astrox 99 Pro
                                                    </span>
                                                    <Flag className="w-4 h-4 text-red-500" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                        Badminton
                                                    </span>
                                                    <span className="text-xs text-slate-400 font-mono">
                                                        ID: 8292
                                                    </span>
                                                </div>
                                                <div className="mt-1 text-xs text-red-500 font-medium">
                                                    Reported: Suspected Counterfeit
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 align-top">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/30 text-brand-primary flex items-center justify-center font-bold text-xs border border-blue-200 dark:border-blue-800">
                                                BT
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-900 dark:text-white">
                                                    Badmintalk_ID
                                                </span>
                                                <div className="flex items-center gap-1 text-xs text-brand-primary">
                                                    <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 font-bold">
                                                        NEW SELLER
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 align-top">
                                        <span className="font-bold text-slate-900 dark:text-white font-heading text-lg">
                                            Rp 2.400.000
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 align-top">
                                        <div className="flex flex-col gap-2 items-start">
                                            <span className="inline-flex items-center rounded-full bg-orange-50 dark:bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-600 dark:text-orange-400 ring-1 ring-inset ring-orange-600/20">
                                                Pre-loved - Good
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 dark:bg-red-500/10 px-3 py-1 text-xs font-bold text-red-700 dark:text-red-400 ring-1 ring-inset ring-red-600/20">
                                                <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                                                Flagged
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right align-top">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                className="flex h-10 w-10 items-center justify-center rounded-xl text-red-500 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-700 transition-colors"
                                                title="Ban Seller"
                                            >
                                                <Gavel className="w-5 h-5" />
                                            </button>
                                            <button className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-white transition-colors">
                                                <MoreHorizontal className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination */}
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-surface-dark px-6 py-4">
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            Showing{" "}
                            <span className="font-bold text-slate-900 dark:text-white">
                                1-5
                            </span>{" "}
                            of{" "}
                            <span className="font-bold text-slate-900 dark:text-white">
                                142
                            </span>{" "}
                            items
                        </div>
                        <div className="flex gap-2">
                            <button className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                Previous
                            </button>
                            <button className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark px-4 py-2 text-sm font-medium text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 hover:text-brand-primary transition-colors shadow-sm">
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
