"use client";

import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { LatLngExpression } from "leaflet";
import { useEffect, useMemo } from "react";

interface InteractiveMapPickerProps {
    lat: number;
    lon: number;
    onPick: (coords: { lat: number; lon: number }) => void;
    showControls?: boolean;
}

function MapClickHandler({ onPick }: { onPick: (coords: { lat: number; lon: number }) => void }) {
    useMapEvents({
        click(event) {
            onPick({ lat: event.latlng.lat, lon: event.latlng.lng });
        },
    });

    return null;
}

function RecenterMap({ lat, lon }: { lat: number; lon: number }) {
    const map = useMap();

    useEffect(() => {
        map.invalidateSize();
        map.setView([lat, lon], Math.max(map.getZoom(), 15), { animate: true });

        const timer = window.setTimeout(() => {
            map.invalidateSize();
        }, 120);

        return () => window.clearTimeout(timer);
    }, [lat, lon, map]);

    return null;
}

export function InteractiveMapPicker({ lat, lon, onPick, showControls = true }: InteractiveMapPickerProps) {
    const center: LatLngExpression = [lat, lon];

    // A single, fully-controlled HTML pin. Using a divIcon (with an EMPTY
    // className so Leaflet's default `.leaflet-div-icon` white box is not applied)
    // avoids the SVG vector-overlay artifacts that produced a stray colored box.
    const pinIcon = useMemo(
        () =>
            L.divIcon({
                className: "jbr-map-pin",
                html:
                    '<span style="display:block;width:18px;height:18px;border-radius:9999px;' +
                    'background:#e11d48;border:2px solid #ffffff;box-shadow:0 0 0 1.5px rgba(0,0,0,0.25)"></span>',
                iconSize: [18, 18],
                iconAnchor: [9, 9],
            }),
        []
    );

    return (
        <MapContainer
            center={center}
            zoom={16}
            scrollWheelZoom
            className="w-full h-full"
            attributionControl={showControls}
            zoomControl={showControls}
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
            />
            <MapClickHandler onPick={onPick} />
            <RecenterMap lat={lat} lon={lon} />
            <Marker position={center} icon={pinIcon} />
        </MapContainer>
    );
}
