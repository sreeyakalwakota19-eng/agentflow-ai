"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkflowStore, Workflow } from "@/store/workflowStore";
import {
  ArrowLeft,
  Save,
  Copy,
  Loader2,
  Check,
  AlertCircle,
  GitBranch,
  Sparkles,
  X,
  Wand2,
} from "lucide-react";

export default function WorkflowToolbar() {
  const router = useRouter();
  const { currentWorkflow, isSaving, saveWorkflow, duplicateWorkflow, generateWorkflowAi, error } =
    useWorkflowStore();

  const [name, setName] = useState<string | null>(null);
  const [status, setStatus] = useState<Workflow["status"] | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // AI Prompt Modal State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const activeName = name !== null ? name : currentWorkflow?.name || "Untitled Workflow";
  const activeStatus = status !== null ? status : currentWorkflow?.status || "draft";

  const handleSave = async () => {
    setSavedSuccess(false);
    const result = await saveWorkflow({ name: activeName, status: activeStatus });
    if (result) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      if (!currentWorkflow?._id && result._id) {
        router.replace(`/workflows/builder?id=${result._id}`);
      }
    }
  };

  const handleDuplicate = async () => {
    if (!currentWorkflow?._id) return;
    const duplicated = await duplicateWorkflow(currentWorkflow._id);
    if (duplicated) {
      router.push(`/workflows/builder?id=${duplicated._id}`);
    }
  };

  const handleAiGenerate = async (promptToUse?: string) => {
    const prompt = promptToUse || aiPrompt;
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setAiError(null);

    const success = await generateWorkflowAi(prompt);
    setIsGenerating(false);

    if (success) {
      setShowAiModal(false);
      setAiPrompt("");
    } else {
      setAiError("Failed to generate workflow. Please refine your prompt.");
    }
  };

  const samplePrompts = [
    "Send an email notification when a new customer ticket is resolved",
    "Post alert to Slack #devops when deploy finishes",
    "Append form submissions data into Google Sheets",
    "Multi-step customer ticket: evaluate sentiment with AI, if urgent alert Slack else log to Sheets",
  ];

  const statusColors: Record<Workflow["status"], string> = {
    draft: "border-zinc-700 bg-zinc-800 text-zinc-300",
    active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    paused: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    archived: "border-red-500/30 bg-red-500/10 text-red-400",
  };

  return (
    <>
      <header className="relative z-20 flex h-14 w-full items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-4 backdrop-blur-md">
        {/* Left: Back & Name */}
        <div className="flex items-center gap-4">
          <Link
            href="/workflows"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Workflows</span>
          </Link>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={activeName}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workflow Name..."
              className="w-48 sm:w-64 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-bold text-white transition-colors hover:border-zinc-800 focus:border-indigo-500 focus:bg-zinc-900 focus:outline-none"
            />

            {currentWorkflow?.version && (
              <span className="hidden items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] font-mono text-zinc-400 sm:inline-flex">
                <GitBranch className="h-2.5 w-2.5" />
                v{currentWorkflow.version}
              </span>
            )}
          </div>
        </div>

        {/* Center: Save Feedback / Errors */}
        <div className="hidden md:flex items-center gap-2 text-xs">
          {savedSuccess && (
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium animate-fadeIn">
              <Check className="h-3.5 w-3.5" />
              Saved successfully
            </span>
          )}
          {error && (
            <span className="inline-flex items-center gap-1.5 text-red-400 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </span>
          )}
        </div>

        {/* Right: Status selector & Actions */}
        <div className="flex items-center gap-2.5">
          {/* AI Generator Button */}
          <button
            onClick={() => setShowAiModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-600/20 px-3 py-1.5 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-500/20 transition-all hover:bg-indigo-600/30 hover:text-white"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span className="hidden sm:inline">AI Generate</span>
          </button>

          <select
            value={activeStatus}
            onChange={(e) => setStatus(e.target.value as Workflow["status"])}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider capitalize focus:outline-none ${statusColors[activeStatus]}`}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>

          {currentWorkflow?._id && (
            <button
              onClick={handleDuplicate}
              title="Duplicate Workflow"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
            >
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Duplicate</span>
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-500 disabled:opacity-60"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Save</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* AI Generator Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 ring-1 ring-indigo-500/30">
                  <Wand2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">AI Workflow Generator</h3>
                  <p className="text-xs text-zinc-400">
                    Describe your automation goal in plain natural language
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAiModal(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {aiError && (
              <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Automation Prompt
              </label>
              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. When a support ticket comes in, analyze its sentiment with AI. If urgent send a Slack alert, else log it in Google Sheets."
                className="mt-1.5 block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Prompt suggestions */}
            <div className="mt-4">
              <span className="block text-[11px] font-semibold text-zinc-400">
                Try a quick example:
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {samplePrompts.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setAiPrompt(sample);
                      handleAiGenerate(sample);
                    }}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:border-indigo-500/50 hover:bg-indigo-600/10 hover:text-indigo-300 text-left"
                  >
                    ✨ {sample}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-zinc-800/80 pt-4">
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="rounded-lg px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isGenerating || !aiPrompt.trim()}
                onClick={() => handleAiGenerate()}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Compiling Workflow Graph...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Generate Graph</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
