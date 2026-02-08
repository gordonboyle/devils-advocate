import Image from "next/image";

interface InsigniaProps {
    className?: string;
}

/**
 * Devils Advocate Insignia Component
 * 
 * Displays the official Devils Advocate logo - a red trident
 * inside a dark hexagonal shield.
 * 
 * To use the actual logo image:
 * 1. Save the insignia image to: frontend/public/images/insignia.png
 * 2. The component will automatically display it
 */
export function Insignia({ className = "w-20 h-20" }: InsigniaProps) {
    return (
        <div className={`${className} relative`}>
            {/* Using Next.js Image component for the insignia */}
            <Image
                src="/images/insignia_v2.png"
                alt="Devil's Advocate Insignia"
                fill
                className="object-contain fill-current stroke-current stroke-1"
                priority
                unoptimized
            />
        </div>
    );
}

/**
 * Fallback SVG version if image is not available
 * Use this component if the PNG image is not set up
 */
export function InsigniaFallback({ className = "w-20 h-20" }: InsigniaProps) {
    return (
        <svg
            viewBox="0 0 100 100"
            className={`${className} fill-current stroke-current stroke-1`}
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id="tridentGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#f87171" />
                    <stop offset="50%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#b91c1c" />
                </linearGradient>
                <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4b5563" />
                    <stop offset="50%" stopColor="#1f2937" />
                    <stop offset="100%" stopColor="#111827" />
                </linearGradient>
                <linearGradient id="shieldEdge" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6b7280" />
                    <stop offset="100%" stopColor="#374151" />
                </linearGradient>
            </defs>

            {/* Hexagonal Shield - Outer Edge */}
            <polygon
                points="50,2 93,24 93,76 50,98 7,76 7,24"
                fill="url(#shieldEdge)"
            />

            {/* Hexagonal Shield - Inner */}
            <polygon
                points="50,6 89,26 89,74 50,94 11,74 11,26"
                fill="url(#shieldGrad)"
            />

            {/* Trident - Center Prong (tallest) */}
            <path
                d="M50 15 L56 32 L53 32 L53 80 L47 80 L47 32 L44 32 Z"
                fill="url(#tridentGrad)"
            />

            {/* Trident - Left Prong */}
            <path
                d="M30 28 L40 22 L43 26 L40 42 L35 45 L32 35 Z"
                fill="url(#tridentGrad)"
            />

            {/* Trident - Right Prong */}
            <path
                d="M70 28 L60 22 L57 26 L60 42 L65 45 L68 35 Z"
                fill="url(#tridentGrad)"
            />

            {/* Trident - Crossbar */}
            <rect x="35" y="40" width="30" height="5" rx="1" fill="url(#tridentGrad)" />

            {/* Trident - Bottom Point */}
            <path
                d="M47 80 L50 90 L53 80 Z"
                fill="url(#tridentGrad)"
            />

            {/* Highlight on left edge */}
            <polygon
                points="50,6 11,26 11,28 50,8"
                fill="rgba(255,255,255,0.1)"
            />
        </svg>
    );
}

export default Insignia;
