/**
 * Custom sport-racket icons (currentColor, 24x24) — closer to the real gear
 * than the generic crossed-oars glyph. Plain SVG, safe in server components.
 */

interface IconProps {
    className?: string;
}

/** Padel racket: rounded/teardrop head with the signature perforations + grip. */
export function PadelIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
            <defs>
                {/* Identical across instances → a shared static id renders correctly. */}
                <mask id="jbr-padel-holes">
                    <rect width="24" height="24" fill="white" />
                    <circle cx="9" cy="6" r="1" fill="black" />
                    <circle cx="12" cy="6" r="1" fill="black" />
                    <circle cx="15" cy="6" r="1" fill="black" />
                    <circle cx="9" cy="9.6" r="1" fill="black" />
                    <circle cx="12" cy="9.6" r="1" fill="black" />
                    <circle cx="15" cy="9.6" r="1" fill="black" />
                </mask>
            </defs>
            <g mask="url(#jbr-padel-holes)">
                <ellipse cx="12" cy="8" rx="6.2" ry="6.6" />
            </g>
            {/* Neck + grip (outside the mask so it stays solid). */}
            <path d="M10.6 13.4h2.8v7.2a1.4 1.4 0 0 1-2.8 0z" />
        </svg>
    );
}

/** Pickleball paddle: elongated rounded-rectangle face (smooth) + grip. */
export function PickleballIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
            {/* Elongated paddle head — taller & narrower than the padel oval. */}
            <rect x="7.5" y="1.8" width="9" height="13.4" rx="4" />
            {/* Grip. */}
            <path d="M10.6 14h2.8v6.6a1.4 1.4 0 0 1-2.8 0z" />
        </svg>
    );
}
