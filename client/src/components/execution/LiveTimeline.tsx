"use client";

import React, { useState } from "react";
import { AgentEvent } from "@/hooks/useExecutionSocket";
import {
  Activity,
  Bot,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Compass,
  Radio,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  Terminal,
} from "lucide-react";

interface LiveTimelineProps {
  events: AgentEvent[];
  isConnected: boolean;
  isLoading: boolean;
}

export default function LiveTimeline({ events, isConnected, isLoading }: LiveTimelineProps) {
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>("all");
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({});

  const toggleExpand = (idx: number) => {
    setExpandedIndices((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const filteredEvents = events.filter((ev) => {
    if (selectedAgentFilter === "all") return true;
    return ev.agent?.toLowerCase().includes(selectedAgentFilter.toLowerCase());
  });

  const getAgentBadge = (agent: string) => {
    switch (agent) {
      case "PlannerAgent":
        return {
          icon: <Compass className="h-3 w-3" />,
          color: "bg-purple-500/10 text-purple-400 border-purple-500/30",
          name: "Planner",
        };
      case "ExecutionAgent":
        return {
          icon: <Play className="h-3 w-3" />,
          color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          name: "Execution",
        };
      case "ValidationAgent":
        return {
          icon: <CheckCircle2 className="h-3 w-3" />,
          color: "bg-sky-500/10 text-sky-400 border-sky-500/30",
          name: "Validation",
        };
      case "RecoveryAgent":
        return {
          icon: <RefreshCw className="h-3 w-3" />,
          color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
          name: "Recovery",
        };
      case "MonitoringAgent":
        return {
          icon: <Activity className="h-3 w-3" />,
          color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
          name: "Monitoring",
        };
      default:
        return {
          icon: <Bot className="h-3 w-3" />,
          color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
          name: agent || "Orchestrator",
        };
    }
  };

  const getEventLevelStyle = (level: string) => {
    switch (level) {
      case "error":
        return "border-red-500/40 bg-red-950/20 text-red-400";
      case "warn":
        return "border-amber-500/40 bg-amber-950/20 text-amber-400";
      default:
        return "border-zinc-800 bg-zinc-900/60 text-zinc-300";
    }
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-zinc-950/80 shadow-2xl backdrop-blur-xl">
      {/* Header with Realtime status */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-800/80 px-5 py-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 ring-1 ring-indigo-500/30">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Live Agent Execution Timeline
              <span className="text-[11px] font-mono text-zinc-400">({events.length} events)</span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Streaming five-agent events in real-time via authenticated Socket.IO
            </p>
          </div>
        </div>

        {/* Realtime WebSocket Connection Badge */}
        <div className="flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
              isConnected
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/30 bg-amber-500/10 text-amber-400"
            }`}
          >
            <Radio className={`h-3 w-3 ${isConnected ? "animate-pulse text-emerald-400" : "text-amber-400"}`} />
            <span>{isConnected ? "Live Socket.IO Stream" : "Reconnecting Socket..."}</span>
          </div>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex items-center gap-1.5 border-b border-zinc-800/60 bg-zinc-900/40 px-5 py-2 overflow-x-auto text-[11px]">
        {["all", "planner", "execution", "validation", "recovery", "monitoring"].map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedAgentFilter(filter)}
            className={`rounded-md px-2.5 py-1 font-semibold capitalize transition-colors ${
              selectedAgentFilter === filter
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Timeline Events Scroll Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3 font-sans">
        {isLoading && events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
            <span className="mt-3 text-xs text-zinc-400">Loading timeline events...</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-500">
            <Terminal className="h-8 w-8 text-zinc-600" />
            <p className="mt-2 text-xs font-semibold">No timeline events recorded yet</p>
            <p className="text-[11px]">Events will appear live as agents begin processing the workflow.</p>
          </div>
        ) : (
          filteredEvents.map((ev, idx) => {
            const badge = getAgentBadge(ev.agent);
            const isExpanded = Boolean(expandedIndices[idx]);
            const isError = ev.level === "error";
            const isWarn = ev.level === "warn";

            return (
              <div
                key={idx}
                className={`relative rounded-xl border p-3.5 transition-all hover:border-zinc-700 ${getEventLevelStyle(
                  ev.level
                )}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {/* Agent Attribution Badge */}
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.color}`}
                    >
                      {badge.icon}
                      <span>{badge.name}</span>
                    </span>

                    {/* Event Name */}
                    <span className="text-xs font-bold text-white">{ev.event}</span>

                    {ev.nodeId && (
                      <span className="inline-flex items-center gap-1 rounded bg-zinc-800/90 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                        <Layers className="h-2.5 w-2.5 text-indigo-400" />
                        {ev.nodeId}
                      </span>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
                    <Clock className="h-2.5 w-2.5" />
                    <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Event Summary / Description */}
                {ev.data && Object.keys(ev.data).length > 0 && (
                  <div className="mt-2 text-xs">
                    {isError && Boolean(ev.data.error || ev.data.reason) ? (
                      <div className="flex items-center gap-1.5 text-red-400 font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>
                          {String(
                            ev.data.reason ||
                              (ev.data.error as { message?: string })?.message ||
                              JSON.stringify(ev.data.error)
                          )}
                        </span>
                      </div>
                    ) : null}

                    {isWarn && Boolean(ev.data.explanation) ? (
                      <div className="text-amber-400 font-medium">{String(ev.data.explanation)}</div>
                    ) : null}

                    {/* Expandable JSON Detail Toggle */}
                    <button
                      onClick={() => toggleExpand(idx)}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <span>{isExpanded ? "Hide Payload Data" : "Inspect Event Data"}</span>
                    </button>

                    {isExpanded && (
                      <pre className="mt-2 max-h-48 overflow-x-auto rounded-lg bg-zinc-950 p-2.5 text-[10px] font-mono text-zinc-300 ring-1 ring-zinc-800">
                        {JSON.stringify(ev.data, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
