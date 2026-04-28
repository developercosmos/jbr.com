"use client";

import { useSyncExternalStore } from "react";
import { getCartCount } from "@/actions/cart";
import { getUnreadCount } from "@/actions/chat";
import { getUnreadNotificationCount } from "@/actions/notifications";

type HeaderCounterState = {
    cartCount: number;
    unreadChatCount: number;
    unreadNotificationCount: number;
    isLoading: boolean;
};

const pollingIntervalMs = 30000;

let state: HeaderCounterState = {
    cartCount: 0,
    unreadChatCount: 0,
    unreadNotificationCount: 0,
    isLoading: true,
};

const listeners = new Set<() => void>();
let pollingHandle: ReturnType<typeof setTimeout> | null = null;
let subscriberCount = 0;
let activePollingSubscriberCount = 0;

function emit() {
    listeners.forEach((listener) => listener());
}

function setState(nextState: Partial<HeaderCounterState>) {
    state = { ...state, ...nextState };
    emit();
}

async function refreshCounters() {
    if (activePollingSubscriberCount === 0) {
        pollingHandle = null;
        return;
    }

    if (typeof document !== "undefined" && document.hidden) {
        scheduleNextPoll();
        return;
    }

    try {
        const [cartCount, unreadChatCount, unreadNotificationCount] = await Promise.all([
            getCartCount(),
            getUnreadCount(),
            getUnreadNotificationCount(),
        ]);

        setState({
            cartCount,
            unreadChatCount,
            unreadNotificationCount,
            isLoading: false,
        });
    } catch {
        setState({ isLoading: false });
    }

    scheduleNextPoll();
}

function scheduleNextPoll() {
    if (activePollingSubscriberCount === 0) {
        pollingHandle = null;
        return;
    }
    pollingHandle = setTimeout(refreshCounters, pollingIntervalMs);
}

function startPollingIfNeeded() {
    if (activePollingSubscriberCount > 0 && pollingHandle === null) {
        void refreshCounters();
    }
}

function stopPollingIfIdle() {
    if (activePollingSubscriberCount === 0 && pollingHandle) {
        clearTimeout(pollingHandle);
        pollingHandle = null;
        setState({ isLoading: false });
    }
}

function subscribe(listener: () => void, enabled: boolean) {
    listeners.add(listener);
    subscriberCount += 1;
    if (enabled) {
        activePollingSubscriberCount += 1;
    }
    startPollingIfNeeded();

    return () => {
        listeners.delete(listener);
        subscriberCount = Math.max(0, subscriberCount - 1);
        if (enabled) {
            activePollingSubscriberCount = Math.max(0, activePollingSubscriberCount - 1);
        }
        stopPollingIfIdle();
    };
}

function getSnapshot() {
    return state;
}

function getServerSnapshot() {
    return state;
}

export function useHeaderCounters(enabled = true) {
    const counters = useSyncExternalStore(
        (listener) => subscribe(listener, enabled),
        getSnapshot,
        getServerSnapshot
    );

    return {
        ...counters,
        refreshCounters,
    };
}
