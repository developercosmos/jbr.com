"use server";

/**
 * GL — Account mapping (which CoA account each auto-posted transaction line uses).
 *
 * Previously every account code in posting.ts / inventory-posting.ts was a hard
 * literal, so changing the account a transaction posts to required a code change.
 * This module makes the mapping configurable via accounting_settings under the
 * `gl.account.<slot>` namespace, with a fallback to the original default code —
 * so behavior is IDENTICAL until an admin overrides a slot (zero-risk rollout).
 *
 * The pure registry (ACCOUNT_SLOTS, types) lives in ./account-map-registry so it
 * can be imported by client components; a "use server" file may only export async
 * functions. Posting code calls resolveAccount("<slot>") instead of a literal.
 */

import { getSetting } from "./settings";
import { SLOT_DEFAULTS, settingKey, ACCOUNT_SLOTS, type AccountSlotState } from "./account-map-registry";

/**
 * Resolve the CoA account code for a transaction slot. Returns the admin-configured
 * override when present, otherwise the original hardcoded default. `at` lets period
 * postings reproduce the mapping that was effective on the posting date.
 */
export async function resolveAccount(slot: string, at?: Date): Promise<string> {
    const fallback = SLOT_DEFAULTS[slot];
    if (fallback === undefined) {
        throw new Error(`resolveAccount: unknown account slot "${slot}"`);
    }
    const override = await getSetting<string>(settingKey(slot), { at, defaultValue: fallback });
    const code = (override ?? fallback).toString().trim();
    return code || fallback;
}

// For the admin UI: every slot with its currently-effective code.
export async function getAccountMap(): Promise<AccountSlotState[]> {
    const out: AccountSlotState[] = [];
    for (const s of ACCOUNT_SLOTS) {
        const override = await getSetting<string>(settingKey(s.slot), { defaultValue: undefined });
        const isOverridden = override !== null && override !== undefined && String(override).trim() !== "";
        out.push({
            ...s,
            currentCode: isOverridden ? String(override).trim() : s.defaultCode,
            isOverridden,
        });
    }
    return out;
}
