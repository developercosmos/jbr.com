"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { upsertPlayerProfile } from "@/actions/niche";

interface ProfileShape {
    level: string | null;
    playStyle: string | null;
    dominantHand: string | null;
    preferredWeightClass: string | null;
    preferredBalance: string | null;
    preferredShaftFlex: string | null;
}

interface Props {
    initial: ProfileShape | null;
}

const LEVELS = [
    { value: "BEGINNER", label: "Pemula" },
    { value: "INTERMEDIATE", label: "Menengah" },
    { value: "ADVANCED", label: "Mahir" },
    { value: "PRO", label: "Profesional" },
];
const STYLES = [
    { value: "OFFENSIVE", label: "Menyerang" },
    { value: "DEFENSIVE", label: "Bertahan" },
    { value: "ALL_AROUND", label: "All-around" },
    { value: "DOUBLES_FRONT", label: "Ganda - Depan" },
    { value: "DOUBLES_BACK", label: "Ganda - Belakang" },
];
const HANDS = [
    { value: "RIGHT", label: "Kanan" },
    { value: "LEFT", label: "Kiri" },
    { value: "AMBI", label: "Ambidextrous" },
];

export default function PlayerProfileForm({ initial }: Props) {
    const router = useRouter();
    const [level, setLevel] = useState(initial?.level ?? "");
    const [playStyle, setPlayStyle] = useState(initial?.playStyle ?? "");
    const [dominantHand, setDominantHand] = useState(initial?.dominantHand ?? "");
    const [preferredWeight, setPreferredWeight] = useState(initial?.preferredWeightClass ?? "");
    const [preferredBalance, setPreferredBalance] = useState(initial?.preferredBalance ?? "");
    const [preferredFlex, setPreferredFlex] = useState(initial?.preferredShaftFlex ?? "");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleSave() {
        setError(null);
        setSuccess(null);
        startTransition(async () => {
            try {
                await upsertPlayerProfile({
                    level: level ? (level as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "PRO") : undefined,
                    play_style: playStyle ? (playStyle as "OFFENSIVE" | "DEFENSIVE" | "ALL_AROUND" | "DOUBLES_FRONT" | "DOUBLES_BACK") : undefined,
                    dominant_hand: dominantHand ? (dominantHand as "LEFT" | "RIGHT" | "AMBI") : undefined,
                    preferred_weight_class: preferredWeight ? (preferredWeight as "2U" | "3U" | "4U" | "5U" | "6U") : undefined,
                    preferred_balance: preferredBalance ? (preferredBalance as "HEAD_HEAVY" | "EVEN" | "HEAD_LIGHT") : undefined,
                    preferred_shaft_flex: preferredFlex ? (preferredFlex as "STIFF" | "MEDIUM" | "FLEXIBLE") : undefined,
                });
                setSuccess("Profil tersimpan.");
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal menyimpan profil.");
            }
        });
    }

    return (
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 text-sm">
            <Field label="Level Permainan">
                <select value={level} onChange={(e) => setLevel(e.target.value)} className={selectClass}>
                    <option value="">— pilih —</option>
                    {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
            </Field>
            <Field label="Gaya Main">
                <select value={playStyle} onChange={(e) => setPlayStyle(e.target.value)} className={selectClass}>
                    <option value="">— pilih —</option>
                    {STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </Field>
            <Field label="Tangan Dominan">
                <select value={dominantHand} onChange={(e) => setDominantHand(e.target.value)} className={selectClass}>
                    <option value="">— pilih —</option>
                    {HANDS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
            </Field>
            <hr className="border-slate-200 dark:border-slate-700" />
            <Field label="Preferensi Bobot (opsional)">
                <select value={preferredWeight} onChange={(e) => setPreferredWeight(e.target.value)} className={selectClass}>
                    <option value="">— bebas —</option>
                    {["2U", "3U", "4U", "5U", "6U"].map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
            </Field>
            <Field label="Preferensi Balance (opsional)">
                <select value={preferredBalance} onChange={(e) => setPreferredBalance(e.target.value)} className={selectClass}>
                    <option value="">— bebas —</option>
                    <option value="HEAD_HEAVY">Head Heavy</option>
                    <option value="EVEN">Even</option>
                    <option value="HEAD_LIGHT">Head Light</option>
                </select>
            </Field>
            <Field label="Preferensi Shaft (opsional)">
                <select value={preferredFlex} onChange={(e) => setPreferredFlex(e.target.value)} className={selectClass}>
                    <option value="">— bebas —</option>
                    <option value="STIFF">Stiff</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="FLEXIBLE">Flexible</option>
                </select>
            </Field>

            {error && <p className="text-xs text-rose-600">{error}</p>}
            {success && <p className="text-xs text-emerald-600">{success}</p>}
            <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
            >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Simpan Profil
            </button>
        </div>
    );
}

const selectClass =
    "w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
            {children}
        </div>
    );
}
