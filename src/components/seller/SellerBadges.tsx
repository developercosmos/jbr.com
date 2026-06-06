import { Verified, ShieldCheck, Clock, Award } from "lucide-react";

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
