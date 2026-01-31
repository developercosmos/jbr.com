import Link from "next/link";
import Image from "next/image";
import { Plus, Users, UserPlus, ShieldCheck, Store, Search, ChevronDown, Download, Lock, Ban, ChevronRight, ShieldAlert, RefreshCcw } from "lucide-react";

export default function UserManagementPage() {
    return (
        <div className="flex-1 bg-background-dark p-4 md:p-8 lg:px-12 text-white">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Breadcrumbs */}
                <nav className="flex flex-wrap gap-2 text-sm">
                    <Link
                        href="/admin"
                        className="text-slate-400 hover:text-brand-primary transition-colors"
                    >
                        Home
                    </Link>
                    <span className="text-slate-400">/</span>
                    <Link
                        href="/admin"
                        className="text-slate-400 hover:text-brand-primary transition-colors"
                    >
                        Admin
                    </Link>
                    <span className="text-slate-400">/</span>
                    <span className="text-white font-medium">User Management</span>
                </nav>

                {/* Page Header */}
                <div className="flex flex-wrap justify-between items-end gap-4">
                    <div className="flex flex-col gap-2 max-w-2xl">
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-white uppercase">
                            User Management
                        </h1>
                        <p className="text-slate-400 text-base">
                            Manage user accounts, verify identities, and monitor trust scores
                            for a safer marketplace.
                        </p>
                    </div>
                    <button className="flex items-center gap-2 bg-brand-primary hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold shadow-lg shadow-brand-primary/25 transition-all active:scale-95">
                        <Plus className="w-5 h-5" />
                        <span>Add New User</span>
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#1a2632] border border-[#344d65] rounded-xl p-5 flex flex-col gap-2 shadow-sm">
                        <div className="flex justify-between items-start">
                            <p className="text-slate-400 text-sm font-medium">Total Users</p>
                            <Users className="w-5 h-5 text-brand-primary" />
                        </div>
                        <div className="flex items-end gap-3">
                            <p className="text-white text-2xl font-bold">14,203</p>
                            <span className="text-green-500 text-xs font-semibold mb-1 bg-green-500/10 px-1.5 py-0.5 rounded">
                                +2.5%
                            </span>
                        </div>
                    </div>
                    <div className="bg-[#1a2632] border border-[#344d65] rounded-xl p-5 flex flex-col gap-2 shadow-sm">
                        <div className="flex justify-between items-start">
                            <p className="text-slate-400 text-sm font-medium">
                                New This Week
                            </p>
                            <UserPlus className="w-5 h-5 text-brand-primary" />
                        </div>
                        <div className="flex items-end gap-3">
                            <p className="text-white text-2xl font-bold">124</p>
                            <span className="text-green-500 text-xs font-semibold mb-1 bg-green-500/10 px-1.5 py-0.5 rounded">
                                +12%
                            </span>
                        </div>
                    </div>
                    <div className="bg-[#1a2632] border border-[#344d65] rounded-xl p-5 flex flex-col gap-2 shadow-sm">
                        <div className="flex justify-between items-start">
                            <p className="text-slate-400 text-sm font-medium">Verified IDs</p>
                            <ShieldCheck className="w-5 h-5 text-brand-primary" />
                        </div>
                        <div className="flex items-end gap-3">
                            <p className="text-white text-2xl font-bold">9,102</p>
                            <span className="text-green-500 text-xs font-semibold mb-1 bg-green-500/10 px-1.5 py-0.5 rounded">
                                +5%
                            </span>
                        </div>
                    </div>
                    <div className="bg-[#1a2632] border border-[#344d65] rounded-xl p-5 flex flex-col gap-2 shadow-sm">
                        <div className="flex justify-between items-start">
                            <p className="text-slate-400 text-sm font-medium">
                                Active Sellers
                            </p>
                            <Store className="w-5 h-5 text-brand-primary" />
                        </div>
                        <div className="flex items-end gap-3">
                            <p className="text-white text-2xl font-bold">3,400</p>
                            <span className="text-slate-400 text-xs font-medium mb-1">
                                24% of total
                            </span>
                        </div>
                    </div>
                </div>

                {/* Toolbar: Search & Filters */}
                <div className="bg-[#1a2632] border border-[#344d65] rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
                    {/* Search */}
                    <div className="w-full md:w-96">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="w-5 h-5 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
                            </div>
                            <input
                                className="block w-full pl-10 pr-3 py-2.5 border border-[#344d65] rounded-lg leading-5 bg-[#111921] text-white placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary sm:text-sm transition-all"
                                placeholder="Search by User ID, Name, or Email"
                                type="text"
                            />
                        </div>
                    </div>
                    {/* Filters & Actions */}
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="relative">
                            <select className="appearance-none bg-[#111921] border border-[#344d65] text-white text-sm rounded-lg focus:ring-brand-primary focus:border-brand-primary block w-full px-4 py-2.5 pr-8 cursor-pointer hover:border-slate-400 transition-colors">
                                <option>All Status</option>
                                <option>Active</option>
                                <option>Pending</option>
                                <option>Banned</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                                <ChevronDown className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="relative">
                            <select className="appearance-none bg-[#111921] border border-[#344d65] text-white text-sm rounded-lg focus:ring-brand-primary focus:border-brand-primary block w-full px-4 py-2.5 pr-8 cursor-pointer hover:border-slate-400 transition-colors">
                                <option>All Roles</option>
                                <option>Buyer</option>
                                <option>Seller</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                                <ChevronDown className="w-5 h-5" />
                            </div>
                        </div>
                        <button className="flex items-center gap-2 border border-[#344d65] hover:border-slate-400 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ml-auto md:ml-0">
                            <Download className="w-5 h-5" />
                            <span>Export</span>
                        </button>
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-[#1a2632] border border-[#344d65] rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-[#1e2b38] text-white uppercase tracking-wider text-xs font-semibold border-b border-[#344d65]">
                                <tr>
                                    <th className="p-4 w-4" scope="col">
                                        <div className="flex items-center">
                                            <input
                                                className="w-4 h-4 text-brand-primary bg-[#111921] border-[#344d65] rounded focus:ring-brand-primary focus:ring-2"
                                                type="checkbox"
                                            />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4" scope="col">
                                        User
                                    </th>
                                    <th className="px-6 py-4" scope="col">
                                        Role
                                    </th>
                                    <th className="px-6 py-4" scope="col">
                                        Trust Score
                                    </th>
                                    <th className="px-6 py-4" scope="col">
                                        Status
                                    </th>
                                    <th className="px-6 py-4" scope="col">
                                        Joined
                                    </th>
                                    <th className="px-6 py-4 text-right" scope="col">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#344d65]">
                                {/* Row 1 */}
                                <tr className="hover:bg-[#1e2b38]/50 transition-colors group">
                                    <td className="p-4 w-4">
                                        <div className="flex items-center">
                                            <input
                                                className="w-4 h-4 text-brand-primary bg-[#111921] border-[#344d65] rounded focus:ring-brand-primary focus:ring-2"
                                                type="checkbox"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative w-10 h-10 rounded-full border border-[#344d65] overflow-hidden">
                                                <Image
                                                    alt="User Avatar"
                                                    className="object-cover"
                                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBnT4LVj7vFTv4OLMKZ4w027C41JLy3GjVRnO7LRIeyfmbXHnUibLiL_d5bis-0RQ_ITpCCPOdiRRDlf0Q-F8WTRVUGNCRlAHw9e6HJ92u79wMuQaY01cUGxwO3HfRhGUKBGt6QuXrS_96CRbQiHy_VRUtoexJ6p2cATJ0lxhg42wSN21sFbM39Y5JWuPFT8DZpnV1nrexNuLaTIasuspX9aY17q-DBGO1nYh9cdZ5pK7wWmSRO_949gA11ECbONvsSNbC5BRyb_aM"
                                                    fill
                                                />
                                            </div>
                                            <div>
                                                <div className="font-medium text-white">
                                                    Budi Santoso
                                                </div>
                                                <div className="text-xs">budi.s@example.com</div>
                                                <div className="text-[10px] text-brand-primary mt-0.5 font-mono">
                                                    ID: #USR-8821
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-white">Seller</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-white">
                                            <ShieldCheck className="w-4 h-4 text-green-500" />
                                            <span>High</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                            Active
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-white">Jan 12, 2025</div>
                                        <div className="text-xs">10:45 AM</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                className="p-1.5 hover:bg-[#111921] rounded text-slate-400 hover:text-white"
                                                title="Reset Password"
                                            >
                                                <Lock className="w-5 h-5" />
                                            </button>
                                            <button
                                                className="p-1.5 hover:bg-[#111921] rounded text-slate-400 hover:text-red-400"
                                                title="Ban User"
                                            >
                                                <Ban className="w-5 h-5" />
                                            </button>
                                            <button
                                                className="p-1.5 hover:bg-[#111921] rounded text-slate-400 hover:text-brand-primary"
                                                title="View Details"
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {/* Row 2 */}
                                <tr className="hover:bg-[#1e2b38]/50 transition-colors group">
                                    <td className="p-4 w-4">
                                        <div className="flex items-center">
                                            <input
                                                className="w-4 h-4 text-brand-primary bg-[#111921] border-[#344d65] rounded focus:ring-brand-primary focus:ring-2"
                                                type="checkbox"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full border border-[#344d65] bg-purple-900 flex items-center justify-center text-white font-bold text-sm">
                                                SL
                                            </div>
                                            <div>
                                                <div className="font-medium text-white">
                                                    Siti Lestari
                                                </div>
                                                <div className="text-xs">siti.lestari@mail.co</div>
                                                <div className="text-[10px] text-brand-primary mt-0.5 font-mono">
                                                    ID: #USR-8822
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-white">Buyer</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-white">
                                            <ShieldCheck className="w-4 h-4 text-slate-400" />
                                            <span>Medium</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                                            Pending
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-white">Mar 04, 2025</div>
                                        <div className="text-xs">02:30 PM</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                className="p-1.5 hover:bg-[#111921] rounded text-slate-400 hover:text-white"
                                                title="Reset Password"
                                            >
                                                <Lock className="w-5 h-5" />
                                            </button>
                                            <button
                                                className="p-1.5 hover:bg-[#111921] rounded text-slate-400 hover:text-red-400"
                                                title="Ban User"
                                            >
                                                <Ban className="w-5 h-5" />
                                            </button>
                                            <button
                                                className="p-1.5 hover:bg-[#111921] rounded text-slate-400 hover:text-brand-primary"
                                                title="View Details"
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {/* Row 3 - Banned */}
                                <tr className="hover:bg-[#1e2b38]/50 transition-colors group">
                                    <td className="p-4 w-4">
                                        <div className="flex items-center">
                                            <input
                                                className="w-4 h-4 text-brand-primary bg-[#111921] border-[#344d65] rounded focus:ring-brand-primary focus:ring-2"
                                                type="checkbox"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative w-10 h-10 rounded-full border border-[#344d65] overflow-hidden grayscale">
                                                <Image
                                                    alt="User Avatar"
                                                    className="object-cover"
                                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuB1eWUNdXNvxirxndrbfUkAboIoalQAiAyvaS6psEZErqlAwBKKOWbXiu0quNaDG_F_G9f9SJyC5A8zMYLuIoWHhDBBI4fLL8gNsRvIhS9VtzHL163BefFJ92P5MQeOLNLEYUS1ZZedrH-lMHgECHGztHPZ5fPNJBeSuxvo-_WW7u3HY6iiW12PxsUeATIRtP2V7gewMqrm3GAx4QwDqVM5f5wCtUzdvnUy6duNsYqdMpqRgPhBNdY0qYdizVmAA-lwP5CHONKuvio"
                                                    fill
                                                />
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-400 line-through">
                                                    Andi Pratama
                                                </div>
                                                <div className="text-xs">andi.p@suspicious.net</div>
                                                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                                    ID: #USR-8819
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-white">Seller</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-white">
                                            <ShieldAlert className="w-4 h-4 text-red-500" />
                                            <span className="text-red-400">Low</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                            Banned
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-white">Dec 20, 2022</div>
                                        <div className="text-xs">09:15 AM</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                className="p-1.5 hover:bg-[#111921] rounded text-slate-400 hover:text-white"
                                                title="Unban User"
                                            >
                                                <RefreshCcw className="w-5 h-5" />
                                            </button>
                                            <button
                                                className="p-1.5 hover:bg-[#111921] rounded text-slate-400 hover:text-brand-primary"
                                                title="View Details"
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination */}
                    <div className="px-6 py-4 border-t border-[#344d65] bg-[#1a2632] flex items-center justify-between">
                        <div className="text-sm text-slate-400">
                            Showing <span className="font-medium text-white">1</span> to{" "}
                            <span className="font-medium text-white">5</span> of{" "}
                            <span className="font-medium text-white">14,203</span> results
                        </div>
                        <div className="flex gap-2">
                            <button
                                className="px-3 py-1 rounded border border-[#344d65] text-slate-400 hover:bg-[#111921] hover:text-white disabled:opacity-50 transition-colors"
                                disabled
                            >
                                Previous
                            </button>
                            <button className="px-3 py-1 rounded bg-brand-primary text-white border border-brand-primary">
                                1
                            </button>
                            <button className="px-3 py-1 rounded border border-[#344d65] text-slate-400 hover:bg-[#111921] hover:text-white transition-colors">
                                2
                            </button>
                            <button className="px-3 py-1 rounded border border-[#344d65] text-slate-400 hover:bg-[#111921] hover:text-white transition-colors">
                                3
                            </button>
                            <button className="px-3 py-1 rounded border border-[#344d65] text-slate-400 hover:bg-[#111921] hover:text-white transition-colors">
                                ...
                            </button>
                            <button className="px-3 py-1 rounded border border-[#344d65] text-slate-400 hover:bg-[#111921] hover:text-white transition-colors">
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
