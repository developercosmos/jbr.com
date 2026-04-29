"use client";

import { createContext, useContext } from "react";

export type FlagValue = boolean | string | null;

const FeatureFlagContext = createContext<Record<string, FlagValue>>({});

export function FeatureFlagProvider({
    flags,
    children,
}: {
    flags: Record<string, FlagValue>;
    children: React.ReactNode;
}) {
    return <FeatureFlagContext.Provider value={flags}>{children}</FeatureFlagContext.Provider>;
}

export function useFlag(key: string): boolean {
    return Boolean(useContext(FeatureFlagContext)[key]);
}

export function useFlagVariant(key: string): string {
    const value = useContext(FeatureFlagContext)[key];
    return typeof value === "string" ? value : "control";
}

export function useAllFlags(): Record<string, FlagValue> {
    return useContext(FeatureFlagContext);
}