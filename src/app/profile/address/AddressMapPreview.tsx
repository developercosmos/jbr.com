"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

interface AddressMapPreviewProps {
    addressText?: string;
    latitude?: string | null;
    longitude?: string | null;
    className?: string;
}

const InteractiveMapPicker = dynamic(
    () => import("./InteractiveMapPicker").then((mod) => mod.InteractiveMapPicker),
    {
        ssr: false,
        loading: () => (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
                Memuat preview...
            </div>
        ),
    }
);

function toFiniteNumber(value?: string | null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function AddressMapPreview({ addressText, latitude, longitude, className }: AddressMapPreviewProps) {
    const initialLat = toFiniteNumber(latitude);
    const initialLon = toFiniteNumber(longitude);

    const [lat, setLat] = useState<number | null>(initialLat);
    const [lon, setLon] = useState<number | null>(initialLon);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLat(initialLat);
        setLon(initialLon);
    }, [initialLat, initialLon]);

    useEffect(() => {
        if (initialLat !== null && initialLon !== null) {
            return;
        }

        if (!addressText?.trim()) {
            return;
        }

        let cancelled = false;

        const resolvePreview = async () => {
            setLoading(true);
            try {
                const query = encodeURIComponent(addressText);
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`);
                if (!response.ok) {
                    return;
                }

                const data = (await response.json()) as Array<{ lat: string; lon: string }>;
                if (!data.length || cancelled) {
                    return;
                }

                const nextLat = Number(data[0].lat);
                const nextLon = Number(data[0].lon);
                if (Number.isFinite(nextLat) && Number.isFinite(nextLon)) {
                    setLat(nextLat);
                    setLon(nextLon);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void resolvePreview();

        return () => {
            cancelled = true;
        };
    }, [addressText, initialLat, initialLon]);

    const hasCoordinates = useMemo(() => lat !== null && lon !== null, [lat, lon]);

    return (
        <div className={className}>
            {hasCoordinates ? (
                <div className="absolute inset-0 pointer-events-none">
                    <InteractiveMapPicker
                        lat={lat!}
                        lon={lon!}
                        onPick={() => {
                            // Preview-only map; pin changes happen in the dialog.
                        }}
                    />
                </div>
            ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 px-3 text-center">
                    {loading ? "Mencari preview peta..." : "Klik untuk lihat peta lokasi"}
                </div>
            )}
        </div>
    );
}
