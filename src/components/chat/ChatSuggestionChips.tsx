"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { recordProductEvent } from "@/actions/product-events";

interface Props {
    suggestions: string[];
    productId?: string;
    onSelect: (text: string) => Promise<void> | void;
    /** Hide the chips after one is used (default true). */
    once?: boolean;
}

/**
 * DIF-12: Smart question suggestion chips. Renders up to 3 quick-question
 * buttons. Clicking sends the message via the parent `onSelect` callback and
 * records analytics event `CHAT_SUGGESTION_USED`.
 */
export function ChatSuggestionChips({ suggestions, productId, onSelect, once = true }: Props) {
    const [hidden, setHidden] = useState(false);
    const [pendingText, setPendingText] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    if (hidden || suggestions.length === 0) return null;

    function handleClick(text: string) {
        setPendingText(text);
        startTransition(async () => {
            try {
                if (productId) {
                    void recordProductEvent({
                        productId,
                        eventType: "CHAT_SUGGESTION_USED",
                        source: "pdp",
                        meta: { suggestion: text },
                    });
                }
                await onSelect(text);
                if (once) setHidden(true);
            } catch {
                // surface via parent if needed
            } finally {
                setPendingText(null);
            }
        });
    }

    return (
        <div className="flex flex-wrap gap-2 px-3 py-2 border-t border-slate-100 bg-slate-50">
            <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide font-semibold text-slate-500">
                <MessageCircle className="w-3.5 h-3.5" />
                Pertanyaan cepat
            </span>
            {suggestions.map((suggestion) => {
                const active = pendingText === suggestion;
                return (
                    <button
                        key={suggestion}
                        type="button"
                        disabled={isPending}
                        onClick={() => handleClick(suggestion)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-slate-200 bg-white text-slate-700 hover:border-brand-primary hover:text-brand-primary disabled:opacity-50 transition-colors"
                    >
                        {active && isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {suggestion}
                    </button>
                );
            })}
        </div>
    );
}
