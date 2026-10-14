"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/layout/AppShell";
import api from "@/lib/api";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  AlertOctagon,
  Clock,
  Pause,
  XCircle,
  RefreshCw,
} from "lucide-react";

interface ExecutionItem {
  _id: string;
  workflow: {
    _id: string;
    name: string;
    version: number;
  };
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "RETRYING" | "PAUSED" | "CANCELLED";
  durationMs: number;
  createdAt: string;
}

export default function ExecutionsListPage() {
  const router = useRouter();
  const [executions, setExecutions] = useState<ExecutionItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchExecutions() {
      setIsLoading(true);
      try {
        const res = await api.get<{ success: boolean; executions: ExecutionItem[] }>("/executions", {
          params: { status: statusFilter === "all" ? undefined : statusFilter },
        });
        if (res.data.success) {
          setExecutions(res.data.executions);
        }
      } catch (err) {
        console.error("Failed to load executions:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchExecutions();
  }, [statusFilter]);

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "COMPLETED":
        return {
          icon: <CheckCircle2 className="h-3 w-3" />,
          color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        };
      case "RUNNING":
      case "RETRYING":
        return {
          icon: <RefreshCw className="h-3 w-3 animate-spin" />,
          color: "border-indigo-500/30 bg-indigo-500/10 text-indigo-400",
        };
      case "FAILED":
        return {
          icon: <AlertOctagon className="h-3 w-3" />,
          color: "border-red-500/30 bg-red-500/10 text-red-400",
        };
      case "PAUSED":
        return {
          icon: <Pause className="h-3 w-3" />,
          color: "border-amber-500/30 bg-amber-500/10 text-amber-400",
        };
      case "CANCELLED":
        return {
          icon: <XCircle className="h-3 w-3" />,
          color: "border-zinc-700 bg-zinc-800 text-zinc-400",
        };
      default:
        return {
          icon: <Clock className="h-3 w-3" />,
          color: "border-zinc-700 bg-zinc-800 text-zinc-300",
        };
    }
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto w-full max-w-7xl px-6 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                <Activity className="h-6 w-6 text-indigo-400" />
                Execution Logs & History
              </h1>
              <p className="mt-0.5 text-xs text-zinc-400">
                Track live background agent runs, durations, and state transitions
              </p>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex rounded-lg border border-zinc-800 bg-zinc-900/80 p-0.5 text-xs">
              {["all", "running", "completed", "failed", "paused", "cancelled"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors ${
                    statusFilter === st
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Executions Table */}
          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-zinc-400">
                <RefreshCw className="mx-auto h-5 w-5 animate-spin text-indigo-400" />
                <span className="mt-2 block">Loading executions...</span>
              </div>
            ) : executions.length === 0 ? (
              <div className="p-12 text-center text-xs text-zinc-500">
                <Activity className="mx-auto h-8 w-8 text-zinc-600" />
                <p className="mt-2 font-semibold">No executions found</p>
                <p className="text-[11px]">Run a workflow to observe background agent executions.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/80">
                {executions.map((ex) => {
                  const badge = getStatusBadge(ex.status);
                  return (
                    <div
                      key={ex._id}
                      onClick={() => router.push(`/executions/${ex._id}`)}
                      className="group flex items-center justify-between p-4 transition-colors hover:bg-zinc-800/40 cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.color}`}
                        >
                          {badge.icon}
                          <span>{ex.status}</span>
                        </span>

                        <div>
                          <h4 className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">
                            {ex.workflow?.name || "Workflow Execution"}
                          </h4>
                          <span className="text-[10px] font-mono text-zinc-500">ID: {ex._id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-xs text-zinc-400">
                        <span className="font-mono text-[11px]">
                          {ex.durationMs ? `${ex.durationMs}ms` : "In progress"}
                        </span>
                        <span className="hidden sm:inline-block text-[11px]">
                          {new Date(ex.createdAt).toLocaleString()}
                        </span>
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600/10 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
