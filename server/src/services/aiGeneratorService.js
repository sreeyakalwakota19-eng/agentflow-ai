const ALLOWED_NODE_TYPES = ["trigger", "action", "ai", "logic"];
const ALLOWED_ACTION_SERVICES = ["email", "slack", "discord", "sheets", "notification"];
const ALLOWED_TRIGGER_TYPES = ["manual", "webhook", "schedule"];

const SYSTEM_PROMPT = `You are the Agentflow AI Workflow Compiler.
Your goal is to convert natural language automation descriptions into a structured, valid Agentflow workflow JSON graph.

You MUST reply ONLY with valid JSON (no markdown fences, no explanatory text).

Allowed Node Types:
1. "trigger": Starting event. (config: triggerType in ["manual", "webhook", "schedule"])
2. "action": Task execution. (config: service in ["email", "slack", "discord", "sheets", "notification"])
3. "ai": LLM reasoning / classifier. (config: model, prompt)
4. "logic": Condition evaluator with True/False branches. (config: operator, condition)

JSON Schema Output format:
{
  "name": "Concise Workflow Title",
  "description": "Clear overview of what the workflow accomplishes",
  "tags": ["tag1", "tag2"],
  "triggerConfig": { "type": "manual|webhook|schedule", "config": {} },
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger",
      "position": { "x": 100, "y": 150 },
      "data": {
        "label": "Webhook Trigger",
        "description": "Receives payload",
        "type": "trigger",
        "config": { "triggerType": "webhook" }
      }
    }
  ],
  "edges": [
    { "id": "e1-2", "source": "trigger-1", "target": "action-1" }
  ]
}`;

/**
 * Validates and normalizes generated workflow structure
 */
function validateAndNormalizeWorkflow(rawWorkflow, originalPrompt = "") {
  if (!rawWorkflow || typeof rawWorkflow !== "object") {
    throw new Error("Generated workflow is not a valid JSON object");
  }

  const name =
    typeof rawWorkflow.name === "string" && rawWorkflow.name.trim()
      ? rawWorkflow.name.trim()
      : "Automated Workflow";

  const description =
    typeof rawWorkflow.description === "string" && rawWorkflow.description.trim()
      ? rawWorkflow.description.trim()
      : `Workflow generated for: "${originalPrompt.slice(0, 100)}"`;

  const tags = Array.isArray(rawWorkflow.tags)
    ? rawWorkflow.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
    : ["ai-generated"];

  if (!Array.isArray(rawWorkflow.nodes) || rawWorkflow.nodes.length === 0) {
    throw new Error("Generated workflow must contain at least one node");
  }

  // Validate and sanitize nodes
  const nodeMap = new Map();
  const sanitizedNodes = [];

  rawWorkflow.nodes.forEach((node, index) => {
    if (!node || typeof node !== "object") return;

    const id = String(node.id || `node-${index + 1}`);
    const type = ALLOWED_NODE_TYPES.includes(node.type) ? node.type : "action";

    // Auto-calculate grid layout positions if invalid
    const position = {
      x: typeof node.position?.x === "number" ? node.position.x : 100 + index * 260,
      y: typeof node.position?.y === "number" ? node.position.y : 150 + (index % 2) * 50,
    };

    const label = node.data?.label || `${type.toUpperCase()} Step ${index + 1}`;
    const desc = node.data?.description || "";
    const config = typeof node.data?.config === "object" && node.data?.config ? node.data.config : {};

    const sanitizedNode = {
      id,
      type,
      position,
      data: {
        label: String(label),
        description: String(desc),
        type,
        config,
      },
    };

    nodeMap.set(id, sanitizedNode);
    sanitizedNodes.push(sanitizedNode);
  });

  if (sanitizedNodes.length === 0) {
    throw new Error("No valid nodes could be processed in the workflow");
  }

  // Ensure at least one trigger node exists
  const hasTrigger = sanitizedNodes.some((n) => n.type === "trigger");
  if (!hasTrigger) {
    const triggerNode = {
      id: `trigger-${Date.now()}`,
      type: "trigger",
      position: { x: 50, y: 150 },
      data: {
        label: "Start Workflow",
        description: "Manual kickoff event",
        type: "trigger",
        config: { triggerType: "manual" },
      },
    };
    sanitizedNodes.unshift(triggerNode);
    nodeMap.set(triggerNode.id, triggerNode);

    // Connect trigger to the first node
    if (sanitizedNodes.length > 1) {
      if (!Array.isArray(rawWorkflow.edges)) rawWorkflow.edges = [];
      rawWorkflow.edges.unshift({
        id: `e-start-${sanitizedNodes[1].id}`,
        source: triggerNode.id,
        target: sanitizedNodes[1].id,
      });
    }
  }

  // Validate and sanitize edges
  const sanitizedEdges = [];
  if (Array.isArray(rawWorkflow.edges)) {
    rawWorkflow.edges.forEach((edge, idx) => {
      if (!edge || !edge.source || !edge.target) return;
      const sourceId = String(edge.source);
      const targetId = String(edge.target);

      // Verify endpoints exist
      if (nodeMap.has(sourceId) && nodeMap.has(targetId) && sourceId !== targetId) {
        sanitizedEdges.push({
          id: String(edge.id || `edge-${sourceId}-${targetId}-${idx}`),
          source: sourceId,
          target: targetId,
          ...(edge.sourceHandle && { sourceHandle: String(edge.sourceHandle) }),
        });
      }
    });
  }

  // If no edges but multiple nodes exist, connect them linearly
  if (sanitizedEdges.length === 0 && sanitizedNodes.length > 1) {
    for (let i = 0; i < sanitizedNodes.length - 1; i++) {
      sanitizedEdges.push({
        id: `auto-edge-${sanitizedNodes[i].id}-${sanitizedNodes[i + 1].id}`,
        source: sanitizedNodes[i].id,
        target: sanitizedNodes[i + 1].id,
      });
    }
  }

  return {
    name,
    description,
    status: "draft",
    tags,
    triggerConfig: rawWorkflow.triggerConfig || {
      type: sanitizedNodes[0]?.data?.config?.triggerType || "manual",
      config: {},
    },
    nodes: sanitizedNodes,
    edges: sanitizedEdges,
    version: 1,
  };
}

/**
 * Deterministic Rule-Based Generator (Tier 3 Fallback)
 */
function generateDeterministic(prompt) {
  const lower = prompt.toLowerCase();

  // Pattern 1: Multi-Step Intelligent Workflow (Complex branching & triage)
  if (
    lower.includes("multi-step") ||
    lower.includes("complex") ||
    lower.includes("pipeline") ||
    lower.includes("support ticket") ||
    lower.includes("triage") ||
    (lower.includes("sentiment") && (lower.includes("if") || lower.includes("alert") || lower.includes("branch"))) ||
    (lower.includes("if") && lower.includes("else"))
  ) {
    return {
      name: "Multi-Step AI Triage & Branching Workflow",
      description: "Ingests payload, assesses sentiment with AI, and conditionally branches to Slack or Sheets.",
      tags: ["multi-step", "ai-agent", "logic-branch", "automation"],
      triggerConfig: { type: "webhook", config: { endpoint: "/webhooks/triage-pipeline" } },
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 80, y: 180 },
          data: {
            label: "Inbound Support Webhook",
            description: "Listens for customer ticket submissions",
            type: "trigger",
            config: { triggerType: "webhook" },
          },
        },
        {
          id: "ai-1",
          type: "ai",
          position: { x: 360, y: 180 },
          data: {
            label: "AI Sentiment Classifier",
            description: "Evaluates ticket urgency and sentiment score",
            type: "ai",
            config: { model: "openrouter/auto", prompt: "Classify urgency as HIGH or NORMAL." },
          },
        },
        {
          id: "logic-1",
          type: "logic",
          position: { x: 640, y: 180 },
          data: {
            label: "Urgency Check",
            description: "Branches if sentiment is urgent",
            type: "logic",
            config: { operator: "equals", field: "urgency", value: "HIGH" },
          },
        },
        {
          id: "action-slack",
          type: "action",
          position: { x: 940, y: 100 },
          data: {
            label: "Escalate to Slack Alert",
            description: "Urgent ticket broadcast to #support-leads",
            type: "action",
            config: { service: "slack", channel: "#urgent-support" },
          },
        },
        {
          id: "action-sheets",
          type: "action",
          position: { x: 940, y: 280 },
          data: {
            label: "Log to Google Sheets",
            description: "Records standard ticket in backlog spreadsheet",
            type: "action",
            config: { service: "sheets" },
          },
        },
      ],
      edges: [
        { id: "e1-2", source: "trigger-1", target: "ai-1" },
        { id: "e2-3", source: "ai-1", target: "logic-1" },
        { id: "e3-slack", source: "logic-1", target: "action-slack", sourceHandle: "true" },
        { id: "e3-sheets", source: "logic-1", target: "action-sheets", sourceHandle: "false" },
      ],
    };
  }

  // Pattern 2: Email / Gmail dispatch
  if (
    lower.includes("email") ||
    lower.includes("gmail") ||
    lower.includes("send mail") ||
    lower.includes("newsletter")
  ) {
    if (lower.includes("ai") || lower.includes("summarize") || lower.includes("classify")) {
      // AI Email workflow
      return {
        name: "AI Email Processing & Dispatch",
        description: "Ingests input, analyzes content with AI agent, and sends email notification.",
        tags: ["email", "ai", "automation"],
        triggerConfig: { type: "webhook", config: { endpoint: "/webhooks/email-trigger" } },
        nodes: [
          {
            id: "trigger-1",
            type: "trigger",
            position: { x: 100, y: 150 },
            data: {
              label: "Incoming Email Event",
              description: "Webhook listener for inbound messages",
              type: "trigger",
              config: { triggerType: "webhook" },
            },
          },
          {
            id: "ai-1",
            type: "ai",
            position: { x: 380, y: 150 },
            data: {
              label: "AI Content Summarizer",
              description: "Extracts key insights and drafts automated response",
              type: "ai",
              config: { model: "openrouter/auto", prompt: "Summarize message and draft polite response." },
            },
          },
          {
            id: "action-1",
            type: "action",
            position: { x: 660, y: 150 },
            data: {
              label: "Send Gmail Response",
              description: "Dispatches email via Gmail API",
              type: "action",
              config: { service: "email" },
            },
          },
        ],
        edges: [
          { id: "e1-2", source: "trigger-1", target: "ai-1" },
          { id: "e2-3", source: "ai-1", target: "action-1" },
        ],
      };
    }

    return {
      name: "Automated Email Notification",
      description: "Triggers and dispatches an email alert to configured recipients.",
      tags: ["email", "notification"],
      triggerConfig: { type: "manual", config: {} },
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 120, y: 150 },
          data: {
            label: "Manual Trigger",
            description: "Operator initiated kickoff",
            type: "trigger",
            config: { triggerType: "manual" },
          },
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 420, y: 150 },
          data: {
            label: "Send Gmail Message",
            description: "Dispatches formatted email",
            type: "action",
            config: { service: "email" },
          },
        },
      ],
      edges: [{ id: "e1-2", source: "trigger-1", target: "action-1" }],
    };
  }

  // Pattern 3: Slack Notification
  if (lower.includes("slack")) {
    return {
      name: "Slack Channel Notification",
      description: "Sends automated messages to a designated Slack channel.",
      tags: ["slack", "notifications", "alerts"],
      triggerConfig: { type: "webhook", config: { endpoint: "/webhooks/slack-alert" } },
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 120, y: 150 },
          data: {
            label: "Webhook Event",
            description: "Listens for system alerts or webhooks",
            type: "trigger",
            config: { triggerType: "webhook" },
          },
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 420, y: 150 },
          data: {
            label: "Post to Slack Channel",
            description: "Sends formatted markdown message to Slack",
            type: "action",
            config: { service: "slack", channel: "#general" },
          },
        },
      ],
      edges: [{ id: "e1-2", source: "trigger-1", target: "action-1" }],
    };
  }

  // Pattern 4: Discord Notification
  if (lower.includes("discord")) {
    return {
      name: "Discord Webhook Dispatcher",
      description: "Relays notifications directly to a Discord server channel.",
      tags: ["discord", "community", "notifications"],
      triggerConfig: { type: "webhook", config: { endpoint: "/webhooks/discord-alert" } },
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 120, y: 150 },
          data: {
            label: "Event Ingest",
            description: "HTTP Webhook trigger",
            type: "trigger",
            config: { triggerType: "webhook" },
          },
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 420, y: 150 },
          data: {
            label: "Send Discord Message",
            description: "Publishes message via Discord Webhook",
            type: "action",
            config: { service: "discord" },
          },
        },
      ],
      edges: [{ id: "e1-2", source: "trigger-1", target: "action-1" }],
    };
  }

  // Pattern 5: Google Sheets Append
  if (lower.includes("sheet") || lower.includes("spreadsheet") || lower.includes("table")) {
    return {
      name: "Google Sheets Data Logger",
      description: "Appends incoming event records into a Google Spreadsheet.",
      tags: ["google-sheets", "data-logging", "analytics"],
      triggerConfig: { type: "webhook", config: { endpoint: "/webhooks/sheets-ingest" } },
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 120, y: 150 },
          data: {
            label: "Form Submission Webhook",
            description: "Receives user submission payload",
            type: "trigger",
            config: { triggerType: "webhook" },
          },
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 420, y: 150 },
          data: {
            label: "Append Row to Google Sheet",
            description: "Inserts record row into target spreadsheet",
            type: "action",
            config: { service: "sheets", sheetName: "Sheet1" },
          },
        },
      ],
      edges: [{ id: "e1-2", source: "trigger-1", target: "action-1" }],
    };
  }

  // Pattern 6: Default fallback for ambiguous or short prompts
  return {
    name: "General Task Orchestration",
    description: `Automated agent workflow generated for prompt: "${prompt}"`,
    tags: ["general", "agent-flow"],
    triggerConfig: { type: "manual", config: {} },
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 120, y: 150 },
        data: {
          label: "Workflow Trigger",
          description: "Initiates workflow execution",
          type: "trigger",
          config: { triggerType: "manual" },
        },
      },
      {
        id: "ai-1",
        type: "ai",
        position: { x: 400, y: 150 },
        data: {
          label: "AI Processing Agent",
          description: "Reasons over input data and executes user goal",
          type: "ai",
          config: { model: "openrouter/auto", prompt: `Execute: ${prompt}` },
        },
      },
      {
        id: "action-1",
        type: "action",
        position: { x: 680, y: 150 },
        data: {
          label: "Dispatch Result Notification",
          description: "Outputs execution result",
          type: "action",
          config: { service: "notification" },
        },
      },
    ],
    edges: [
      { id: "e1-2", source: "trigger-1", target: "ai-1" },
      { id: "e2-3", source: "ai-1", target: "action-1" },
    ],
  };
}

/**
 * Primary AI Generator: OpenRouter
 */
async function generateWithOpenRouter(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://agentflow.ai",
      "X-Title": "Agentflow AI",
    },
    body: JSON.stringify({
      model: "meta-llama/llama-3.3-70b-instruct",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Generate workflow for: ${prompt}` },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API responded with status ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response received from OpenRouter");
  }

  return JSON.parse(content);
}

/**
 * Secondary AI Generator: Google Gemini
 */
async function generateWithGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: SYSTEM_PROMPT },
            { text: `Generate workflow for prompt: ${prompt}` },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API responded with status ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Empty response from Gemini API");
  }

  return JSON.parse(text);
}

/**
 * Orchestrates multi-tiered generation with fallback chain:
 * 1. OpenRouter (Primary)
 * 2. Gemini (Fallback)
 * 3. Deterministic Rule-Based (Final Fallback)
 */
async function generateWorkflow(prompt) {
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("Prompt is required to generate a workflow");
  }

  const cleanPrompt = prompt.trim();
  let generatedResult = null;
  let providerUsed = "deterministic";

  // Tier 1: Try OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    try {
      generatedResult = await generateWithOpenRouter(cleanPrompt);
      providerUsed = "openrouter";
    } catch (err) {
      console.warn("OpenRouter generation failed, trying Gemini fallback:", err.message);
    }
  }

  // Tier 2: Try Gemini Fallback
  if (!generatedResult && process.env.GEMINI_API_KEY) {
    try {
      generatedResult = await generateWithGemini(cleanPrompt);
      providerUsed = "gemini";
    } catch (err) {
      console.warn("Gemini generation failed, falling back to deterministic engine:", err.message);
    }
  }

  // Tier 3: Deterministic Rule Engine Fallback
  if (!generatedResult) {
    generatedResult = generateDeterministic(cleanPrompt);
    providerUsed = "deterministic";
  }

  // Final schema validation and normalization
  const normalizedWorkflow = validateAndNormalizeWorkflow(generatedResult, cleanPrompt);

  return {
    ...normalizedWorkflow,
    generatorMetadata: {
      provider: providerUsed,
      prompt: cleanPrompt,
      generatedAt: new Date().toISOString(),
    },
  };
}

module.exports = {
  generateWorkflow,
  validateAndNormalizeWorkflow,
  generateDeterministic,
};
