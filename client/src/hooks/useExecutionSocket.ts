"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getSocket } from "@/lib/socket";
import api from "@/lib/api";

export interface AgentEvent {
  _id?: string;
  execution: string;
  agent: "PlannerAgent" | "ExecutionAgent" | "ValidationAgent" | "RecoveryAgent" | "MonitoringAgent" | "Orchestrator";
  level: "info" | "warn" | "error" | "debug";
  event: string;
  nodeId?: string | null;
  nodeType?: string | null;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface StatusUpdate {
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "RETRYING" | "PAUSED" | "CANCELLED";
  durationMs?: number;
  completedAt?: string;
  error?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
}

export function useExecutionSocket(executionId: string | null) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [liveStatus, setLiveStatus] = useState<StatusUpdate["status"] | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  const seenEventKeys = useRef<Set<string>>(new Set());

  // Fetch initial logs via REST
  const fetchInitialLogs = useCallback(async () => {
    if (!executionId) return;
    try {
      const res = await api.get<{ success: boolean; logs: AgentEvent[] }>(`/executions/${executionId}/logs`);
      if (res.data.success && Array.isArray(res.data.logs)) {
        const initialLogs = res.data.logs;
        initialLogs.forEach((log) => {
          const key = `${log.timestamp}_${log.event}_${log.nodeId || ""}`;
          seenEventKeys.current.add(key);
        });
        setEvents(initialLogs);
      }
    } catch (err) {
      console.warn("Failed to fetch initial execution logs:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [executionId]);

  useEffect(() => {
    if (!executionId) return;

    // Load initial logs asynchronously without calling setState synchronously in effect body
    let isMounted = true;
    (async () => {
      if (isMounted) {
        await fetchInitialLogs();
      }
    })();

    const socket = getSocket();

    const onConnect = () => {
      setIsConnected(true);
      socket.emit("join_execution", executionId);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onAgentEvent = (eventData: AgentEvent) => {
      if (eventData.execution !== executionId && (eventData as unknown as { executionId: string }).executionId !== executionId) {
        return;
      }

      const key = `${eventData.timestamp}_${eventData.event}_${eventData.nodeId || ""}`;
      if (!seenEventKeys.current.has(key)) {
        seenEventKeys.current.add(key);
        setEvents((prev) => [...prev, eventData]);
      }
    };

    const onExecutionStatus = (statusData: StatusUpdate & { executionId: string }) => {
      if (statusData.executionId === executionId && statusData.status) {
        setLiveStatus(statusData.status);
      }
    };

    if (socket.connected) {
      socket.emit("join_execution", executionId);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("agent_event", onAgentEvent);
    socket.on("execution_status", onExecutionStatus);

    return () => {
      isMounted = false;
      socket.emit("leave_execution", executionId);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("agent_event", onAgentEvent);
      socket.off("execution_status", onExecutionStatus);
    };
  }, [executionId, fetchInitialLogs]);

  return {
    events,
    liveStatus,
    isConnected,
    isLoadingLogs,
    refetchLogs: fetchInitialLogs,
  };
}
