import Image from "next/image";
import { Trash2, Minus, Plus } from "lucide-react";

export function CartItem() {
    return (
        <div className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors border-t border-slate-100 dark:border-slate-700/50 first:border-0">
            <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 rounded border-slate-300 dark:border-slate-500 bg-transparent text-brand-primary focus:ring-brand-primary/20 dark:focus:ring-offset-slate-800 mt-2 sm:mt-0"
            />
            {/* Image */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white">
                <Image
                    alt="Red Nike running shoe side view on white background"
                    className="object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAIAxuXIW2mDcjjk7-3waz1knqLAO5eayaoOT0pjRilsVeUf0kXRvAtM3-RDukL6-zQYGF9rd44ZUTIwH-X0PIJbFUHN4MDeCNs3c2F5HF0KnWcUcqdhgpDG_mBWs6iyEkFDABJ1wE9ZXqhMPU2zVBvojX-ZR1X0vf6KDd2WhHiqqjU3YvfcEuN2TlSjoa5k-T0KNQRfMjgNJ7FC8hgxl70pTZ4B5tujmpfiwu281bZULfo0rePmQYdSb2qFOPTCehVmMTQOjJ_VFA"
                    fill
                />
            </div>
            {/* Details */}
            <div className="flex-1 flex flex-col min-w-0 gap-1">
                <div className="flex items-start justify-between gap-4">
                    <h4 className="text-slate-800 dark:text-slate-100 text-base font-semibold leading-snug line-clamp-2">
                        Nike Air Zoom Pegasus 39 - Running Shoes
                    </h4>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Merah - Size 42
                </p>
                <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                        Pre-loved - Good Condition
                    </span>
                </div>
                <div className="mt-2 text-slate-900 dark:text-white text-lg font-bold">
                    Rp 1.200.000
                </div>
            </div>
            {/* Actions */}
            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-4 sm:gap-6 ml-0 sm:ml-auto">
                <button
                    className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors"
                    title="Hapus"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
                <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden h-8">
                    <button className="w-8 h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors">
                        <Minus className="w-4 h-4" />
                    </button>
                    <input
                        className="w-10 h-full text-center text-sm font-medium border-none bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white focus:ring-0 p-0 outline-none"
                        readOnly
                        type="text"
                        value="1"
                    />
                    <button className="w-8 h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
