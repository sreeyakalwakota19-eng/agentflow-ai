"use client";

import React from "react";
import { Zap, Play, Bot, GitBranch, Plus } from "lucide-react";
import { useWorkflowStore } from "@/store/workflowStore";

export default function NodePalette() {
  const { addNode } = useWorkflowStore();

  const paletteItems = [
    {
      type: "trigger" as const,
      title: "Trigger",
      description: "Start workflow on event or webhook",
      icon: Zap,
      color: "text-sky-400 bg-sky-500/10 border-sky-500/20 hover:border-sky-500/50",
    },
    {
      type: "action" as const,
      title: "Action",
      description: "Execute task, send email or message",
      icon: Play,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/50",
    },
    {
      type: "ai" as const,
      title: "AI Agent",
      description: "Process prompt with LLM reasoning",
      icon: Bot,
      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20 hover:border-indigo-500/50",
    },
    {
      type: "logic" as const,
      title: "Logic Branch",
      description: "Evaluate condition and branch flow",
      icon: GitBranch,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20 hover:border-amber-500/50",
    },
  ];

  const onDragStart = (event: React.DragEvent, nodeType: "trigger" | "action" | "ai" | "logic") => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-zinc-800 bg-zinc-950/80 p-4 backdrop-blur-md">
      <div className="mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Node Palette
        </h3>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Drag to canvas or click to add
        </p>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
        {paletteItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => onDragStart(e, item.type)}
              onClick={() => addNode(item.type)}
              className={`group flex cursor-grab items-start gap-3 rounded-xl border p-3 transition-all hover:scale-[1.02] active:cursor-grabbing ${item.color}`}
            >
              <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-900 ring-1 ring-zinc-800">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-white group-hover:text-zinc-100">
                    {item.title}
                  </h4>
                  <Plus className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="mt-0.5 text-[10px] text-zinc-400 line-clamp-2 leading-tight">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
