"use client";

import React, { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/layout/AppShell";
import api from "@/lib/api";
import {
  Boxes,
  Mail,
  MessageSquare,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  Play,
} from "lucide-react";

interface IntegrationProviderInfo {
  provider: "gmail" | "slack" | "discord" | "google_sheets";
  name: string;
  category: string;
  description: string;
  status: "connected" | "disconnected" | "expired" | "error";
  accountEmail?: string;
  lastConnectedAt?: string;
  availableActions: string[];
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationProviderInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [testModalProvider, setTestModalProvider] = useState<IntegrationProviderInfo | null>(null);
  const [testAction, setTestAction] = useState("");
  const [testParams, setTestParams] = useState("{\n  \"to\": \"test@example.com\",\n  \"subject\": \"Agentflow AI Integration Test\",\n  \"body\": \"This is an automated action test dispatched from the operator studio.\"\n}");
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [isExecutingTest, setIsExecutingTest] = useState(false);

  const fetchIntegrations = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ success: boolean; integrations: IntegrationProviderInfo[] }>(
        "/integrations"
      );
      if (res.data.success) {
        setIntegrations(res.data.integrations);
      }
    } catch (err) {
      console.error("Failed to load integrations:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (isMounted) {
        await fetchIntegrations();
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleConnect = async (provider: string) => {
    setActionLoading(provider);
    try {
      const res = await api.get<{ success: boolean; authUrl: string }>(
        `/integrations/oauth/${provider}/start`
      );
      if (res.data.success && res.data.authUrl) {
        window.location.assign(res.data.authUrl);
      }
    } catch (err) {
      console.error("Failed to start OAuth:", err);
      alert("Failed to initiate OAuth authorization for " + provider);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    if (!confirm(`Are you sure you want to disconnect ${provider}?`)) return;
    setActionLoading(provider);
    try {
      await api.post(`/integrations/${provider}/disconnect`);
      await fetchIntegrations();
    } catch (err) {
      console.error("Failed to disconnect:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleExecuteTest = async () => {
    if (!testModalProvider || !testAction) return;
    setIsExecutingTest(true);
    setTestResult(null);
    try {
      let parsed = {};
      try {
        parsed = JSON.parse(testParams);
      } catch {
        alert("Invalid JSON in parameters field");
        setIsExecutingTest(false);
        return;
      }

      const res = await api.post(`/integrations/${testModalProvider.provider}/execute`, {
        action: testAction,
        params: parsed,
      });

      setTestResult(res.data as Record<string, unknown>);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Execution error";
      setTestResult({ success: false, error: msg });
    } finally {
      setIsExecutingTest(false);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "gmail":
        return <Mail className="h-5 w-5 text-red-400" />;
      case "slack":
        return <MessageSquare className="h-5 w-5 text-emerald-400" />;
      case "discord":
        return <Zap className="h-5 w-5 text-indigo-400" />;
      case "google_sheets":
        return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />;
      default:
        return <Boxes className="h-5 w-5 text-zinc-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return {
          icon: <CheckCircle2 className="h-3 w-3" />,
          color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
          text: "Connected",
        };
      case "expired":
        return {
          icon: <AlertTriangle className="h-3 w-3" />,
          color: "border-amber-500/30 bg-amber-500/10 text-amber-400",
          text: "Token Expired",
        };
      case "error":
        return {
          icon: <XCircle className="h-3 w-3" />,
          color: "border-red-500/30 bg-red-500/10 text-red-400",
          text: "Config Error",
        };
      default:
        return {
          icon: <XCircle className="h-3 w-3" />,
          color: "border-zinc-700 bg-zinc-800 text-zinc-400",
          text: "Disconnected",
        };
    }
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-7xl px-6 py-8">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                External Service Integrations
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400">
                  <ShieldCheck className="h-3 w-3" />
                  AES-256-GCM Encrypted
                </span>
              </h1>
              <p className="mt-1 text-xs text-zinc-400">
                Connect external communication tools, databases, and OAuth providers for autonomous agent execution
              </p>
            </div>

            <button
              onClick={fetchIntegrations}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-indigo-400" : ""}`} />
              <span>Refresh Status</span>
            </button>
          </div>

          {/* Security Banner */}
          <div className="mt-6 rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-4 text-xs text-indigo-200/90 backdrop-blur-sm flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Zero-Knowledge Token Security Policy</p>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                Agentflow AI never requests or stores third-party passwords. All OAuth access and refresh tokens are hardware-encrypted with AES-256-GCM at rest and excluded from general database queries.
              </p>
            </div>
          </div>

          {/* Integration Provider Grid */}
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-56 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 animate-pulse" />
              ))
            ) : (
              integrations.map((item) => {
                const badge = getStatusBadge(item.status);
                const isBusy = actionLoading === item.provider;

                return (
                  <div
                    key={item.provider}
                    className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm transition-all hover:border-zinc-700"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800/80 border border-zinc-700/60">
                            {getProviderIcon(item.provider)}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                              {item.name}
                              <span className="text-[10px] font-mono text-zinc-500 uppercase">
                                ({item.category})
                              </span>
                            </h3>
                            {item.accountEmail && (
                              <p className="text-[11px] font-mono text-indigo-400 mt-0.5">
                                {item.accountEmail}
                              </p>
                            )}
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.color}`}
                        >
                          {badge.icon}
                          <span>{badge.text}</span>
                        </span>
                      </div>

                      <p className="mt-3 text-xs text-zinc-400">{item.description}</p>

                      {/* Supported Actions */}
                      <div className="mt-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          Supported Agent Actions:
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {item.availableActions.map((act) => (
                            <span
                              key={act}
                              className="rounded bg-zinc-800/80 px-2 py-0.5 text-[10px] font-mono text-zinc-300 border border-zinc-700/40"
                            >
                              {act}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-4">
                      {item.status === "connected" ? (
                        <div className="flex items-center gap-2 w-full justify-between">
                          <button
                            onClick={() => {
                              setTestModalProvider(item);
                              setTestAction(item.availableActions[0] || "");
                              setTestResult(null);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-400 hover:bg-indigo-500/20 transition-all"
                          >
                            <Play className="h-3 w-3" />
                            <span>Test Action</span>
                          </button>

                          <button
                            disabled={isBusy}
                            onClick={() => handleDisconnect(item.provider)}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:border-red-500/40 hover:text-red-400 transition-all"
                          >
                            <span>Disconnect</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled={isBusy}
                          onClick={() => handleConnect(item.provider)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 transition-all"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>{item.status === "expired" ? "Reconnect OAuth" : "Connect Provider"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Test Provider Modal */}
          {testModalProvider && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Play className="h-4 w-4 text-indigo-400" />
                    Test Execution: {testModalProvider.name}
                  </h3>
                  <button
                    onClick={() => setTestModalProvider(null)}
                    className="text-zinc-500 hover:text-white text-xs font-bold"
                  >
                    ✕ Close
                  </button>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Select Action
                  </label>
                  <select
                    value={testAction}
                    onChange={(e) => setTestAction(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {testModalProvider.availableActions.map((act) => (
                      <option key={act} value={act}>
                        {act}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Action Payload Parameters (JSON)
                  </label>
                  <textarea
                    rows={4}
                    value={testParams}
                    onChange={(e) => setTestParams(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-xs font-mono text-emerald-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {testResult && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Result Payload
                    </span>
                    <pre className="mt-1 max-h-36 overflow-auto text-[10px] font-mono text-zinc-300">
                      {JSON.stringify(testResult, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setTestModalProvider(null)}
                    className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isExecutingTest}
                    onClick={handleExecuteTest}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-500"
                  >
                    {isExecutingTest && <RefreshCw className="h-3 w-3 animate-spin" />}
                    <span>Dispatch Test</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
