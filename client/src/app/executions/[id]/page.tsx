"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import LiveTimeline from "@/components/execution/LiveTimeline";
import { useExecutionSocket } from "@/hooks/useExecutionSocket";
import api from "@/lib/api";
import {
  ArrowLeft,
  Play,
  Pause,
  XCircle,
  RotateCcw,
  CheckCircle2,
  AlertOctagon,
  Clock,
  RefreshCw,
  GitBranch,
} from "lucide-react";

interface ExecutionDetail {
  _id: string;
  workflow: {
    _id: string;
    name: string;
    version: number;
  };
  workflowSnapshot: {
    name: string;
    description: string;
    nodes: Array<{ id: string; type: string; data?: { label?: string } }>;
    edges: Array<{ id: string; source: string; target: string }>;
  };
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "RETRYING" | "PAUSED" | "CANCELLED";
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  error?: {
    message?: string;
    category?: string;
    explanation?: string;
  };
  plan?: {
    confidenceScore?: number;
    executionOrder?: string[];
  };
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export default function ExecutionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const executionId = resolvedParams.id;
  const router = useRouter();

  const [execution, setExecution] = useState<ExecutionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const { events, liveStatus, isConnected, isLoadingLogs } = useExecutionSocket(executionId);

  const currentStatus = liveStatus || execution?.status || "PENDING";

  useEffect(() => {
    async function fetchExecution() {
      try {
        const res = await api.get<{ success: boolean; execution: ExecutionDetail }>(
          `/executions/${executionId}`
        );
        if (res.data.success) {
          setExecution(res.data.execution);
        }
      } catch (err) {
        console.error("Failed to load execution detail:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchExecution();
  }, [executionId]);

  const handlePause = async () => {
    setIsActionLoading(true);
    try {
      await api.post(`/executions/${executionId}/pause`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResume = async () => {
    setIsActionLoading(true);
    try {
      await api.post(`/executions/${executionId}/resume`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this execution?")) return;
    setIsActionLoading(true);
    try {
      await api.post(`/executions/${executionId}/cancel`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!execution?.workflow?._id) return;
    setIsActionLoading(true);
    try {
      const res = await api.post<{ success: boolean; execution: { _id: string } }>("/executions", {
        workflowId: execution.workflow._id,
        inputs: execution.inputs || {},
      });
      if (res.data.success && res.data.execution?._id) {
        router.push(`/executions/${res.data.execution._id}`);
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "COMPLETED":
        return {
          icon: <CheckCircle2 className="h-3.5 w-3.5" />,
          color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        };
      case "RUNNING":
      case "RETRYING":
        return {
          icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" />,
          color: "border-indigo-500/30 bg-indigo-500/10 text-indigo-400",
        };
      case "FAILED":
        return {
          icon: <AlertOctagon className="h-3.5 w-3.5" />,
          color: "border-red-500/30 bg-red-500/10 text-red-400",
        };
      case "PAUSED":
        return {
          icon: <Pause className="h-3.5 w-3.5" />,
          color: "border-amber-500/30 bg-amber-500/10 text-amber-400",
        };
      case "CANCELLED":
        return {
          icon: <XCircle className="h-3.5 w-3.5" />,
          color: "border-zinc-700 bg-zinc-800 text-zinc-400",
        };
      default:
        return {
          icon: <Clock className="h-3.5 w-3.5" />,
          color: "border-zinc-700 bg-zinc-800 text-zinc-300",
        };
    }
  };

  const badge = getStatusBadge(currentStatus);

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 selection:bg-indigo-500 selection:text-white">
        {/* Navigation Header */}
        <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/80 px-6 py-3.5 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/workflows"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Workflows</span>
              </Link>

              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">
                  {execution?.workflowSnapshot?.name || "Workflow Execution"}
                </h2>
                <span className="text-zinc-600">•</span>
                <span className="font-mono text-xs text-zinc-400">{executionId}</span>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${badge.color}`}
              >
                {badge.icon}
                <span>{currentStatus}</span>
              </span>

              {currentStatus === "RUNNING" && (
                <button
                  disabled={isActionLoading}
                  onClick={handlePause}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10"
                >
                  <Pause className="h-3 w-3" />
                  <span>Pause</span>
                </button>
              )}

              {currentStatus === "PAUSED" && (
                <button
                  disabled={isActionLoading}
                  onClick={handleResume}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20"
                >
                  <Play className="h-3 w-3" />
                  <span>Resume</span>
                </button>
              )}

              {(currentStatus === "RUNNING" || currentStatus === "PAUSED") && (
                <button
                  disabled={isActionLoading}
                  onClick={handleCancel}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:border-red-500/50 hover:text-red-400"
                >
                  <XCircle className="h-3 w-3" />
                  <span>Cancel</span>
                </button>
              )}

              {(currentStatus === "COMPLETED" || currentStatus === "FAILED" || currentStatus === "CANCELLED") && (
                <button
                  disabled={isActionLoading}
                  onClick={handleRetry}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Re-run Execution</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Layout */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">
          {isLoading ? (
            <div className="flex h-96 items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: Metadata & Snapshot (5 Cols) */}
              <div className="space-y-5 lg:col-span-5">
                {/* Overview Card */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Execution Snapshot
                  </h3>

                  <h1 className="mt-2 text-lg font-extrabold text-white">
                    {execution?.workflowSnapshot?.name || "Workflow"}
                  </h1>
                  <p className="mt-1 text-xs text-zinc-400">
                    {execution?.workflowSnapshot?.description || "No description provided."}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-800/80 pt-4 text-xs">
                    <div>
                      <span className="text-[11px] text-zinc-500">Started At</span>
                      <p className="font-mono text-zinc-300">
                        {execution?.startedAt ? new Date(execution.startedAt).toLocaleTimeString() : "Pending"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] text-zinc-500">Duration</span>
                      <p className="font-mono text-zinc-300">
                        {execution?.durationMs ? `${execution.durationMs}ms` : "In progress..."}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] text-zinc-500">Graph Version</span>
                      <p className="flex items-center gap-1 font-mono text-zinc-300">
                        <GitBranch className="h-3 w-3 text-indigo-400" />
                        v{execution?.workflow?.version || 1}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] text-zinc-500">Planner Confidence</span>
                      <p className="font-mono text-emerald-400 font-bold">
                        {execution?.plan?.confidenceScore
                          ? `${Math.round(execution.plan.confidenceScore * 100)}%`
                          : "Calculating..."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Error Callout Card if Failed */}
                {execution?.error && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-5">
                    <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                      <AlertOctagon className="h-4 w-4 flex-shrink-0" />
                      <span>Execution Escalated & Terminated</span>
                    </div>
                    <p className="mt-2 text-xs text-red-300">
                      {execution.error.message || "An unrecoverable error halted the pipeline."}
                    </p>
                    {execution.error.explanation && (
                      <p className="mt-1 text-[11px] text-red-400/80">
                        Recovery explanation: {execution.error.explanation}
                      </p>
                    )}
                  </div>
                )}

                {/* Execution Outputs */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Execution Output Payload
                  </h4>
                  <pre className="mt-2.5 max-h-60 overflow-auto rounded-xl bg-zinc-950 p-3.5 text-xs font-mono text-emerald-400 ring-1 ring-zinc-800">
                    {JSON.stringify(execution?.outputs || {}, null, 2)}
                  </pre>
                </div>

                {/* Execution Inputs */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Input Parameters
                  </h4>
                  <pre className="mt-2.5 max-h-48 overflow-auto rounded-xl bg-zinc-950 p-3.5 text-xs font-mono text-zinc-300 ring-1 ring-zinc-800">
                    {JSON.stringify(execution?.inputs || {}, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Right Column: LiveTimeline Component (7 Cols) */}
              <div className="h-[750px] lg:col-span-7">
                <LiveTimeline events={events} isConnected={isConnected} isLoading={isLoadingLogs} />
              </div>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
