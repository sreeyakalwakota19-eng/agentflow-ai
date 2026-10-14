import React, { memo } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { Zap } from "lucide-react";
import { NodeData } from "@/store/workflowStore";

export type CustomNode = Node<NodeData>;

function TriggerNodeComponent({ data, selected }: NodeProps<CustomNode>) {
  const nodeData = data;

  return (
    <div
      className={`group relative min-w-[220px] rounded-xl border bg-zinc-900/95 p-4 shadow-xl backdrop-blur-md transition-all ${
        selected
          ? "border-sky-500 ring-2 ring-sky-500/30 shadow-sky-500/10"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30">
          <Zap className="h-4 w-4" />
        </div>
        <div className="flex-1 overflow-hidden">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400">
            Trigger
          </span>
          <h4 className="truncate text-xs font-semibold text-white">
            {nodeData.label || "Start Event"}
          </h4>
        </div>
      </div>

      {nodeData.description && (
        <p className="mt-2 text-[11px] text-zinc-400 line-clamp-2">
          {nodeData.description}
        </p>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !bg-sky-500 !border-2 !border-zinc-900"
      />
    </div>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
export default TriggerNode;
