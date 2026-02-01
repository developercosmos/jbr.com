import { Verified, ShieldCheck, Star, Clock, Award } from "lucide-react";

interface SellerBadgeProps {
    type: "verified" | "topSeller" | "fastResponse" | "trusted";
    size?: "sm" | "md" | "lg";
}

const badgeConfig = {
    verified: {
        icon: Verified,
        label: "Verified Seller",
        bgColor: "bg-blue-100",
        textColor: "text-blue-700",
        iconColor: "text-blue-500",
    },
    topSeller: {
        icon: Award,
        label: "Top Seller",
        bgColor: "bg-amber-100",
        textColor: "text-amber-700",
        iconColor: "text-amber-500",
    },
    fastResponse: {
        icon: Clock,
        label: "Fast Response",
        bgColor: "bg-green-100",
        textColor: "text-green-700",
        iconColor: "text-green-500",
    },
    trusted: {
        icon: ShieldCheck,
        label: "Trusted",
        bgColor: "bg-purple-100",
        textColor: "text-purple-700",
        iconColor: "text-purple-500",
    },
};

const sizeConfig = {
    sm: {
        padding: "px-1.5 py-0.5",
        text: "text-[10px]",
        icon: "w-3 h-3",
        gap: "gap-0.5",
    },
    md: {
        padding: "px-2 py-1",
        text: "text-xs",
        icon: "w-3.5 h-3.5",
        gap: "gap-1",
    },
    lg: {
        padding: "px-3 py-1.5",
        text: "text-sm",
        icon: "w-4 h-4",
        gap: "gap-1.5",
    },
};

export function SellerBadge({ type, size = "md" }: SellerBadgeProps) {
    const badge = badgeConfig[type];
    const sizeStyles = sizeConfig[size];
    const Icon = badge.icon;

    return (
        <span
            className={`inline-flex items-center ${sizeStyles.gap} ${sizeStyles.padding} ${badge.bgColor} ${badge.textColor} ${sizeStyles.text} font-bold rounded-full`}
        >
            <Icon className={`${sizeStyles.icon} ${badge.iconColor}`} />
            {badge.label}
        </span>
    );
}

// Icon-only version for compact displays
interface SellerBadgeIconProps {
    type: "verified" | "topSeller" | "fastResponse" | "trusted";
    size?: number;
}

export function SellerBadgeIcon({ type, size = 16 }: SellerBadgeIconProps) {
    const badge = badgeConfig[type];
    const Icon = badge.icon;

    return (
        <span
            className={`inline-flex items-center justify-center ${badge.iconColor}`}
            title={badge.label}
        >
            <Icon style={{ width: size, height: size }} className="fill-current" />
        </span>
    );
}

// Seller rating display with stars
interface SellerRatingProps {
    rating: number;
    reviewCount: number;
    size?: "sm" | "md";
}

export function SellerRating({ rating, reviewCount, size = "md" }: SellerRatingProps) {
    const isSmall = size === "sm";

    return (
        <div className={`flex items-center ${isSmall ? "gap-1" : "gap-1.5"}`}>
            <Star
                className={`${isSmall ? "w-3 h-3" : "w-4 h-4"} text-amber-400 fill-amber-400`}
            />
            <span className={`${isSmall ? "text-xs" : "text-sm"} font-bold text-slate-900`}>
                {rating.toFixed(1)}
            </span>
            <span className={`${isSmall ? "text-xs" : "text-sm"} text-slate-500`}>
                ({reviewCount} ulasan)
            </span>
        </div>
    );
}
