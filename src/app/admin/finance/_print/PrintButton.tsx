"use client";

// The print trigger needs an onClick handler, which Server Components cannot
// render (passing event handlers from an RSC crashes the whole page at render
// time). PrintShell stays a server component and mounts this tiny island.
export default function PrintButton() {
    return (
        <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-brand-primary px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
        >
            Cetak / Simpan PDF
        </button>
    );
}
