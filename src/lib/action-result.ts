import { z } from "zod";

/**
 * Helpers for the server-action "return-error" pattern.
 *
 * Next.js production masks every error THROWN from a server action as
 * "An error occurred in the Server Components render…", so business-rule
 * messages never reach the user. Actions whose errors are shown in the UI
 * wrap their internals and RETURN { success: false, error } instead:
 *
 *   export async function doThing(input: Input) {
 *       try {
 *           return await doThingInternal(input);
 *       } catch (err) {
 *           if (isNextControlFlowError(err)) throw err;
 *           const message = actionErrorMessage(err, "Gagal memproses.");
 *           logger.warn("domain:do_thing_failed", { error: message });
 *           return { success: false as const, error: message };
 *       }
 *   }
 */

/** Human-readable message from a caught server-action error. */
export function actionErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof z.ZodError) {
        return err.issues[0]?.message ?? fallback;
    }
    if (err instanceof Error && err.message.trim()) {
        return err.message;
    }
    return fallback;
}

/**
 * redirect()/notFound() work by throwing control-flow errors (digest
 * "NEXT_REDIRECT"/"NEXT_HTTP_ERROR_FALLBACK"). They must be re-thrown, never
 * converted into a failure result.
 */
export function isNextControlFlowError(err: unknown): boolean {
    return (
        typeof err === "object" &&
        err !== null &&
        "digest" in err &&
        String((err as { digest?: unknown }).digest).startsWith("NEXT_")
    );
}
