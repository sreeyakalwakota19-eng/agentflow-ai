/**
 * Service Executors Registry for Agentflow AI
 * Dispatches node tasks to dedicated service adapters.
 */

const executors = {
  // Trigger Handler
  trigger: async (node, inputs, context) => {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      triggerType: node.data?.config?.triggerType || "manual",
      payload: inputs || {},
    };
  },

  // Action Service Handlers
  action: async (node, inputs, context) => {
    const service = node.data?.config?.service || "notification";

    switch (service) {
      case "email":
      case "gmail": {
        const recipient = inputs.recipient || node.data?.config?.recipient || inputs.email || "recipient@example.com";
        const subject = inputs.subject || node.data?.config?.subject || "Automated Notification";
        const body = inputs.body || inputs.content || node.data?.config?.body || "Notification content";

        // Simulated service execution
        return {
          service: "email",
          status: "SENT",
          recipient,
          subject,
          messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          deliveredAt: new Date().toISOString(),
        };
      }

      case "slack": {
        const channel = node.data?.config?.channel || inputs.channel || "#general";
        const message = inputs.message || inputs.content || node.data?.config?.message || "Notification from Agentflow";

        return {
          service: "slack",
          status: "POSTED",
          channel,
          message,
          ts: String(Date.now() / 1000),
          deliveredAt: new Date().toISOString(),
        };
      }

      case "discord": {
        const message = inputs.message || inputs.content || "Alert from Agentflow";
        return {
          service: "discord",
          status: "BROADCASTED",
          message,
          deliveredAt: new Date().toISOString(),
        };
      }

      case "sheets": {
        const sheetName = node.data?.config?.sheetName || "Sheet1";
        const rowData = inputs.row || inputs.data || inputs;

        return {
          service: "sheets",
          status: "APPENDED",
          sheetName,
          rowAppended: rowData,
          rowsCount: 1,
          updatedRange: `${sheetName}!A1:Z1`,
          appendedAt: new Date().toISOString(),
        };
      }

      default: {
        return {
          service: "notification",
          status: "DISPATCHED",
          output: inputs,
          dispatchedAt: new Date().toISOString(),
        };
      }
    }
  },

  // AI Reasoning Agent Handler
  ai: async (node, inputs, context) => {
    const prompt = node.data?.config?.prompt || "Analyze input data and summarize key insights";
    const model = node.data?.config?.model || "openrouter/auto";

    // In a live integration, this invokes the LLM client.
    // For execution engine mock execution:
    const summary = `AI analysis performed by model [${model}] on input data.`;
    const sentiment = inputs.urgency || inputs.sentiment || (JSON.stringify(inputs).toLowerCase().includes("urgent") ? "HIGH" : "NORMAL");

    return {
      model,
      prompt,
      summary,
      sentiment,
      urgency: sentiment,
      confidence: 0.95,
      reasoning: "Analyzed tokens, classified urgency, and determined recommended next step.",
      processedAt: new Date().toISOString(),
    };
  },

  // Logic Condition Branching Handler
  logic: async (node, inputs, context) => {
    const config = node.data?.config || {};
    const field = config.field || "urgency";
    const expectedValue = config.value !== undefined ? config.value : "HIGH";
    const operator = config.operator || "equals";

    const actualValue = inputs[field] !== undefined ? inputs[field] : inputs.sentiment;

    let conditionPassed = false;
    if (operator === "equals") {
      conditionPassed = String(actualValue).toUpperCase() === String(expectedValue).toUpperCase();
    } else if (operator === "not_equals") {
      conditionPassed = String(actualValue).toUpperCase() !== String(expectedValue).toUpperCase();
    } else if (operator === "contains") {
      conditionPassed = String(actualValue).toLowerCase().includes(String(expectedValue).toLowerCase());
    } else {
      conditionPassed = Boolean(actualValue);
    }

    return {
      conditionPassed,
      branch: conditionPassed ? "true" : "false",
      evaluatedField: field,
      actualValue,
      expectedValue,
      evaluatedAt: new Date().toISOString(),
    };
  },
};

async function executeNodeService(node, inputs, context) {
  const handler = executors[node.type];
  if (!handler) {
    throw new Error(`Unsupported node execution type: ${node.type}`);
  }
  return await handler(node, inputs, context);
}

module.exports = {
  executors,
  executeNodeService,
};
