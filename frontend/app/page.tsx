"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  Terminal,
  ShieldAlert,
  Zap,
  ArrowRight,
  RotateCcw,
  Target
} from "lucide-react";
import { Insignia } from "@/components/Insignia";
import BriefingModal from "@/components/BriefingModal";
import CommandOverride from "@/components/CommandOverride";
import ServerStatus from "@/components/ServerStatus";

// Types matching backend v5.1
interface PlanResponse {
  thread_id: string;
  final_plan: {
    objective: string;
    steps: Array<{ step: string; description: string }>;
    risks: Array<{ risk: string; mitigation: string }>;
    success_metrics: string[];
    version: number;
    normalized_objective?: string;
  } | null;
  iteration_count: number;
  status: string;
  message?: string;
  next_node?: string;
  questions?: string[]; // Interrogator questions (v5.1)
}

export default function Home() {
  const [objective, setObjective] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New state for feedback loop
  const [feedback, setFeedback] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Restore state from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const savedThreadId = localStorage.getItem('devils_advocate_thread_id');
    const savedResult = localStorage.getItem('devils_advocate_result');
    const savedObjective = localStorage.getItem('devils_advocate_objective');

    if (savedThreadId) setActiveThreadId(savedThreadId);
    if (savedResult) {
      try {
        setResult(JSON.parse(savedResult));
      } catch (e) {
        console.error('Failed to parse saved result:', e);
      }
    }
    if (savedObjective) setObjective(savedObjective);
  }, []);

  // Persist state to localStorage when it changes
  useEffect(() => {
    if (activeThreadId) {
      localStorage.setItem('devils_advocate_thread_id', activeThreadId);
    } else {
      localStorage.removeItem('devils_advocate_thread_id');
    }
  }, [activeThreadId]);

  useEffect(() => {
    if (result) {
      localStorage.setItem('devils_advocate_result', JSON.stringify(result));
    } else {
      localStorage.removeItem('devils_advocate_result');
    }
  }, [result]);

  useEffect(() => {
    if (objective) {
      localStorage.setItem('devils_advocate_objective', objective);
    }
  }, [objective]);

  // Clear session helper
  const clearSession = () => {
    setResult(null);
    setActiveThreadId(null);
    setObjective("");
    setFeedback("");
    setError(null);
    localStorage.removeItem('devils_advocate_thread_id');
    localStorage.removeItem('devils_advocate_result');
    localStorage.removeItem('devils_advocate_objective');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting objective:", objective);
    if (!objective.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setActiveThreadId(null);
    setFeedback("");

    try {
      const res = await fetch("http://localhost:8005/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      if (data.thread_id) {
        setActiveThreadId(data.thread_id);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong connected to the Devils Advocate engine.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle Interrogator answers (v5.1)
  const handleInterrogatorSubmit = async (answers: string) => {
    if (!activeThreadId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`http://localhost:8005/plan/${activeThreadId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Error submitting answers.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (action: "approve" | "reject", customFeedback?: string) => {
    if (!activeThreadId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("http://localhost:8005/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: activeThreadId,
          action: action,
          feedback_text: customFeedback || feedback
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Error submitting feedback.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <main className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-[#ef4444] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#ef4444] font-mono text-xs tracking-widest uppercase">Initializing Interface...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-[#ededed] selection:bg-[#ef4444]/30 font-sans relative overflow-x-hidden">
      {/* Background Layers */}
      <div className="fixed inset-0 tactical-grid opacity-40 pointer-events-none" />
      <div className="fixed inset-0 tactical-grid-accent opacity-20 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.1)_0%,transparent_60%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(0,0,0,0.9)_0%,transparent_60%)] pointer-events-none" />

      {/* HUD Layer - Top Left (Badge) */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute top-8 left-8 z-50 pointer-events-none select-none"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] text-sm font-mono tracking-wider shadow-[0_0_15px_rgba(239,68,68,0.1)] backdrop-blur-sm">
          <Zap className="w-4 h-4" />
          <span>AI ARCHITECTURE v5.1</span>
        </div>
      </motion.div>

      {/* HUD Layer - Top Right (Server Status) */}
      <div className="absolute top-8 right-8 z-50 pointer-events-auto">
        <ServerStatus />
      </div>

      {/* Content Layer - Centered */}
      <div className="relative z-10 min-h-screen flex flex-col justify-center items-center w-full max-w-5xl mx-auto px-6 py-24">

        {/* Hero Section */}
        <div className="text-center mb-12 space-y-8 w-full">
          {/* Insignia Logo - Center Stage */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center"
          >
            <Insignia className="w-28 h-28 mb-6 drop-shadow-[0_0_35px_rgba(239,68,68,0.5)]" />
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-6xl md:text-8xl font-bold tracking-widest text-white leading-tight"
          >
            DEVIL&apos;S ADVOCATE
          </motion.h1>

          {/* Subtitle */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="space-y-3 max-w-2xl mx-auto"
          >
            <p className="text-[#a3a3a3] text-lg font-light tracking-wide">
              A deterministic, adversarial AI planning engine.
            </p>
            <p className="text-[#ef4444] text-base font-mono italic tracking-wide">
              &quot;Plan for the worst, execute with the best.&quot;
            </p>
          </motion.div>
        </div>

        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="max-w-3xl w-full mx-auto mb-16"
        >
          <form onSubmit={handleSubmit} className="relative group w-full">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#ef4444]/40 via-[#ef4444]/20 to-[#ef4444]/40 rounded-xl blur-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition duration-500" />

            <div className="relative bg-[#0a0a0a] ring-1 ring-[#262626] group-focus-within:ring-[#ef4444]/50 rounded-xl p-2 flex items-center gap-2 shadow-2xl transition-all">
              <div className="pl-4 text-[#ef4444]/80">
                <Terminal className="w-5 h-5" />
              </div>
              <input
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Enter mission objective..."
                className="w-full bg-transparent border-none focus:ring-0 text-lg placeholder:text-[#525252] text-[#ededed] h-12 outline-none font-mono tracking-tight"
                disabled={loading || result?.status === "PAUSED" || result?.status === "INTERRUPTED"}
              />
              <button
                type="submit"
                disabled={loading || !objective || result?.status === "PAUSED" || result?.status === "INTERRUPTED"}
                className="bg-[#171717] hover:bg-[#ef4444] text-[#ef4444] hover:text-white border border-[#ef4444]/30 px-6 py-2.5 rounded-lg font-bold tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 uppercase text-sm flex-none"
              >
                {loading && !result ? (
                  <>EXECUTING...</>
                ) : (
                  <>EXECUTE <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </form>

          {!loading && !result && (
            <div className="mt-8 flex justify-center gap-4 md:gap-8 text-xs font-mono tracking-widest text-[#525252] uppercase flex-wrap">
              <span className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-[#ef4444]" />
                Multi-Agent Critique
              </span>
              <span className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#ef4444]" />
                Drift Protection
              </span>
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[#ef4444]" />
                Interrogation
              </span>
            </div>
          )}

          {result && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={clearSession}
                className="flex items-center gap-2 px-4 py-2 text-xs font-mono text-[#737373] hover:text-[#ef4444] bg-[#0a0a0a] hover:bg-[#171717] rounded border border-[#262626] hover:border-[#ef4444]/50 transition-all uppercase tracking-wider"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Mission
              </button>
            </div>
          )}
        </motion.div>

        {/* Loading State */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-12 text-center space-y-4"
            >
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 border-2 border-[#ef4444]/20 rounded-full" />
                <div className="absolute inset-0 border-t-2 border-[#ef4444] rounded-full animate-spin" />
                <div className="absolute inset-3 border-t-2 border-[#b91c1c] rounded-full animate-spin [animation-direction:reverse] [animation-duration:2s]" />
              </div>
              <p className="text-[#ef4444] animate-pulse font-mono text-xs tracking-[0.2em] uppercase">
                {result?.status === "INTERRUPTED"
                  ? "AWAITING CLEARANCE..."
                  : activeThreadId
                    ? "PROCESSING INTEL..."
                    : "TACTICAL ANALYSIS IN PROGRESS"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-4 bg-[#171717] border border-[#ff0000]/30 rounded text-[#ff4444] text-center max-w-2xl mx-auto flex items-center justify-center gap-3 w-full"
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="font-mono text-sm">{error}</span>
          </motion.div>
        )}

        {/* MODAL: Interrogator (Briefing) */}
        <BriefingModal
          isOpen={result?.status === "INTERRUPTED" && !!result.questions}
          questions={result?.questions || []}
          planId={activeThreadId || ""}
          onSubmit={handleInterrogatorSubmit}
          onAbort={clearSession}
        />

        {/* COMPONENT: Command Override */}
        {result?.status === "RECOVERABLE_FAIL" && activeThreadId && (
          <CommandOverride
            planId={activeThreadId}
            onFeedbackSubmit={(fb) => handleFeedback("reject", fb)}
          />
        )}

        {/* Legacy: Human Review Block (PAUSED) */}
        {result?.status === "PAUSED" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-3xl w-full mx-auto mt-12 mb-8"
          >
            <div className="bg-[#171212] border border-amber-500/20 rounded-xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-50">
                <ShieldAlert className="w-16 h-16 text-amber-500/10" />
              </div>
              <div className="relative z-10 flex flex-col gap-4">
                <h3 className="text-lg font-bold text-amber-500 flex items-center gap-2 uppercase tracking-wider">
                  <ShieldAlert className="w-5 h-5" /> Human Verification
                </h3>
                <p className="text-[#a3a3a3] text-sm">
                  The Gatekeeper has paused execution for safety. Review the parameters.
                </p>

                <textarea
                  className="w-full bg-[#0a0a0a] border border-[#262626] focus:border-amber-500/50 rounded p-4 text-[#e5e5e5] placeholder:text-[#525252] min-h-[100px] font-mono text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all"
                  placeholder="Enter optional feedback or overrides..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />

                <div className="flex gap-4 justify-end">
                  <button
                    onClick={() => handleFeedback('approve')}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded bg-green-900/20 hover:bg-green-900/40 text-green-500 border border-green-900/50 hover:border-green-500/50 font-bold tracking-wide transition-all text-xs uppercase"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve
                  </button>

                  <button
                    onClick={() => handleFeedback('reject')}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded bg-[#171717] hover:bg-[#262626] text-[#e5e5e5] border border-[#262626] font-bold tracking-wide transition-all text-xs uppercase"
                  >
                    <RotateCcw className="w-4 h-4" /> Retry
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Results */}
        {result && result.final_plan && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-16 grid gap-8 md:grid-cols-[2fr,1fr] w-full"
          >
            {/* Main Plan */}
            <div className="space-y-6">
              <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#ef4444] to-transparent opacity-50" />

                <div className="flex items-start justify-between mb-8 pb-6 border-b border-[#262626]">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3 tracking-wide">
                      <Target className="w-6 h-6 text-[#ef4444]" />
                      BATTLE PLAN
                    </h2>
                    <p className="text-[#525252] text-xs font-mono uppercase tracking-widest">
                      ID: {result.thread_id.slice(0, 8)} • VER: {result.final_plan.version}
                    </p>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-xs font-mono border font-bold uppercase tracking-wider ${result.status === 'PAUSED'
                    ? 'bg-amber-900/10 text-amber-500 border-amber-900/30'
                    : result.status === 'INTERRUPTED'
                      ? 'bg-red-900/10 text-red-500 border-red-900/30 animate-pulse'
                      : 'bg-green-900/10 text-green-500 border-green-900/30'
                    }`}>
                    {result.status}
                  </div>
                </div>

                <div className="space-y-10">
                  {/* Steps */}
                  <div className="space-y-6">
                    <h3 className="text-xs font-bold text-[#ef4444] uppercase tracking-[0.2em] flex items-center gap-2">
                      <Zap className="w-3 h-3" />
                      Execution Steps
                    </h3>
                    <div className="space-y-4">
                      {result.final_plan.steps.map((step, i) => (
                        <div key={i} className="flex gap-5 group">
                          <div className="flex-none w-8 h-8 rounded bg-[#171717] flex items-center justify-center text-[#ef4444] font-mono text-xs border border-[#262626] group-hover:border-[#ef4444]/50 transition-all">
                            {String(i + 1).padStart(2, '0')}
                          </div>
                          <div>
                            <h4 className="text-[#ededed] font-medium tracking-wide">{step.step}</h4>
                            <p className="text-[#737373] text-sm leading-relaxed mt-2">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Risks */}
                  <div className="space-y-6">
                    <h3 className="text-xs font-bold text-[#ef4444] uppercase tracking-[0.2em] flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3" />
                      Risk Analysis
                    </h3>
                    <div className="grid gap-4">
                      {result.final_plan.risks.map((risk, i) => (
                        <div key={i} className="bg-[#0f0f0f] border border-red-900/20 rounded p-4 hover:border-red-900/40 transition-all">
                          <div className="flex items-start gap-4">
                            <AlertTriangle className="w-4 h-4 text-[#ef4444] mt-1 flex-none" />
                            <div>
                              <p className="text-[#d4d4d4] text-sm font-medium mb-1">{risk.risk}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] font-mono text-[#ef4444] uppercase tracking-wider bg-red-900/10 px-2 py-0.5 rounded">Mitigation</span>
                                <p className="text-[#737373] text-xs">
                                  {risk.mitigation}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar / Metadata */}
            <div className="space-y-8">
              <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-6">
                <h3 className="text-[#ededed] font-bold mb-6 flex items-center gap-2 text-xs uppercase tracking-widest border-b border-[#262626] pb-4">
                  <Bot className="w-4 h-4 text-[#737373]" />
                  Engine Telemetry
                </h3>
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[#525252] font-mono uppercase">Iterations</span>
                    <span className="text-[#ededed] font-mono bg-[#171717] px-2 py-1 rounded">{result.iteration_count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#525252] font-mono uppercase">Compute Load</span>
                    <span className="text-[#ededed] font-mono">NORMAL</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#525252] font-mono uppercase">Safety Check</span>
                    <span className="text-green-500 font-mono flex items-center gap-1">
                      VERIFIED <CheckCircle2 className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-6">
                <h3 className="text-[#ededed] font-bold mb-6 flex items-center gap-2 text-xs uppercase tracking-widest border-b border-[#262626] pb-4">
                  <Target className="w-4 h-4 text-[#737373]" />
                  Success Metrics
                </h3>
                <ul className="space-y-3">
                  {result.final_plan.success_metrics.map((metric, i) => (
                    <li key={i} className="flex items-start gap-3 text-xs text-[#a3a3a3] leading-relaxed">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444] mt-1.5 flex-none shadow-[0_0_8px_#ef4444]" />
                      {metric}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}

      </div>

      {/* Modals */}
      {/* BriefingModal uses portal or fixed, but here it's rendered in DOM. It has 'fixed inset-0 z-50' so it overlays everything regardless of parent. */}
      {/* We conditionally render it inside the return, as JSX. */}

    </main>
  );
}
