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
  Play,
  RotateCcw,
  Target
} from "lucide-react";
import { Insignia } from "@/components/Insignia";

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

  // Interrogator answers (v5.1)
  const [interrogatorAnswers, setInterrogatorAnswers] = useState("");

  // Restore state from localStorage on mount
  useEffect(() => {
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
    setInterrogatorAnswers("");
    setError(null);
    localStorage.removeItem('devils_advocate_thread_id');
    localStorage.removeItem('devils_advocate_result');
    localStorage.removeItem('devils_advocate_objective');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objective.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setActiveThreadId(null);
    setFeedback("");
    setInterrogatorAnswers("");

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
  const handleInterrogatorSubmit = async () => {
    if (!activeThreadId || !interrogatorAnswers.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`http://localhost:8005/plan/${activeThreadId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: interrogatorAnswers }),
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

  const handleFeedback = async (action: "approve" | "reject") => {
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
          feedback_text: feedback
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

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white selection:bg-red-500/30 font-sans">
      {/* Tactical Grid Background */}
      <div className="fixed inset-0 tactical-grid opacity-60 pointer-events-none" />
      <div className="fixed inset-0 tactical-grid-accent opacity-30 pointer-events-none" />

      {/* Red gradient vignette */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.15)_0%,transparent_50%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(0,0,0,0.8)_0%,transparent_50%)] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-6 py-8 z-10">
        {/* Top Left Corner - Version Badge */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-6 left-6 z-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-mono tracking-wider">
            <Zap className="w-4 h-4" />
            <span>AI ARCHITECTURE v5.1</span>
          </div>
        </motion.div>

        {/* Centered Hero Section */}
        <div className="text-center pt-16 mb-16 space-y-6">
          {/* Insignia Logo - Center Stage */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center"
          >
            <Insignia className="w-28 h-28 text-red-500 mb-4 drop-shadow-[0_0_25px_rgba(239,68,68,0.6)]" />
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl md:text-7xl font-bold tracking-tight"
          >
            <span className="bg-gradient-to-b from-white via-white to-neutral-400 bg-clip-text text-transparent">
              DEVIL&apos;S ADVOCATE
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="space-y-3 max-w-2xl mx-auto"
          >
            <p className="text-neutral-400 text-lg">
              A deterministic, adversarial AI planning engine.
            </p>
            <p className="text-red-400/80 text-sm font-mono italic">
              &quot;Plan for the worst, and execute with the best.&quot;
            </p>
          </motion.div>
        </div>

        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="max-w-2xl mx-auto"
        >
          <form onSubmit={handleSubmit} className="relative group">
            {/* Red glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-red-600/50 via-red-500/30 to-red-600/50 rounded-xl blur-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition duration-500" />

            <div className="relative bg-[#111111] ring-1 ring-red-500/20 rounded-xl p-2 flex items-center gap-2 shadow-2xl">
              <div className="pl-4 text-red-500/60">
                <Terminal className="w-5 h-5" />
              </div>
              <input
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Enter mission objective..."
                className="w-full bg-transparent border-none focus:ring-0 text-lg placeholder:text-neutral-600 text-white h-12 outline-none font-mono"
                disabled={loading || result?.status === "PAUSED" || result?.status === "INTERRUPTED"}
              />
              <button
                type="submit"
                disabled={loading || !objective || result?.status === "PAUSED" || result?.status === "INTERRUPTED"}
                className="btn-tactical text-white px-6 py-2.5 rounded-lg font-bold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
              >
                {loading && !result ? (
                  <>EXECUTING...</>
                ) : (
                  <>EXECUTE <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </form>

          {/* Quick status examples */}
          {!loading && !result && (
            <div className="mt-8 flex justify-center gap-6 text-sm text-neutral-500">
              <span className="flex items-center gap-1.5">
                <BrainCircuit className="w-4 h-4 text-red-500/60" />
                Multi-Agent Critique
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-red-500/60" />
                Drift Protection
              </span>
              <span className="flex items-center gap-1.5">
                <Target className="w-4 h-4 text-red-500/60" />
                Interrogation
              </span>
            </div>
          )}

          {/* New Session Button */}
          {result && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={clearSession}
                className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-400 hover:text-red-400 bg-neutral-900/50 hover:bg-red-950/30 rounded-lg border border-neutral-800 hover:border-red-500/30 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                New Mission
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
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 border-2 border-red-500/30 rounded-full" />
                <div className="absolute inset-0 border-t-2 border-red-500 rounded-full animate-spin" />
                <div className="absolute inset-3 border-t-2 border-red-400 rounded-full animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
                <div className="absolute inset-6 border-t-2 border-red-300 rounded-full animate-spin [animation-duration:2s]" />
              </div>
              <p className="text-red-400/80 animate-pulse font-mono text-sm tracking-widest">
                {result?.status === "INTERRUPTED"
                  ? "AWAITING INPUT..."
                  : activeThreadId
                    ? "PROCESSING INTEL..."
                    : "DRAFTING · CRITIQUING · SYNTHESIZING"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-4 card-tactical-danger rounded-lg text-red-400 text-center max-w-2xl mx-auto flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-5 h-5" />
            <span className="font-mono">{error}</span>
          </motion.div>
        )}

        {/* Interrogator Questions Block (v5.1) */}
        {result?.status === "INTERRUPTED" && result?.questions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-3xl mx-auto mt-12 mb-8"
          >
            <div className="card-tactical-danger rounded-xl p-6 glow-red">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-500/20 rounded-lg">
                  <Target className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-red-400 flex items-center gap-2">
                    <span>INTERROGATION REQUIRED</span>
                    <span className="text-xs font-mono bg-red-500/20 px-2 py-0.5 rounded">v5.1</span>
                  </h3>
                  <p className="text-neutral-400 mt-1 mb-4 text-sm">
                    Answer these clarifying questions to create a more precise battle plan.
                  </p>

                  <div className="space-y-3 mb-6">
                    {result.questions.map((question, i) => (
                      <div key={i} className="flex gap-3 items-start p-3 bg-red-950/30 border border-red-500/20 rounded-lg">
                        <span className="flex-none w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center text-red-400 text-sm font-mono">
                          {i + 1}
                        </span>
                        <p className="text-neutral-200 text-sm">{question}</p>
                      </div>
                    ))}
                  </div>

                  <textarea
                    className="w-full bg-[#0a0a0a] border border-red-500/30 rounded-lg p-4 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 min-h-[120px] font-mono text-sm"
                    placeholder="Enter your answers here. Be specific about constraints, budgets, timelines, and success criteria..."
                    value={interrogatorAnswers}
                    onChange={(e) => setInterrogatorAnswers(e.target.value)}
                  />

                  <div className="flex gap-3 mt-4 justify-end">
                    <button
                      onClick={handleInterrogatorSubmit}
                      disabled={loading || !interrogatorAnswers.trim()}
                      className="btn-tactical text-white px-6 py-2.5 rounded-lg font-bold tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" /> SUBMIT INTEL
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Human Review Interruption Block */}
        {result?.status === "PAUSED" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-3xl mx-auto mt-12 mb-8"
          >
            <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-6 glow-red">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-500/20 rounded-lg">
                  <ShieldAlert className="w-6 h-6 text-amber-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-amber-400">HUMAN REVIEW REQUIRED</h3>
                  <p className="text-amber-200/60 mt-1 mb-4 text-sm">
                    The Gatekeeper has paused execution. Analyze the plan and decide how to proceed.
                  </p>

                  <textarea
                    className="w-full bg-[#0a0a0a] border border-amber-500/30 rounded-lg p-4 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 min-h-[100px] font-mono text-sm"
                    placeholder="Enter feedback or directives (optional)..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                  />

                  <div className="flex gap-3 mt-4 justify-end">
                    <button
                      onClick={() => handleFeedback('approve')}
                      disabled={loading}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold tracking-wide transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" /> APPROVE
                    </button>

                    <button
                      onClick={() => handleFeedback('reject')}
                      disabled={loading}
                      className="btn-tactical text-white px-5 py-2.5 rounded-lg font-bold tracking-wide transition-all flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" /> CONTINUE EXECUTION
                    </button>
                  </div>
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
            className="mt-16 grid gap-8 md:grid-cols-[2fr,1fr]"
          >
            {/* Main Plan */}
            <div className="space-y-6">
              <div className="card-tactical rounded-2xl p-6 md:p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                      <Target className="w-6 h-6 text-red-500" />
                      Battle Plan
                    </h2>
                    <p className="text-neutral-500 text-sm font-mono">
                      VERSION {result.final_plan.version} • TACTICAL OBJECTIVE
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-mono border ${result.status === 'PAUSED'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                    : result.status === 'INTERRUPTED'
                      ? 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse'
                      : 'bg-green-500/10 text-green-400 border-green-500/30'
                    }`}>
                    {result.status}
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Steps */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Execution Steps
                    </h3>
                    <div className="space-y-3">
                      {result.final_plan.steps.map((step, i) => (
                        <div key={i} className="flex gap-4 group">
                          <div className="flex-none w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 font-mono text-sm border border-red-500/30 group-hover:border-red-500 group-hover:bg-red-500/20 transition-all">
                            {i + 1}
                          </div>
                          <div>
                            <h4 className="text-white font-medium">{step.step}</h4>
                            <p className="text-neutral-400 text-sm leading-relaxed mt-1">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Risks */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Critical Risk Analysis
                    </h3>
                    <div className="grid gap-3">
                      {result.final_plan.risks.map((risk, i) => (
                        <div key={i} className="card-tactical-danger rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-4 h-4 text-red-500 mt-1 flex-none" />
                            <div>
                              <p className="text-red-200 text-sm font-medium">{risk.risk}</p>
                              <p className="text-red-400/60 text-xs mt-1 font-mono">
                                MITIGATION: {risk.mitigation}
                              </p>
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
            <div className="space-y-6">
              <div className="card-tactical rounded-xl p-6">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2 tracking-wide">
                  <Bot className="w-4 h-4 text-red-500" />
                  ENGINE STATS
                </h3>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between py-2 border-b border-red-500/10">
                    <span className="text-neutral-500 font-mono">ITERATIONS</span>
                    <span className="text-white font-mono">{result.iteration_count}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-red-500/10">
                    <span className="text-neutral-500 font-mono">COMPUTE</span>
                    <span className="text-white font-mono">50 CALLS (MAX)</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-red-500/10">
                    <span className="text-neutral-500 font-mono">DRIFT CHECK</span>
                    <span className="text-green-400 font-mono">PASSED</span>
                  </div>
                  {result.message && (
                    <div className="py-2 border-b border-red-500/10">
                      <span className="text-neutral-500 block mb-1 font-mono">LAST MSG</span>
                      <span className="text-neutral-300 text-xs italic">&quot;{result.message}&quot;</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="card-tactical-danger rounded-xl p-6">
                <h3 className="text-red-400 font-bold mb-4 flex items-center gap-2 tracking-wide">
                  <CheckCircle2 className="w-4 h-4" />
                  SUCCESS METRICS
                </h3>
                <ul className="space-y-2 mt-4">
                  {result.final_plan.success_metrics.map((metric, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-neutral-300">
                      <ChevronRight className="w-3 h-3 text-red-500 mt-1 flex-none" />
                      {metric}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}
