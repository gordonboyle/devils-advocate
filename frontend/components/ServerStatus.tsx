"use client";

import { useState, useEffect } from "react";

export default function ServerStatus() {
    const [status, setStatus] = useState<"loading" | "online" | "offline">("loading");

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const res = await fetch("http://localhost:8005/health");
                if (res.ok) {
                    setStatus("online");
                } else {
                    setStatus("offline");
                }
            } catch (e) {
                setStatus("offline");
            }
        };

        // Initial check
        checkHealth();

        // Poll every 30s
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    if (status === "loading") {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#171717] border border-[#262626]">
                <div className="w-2 h-2 rounded-full bg-neutral-500 animate-pulse" />
                <span className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
                    INITIALIZING...
                </span>
            </div>
        );
    }

    if (status === "offline") {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-900/10 border border-red-900/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </div>
                <span className="text-[10px] font-mono tracking-widest text-red-500 uppercase">
                    OFFLINE
                </span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-900/10 border border-green-900/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
            <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </div>
            <span className="text-[10px] font-mono tracking-widest text-green-500 uppercase">
                SYSTEM ONLINE
            </span>
        </div>
    );
}
