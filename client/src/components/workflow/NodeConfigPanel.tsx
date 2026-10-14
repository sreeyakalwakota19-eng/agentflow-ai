"use client";

import React from "react";
import { useWorkflowStore } from "@/store/workflowStore";
import { X, Trash2, Sliders, Zap, Play, Bot, GitBranch } from "lucide-react";

export default function NodeConfigPanel() {
  const { nodes, selectedNodeId, selectNode, updateNodeData, deleteNode } = useWorkflowStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (!selectedNode) {
    return null;
  }

  const { data } = selectedNode;
  const config = (data.config || {}) as Record<string, string>;

  const getIcon = () => {
    switch (selectedNode.type) {
      case "trigger":
        return <Zap className="h-4 w-4 text-sky-400" />;
      case "action":
        return <Play className="h-4 w-4 text-emerald-400" />;
      case "ai":
        return <Bot className="h-4 w-4 text-indigo-400" />;
      case "logic":
        return <GitBranch className="h-4 w-4 text-amber-400" />;
      default:
        return <Sliders className="h-4 w-4 text-zinc-400" />;
    }
  };

  return (
    <div className="flex h-full w-80 flex-col border-l border-zinc-800 bg-zinc-950/90 p-5 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 ring-1 ring-zinc-800">
            {getIcon()}
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Node Settings
            </h3>
            <p className="text-[10px] text-zinc-400 capitalize">
              {selectedNode.type} Node
            </p>
          </div>
        </div>

        <button
          onClick={() => selectNode(null)}
          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Form Fields */}
      <div className="flex-1 space-y-4 overflow-y-auto py-4 pr-1 text-xs">
        {/* Label */}
        <div>
          <label className="block font-semibold text-zinc-300">Node Label</label>
          <input
            type="text"
            value={data.label || ""}
            onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900/90 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="e.g. Ingest User Feedback"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block font-semibold text-zinc-300">Description</label>
          <textarea
            rows={2}
            value={data.description || ""}
            onChange={(e) => updateNodeData(selectedNode.id, { description: e.target.value })}
            className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900/90 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Describe what this step does..."
          />
        </div>

        {/* Type-Specific Configurations */}
        {selectedNode.type === "trigger" && (
          <div className="space-y-3 border-t border-zinc-800/80 pt-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
              Trigger Options
            </h4>
            <div>
              <label className="block font-semibold text-zinc-300">Trigger Mode</label>
              <select
                value={config.triggerType || "manual"}
                onChange={(e) =>
                  updateNodeData(selectedNode.id, {
                    config: { ...config, triggerType: e.target.value },
                  })
                }
                className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              >
                <option value="manual">Manual Kickoff</option>
                <option value="webhook">Webhook HTTP Post</option>
                <option value="schedule">Cron Schedule</option>
              </select>
            </div>
          </div>
        )}

        {selectedNode.type === "action" && (
          <div className="space-y-3 border-t border-zinc-800/80 pt-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Action Options
            </h4>
            <div>
              <label className="block font-semibold text-zinc-300">Action Service</label>
              <select
                value={config.service || "email"}
                onChange={(e) =>
                  updateNodeData(selectedNode.id, {
                    config: { ...config, service: e.target.value },
                  })
                }
                className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="email">Send Gmail / Email</option>
                <option value="slack">Post to Slack Channel</option>
                <option value="discord">Post to Discord Webhook</option>
                <option value="sheets">Append to Google Sheets</option>
              </select>
            </div>
          </div>
        )}

        {selectedNode.type === "ai" && (
          <div className="space-y-3 border-t border-zinc-800/80 pt-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
              AI Agent Reasoning
            </h4>
            <div>
              <label className="block font-semibold text-zinc-300">Model Provider</label>
              <select
                value={config.model || "openrouter/auto"}
                onChange={(e) =>
                  updateNodeData(selectedNode.id, {
                    config: { ...config, model: e.target.value },
                  })
                }
                className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="openrouter/auto">OpenRouter (Default Router)</option>
                <option value="gemini-1.5-pro">Google Gemini 1.5 Pro</option>
                <option value="rule-based">Deterministic Rule Engine</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-zinc-300">Prompt Instructions</label>
              <textarea
                rows={3}
                value={config.prompt || ""}
                onChange={(e) =>
                  updateNodeData(selectedNode.id, {
                    config: { ...config, prompt: e.target.value },
                  })
                }
                className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                placeholder="Analyze input and extract structured json..."
              />
            </div>
          </div>
        )}

        {selectedNode.type === "logic" && (
          <div className="space-y-3 border-t border-zinc-800/80 pt-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Condition Check
            </h4>
            <div>
              <label className="block font-semibold text-zinc-300">Evaluation Operator</label>
              <select
                value={config.operator || "equals"}
                onChange={(e) =>
                  updateNodeData(selectedNode.id, {
                    config: { ...config, operator: e.target.value },
                  })
                }
                className="mt-1.5 block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="equals">Equals (==)</option>
                <option value="contains">Contains substring</option>
                <option value="greater_than">Greater Than (&gt;)</option>
                <option value="is_empty">Is Empty / Null</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Delete Node Button */}
      <div className="border-t border-zinc-800/80 pt-3">
        <button
          onClick={() => deleteNode(selectedNode.id)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Delete Node</span>
        </button>
      </div>
    </div>
  );
}
