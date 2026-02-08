"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface CommandOverrideProps {
    planId: string;
    onFeedbackSubmit: (feedback: string) => Promise<void>;
}

export default function CommandOverride({ planId, onFeedbackSubmit }: CommandOverrideProps) {
    const [feedback, setFeedback] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!feedback.trim()) return;

        setIsSubmitting(true);
        try {
            await onFeedbackSubmit(feedback);
            setFeedback(""); // Clear input on success
        } catch (error) {
            console.error("Failed to submit feedback:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full max-w-4xl mx-auto my-8 p-4 bg-[#0a0a0a] border-l-4 border-[#ef4444] rounded-lg shadow-[0_4px_20px_rgba(239,68,68,0.1)]"
        >
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 text-[#ef4444]">
                    <div className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse" />
                    <h3 className="font-mono text-sm font-bold tracking-wider uppercase">
                        Mission Critical Override
                    </h3>
                </div>

                <p className="text-[#a3a3a3] text-sm leading-relaxed">
                    The strategic analysis has flagged critical failures. Please provide tactical feedback to refine the plan.
                </p>

                <div className="relative group">
                    <div className="absolute inset-0 bg-[#ef4444]/5 blur-lg group-hover:bg-[#ef4444]/10 transition-colors duration-500 rounded-lg" />
                    <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Wait, ignore the cost constraints. Focus on speed..."
                        className="relative w-full h-24 bg-[#050505] border border-[#262626] rounded p-4 text-[#e5e5e5] placeholder:text-[#525252] focus:border-[#ef4444] focus:ring-1 focus:ring-[#ef4444] transition-all font-mono text-sm resize-none z-10"
                    />
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !feedback.trim()}
                        className="px-6 py-2 bg-[#ef4444] hover:bg-[#dc2626] text-white text-sm font-bold tracking-wider rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:shadow-[0_0_25px_rgba(239,68,68,0.5)]"
                    >
                        {isSubmitting ? (
                            <>
                                <span className="animate-spin text-xs">↻</span> OVERRIDING...
                            </>
                        ) : (
                            <>
                                <span>⚡</span> EXECUTE OVERRIDE
                            </>
                        )}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
