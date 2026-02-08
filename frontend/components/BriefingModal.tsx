"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BriefingModalProps {
    isOpen: boolean;
    questions: string[];
    planId: string;
    onSubmit: (answers: string) => Promise<void>;
    onAbort?: () => void;
}

export default function BriefingModal({ isOpen, questions, planId, onSubmit, onAbort }: BriefingModalProps) {
    const [answers, setAnswers] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!answers.trim()) return;

        setIsSubmitting(true);
        try {
            await onSubmit(answers);
            setAnswers(""); // Clear after successful submission
        } catch (error) {
            console.error("Failed to submit intel:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="w-full max-w-2xl bg-[#0a0a0a] border border-[#ef4444] rounded-lg shadow-[0_0_50px_rgba(239,68,68,0.2)] overflow-hidden"
                >
                    {/* Header */}
                    <div className="bg-[#ef4444] px-6 py-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                            <h2 className="text-white font-bold tracking-wider text-lg">
                                INTERROGATION REQUIRED
                            </h2>
                        </div>
                        <span className="text-white/80 text-xs font-mono">v5.1 INTEL GATHERING</span>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            <p className="text-[#a3a3a3] text-sm">
                                The strategist has identified gaps in your mission parameters.
                                Provide the missing intelligence to proceed.
                            </p>

                            <div className="space-y-3">
                                {questions.map((q, idx) => (
                                    <div
                                        key={idx}
                                        className="flex gap-4 p-4 bg-[#171717] rounded border border-[#262626] border-l-4 border-l-[#ef4444]"
                                    >
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#ef4444]/20 text-[#ef4444] flex items-center justify-center text-xs font-bold">
                                            {idx + 1}
                                        </span>
                                        <p className="text-[#e5e5e5] text-sm leading-relaxed">{q}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="space-y-2">
                            <label className="text-[#ef4444] text-xs font-bold uppercase tracking-wider">
                                Classified Response
                            </label>
                            <textarea
                                value={answers}
                                onChange={(e) => setAnswers(e.target.value)}
                                placeholder="Enter specific constraints, budgets, or success criteria..."
                                className="w-full h-32 bg-[#050505] border border-[#333] rounded p-4 text-[#d4d4d4] placeholder:text-[#525252] focus:outline-none focus:border-[#ef4444] focus:ring-1 focus:ring-[#ef4444] transition-all font-mono text-sm resize-none"
                            />
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end pt-2 gap-4">
                            {onAbort && (
                                <button
                                    onClick={onAbort}
                                    disabled={isSubmitting}
                                    className="px-6 py-3 bg-transparent hover:bg-red-900/20 text-[#737373] hover:text-[#ef4444] border border-transparent hover:border-red-900/50 transition-all duration-300 rounded font-bold tracking-wider text-sm uppercase"
                                >
                                    Abort Mission
                                </button>
                            )}
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !answers.trim()}
                                className="group relative px-6 py-3 bg-[#171717] hover:bg-[#ef4444] border border-[#ef4444] text-[#ef4444] hover:text-white transition-all duration-300 rounded overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="absolute inset-0 w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_3s_infinite]" />
                                <span className="relative flex items-center gap-2 font-bold tracking-wider text-sm">
                                    {isSubmitting ? (
                                        <>
                                            <span className="animate-spin">↻</span> ENCRYPTING...
                                        </>
                                    ) : (
                                        <>
                                            <span>▶</span> SUBMIT INTEL
                                        </>
                                    )}
                                </span>
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
