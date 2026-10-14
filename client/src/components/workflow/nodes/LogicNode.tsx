import React, { memo } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import { NodeData } from "@/store/workflowStore";

export type CustomNode = Node<NodeData>;

function LogicNodeComponent({ data, selected }: NodeProps<CustomNode>) {
  const nodeData = data;

  return (
    <div
      className={`group relative min-w-[220px] rounded-xl border bg-zinc-900/95 p-4 shadow-xl backdrop-blur-md transition-all ${
        selected
          ? "border-amber-500 ring-2 ring-amber-500/30 shadow-amber-500/10"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !bg-amber-500 !border-2 !border-zinc-900"
      />

      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30">
          <GitBranch className="h-4 w-4" />
        </div>
        <div className="flex-1 overflow-hidden">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
            Logic & Branch
          </span>
          <h4 className="truncate text-xs font-semibold text-white">
            {nodeData.label || "Condition Evaluator"}
          </h4>
        </div>
      </div>

      {nodeData.description && (
        <p className="mt-2 text-[11px] text-zinc-400 line-clamp-2">
          {nodeData.description}
        </p>
      )}

      {/* Output handles for True / False branches */}
      <div className="mt-3 flex items-center justify-between border-t border-zinc-800/80 pt-2 text-[10px] font-semibold text-zinc-400">
        <span className="text-emerald-400">True (Pass)</span>
        <span className="text-rose-400">False (Fail)</span>
      </div>

      <Handle
        type="source"
        id="true"
        position={Position.Right}
        style={{ top: "45%" }}
        className="!h-3 !w-3 !bg-emerald-500 !border-2 !border-zinc-900"
      />
      <Handle
        type="source"
        id="false"
        position={Position.Right}
        style={{ top: "80%" }}
        className="!h-3 !w-3 !bg-rose-500 !border-2 !border-zinc-900"
      />
    </div>
  );
}

export const LogicNode = memo(LogicNodeComponent);
export default LogicNode;
