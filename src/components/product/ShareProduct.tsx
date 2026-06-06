"use client";

import { useState } from "react";
import { Share2, Copy, Check, Facebook, Twitter, Mail } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

interface ShareProductProps {
    productTitle: string;
    productUrl: string; // relative path, e.g. /product/slug
}

export function ShareProduct({ productTitle, productUrl }: ShareProductProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const fullUrl =
        typeof window !== "undefined" ? `${window.location.origin}${productUrl}` : productUrl;

    const shareText = encodeURIComponent(`Cek ${productTitle} di JualBeliRaket.com!`);
    const shareUrl = encodeURIComponent(fullUrl);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(fullUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* clipboard unavailable */
        }
    };

    // Prefer the native share sheet on mobile.
    const handleNativeShare = async () => {
        if (typeof navigator !== "undefined" && navigator.share) {
            try {
                await navigator.share({ title: productTitle, url: fullUrl });
                return;
            } catch {
                /* user cancelled — fall through to the menu */
            }
        }
        setIsOpen((o) => !o);
    };

    const shareOptions = [
        { name: "WhatsApp", icon: FaWhatsapp, url: `https://wa.me/?text=${shareText}%20${shareUrl}`, color: "hover:bg-green-100 text-green-600" },
        { name: "Facebook", icon: Facebook, url: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`, color: "hover:bg-blue-100 text-blue-600" },
        { name: "Twitter", icon: Twitter, url: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`, color: "hover:bg-sky-100 text-sky-500" },
        { name: "Email", icon: Mail, url: `mailto:?subject=${shareText}&body=${shareUrl}`, color: "hover:bg-slate-100 text-slate-600" },
    ];

    return (
        <div className="relative">
            <button
                type="button"
                onClick={handleNativeShare}
                className="flex items-center justify-center gap-2 text-slate-600 hover:text-brand-primary py-2.5 px-3 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
                title="Bagikan"
            >
                <Share2 className="w-4 h-4" /> Share
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-surface-dark rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
                        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">Bagikan Produk</p>
                        </div>
                        <div className="p-2">
                            <div className="grid grid-cols-4 gap-2 mb-3">
                                {shareOptions.map((option) => {
                                    const Icon = option.icon;
                                    return (
                                        <a
                                            key={option.name}
                                            href={option.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`p-3 rounded-lg ${option.color} transition-colors flex items-center justify-center`}
                                            title={option.name}
                                            onClick={() => setIsOpen(false)}
                                        >
                                            <Icon className="w-5 h-5" />
                                        </a>
                                    );
                                })}
                            </div>
                            <button
                                type="button"
                                onClick={handleCopyLink}
                                className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-4 h-4 text-green-500" />
                                        <span className="text-sm text-green-600 font-medium">Link disalin!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4 text-slate-500" />
                                        <span className="text-sm text-slate-600 dark:text-slate-300">Salin Link</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
