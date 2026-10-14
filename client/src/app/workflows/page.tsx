"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/layout/AppShell";
import { useWorkflowStore, Workflow } from "@/store/workflowStore";
import {
  Plus,
  Search,
  Copy,
  Trash2,
  Calendar,
  Layers,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  FolderOpen,
} from "lucide-react";

export default function WorkflowsListPage() {
  const router = useRouter();
  const {
    workflows,
    pagination,
    isLoading,
    fetchWorkflows,
    duplicateWorkflow,
    deleteWorkflow,
  } = useWorkflowStore();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchWorkflows({
      page,
      limit: 9,
      search: search.trim() || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
    });
  }, [fetchWorkflows, page, search, statusFilter]);

  const handleDuplicate = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    await duplicateWorkflow(id);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this workflow?")) {
      await deleteWorkflow(id);
    }
  };

  const statusStyles: Record<Workflow["status"], { border: string; bg: string; text: string }> = {
    draft: {
      border: "border-zinc-700",
      bg: "bg-zinc-800",
      text: "text-zinc-300",
    },
    active: {
      border: "border-emerald-500/30",
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
    },
    paused: {
      border: "border-amber-500/30",
      bg: "bg-amber-500/10",
      text: "text-amber-400",
    },
    archived: {
      border: "border-red-500/30",
      bg: "bg-red-500/10",
      text: "text-red-400",
    },
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto w-full max-w-7xl px-6 py-8">
          {/* Header & Filter Bar */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                <GitBranch className="h-6 w-6 text-indigo-400" />
                Workflows Studio
              </h1>
              <p className="mt-0.5 text-xs text-zinc-400">
                Manage, edit, and orchestrate your autonomous AI agent workflows
              </p>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search workflows..."
                  className="w-48 sm:w-60 rounded-lg border border-zinc-800 bg-zinc-900/90 py-1.5 pl-8 pr-3 text-xs text-white placeholder-zinc-500 transition-colors focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Status Tabs */}
              <div className="flex rounded-lg border border-zinc-800 bg-zinc-900/80 p-0.5 text-xs">
                {["all", "draft", "active", "paused", "archived"].map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setStatusFilter(st);
                      setPage(1);
                    }}
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

              <Link
                href="/workflows/builder"
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-500"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Workflow</span>
              </Link>
            </div>
          </div>

          {/* Workflow Cards Grid */}
          <div className="mt-8">
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-44 animate-pulse rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5"
                  />
                ))}
              </div>
            ) : workflows.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400 ring-1 ring-indigo-500/20">
                  <FolderOpen className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-white">
                  No workflows found
                </h3>
                <p className="mt-1 max-w-sm text-xs text-zinc-400">
                  {search || statusFilter !== "all"
                    ? "Try adjusting your search or status filters."
                    : "Create your first workflow to start orchestrating AI agents."}
                </p>
                <Link
                  href="/workflows/builder"
                  className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Build First Workflow</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {workflows.map((wf) => {
                  const style = statusStyles[wf.status] || statusStyles.draft;
                  const nodeCount = wf.nodes?.length || 0;
                  const edgeCount = wf.edges?.length || 0;

                  return (
                    <div
                      key={wf._id}
                      onClick={() => router.push(`/workflows/builder?id=${wf._id}`)}
                      className="group relative flex flex-col justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-sm transition-all hover:border-zinc-700 hover:bg-zinc-900/90 hover:shadow-xl hover:shadow-indigo-500/5 cursor-pointer"
                    >
                      <div>
                        {/* Top: Status and Version */}
                        <div className="flex items-center justify-between">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.border} ${style.bg} ${style.text}`}
                          >
                            {wf.status}
                          </span>

                          <span className="flex items-center gap-1 text-[11px] font-mono text-zinc-400">
                            <GitBranch className="h-3 w-3" />
                            v{wf.version || 1}
                          </span>
                        </div>

                        {/* Title & Description */}
                        <h3 className="mt-3 text-sm font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                          {wf.name}
                        </h3>

                        <p className="mt-1 text-xs text-zinc-400 line-clamp-2 min-h-[32px]">
                          {wf.description || "No description provided."}
                        </p>

                        {/* Tags */}
                        {wf.tags && wf.tags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {wf.tags.map((t, idx) => (
                              <span
                                key={idx}
                                className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Footer Stats & Actions */}
                      <div className="mt-5 border-t border-zinc-800/80 pt-3 flex items-center justify-between text-[11px] text-zinc-400">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Layers className="h-3 w-3 text-indigo-400" />
                            {nodeCount} {nodeCount === 1 ? "node" : "nodes"} ({edgeCount} edges)
                          </span>
                          <span className="hidden sm:inline-block">•</span>
                          <span className="hidden sm:flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(wf.updatedAt).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleDuplicate(e, wf._id)}
                            title="Duplicate Workflow"
                            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, wf._id)}
                            title="Delete Workflow"
                            className="rounded-md p-1.5 text-zinc-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <div className="ml-1 flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600/10 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                            <ArrowRight className="h-3 w-3" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between border-t border-zinc-800/80 pt-4 text-xs text-zinc-400">
              <span>
                Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-300 hover:border-zinc-700 hover:text-white disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-300 hover:border-zinc-700 hover:text-white disabled:opacity-40"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
