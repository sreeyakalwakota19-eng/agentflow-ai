"use client";

import React, { useEffect } from "react";
import { useParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useWorkflowStore } from "@/store/workflowStore";
import WorkflowToolbar from "@/components/workflow/WorkflowToolbar";
import NodePalette from "@/components/workflow/NodePalette";
import WorkflowCanvas from "@/components/workflow/WorkflowCanvas";
import NodeConfigPanel from "@/components/workflow/NodeConfigPanel";
import { Loader2 } from "lucide-react";

export default function WorkflowDetailPage() {
  const params = useParams();
  const workflowId = params.id as string;
  const { fetchWorkflowById, isLoading } = useWorkflowStore();

  useEffect(() => {
    if (workflowId) {
      fetchWorkflowById(workflowId);
    }
  }, [workflowId, fetchWorkflowById]);

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
    <ProtectedRoute>
      <div className="flex h-screen w-full flex-col overflow-hidden bg-zinc-950 text-zinc-100">
        <WorkflowToolbar />
        <div className="relative flex flex-1 overflow-hidden">
          <NodePalette />
          <div className="relative flex-1">
            <WorkflowCanvas />
          </div>
          <NodeConfigPanel />
        </div>
      </div>
    </ProtectedRoute>
  );
}
