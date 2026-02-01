"use client";

import { useState } from "react";
import { Share2, Copy, Check, Facebook, Twitter, Mail } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

interface ShareProductProps {
    productTitle: string;
    productUrl: string;
}

export function ShareProduct({ productTitle, productUrl }: ShareProductProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const fullUrl = typeof window !== "undefined"
        ? `${window.location.origin}${productUrl}`
        : productUrl;

    const shareText = encodeURIComponent(`Check out ${productTitle} on JuabebeliRaket.com!`);
    const shareUrl = encodeURIComponent(fullUrl);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(fullUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error("Error copying link:", error);
        }
    };

    const shareOptions = [
        {
            name: "WhatsApp",
            icon: FaWhatsapp,
            url: `https://wa.me/?text=${shareText}%20${shareUrl}`,
            color: "hover:bg-green-100 text-green-600",
        },
        {
            name: "Facebook",
            icon: Facebook,
            url: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
            color: "hover:bg-blue-100 text-blue-600",
        },
        {
            name: "Twitter",
            icon: Twitter,
            url: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,
            color: "hover:bg-sky-100 text-sky-500",
        },
        {
            name: "Email",
            icon: Mail,
            url: `mailto:?subject=${shareText}&body=${shareUrl}`,
            color: "hover:bg-slate-100 text-slate-600",
        },
    ];

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                title="Bagikan"
            >
                <Share2 className="w-5 h-5 text-slate-600" />
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown */}
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
                        <div className="p-3 border-b border-slate-100">
                            <p className="text-sm font-medium text-slate-900">Bagikan Produk</p>
                        </div>

                        <div className="p-2">
                            {/* Share Buttons */}
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

                            {/* Copy Link */}
                            <button
                                onClick={handleCopyLink}
                                className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-4 h-4 text-green-500" />
                                        <span className="text-sm text-green-600 font-medium">
                                            Link disalin!
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4 text-slate-500" />
                                        <span className="text-sm text-slate-600">
                                            Salin Link
                                        </span>
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
