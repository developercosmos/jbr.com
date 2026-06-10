"use client";

import { AlertCircle, X } from "lucide-react";

/** Popup dialog for form errors (validation, upload, save failures). */
export default function FormErrorModal({ message, onClose }: { message: string; onClose: () => void }) {
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            role="alertdialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-full bg-rose-100">
                            <AlertCircle className="w-6 h-6 text-rose-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Periksa Kembali</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
                        aria-label="Tutup"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">{message}</p>

                <div className="flex justify-end pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-colors"
                    >
                        Mengerti
                    </button>
                </div>
            </div>
        </div>
    );
}
