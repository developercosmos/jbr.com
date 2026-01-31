/**
 * Custom Server-Sent Events (SSE) based realtime system
 * Replaces Pusher for development/self-hosted environments
 */

// In-memory message store for development
// In production, use Redis or similar for multi-instance support
const channels = new Map<string, Set<(data: string) => void>>();

export function subscribe(
    channelName: string,
    callback: (data: string) => void
): () => void {
    if (!channels.has(channelName)) {
        channels.set(channelName, new Set());
    }

    const listeners = channels.get(channelName)!;
    listeners.add(callback);

    // Return unsubscribe function
    return () => {
        listeners.delete(callback);
        if (listeners.size === 0) {
            channels.delete(channelName);
        }
    };
}

export function publish(channelName: string, event: string, data: unknown): void {
    const listeners = channels.get(channelName);
    if (listeners) {
        const message = JSON.stringify({ event, data, timestamp: Date.now() });
        listeners.forEach((callback) => {
            try {
                callback(message);
            } catch (error) {
                console.error("Error sending message to listener:", error);
            }
        });
    }
}

// Helper to create SSE response for Next.js API routes
export function createSSEResponse(
    channelName: string,
    request: Request
): Response {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            // Send initial connection message
            controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ event: "connected", channel: channelName })}\n\n`)
            );

            // Subscribe to channel
            const unsubscribe = subscribe(channelName, (data) => {
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            });

            // Handle client disconnect
            request.signal.addEventListener("abort", () => {
                unsubscribe();
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}

// Client-side hook types
export interface RealtimeMessage<T = unknown> {
    event: string;
    data: T;
    timestamp: number;
}
