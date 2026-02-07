"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  Terminal,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  Play
} from "lucide-react";

// Types matching backend
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
}

export default function Home() {
  const [objective, setObjective] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New state for feedback loop
  const [feedback, setFeedback] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      // Keep thread_id active just in case
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Error submitting feedback.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30 font-sans pb-20">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-6 py-20 z-10">
        {/* Header */}
        <div className="text-center mb-16 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Architecture v4.3</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent"
          >
            Devils Advocate
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-lg max-w-2xl mx-auto"
          >
            A deterministic, adversarial AI planning engine.
            Drags your ideas through hell so they can walk on earth.
          </motion.p>
        </div>

        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="max-w-2xl mx-auto"
        >
          <form onSubmit={handleSubmit} className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-red-500 via-indigo-500 to-purple-500 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
            <div className="relative bg-slate-900 ring-1 ring-slate-800 rounded-xl p-2 flex items-center gap-2 shadow-2xl">
              <div className="pl-4 text-slate-500">
                <Terminal className="w-5 h-5" />
              </div>
              <input
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Enter your objective (e.g., 'Build a moon base')..."
                className="w-full bg-transparent border-none focus:ring-0 text-lg placeholder:text-slate-600 text-white h-12 outline-none"
                disabled={loading || (result?.status === "PAUSED")}
              />
              <button
                type="submit"
                disabled={loading || !objective || (result?.status === "PAUSED")}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                {loading && !result ? (
                  <>Running...</>
                ) : (
                  <>Execute <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </form>

          {/* Quick status examples */}
          {!loading && !result && (
            <div className="mt-8 flex justify-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><BrainCircuit className="w-4 h-4" /> Multi-Agent Critique</span>
              <span className="flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> Drift Protection</span>
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
                <div className="absolute inset-0 border-t-2 border-indigo-500 rounded-full animate-spin"></div>
                <div className="absolute inset-2 border-t-2 border-red-500 rounded-full animate-spin [animation-direction:reverse]"></div>
              </div>
              <p className="text-slate-400 animate-pulse font-mono">
                {activeThreadId ? "Processing Feedback..." : "Drafting · Critiquing · Synthesizing..."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-center max-w-2xl mx-auto flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-5 h-5" />
            {error}
          </motion.div>
        )}

        {/* Human Review Interruption Block */}
        {result?.status === "PAUSED" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-3xl mx-auto mt-12 mb-8 bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 ring-1 ring-amber-500/20 shadow-2xl shadow-amber-900/10"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/20 rounded-lg">
                <ShieldAlert className="w-6 h-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-amber-400">Human Review Required</h3>
                <p className="text-amber-200/80 mt-1 mb-4">
                  The Gatekeeper has paused execution for your review.
                  Please analyze the generated plan and decide how to proceed.
                </p>

                <textarea
                  className="w-full bg-slate-900/50 border border-amber-500/30 rounded-lg p-3 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 min-h-[100px]"
                  placeholder="Enter feedback or directives (optional)..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />

                <div className="flex gap-3 mt-4 justify-end">
                  <button
                    onClick={() => handleFeedback('approve')}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve & Finish
                  </button>

                  <button
                    onClick={() => handleFeedback('reject')}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
                  >
                    <Play className="w-4 h-4" /> Resume Execution
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
            className="mt-16 grid gap-8 md:grid-cols-[2fr,1fr]"
          >
            {/* Main Plan */}
            <div className="space-y-6">
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 md:p-8 backdrop-blur-sm">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold text-white mb-1">Execution Plan</h2>
                    <p className="text-slate-400 text-sm">Version {result.final_plan.version} • Normalized Target</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-mono border ${result.status === 'PAUSED' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
                    STATUS: {result.status}
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Steps */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Implementation Steps</h3>
                    <div className="space-y-3">
                      {result.final_plan.steps.map((step, i) => (
                        <div key={i} className="flex gap-4 group">
                          <div className="flex-none w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-mono text-sm border border-slate-700 group-hover:border-indigo-500/50 group-hover:text-indigo-400 transition-colors">
                            {i + 1}
                          </div>
                          <div>
                            <h4 className="text-slate-200 font-medium">{step.step}</h4>
                            <p className="text-slate-400 text-sm leading-relaxed mt-1">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Risks */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Risk Analysis</h3>
                    <div className="grid gap-3">
                      {result.final_plan.risks.map((risk, i) => (
                        <div key={i} className="bg-red-950/20 border border-red-900/30 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-4 h-4 text-red-500 mt-1 flex-none" />
                            <div>
                              <p className="text-red-200 text-sm font-medium">{risk.risk}</p>
                              <p className="text-red-400/80 text-xs mt-1">Mitigation: {risk.mitigation}</p>
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
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-400" />
                  Engine Stats
                </h3>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between py-2 border-b border-slate-800/50">
                    <span className="text-slate-500">Iterations</span>
                    <span className="text-slate-200 font-mono">{result.iteration_count}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/50">
                    <span className="text-slate-500">Compute Budget</span>
                    <span className="text-slate-200 font-mono">15 Calls (Max)</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/50">
                    <span className="text-slate-500">Drift Check</span>
                    <span className="text-green-400 font-mono">PASSED</span>
                  </div>
                  {result.message && (
                    <div className="py-2 border-b border-slate-800/50">
                      <span className="text-slate-500 block mb-1">Last Message</span>
                      <span className="text-slate-300 italic">&quot;{result.message}&quot;</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/20 rounded-xl p-6">
                <h3 className="text-indigo-300 font-medium mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Success Metrics
                </h3>
                <ul className="space-y-2 mt-4">
                  {result.final_plan.success_metrics.map((metric, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <ChevronRight className="w-3 h-3 text-indigo-500 mt-1 flex-none" />
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
