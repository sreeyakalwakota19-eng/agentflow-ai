"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/layout/AppShell";
import api from "@/lib/api";
import {
  GitFork,
  Activity,
  CheckCircle2,
  AlertOctagon,
  TrendingUp,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Clock,
  Boxes,
  Plus,
  Play,
  Bot,
  Compass,
} from "lucide-react";

interface DashboardStats {
  workflowCount: number;
  executionCount: number;
  successCount: number;
  failedCount: number;
  runningCount: number;
  successRate: number;
  recentExecutions: Array<{
    _id: string;
    status: string;
    workflow?: { name: string; version: number };
    durationMs?: number;
    createdAt: string;
  }>;
  failedExecutions: Array<{
    _id: string;
    workflow?: { name: string; version: number };
    error?: { message?: string; category?: string; explanation?: string };
    createdAt: string;
  }>;
  liveAgentActivity: Array<{
    _id: string;
    agent: string;
    event: string;
    level: string;
    nodeId?: string;
    timestamp: string;
  }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<{ success: boolean; stats: DashboardStats }>("/dashboard/stats");
      if (res.data.success) {
        setStats(res.data.stats);
      }
    } catch (err: unknown) {
      console.error("Failed to load dashboard metrics:", err);
      setError("Unable to connect to telemetry service. Please verify backend connectivity.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (isMounted) {
        await fetchStats();
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "COMPLETED":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
      case "RUNNING":
      case "RETRYING":
        return "border-indigo-500/30 bg-indigo-500/10 text-indigo-400 animate-pulse";
      case "FAILED":
        return "border-red-500/30 bg-red-500/10 text-red-400";
      default:
        return "border-zinc-700 bg-zinc-800 text-zinc-300";
    }
  };

  const getAgentColor = (agent: string) => {
    switch (agent) {
      case "PlannerAgent":
        return "text-purple-400 bg-purple-500/10 border-purple-500/20";
      case "ExecutionAgent":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "ValidationAgent":
        return "text-sky-400 bg-sky-500/10 border-sky-500/20";
      case "RecoveryAgent":
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "MonitoringAgent":
        return "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
      default:
        return "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
    }
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-7xl px-6 py-8">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                Operator Telemetry Dashboard
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Engine
                </span>
              </h1>
              <p className="mt-1 text-xs text-zinc-400">
                Multi-agent orchestration health, failure classification triage, and workflow metrics
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={fetchStats}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white transition-all"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-indigo-400" : ""}`} />
                <span>Refresh</span>
              </button>

              <Link
                href="/workflows/builder"
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Workflow</span>
              </Link>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-red-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={fetchStats}
                className="rounded-md bg-red-900/50 px-2.5 py-1 font-semibold text-red-200 hover:bg-red-900"
              >
                Retry
              </button>
            </div>
          )}

          {/* Metric KPI Cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Workflows Count */}
            <Link
              href="/workflows"
              className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 backdrop-blur-sm transition-all hover:border-zinc-700 hover:bg-zinc-900/80"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Workflows</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                  <GitFork className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                {isLoading ? (
                  <div className="h-8 w-16 bg-zinc-800 rounded animate-pulse" />
                ) : (
                  <span className="text-3xl font-black text-white">{stats?.workflowCount ?? 0}</span>
                )}
                <span className="text-xs text-zinc-500">defined DAGs</span>
              </div>
            </Link>

            {/* Total Executions */}
            <Link
              href="/executions"
              className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 backdrop-blur-sm transition-all hover:border-zinc-700 hover:bg-zinc-900/80"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total Executions</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
                  <Activity className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                {isLoading ? (
                  <div className="h-8 w-16 bg-zinc-800 rounded animate-pulse" />
                ) : (
                  <span className="text-3xl font-black text-white">{stats?.executionCount ?? 0}</span>
                )}
                <span className="text-xs text-zinc-500">runs orchestrated</span>
              </div>
            </Link>

            {/* Success Rate */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Success Rate</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                {isLoading ? (
                  <div className="h-8 w-20 bg-zinc-800 rounded animate-pulse" />
                ) : (
                  <span className="text-3xl font-black text-emerald-400">{stats?.successRate ?? 100}%</span>
                )}
                <span className="text-xs text-zinc-500">
                  ({stats?.successCount ?? 0} pass / {stats?.failedCount ?? 0} fail)
                </span>
              </div>
            </div>

            {/* Active Running Executions */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Active Pipeline</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                  <Play className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                {isLoading ? (
                  <div className="h-8 w-12 bg-zinc-800 rounded animate-pulse" />
                ) : (
                  <span className="text-3xl font-black text-purple-400">{stats?.runningCount ?? 0}</span>
                )}
                <span className="text-xs text-zinc-500">in-flight workers</span>
              </div>
            </div>
          </div>

          {/* Main Grid: 2 Columns */}
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left Column: Recent Executions & Failed Triage (7 Cols) */}
            <div className="space-y-6 lg:col-span-7">
              {/* Recent Executions */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-indigo-400" />
                    Recent Pipeline Executions
                  </h3>
                  <Link
                    href="/executions"
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <span>View all</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                {isLoading ? (
                  <div className="py-8 text-center text-xs text-zinc-400">Loading recent runs...</div>
                ) : (stats?.recentExecutions?.length ?? 0) === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-500">No executions recorded yet.</div>
                ) : (
                  <div className="divide-y divide-zinc-800/60 mt-2">
                    {stats?.recentExecutions.map((exec) => (
                      <div
                        key={exec._id}
                        onClick={() => router.push(`/executions/${exec._id}`)}
                        className="group flex items-center justify-between py-3 cursor-pointer hover:bg-zinc-800/20 px-2 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(
                              exec.status
                            )}`}
                          >
                            {exec.status}
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">
                              {exec.workflow?.name || "Workflow Execution"}
                            </h4>
                            <span className="text-[10px] font-mono text-zinc-500">ID: {exec._id}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-zinc-400">
                          <span className="font-mono text-[11px]">
                            {exec.durationMs ? `${exec.durationMs}ms` : "Active"}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Failed Executions Triage Box */}
              <div className="rounded-2xl border border-red-500/20 bg-red-950/10 p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-red-500/20 pb-3.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-2">
                    <AlertOctagon className="h-4 w-4 text-red-400" />
                    Failed Executions Triage
                  </h3>
                  <span className="text-[11px] font-mono text-red-400/80">
                    {stats?.failedExecutions?.length ?? 0} failures flagged
                  </span>
                </div>

                {(stats?.failedExecutions?.length ?? 0) === 0 ? (
                  <div className="py-6 text-center text-xs text-emerald-400 flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Clean bill of health! Zero recent failed executions.</span>
                  </div>
                ) : (
                  <div className="divide-y divide-red-500/10 mt-2 space-y-3">
                    {stats?.failedExecutions.map((fail) => (
                      <div
                        key={fail._id}
                        onClick={() => router.push(`/executions/${fail._id}`)}
                        className="pt-3 group cursor-pointer hover:bg-red-950/20 p-2 rounded-lg transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white group-hover:text-red-300">
                            {fail.workflow?.name || "Failed Execution"}
                          </span>
                          <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-red-300 uppercase">
                            {fail.error?.category || "ERROR"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-red-300/80">
                          {fail.error?.message || "Execution terminated unexpectedly."}
                        </p>
                        {fail.error?.explanation && (
                          <p className="mt-0.5 text-[11px] text-zinc-400">
                            Agent analysis: {fail.error.explanation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Live Agent Telemetry & Quick Actions (5 Cols) */}
            <div className="space-y-6 lg:col-span-5">
              {/* Quick Actions Card */}
              <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-indigo-950/30 via-zinc-900/50 to-zinc-950 p-5 backdrop-blur-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Quick Studio Actions
                </h3>

                <div className="mt-3.5 space-y-2.5">
                  <Link
                    href="/workflows/builder"
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 hover:border-indigo-500/40 hover:bg-indigo-600/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                        <Plus className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-indigo-400">
                          Design Workflow Canvas
                        </h4>
                        <p className="text-[10px] text-zinc-400">Drag & drop triggers, AI nodes, and actions</p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
                  </Link>

                  <Link
                    href="/integrations"
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 hover:border-cyan-500/40 hover:bg-cyan-600/10 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
                        <Boxes className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-cyan-400">
                          Manage Third-Party Integrations
                        </h4>
                        <p className="text-[10px] text-zinc-400">Gmail, Slack, Discord, Google Sheets OAuth</p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
                  </Link>
                </div>
              </div>

              {/* Live Agent Telemetry Feed */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 backdrop-blur-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Compass className="h-4 w-4 text-purple-400" />
                    Live Agent Telemetry Feed
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">Latest events</span>
                </h3>

                {isLoading ? (
                  <div className="py-8 text-center text-xs text-zinc-400">Streaming agent events...</div>
                ) : (stats?.liveAgentActivity?.length ?? 0) === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-500">
                    No recent agent events captured.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2.5">
                    {stats?.liveAgentActivity.map((log) => (
                      <div
                        key={log._id}
                        className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-2.5 text-xs transition-colors hover:border-zinc-700"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getAgentColor(
                              log.agent
                            )}`}
                          >
                            <Bot className="h-2.5 w-2.5" />
                            {log.agent}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="mt-1.5 font-bold text-white text-[11px]">{log.event}</p>
                        {log.nodeId && (
                          <span className="mt-1 inline-block rounded bg-zinc-800 px-1 py-0.2 text-[9px] font-mono text-zinc-400">
                            Node: {log.nodeId}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
