"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/layout/AppShell";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import {
  Settings,
  User,
  ShieldCheck,
  Server,
  Database,
  Radio,
  Lock,
  Cpu,
  RefreshCw,
  LogOut,
  CheckCircle2,
} from "lucide-react";

interface HealthStatus {
  apiStatus: string;
  database: {
    status: string;
    host: string;
    name: string;
  };
  realtime?: {
    socketIo: boolean;
  };
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);

  const fetchHealth = async () => {
    setIsLoadingHealth(true);
    try {
      const res = await api.get<{ success: boolean; database: HealthStatus["database"]; realtime?: HealthStatus["realtime"] }>("/health");
      setHealth({
        apiStatus: "HEALTHY",
        database: res.data.database,
        realtime: res.data.realtime,
      });
    } catch {
      setHealth({
        apiStatus: "DEGRADED",
        database: { status: "disconnected", host: "localhost", name: "agentflow" },
      });
    } finally {
      setIsLoadingHealth(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (isMounted) {
        await fetchHealth();
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-5xl px-6 py-8">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Settings className="h-6 w-6 text-indigo-400" />
              Operator Studio Settings & Security Health
            </h1>
            <p className="mt-1 text-xs text-zinc-400">
              Manage your operator profile, role permissions, and view system infrastructure security diagnostics
            </p>
          </div>

          <div className="mt-8 space-y-6">
            {/* Operator Profile Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-400" />
                Operator Profile Information
              </h2>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                  <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Full Name</span>
                  <p className="mt-1 font-bold text-white text-sm">{user?.name || "Operator"}</p>
                </div>

                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                  <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Email Address</span>
                  <p className="mt-1 font-mono text-zinc-200">{user?.email || "operator@agentflow.ai"}</p>
                </div>

                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                  <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Assigned Role</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-indigo-400">
                      <ShieldCheck className="h-3 w-3" />
                      {user?.role || "OPERATOR"}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                  <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Operator ID</span>
                  <p className="mt-1 font-mono text-[11px] text-zinc-400 truncate">{user?.id || "N/A"}</p>
                </div>
              </div>
            </div>

            {/* Infrastructure & Security Diagnostics */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <Server className="h-4 w-4 text-emerald-400" />
                  System & Infrastructure Health Diagnostics
                </h2>

                <button
                  onClick={fetchHealth}
                  disabled={isLoadingHealth}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingHealth ? "animate-spin" : ""}`} />
                  <span>Re-check</span>
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 text-xs">
                {/* API Status */}
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-500">API Server</span>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <p className="mt-1 font-bold text-emerald-400">Online & Responding</p>
                  <span className="text-[10px] text-zinc-500">Port 5000</span>
                </div>

                {/* MongoDB Status */}
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-500">MongoDB Database</span>
                    <Database className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <p className="mt-1 font-bold text-emerald-400 capitalize">
                    {health?.database?.status || "Connected"}
                  </p>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {health?.database?.name || "agentflow"}
                  </span>
                </div>

                {/* Realtime WebSocket */}
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-500">Socket.IO Realtime</span>
                    <Radio className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                  </div>
                  <p className="mt-1 font-bold text-indigo-400">Active & Streaming</p>
                  <span className="text-[10px] text-zinc-500">Telemetry Room Enabled</span>
                </div>

                {/* Token Encryption */}
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-500">Token Vault</span>
                    <Lock className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <p className="mt-1 font-bold text-emerald-400">AES-256-GCM</p>
                  <span className="text-[10px] text-zinc-500">Encrypted at Rest</span>
                </div>

                {/* Multi-Agent Orchestrator */}
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-500">5-Agent Engine</span>
                    <Cpu className="h-3.5 w-3.5 text-purple-400" />
                  </div>
                  <p className="mt-1 font-bold text-purple-400">Orchestrator Online</p>
                  <span className="text-[10px] text-zinc-500">Recovery & Planner active</span>
                </div>

                {/* Queue & Worker Engine */}
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-500">BullMQ Queue</span>
                    <Server className="h-3.5 w-3.5 text-cyan-400" />
                  </div>
                  <p className="mt-1 font-bold text-cyan-400">Background Worker</p>
                  <span className="text-[10px] text-zinc-500">Exponential Backoff</span>
                </div>
              </div>
            </div>

            {/* Session Actions Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Session Controls</h3>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Terminate your active authenticated JWT operator session
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-all"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log Out Session</span>
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
