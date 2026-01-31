import { Search, Filter, Download, Eye, MoreHorizontal, Trash2, CheckCircle, XCircle, Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function AdminProductsPage() {
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
                                        Products
                                    </span>
                                </li>
                            </ol>
                        </nav>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white uppercase">
                            Product Inventory
                        </h1>
                        <p className="mt-2 text-slate-500 dark:text-slate-400 text-lg">
                            Manage all products registered on the platform.
                        </p>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-100 dark:border-slate-800 p-5 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
                    <div className="relative w-full md:w-96 group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-primary transition-colors">
                            <Search className="w-5 h-5" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search product name, SKU, or seller..."
                            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary sm:text-sm transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:border-brand-primary hover:text-brand-primary transition-colors text-sm font-medium whitespace-nowrap">
                            <Filter className="w-4 h-4" />
                            Filter Category
                        </button>
                        <div className="relative">
                            <select className="px-4 py-2.5 pr-8 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary text-sm font-medium cursor-pointer appearance-none">
                                <option>All Status</option>
                                <option>Active</option>
                                <option>Inactive</option>
                                <option>Needs Review</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Products Table */}
                <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-black/20 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 font-heading">
                                    <th className="px-6 py-4">Product</th>
                                    <th className="px-6 py-4">Seller</th>
                                    <th className="px-6 py-4">Category</th>
                                    <th className="px-6 py-4 text-right">Price</th>
                                    <th className="px-6 py-4 text-center">Stock</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {/* Row 1 */}
                                <tr className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 rounded-xl bg-slate-200 dark:bg-slate-700 relative overflow-hidden flex-shrink-0 border border-slate-200 dark:border-slate-700">
                                                <Image
                                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAIaF_lSZ7Pxl2d96PA8BCRBrdPH42wW783ImbT7w8ufOm4cteDQpCZAMda9XdBG6RDdX8tDO7X-mF1iBrDebNfjwGQQbdSn4oW_7r3a2KvC6ZgmE6WB2s_YFz5vO2n1Jy4h0QRpg9NH4vIt-9y5oQ9ScsGsrRi1uqxZ8ErOTAeG4i9JIinF9qS6bs7GZdsaY2BIBmDuMAx8_uKaTTy37FIbrdDQdyb8njxQdGNT3NofDa8FOV9p7fTY2HAdVcX3UuQxcP0b-UnqO4"
                                                    alt="Product"
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 dark:text-white text-sm">
                                                    Nike Air Jordan Red
                                                </span>
                                                <span className="text-xs text-slate-500 font-mono">
                                                    SKU: NK-AJ-001
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-300">
                                        Agus Sport Store
                                    </td>
                                    <td className="px-6 py-5 text-sm">
                                        <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-white/10 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                            Shoes
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-sm font-bold text-right text-slate-900 dark:text-white font-heading">
                                        Rp 2.500.000
                                    </td>
                                    <td className="px-6 py-5 text-sm text-center text-slate-600 dark:text-slate-300">
                                        12
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 ring-1 ring-inset ring-green-600/20">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                            Active
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 text-slate-400 hover:text-brand-primary hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors" title="View Details">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors" title="Delete">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {/* Row 2 */}
                                <tr className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 rounded-xl bg-slate-200 dark:bg-slate-700 relative overflow-hidden flex-shrink-0 border border-slate-200 dark:border-slate-700">
                                                <Image
                                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAOQy9vRJqIQMmAmWRCB1SGC99BPsLlljsIZ2755XuqU-0grLUuh4vsiJkgUtxxNduBzXhAfSaZ0UeAQY6km0V7iYhiwjE-yfZ66E2ncSSpXM2KQOz40uPBHmQxXD2Z0edwc5Rbv2pinPtLyRfr22CrKr-SKbKEeeqm4bQqGmw3-ZsUnTk1SX14i3bdns3s-gjWtR536hpIJDJ5kgQZpBN7qc3UYqMUca54kPDiBDHXcVMr8oplziatKZjjrisrIGliYLBxSVNggws"
                                                    alt="Product"
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 dark:text-white text-sm">
                                                    Nike Air Zoom Pegasus
                                                </span>
                                                <span className="text-xs text-slate-500 font-mono">
                                                    SKU: NK-ZP-039
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-300">
                                        Pro Shop Indonesia
                                    </td>
                                    <td className="px-6 py-5 text-sm">
                                        <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-white/10 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                            Shoes
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-sm font-bold text-right text-slate-900 dark:text-white font-heading">
                                        Rp 1.200.000
                                    </td>
                                    <td className="px-6 py-5 text-sm text-center text-slate-600 dark:text-slate-300">
                                        45
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400 ring-1 ring-inset ring-yellow-600/20">
                                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
                                            Review
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10 rounded-lg transition-colors" title="Approve">
                                                <CheckCircle className="w-4 h-4" />
                                            </button>
                                            <button className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors" title="Reject">
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}
