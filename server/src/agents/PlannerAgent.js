/**
 * PlannerAgent
 * Responsible for DAG analysis, topological sorting of workflow nodes,
 * execution path determination, and generating a confidence score.
 */

class PlannerAgent {
  constructor(monitoringAgent) {
    this.name = "PlannerAgent";
    this.monitoringAgent = monitoringAgent;
  }

  /**
   * Generates execution plan from immutable workflow snapshot
   */
  async createPlan(execution, workflowSnapshot) {
    const nodes = workflowSnapshot.nodes || [];
    const edges = workflowSnapshot.edges || [];

    await this.monitoringAgent.logEvent(execution._id, this.name, "PLAN_GENERATION_STARTED", "info", {
      nodeCount: nodes.length,
      edgeCount: edges.length,
    });

    if (nodes.length === 0) {
      const errorMsg = "Workflow snapshot contains no nodes to execute";
      await this.monitoringAgent.logEvent(execution._id, this.name, "PLAN_GENERATION_FAILED", "error", {
        reason: errorMsg,
      });
      throw new Error(errorMsg);
    }

    // Build Adjacency Graph and In-Degree Map
    const nodeMap = new Map();
    const inDegree = new Map();
    const adjList = new Map();

    nodes.forEach((node) => {
      nodeMap.set(node.id, node);
      inDegree.set(node.id, 0);
      adjList.set(node.id, []);
    });

    edges.forEach((edge) => {
      if (adjList.has(edge.source) && inDegree.has(edge.target)) {
        adjList.get(edge.source).push({
          target: edge.target,
          sourceHandle: edge.sourceHandle || null,
        });
        inDegree.set(edge.target, inDegree.get(edge.target) + 1);
      }
    });

    // Topological Sort (Kahn's Algorithm with Priority for Triggers)
    const queue = [];
    nodes.forEach((node) => {
      if (inDegree.get(node.id) === 0) {
        queue.push(node.id);
      }
    });

    // Prioritize trigger nodes at front
    queue.sort((a, b) => {
      const aIsTrigger = nodeMap.get(a)?.type === "trigger" ? -1 : 1;
      const bIsTrigger = nodeMap.get(b)?.type === "trigger" ? -1 : 1;
      return aIsTrigger - bIsTrigger;
    });

    const executionOrder = [];
    const visited = new Set();
    const details = [];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (visited.has(currentId)) continue;

      visited.add(currentId);
      executionOrder.push(currentId);

      const node = nodeMap.get(currentId);
      const outgoing = adjList.get(currentId) || [];

      details.push({
        nodeId: currentId,
        nodeType: node?.type,
        label: node?.data?.label,
        outgoingEdges: outgoing,
      });

      for (const edge of outgoing) {
        const targetId = edge.target;
        inDegree.set(targetId, inDegree.get(targetId) - 1);
        if (inDegree.get(targetId) <= 0 && !visited.has(targetId)) {
          queue.push(targetId);
        }
      }
    }

    // Fallback: If disconnected nodes exist, add them sequentially
    nodes.forEach((node) => {
      if (!visited.has(node.id)) {
        executionOrder.push(node.id);
        details.push({
          nodeId: node.id,
          nodeType: node.type,
          label: node.data?.label,
          outgoingEdges: [],
        });
      }
    });

    // Calculate Confidence Score
    // Factors: Trigger presence (0.3), Edge connectivity (0.4), Config presence (0.3)
    let score = 0.0;
    const hasTrigger = nodes.some((n) => n.type === "trigger");
    if (hasTrigger) score += 0.35;

    const connectedRatio = nodes.length > 1 ? Math.min(1.0, edges.length / (nodes.length - 1)) : 1.0;
    score += connectedRatio * 0.35;

    const configuredCount = nodes.filter((n) => n.data && n.data.label).length;
    score += (configuredCount / nodes.length) * 0.3;

    const confidenceScore = Math.min(1.0, Math.max(0.1, Number(score.toFixed(2))));

    const plan = {
      executionOrder,
      confidenceScore,
      estimatedSteps: executionOrder.length,
      details,
    };

    await this.monitoringAgent.logEvent(execution._id, this.name, "PLAN_CREATED", "info", {
      executionOrder,
      confidenceScore,
      totalSteps: executionOrder.length,
    });

    return plan;
  }
}

module.exports = PlannerAgent;
