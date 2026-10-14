"use client";

import React, { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useWorkflowStore } from "@/store/workflowStore";
import WorkflowToolbar from "@/components/workflow/WorkflowToolbar";
import NodePalette from "@/components/workflow/NodePalette";
import WorkflowCanvas from "@/components/workflow/WorkflowCanvas";
import NodeConfigPanel from "@/components/workflow/NodeConfigPanel";
import { Loader2 } from "lucide-react";

function BuilderContent() {
  const searchParams = useSearchParams();
  const workflowId = searchParams.get("id");
  const { fetchWorkflowById, resetBuilder, isLoading } = useWorkflowStore();

  useEffect(() => {
    if (workflowId) {
      fetchWorkflowById(workflowId);
    } else {
      resetBuilder();
    }
  }, [workflowId, fetchWorkflowById, resetBuilder]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
          <p className="text-xs font-semibold text-zinc-400">Loading workflow graph...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Top Toolbar */}
      <WorkflowToolbar />

      {/* Main Workspace: Palette (Left), Canvas (Center), Config (Right) */}
      <div className="relative flex flex-1 overflow-hidden">
        <NodePalette />
        <div className="relative flex-1">
          <WorkflowCanvas />
        </div>
        <NodeConfigPanel />
      </div>
    </div>
  );
}

export default function WorkflowBuilderPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center bg-zinc-950">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        }
      >
        <BuilderContent />
      </Suspense>
    </ProtectedRoute>
  );
}
