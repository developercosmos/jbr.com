import { createSSEResponse } from "@/lib/realtime";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ channel: string }> }
) {
    const { channel } = await params;

    // Validate channel name (basic security)
    const validChannelPattern = /^[a-zA-Z0-9_:-]+$/;
    if (!validChannelPattern.test(channel)) {
        return new Response("Invalid channel name", { status: 400 });
    }

    return createSSEResponse(channel, request);
}
