import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const dynamic = 'force-dynamic';

const { GET: originalGET, POST: originalPOST } = toNextJsHandler(auth);

export async function GET(request: Request) {
    try {
        return await originalGET(request);
    } catch (error) {
        console.error('[AUTH GET ERROR]', error);
        throw error;
    }
}

export async function POST(request: Request) {
    try {
        const clonedRequest = request.clone();
        const body = await clonedRequest.text();
        console.log('[AUTH POST] URL:', request.url, 'Body:', body);
        const response = await originalPOST(request);
        console.log('[AUTH POST] Response status:', response.status);
        return response;
    } catch (error) {
        console.error('[AUTH POST ERROR]', error);
        throw error;
    }
}
