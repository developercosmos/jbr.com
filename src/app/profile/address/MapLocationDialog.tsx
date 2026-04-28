"use client";

import { Loader2, LocateFixed, MapPin, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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

function toFiniteNumber(value?: string | null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toMapUrls(lat: number, lon: number) {
    const delta = 0.008;
    const bbox = `${lon - delta}%2C${lat - delta}%2C${lon + delta}%2C${lat + delta}`;

    return {
        embedUrl: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`,
        openUrl: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`,
    };
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
    const [error, setError] = useState("");

    const hasCoordinates = lat !== null && lon !== null;

    const mapUrls = useMemo(() => {
        if (!hasCoordinates) {
            return null;
        }

        return toMapUrls(lat, lon);
    }, [hasCoordinates, lat, lon]);

    const resolveFromAddress = async () => {
        if (!addressText?.trim()) {
            setError("Alamat belum diisi. Isi alamat terlebih dahulu.");
            return;
        }

        setResolvingAddress(true);
        setError("");

        try {
            const query = encodeURIComponent(addressText);
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`);
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

            setLat(nextLat);
            setLon(nextLon);
        } catch (err) {
            const message = err instanceof Error && err.message.trim()
                ? err.message
                : "Gagal memuat titik lokasi dari alamat.";
            setError(message);
        } finally {
            setResolvingAddress(false);
        }
    };

    const resolveFromBrowserLocation = () => {
        if (!navigator.geolocation) {
            setError("Browser tidak mendukung akses lokasi.");
            return;
        }

        setLocating(true);
        setError("");

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLat(position.coords.latitude);
                setLon(position.coords.longitude);
                setLocating(false);
            },
            (geoError) => {
                const message = geoError.message?.trim() || "Izin lokasi ditolak atau gagal mendapatkan lokasi.";
                setError(message);
                setLocating(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000,
            }
        );
    };

    useEffect(() => {
        if (!open) {
            return;
        }

        setError("");

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
            void resolveFromAddress();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

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
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => void resolveFromAddress()}
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
                            Gunakan Lokasi Saya
                        </button>

                        {mapUrls && (
                            <a
                                href={mapUrls.openUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-brand-primary hover:text-brand-primary"
                            >
                                <MapPin className="w-4 h-4" />
                                Buka di OSM
                            </a>
                        )}
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 h-[360px] bg-slate-100 dark:bg-slate-800 relative">
                        {mapUrls ? (
                            <iframe
                                title="Peta Lokasi"
                                src={mapUrls.embedUrl}
                                className="absolute inset-0 w-full h-full border-0"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                                Titik lokasi belum tersedia
                            </div>
                        )}
                    </div>

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
