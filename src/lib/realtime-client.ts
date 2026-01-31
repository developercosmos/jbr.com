"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// Client-side type definition for realtime messages
export interface RealtimeMessage<T = unknown> {
    event: string;
    data: T;
    timestamp: number;
}

interface UseRealtimeOptions {
    onMessage?: (message: RealtimeMessage) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
}

export function useRealtime(channel: string, options: UseRealtimeOptions = {}) {
    const [connected, setConnected] = useState(false);
    const [messages, setMessages] = useState<RealtimeMessage[]>([]);
    const eventSourceRef = useRef<EventSource | null>(null);

    useEffect(() => {
        if (!channel) return;

        const eventSource = new EventSource(`/api/realtime/${encodeURIComponent(channel)}`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            setConnected(true);
            options.onConnect?.();
        };

        eventSource.onmessage = (event) => {
            try {
                const message: RealtimeMessage = JSON.parse(event.data);
                setMessages((prev) => [...prev, message]);
                options.onMessage?.(message);
            } catch (error) {
                console.error("Failed to parse realtime message:", error);
            }
        };

        eventSource.onerror = () => {
            setConnected(false);
            options.onDisconnect?.();
            // EventSource will automatically try to reconnect
        };

        return () => {
            eventSource.close();
            eventSourceRef.current = null;
            setConnected(false);
        };
    }, [channel, options]);

    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    return { connected, messages, clearMessages };
}

// Helper hook for chat-specific functionality
export function useChatRealtime(conversationId: string | undefined) {
    const channel = conversationId ? `chat:${conversationId}` : "";

    return useRealtime(channel, {
        onConnect: () => console.log(`Connected to chat: ${conversationId}`),
        onDisconnect: () => console.log(`Disconnected from chat: ${conversationId}`),
    });
}
