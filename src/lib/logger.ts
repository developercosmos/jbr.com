/**
 * TECH-03: Structured logger.
 *
 * Emits one JSON line per log so a downstream collector (e.g. Pino/Loki/Datadog)
 * can parse without regex. Falls back to console in dev for readability.
 */

type Level = "debug" | "info" | "warn" | "error";

interface LogPayload {
    level: Level;
    msg: string;
    ts: string;
    requestId?: string;
    [key: string]: unknown;
}

let currentRequestId: string | undefined;

export function setRequestId(id: string | undefined) {
    currentRequestId = id;
}

export function getRequestId(): string | undefined {
    return currentRequestId;
}

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
    const payload: LogPayload = {
        level,
        msg,
        ts: new Date().toISOString(),
        requestId: currentRequestId,
        ...fields,
    };

    const isDev = process.env.NODE_ENV !== "production";
    if (isDev) {
        const tag = level.toUpperCase();
        const requestTag = payload.requestId ? `[${payload.requestId}] ` : "";
        // eslint-disable-next-line no-console
        console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
            `${tag} ${requestTag}${msg}`,
            fields ?? ""
        );
        return;
    }

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
}

export const logger = {
    debug: (msg: string, fields?: Record<string, unknown>) => emit("debug", msg, fields),
    info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
    warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
    error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
};

export function newRequestId(): string {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
