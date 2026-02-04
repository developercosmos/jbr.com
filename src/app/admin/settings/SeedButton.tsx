"use client";

import { useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { seedDefaultIntegrations } from "@/actions/settings";
import { useRouter } from "next/navigation";

export function SeedButton() {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleSeed = () => {
        startTransition(async () => {
            try {
                await seedDefaultIntegrations();
                router.refresh();
            } catch (err) {
                console.error("Seed error:", err);
            }
        });
    };

    return (
        <button
            onClick={handleSeed}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary hover:bg-blue-600 disabled:bg-slate-400 text-white font-bold rounded-xl transition-colors"
        >
            {isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
                <Plus className="w-5 h-5" />
            )}
            Tambah Integrasi Default
        </button>
    );
}
