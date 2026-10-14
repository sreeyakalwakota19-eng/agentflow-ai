import { create } from "zustand";
import {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
} from "@xyflow/react";
import api from "@/lib/api";

export interface Workflow {
  _id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "paused" | "archived";
  triggerConfig: Record<string, unknown>;
  nodes: Node[];
  edges: Edge[];
  version: number;
  tags: string[];
  owner?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface NodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  type: "trigger" | "action" | "ai" | "logic";
  config?: Record<string, unknown>;
}

interface WorkflowState {
  workflows: Workflow[];
  pagination: Pagination | null;
  currentWorkflow: Workflow | null;

  // React Flow graph state
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;

  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Workflow API Actions
  fetchWorkflows: (params?: { page?: number; limit?: number; search?: string; status?: string }) => Promise<void>;
  fetchWorkflowById: (id: string) => Promise<Workflow | null>;
  saveWorkflow: (metadata?: { name?: string; description?: string; status?: Workflow["status"]; tags?: string[] }) => Promise<Workflow | null>;
  duplicateWorkflow: (id: string) => Promise<Workflow | null>;
  deleteWorkflow: (id: string) => Promise<boolean>;
  generateWorkflowAi: (prompt: string) => Promise<boolean>;

  // Graph state actions
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: OnNodesChange<Node<NodeData>>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (type: "trigger" | "action" | "ai" | "logic", position?: { x: number; y: number }) => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  deleteNode: (nodeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  resetBuilder: (workflow?: Workflow | null) => void;
  clearError: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: [],
  pagination: null,
  currentWorkflow: null,

  nodes: [],
  edges: [],
  selectedNodeId: null,

  isLoading: false,
  isSaving: false,
  error: null,

  fetchWorkflows: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<{
        success: boolean;
        workflows: Workflow[];
        pagination: Pagination;
      }>("/workflows", { params });

      if (response.data.success) {
        set({
          workflows: response.data.workflows,
          pagination: response.data.pagination,
          isLoading: false,
        });
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      set({
        isLoading: false,
        error: errorObj.response?.data?.message || "Failed to fetch workflows",
      });
    }
  },

  fetchWorkflowById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<{ success: boolean; workflow: Workflow }>(`/workflows/${id}`);
      if (response.data.success) {
        const wf = response.data.workflow;
        set({
          currentWorkflow: wf,
          nodes: (wf.nodes as Node<NodeData>[]) || [],
          edges: wf.edges || [],
          selectedNodeId: null,
          isLoading: false,
        });
        return wf;
      }
      return null;
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      set({
        isLoading: false,
        error: errorObj.response?.data?.message || "Failed to load workflow",
      });
      return null;
    }
  },

  saveWorkflow: async (metadata = {}) => {
    const { currentWorkflow, nodes, edges } = get();
    set({ isSaving: true, error: null });

    const payload = {
      name: metadata.name || currentWorkflow?.name || "New Workflow",
      description: metadata.description !== undefined ? metadata.description : currentWorkflow?.description || "",
      status: metadata.status || currentWorkflow?.status || "draft",
      tags: metadata.tags || currentWorkflow?.tags || [],
      triggerConfig: currentWorkflow?.triggerConfig || { type: "manual", config: {} },
      nodes,
      edges,
    };

    try {
      if (currentWorkflow?._id) {
        // Update existing workflow
        const response = await api.put<{ success: boolean; workflow: Workflow }>(
          `/workflows/${currentWorkflow._id}`,
          payload
        );
        if (response.data.success) {
          const updated = response.data.workflow;
          set({ currentWorkflow: updated, isSaving: false });
          return updated;
        }
      } else {
        // Create new workflow
        const response = await api.post<{ success: boolean; workflow: Workflow }>("/workflows", payload);
        if (response.data.success) {
          const created = response.data.workflow;
          set({ currentWorkflow: created, isSaving: false });
          return created;
        }
      }
      set({ isSaving: false });
      return null;
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      set({
        isSaving: false,
        error: errorObj.response?.data?.message || "Failed to save workflow",
      });
      return null;
    }
  },

  duplicateWorkflow: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<{ success: boolean; workflow: Workflow }>(`/workflows/${id}/duplicate`);
      if (response.data.success) {
        set({ isLoading: false });
        await get().fetchWorkflows();
        return response.data.workflow;
      }
      return null;
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      set({
        isLoading: false,
        error: errorObj.response?.data?.message || "Failed to duplicate workflow",
      });
      return null;
    }
  },

  deleteWorkflow: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.delete<{ success: boolean }>(`/workflows/${id}`);
      if (response.data.success) {
        set((state) => ({
          workflows: state.workflows.filter((w) => w._id !== id),
          currentWorkflow: state.currentWorkflow?._id === id ? null : state.currentWorkflow,
          isLoading: false,
        }));
        return true;
      }
      return false;
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      set({
        isLoading: false,
        error: errorObj.response?.data?.message || "Failed to delete workflow",
      });
      return false;
    }
  },

  generateWorkflowAi: async (prompt: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<{
        success: boolean;
        workflow: Workflow;
      }>("/workflows/generate", { prompt });

      if (response.data.success && response.data.workflow) {
        const generated = response.data.workflow;
        set({
          currentWorkflow: {
            ...generated,
            _id: get().currentWorkflow?._id || "", // Keep current id if updating existing draft
          },
          nodes: (generated.nodes as Node<NodeData>[]) || [],
          edges: generated.edges || [],
          selectedNodeId: generated.nodes?.[0]?.id || null,
          isLoading: false,
        });
        return true;
      }
      set({ isLoading: false });
      return false;
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      set({
        isLoading: false,
        error: errorObj.response?.data?.message || "AI generation failed. Please try a different prompt.",
      });
      return false;
    }
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection: Connection) => {
    set({
      edges: addEdge(
        {
          ...connection,
          animated: true,
          style: { stroke: "#6366f1", strokeWidth: 2 },
        },
        get().edges
      ),
    });
  },

  addNode: (type, position) => {
    const nodeCount = get().nodes.length + 1;
    const defaultPositions: Record<string, { x: number; y: number }> = {
      trigger: { x: 100, y: 150 },
      action: { x: 400, y: 150 },
      ai: { x: 300, y: 300 },
      logic: { x: 250, y: 200 },
    };

    const nodePos = position || {
      x: (defaultPositions[type]?.x || 200) + (nodeCount % 5) * 30,
      y: (defaultPositions[type]?.y || 200) + (nodeCount % 5) * 30,
    };

    const labels: Record<string, string> = {
      trigger: "Webhook Trigger",
      action: "Send Email Notification",
      ai: "AI Sentiment Classifier",
      logic: "Condition Check",
    };

    const descriptions: Record<string, string> = {
      trigger: "Triggers on incoming HTTP request or event",
      action: "Executes external integration or message dispatch",
      ai: "Processes prompt using configured LLM agent",
      logic: "Branches workflow based on condition evaluation",
    };

    const newNode: Node<NodeData> = {
      id: `${type}-${Date.now()}`,
      type,
      position: nodePos,
      data: {
        label: labels[type] || "Custom Node",
        description: descriptions[type] || "",
        type,
        config: {},
      },
    };

    set((state) => ({
      nodes: [...state.nodes, newNode],
      selectedNodeId: newNode.id,
    }));
  },

  updateNodeData: (nodeId, data) => {
    set((state) => ({
      nodes: state.nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...data,
              config: {
                ...node.data.config,
                ...data.config,
              },
            },
          };
        }
        return node;
      }),
    }));
  },

  deleteNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
    }));
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  resetBuilder: (workflow = null) => {
    if (workflow) {
      set({
        currentWorkflow: workflow,
        nodes: (workflow.nodes as Node<NodeData>[]) || [],
        edges: workflow.edges || [],
        selectedNodeId: null,
        error: null,
      });
    } else {
      // Create empty template
      set({
        currentWorkflow: null,
        nodes: [
          {
            id: "trigger-1",
            type: "trigger",
            position: { x: 120, y: 150 },
            data: {
              label: "Start Workflow",
              description: "Manual or scheduled kickoff",
              type: "trigger",
              config: { triggerType: "manual" },
            },
          },
        ],
        edges: [],
        selectedNodeId: "trigger-1",
        error: null,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
