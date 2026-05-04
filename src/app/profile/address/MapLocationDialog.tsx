"use client";

import { Loader2, LocateFixed, Search, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

interface CoordinatesPayload {
    latitude: string;
    longitude: string;
}

interface MapLocationDialogProps {
    open: boolean;
    onClose: () => void;
    addressText?: string;
    initialLatitude?: string | null;
    initialLongitude?: string | null;
    onSelect?: (coords: CoordinatesPayload) => void;
}

const DEFAULT_CENTER = {
    lat: -6.200000,
    lon: 106.816666,
};

const InteractiveMapPicker = dynamic(
    () => import("./InteractiveMapPicker").then((mod) => mod.InteractiveMapPicker),
    {
        ssr: false,
        loading: () => (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                Memuat peta...
            </div>
        ),
    }
);

function toFiniteNumber(value?: string | null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function MapLocationDialog({
    open,
    onClose,
    addressText,
    initialLatitude,
    initialLongitude,
    onSelect,
}: MapLocationDialogProps) {
    const [lat, setLat] = useState<number | null>(null);
    const [lon, setLon] = useState<number | null>(null);
    const [locating, setLocating] = useState(false);
    const [resolvingAddress, setResolvingAddress] = useState(false);
    const [addressQuery, setAddressQuery] = useState("");
    const [error, setError] = useState("");

    const hasCoordinates = lat !== null && lon !== null;

    const setPickedCoordinates = useCallback((nextLat: number, nextLon: number) => {
        setLat(nextLat);
        setLon(nextLon);
        setError("");
    }, []);

    const resolveFromAddress = useCallback(async (query?: string) => {
        const source = (query ?? addressQuery ?? addressText ?? "").trim();

        if (!source) {
            setError("Alamat belum diisi. Isi alamat terlebih dahulu.");
            return;
        }

        setResolvingAddress(true);
        setError("");

        try {
            const encoded = encodeURIComponent(source);
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encoded}`);
            if (!response.ok) {
                throw new Error("Gagal mencari lokasi dari alamat.");
            }

            const data = (await response.json()) as Array<{ lat: string; lon: string }>;
            if (!data.length) {
                throw new Error("Lokasi alamat tidak ditemukan. Coba lengkapi alamat.");
            }

            const nextLat = Number(data[0].lat);
            const nextLon = Number(data[0].lon);

            if (!Number.isFinite(nextLat) || !Number.isFinite(nextLon)) {
                throw new Error("Koordinat dari alamat tidak valid.");
            }

            setPickedCoordinates(nextLat, nextLon);
        } catch (err) {
            const message = err instanceof Error && err.message.trim()
                ? err.message
                : "Gagal memuat titik lokasi dari alamat.";
            setError(message);
        } finally {
            setResolvingAddress(false);
        }
    }, [addressQuery, addressText, setPickedCoordinates]);

    const resolveFromBrowserLocation = useCallback(async () => {
        if (!navigator.geolocation) {
            setError("Browser tidak mendukung akses lokasi.");
            return;
        }

        if (!window.isSecureContext) {
            setError("Akses lokasi membutuhkan koneksi HTTPS yang aman.");
            return;
        }

        if (navigator.permissions?.query) {
            try {
                const permission = await navigator.permissions.query({ name: "geolocation" });
                if (permission.state === "denied") {
                    setError("Izin lokasi diblokir di browser. Aktifkan izin lokasi lalu coba lagi.");
                    return;
                }
            } catch {
                // Continue with geolocation request when permissions API is unavailable.
            }
        }

        setLocating(true);
        setError("");

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setPickedCoordinates(position.coords.latitude, position.coords.longitude);
                setLocating(false);
            },
            (geoError) => {
                let message = geoError.message?.trim() || "Gagal mendapatkan lokasi.";

                if (geoError.code === 1) {
                    message = "Akses lokasi ditolak. Pastikan izin lokasi browser sudah aktif.";
                } else if (geoError.code === 2) {
                    message = "Lokasi tidak tersedia. Coba lagi atau pilih titik manual di peta.";
                } else if (geoError.code === 3) {
                    message = "Permintaan lokasi timeout. Coba lagi atau pilih titik manual di peta.";
                }

                setError(message);
                setLocating(false);
            },
            {
                enableHighAccuracy: false,
                timeout: 20000,
                maximumAge: 0,
            }
        );
    }, [setPickedCoordinates]);

    // Stable refs so the open-init effect does not re-run when the callback
    // functions are recreated (e.g. when the user types in the address input).
    const resolveFromAddressRef = useRef(resolveFromAddress);
    useEffect(() => { resolveFromAddressRef.current = resolveFromAddress; });
    const resolveFromBrowserLocationRef = useRef(resolveFromBrowserLocation);
    useEffect(() => { resolveFromBrowserLocationRef.current = resolveFromBrowserLocation; });

    useEffect(() => {
        if (!open) {
            return;
        }

        setError("");
        setAddressQuery(addressText?.trim() || "");

        const initialLatNumber = toFiniteNumber(initialLatitude);
        const initialLonNumber = toFiniteNumber(initialLongitude);

        if (initialLatNumber !== null && initialLonNumber !== null) {
            setLat(initialLatNumber);
            setLon(initialLonNumber);
            return;
        }

        setLat(DEFAULT_CENTER.lat);
        setLon(DEFAULT_CENTER.lon);

        if (addressText?.trim()) {
            void resolveFromAddressRef.current(addressText.trim());
            return;
        }

        // Trigger browser GPS request so users get permission popup immediately.
        void resolveFromBrowserLocationRef.current();
    }, [addressText, initialLatitude, initialLongitude, open]);

    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative z-10 bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Pilih Titik Lokasi</h3>
                        <p className="text-xs text-slate-500 mt-1">Prioritas titik: koordinat tersimpan, alamat input, lalu lokasi user.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Cari dari alamat
                        </label>
                        <input
                            type="text"
                            value={addressQuery}
                            onChange={(event) => setAddressQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    void resolveFromAddress(addressQuery);
                                }
                            }}
                            placeholder="Ketik alamat atau nama tempat"
                            className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => void resolveFromAddress(addressQuery)}
                            disabled={resolvingAddress}
                            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-brand-primary hover:text-brand-primary disabled:opacity-60"
                        >
                            {resolvingAddress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            Cari dari Alamat
                        </button>

                        <button
                            type="button"
                            onClick={resolveFromBrowserLocation}
                            disabled={locating}
                            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-brand-primary text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-60"
                        >
                            {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
                            Minta Izin GPS & Lokasi Saya
                        </button>
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 h-[360px] bg-slate-100 dark:bg-slate-800 relative">
                        {hasCoordinates ? (
                            <InteractiveMapPicker
                                lat={lat}
                                lon={lon}
                                onPick={(coords) => {
                                    setPickedCoordinates(coords.lat, coords.lon);
                                }}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                                Titik lokasi belum tersedia
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 -mt-1">
                        Klik langsung pada peta untuk meletakkan pin di lokasi yang diinginkan.
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-slate-500">
                            {hasCoordinates
                                ? `Koordinat: ${lat?.toFixed(6)}, ${lon?.toFixed(6)}`
                                : "Koordinat belum ditentukan"}
                        </p>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="h-10 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Tutup
                            </button>
                            {onSelect && hasCoordinates && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSelect({
                                            latitude: String(lat),
                                            longitude: String(lon),
                                        });
                                        onClose();
                                    }}
                                    className="h-10 px-4 rounded-lg bg-brand-primary text-white text-sm font-semibold hover:bg-blue-600"
                                >
                                    Gunakan Titik Ini
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
