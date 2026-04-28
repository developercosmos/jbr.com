"use client";

import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { useEffect } from "react";

interface InteractiveMapPickerProps {
    lat: number;
    lon: number;
    onPick: (coords: { lat: number; lon: number }) => void;
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
        map.setView([lat, lon], Math.max(map.getZoom(), 15), { animate: true });
    }, [lat, lon, map]);

    return null;
}

export function InteractiveMapPicker({ lat, lon, onPick }: InteractiveMapPickerProps) {
    const center: LatLngExpression = [lat, lon];

    return (
        <MapContainer
            center={center}
            zoom={16}
            scrollWheelZoom
            className="w-full h-full"
            attributionControl
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
            />
            <MapClickHandler onPick={onPick} />
            <RecenterMap lat={lat} lon={lon} />
            <CircleMarker
                center={center}
                radius={10}
                pathOptions={{
                    color: "#ffffff",
                    weight: 2,
                    fillColor: "#e11d48",
                    fillOpacity: 0.95,
                }}
            />
        </MapContainer>
    );
}
