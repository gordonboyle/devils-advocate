interface TridentLogoProps {
    className?: string;
}

export function TridentLogo({ className = "" }: TridentLogoProps) {
    return (
        <div className="drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]">
            <svg
                viewBox="0 0 24 24"
                className={className}
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Trident - Tactical Design */}
                <path
                    d="M12 1
             L12 3
             L10.5 3
             L10.5 1.5
             L9 1.5
             L9 4
             L8 4
             L8 7
             L9 8
             L9 6
             L10 6
             L10 8
             L11 8
             L11 10
             L10.5 10
             L10.5 11
             L11 11
             L11 22
             L13 22
             L13 11
             L13.5 11
             L13.5 10
             L13 10
             L13 8
             L14 8
             L14 6
             L15 6
             L15 8
             L16 7
             L16 4
             L15 4
             L15 1.5
             L13.5 1.5
             L13.5 3
             L12 3
             Z
             M8.5 2
             L7 3.5
             L7 6
             L8 7
             L8 4.5
             L8.5 4
             Z
             M15.5 2
             L17 3.5
             L17 6
             L16 7
             L16 4.5
             L15.5 4
             Z"
                    fillRule="evenodd"
                />
                {/* Center prong accent */}
                <path
                    d="M11.5 2 L12.5 2 L12.5 4 L11.5 4 Z"
                    opacity="0.8"
                />
            </svg>
        </div>
    );
}

// Alternate simpler version with cleaner trident shape
export function TridentLogoSimple({ className = "" }: TridentLogoProps) {
    return (
        <div className="drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]">
            <svg
                viewBox="0 0 24 24"
                className={className}
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Main shaft */}
                <rect x="11" y="8" width="2" height="14" rx="0.5" />

                {/* Center prong */}
                <path d="M12 2 L14 6 L13 6 L13 9 L11 9 L11 6 L10 6 Z" />

                {/* Left prong */}
                <path d="M6 5 L8 3 L9 4 L9 7 L8 8 L8 5.5 L7 6.5 L7 8 L6 7 Z" />

                {/* Right prong */}
                <path d="M18 5 L16 3 L15 4 L15 7 L16 8 L16 5.5 L17 6.5 L17 8 L18 7 Z" />

                {/* Crossbar */}
                <rect x="8" y="7" width="8" height="1.5" rx="0.25" />
            </svg>
        </div>
    );
}

// Premium version matching the reference image style
export function TridentLogoPremium({ className = "" }: TridentLogoProps) {
    return (
        <div className="drop-shadow-[0_0_15px_rgba(239,68,68,0.7)]">
            <svg
                viewBox="0 0 32 32"
                className={className}
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Gradient definitions */}
                <defs>
                    <linearGradient id="tridentGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#f87171" />
                        <stop offset="50%" stopColor="#ef4444" />
                        <stop offset="100%" stopColor="#b91c1c" />
                    </linearGradient>
                    <linearGradient id="shaftGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#dc2626" />
                        <stop offset="50%" stopColor="#ef4444" />
                        <stop offset="100%" stopColor="#dc2626" />
                    </linearGradient>
                </defs>

                {/* Main trident shape */}
                <g fill="url(#tridentGradient)">
                    {/* Center prong - tallest */}
                    <path d="M16 1 L18 7 L17 7 L17 10 L15 10 L15 7 L14 7 Z" />

                    {/* Left prong */}
                    <path d="M8 6 L11 4 L12 5 L11.5 9 L9 10 L9 7 Z" />

                    {/* Right prong */}
                    <path d="M24 6 L21 4 L20 5 L20.5 9 L23 10 L23 7 Z" />
                </g>

                {/* Crossbar / Guard */}
                <rect x="9" y="9" width="14" height="2" rx="0.5" fill="url(#shaftGradient)" />

                {/* Main shaft */}
                <rect x="14.5" y="10" width="3" height="19" rx="0.5" fill="url(#shaftGradient)" />

                {/* Shaft details / grooves */}
                <rect x="15.25" y="12" width="1.5" height="1" rx="0.25" fill="#fca5a5" opacity="0.5" />
                <rect x="15.25" y="14" width="1.5" height="1" rx="0.25" fill="#fca5a5" opacity="0.3" />

                {/* Bottom point */}
                <path d="M14.5 28 L16 31 L17.5 28 Z" fill="url(#tridentGradient)" />
            </svg>
        </div>
    );
}

export default TridentLogo;
