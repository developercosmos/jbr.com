"use client";

import { useEffect } from "react";
import { incrementProductViews } from "@/actions/views";

interface ProductViewTrackerProps {
    productId: string;
}

/**
 * Client component that tracks product views
 * Placed on product pages to increment view count on page load
 */
export function ProductViewTracker({ productId }: ProductViewTrackerProps) {
    useEffect(() => {
        // Increment view count
        incrementProductViews(productId);

        // Store in recently viewed (localStorage)
        try {
            const recentlyViewed = JSON.parse(
                localStorage.getItem("recentlyViewed") || "[]"
            ) as string[];

            // Remove if already exists, then add to front
            const filtered = recentlyViewed.filter((id) => id !== productId);
            filtered.unshift(productId);

            // Keep only last 10
            const trimmed = filtered.slice(0, 10);
            localStorage.setItem("recentlyViewed", JSON.stringify(trimmed));
        } catch (error) {
            console.error("Error storing recently viewed:", error);
        }
    }, [productId]);

    return null; // This component doesn't render anything
}

/**
 * Hook to get recently viewed product IDs
 */
export function useRecentlyViewed(): string[] {
    if (typeof window === "undefined") return [];

    try {
        return JSON.parse(localStorage.getItem("recentlyViewed") || "[]");
    } catch {
        return [];
    }
}
