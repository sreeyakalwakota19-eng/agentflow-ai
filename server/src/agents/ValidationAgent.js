/**
 * ValidationAgent
 * Validates inputs, outputs, and requirements before and after node execution.
 * Detects missing fields, invalid configurations, and payload schema anomalies.
 */

class ValidationAgent {
  constructor(monitoringAgent) {
    this.name = "ValidationAgent";
    this.monitoringAgent = monitoringAgent;
  }

  /**
   * Validates pre-conditions and required inputs for a node before execution
   */
  async validateNodeInputs(executionId, node, inputs) {
    const missingFields = [];
    const errors = [];

    const config = node.data?.config || {};
    const type = node.type;

    // Node-type specific pre-validation
    if (type === "action") {
      const service = config.service;
      if (service === "email" || service === "gmail") {
        if (!inputs.recipient && !config.recipient && !inputs.email) {
          missingFields.push("recipient");
        }
      } else if (service === "slack") {
        if (!inputs.channel && !config.channel) {
          missingFields.push("channel");
        }
      }
    } else if (type === "ai") {
      const prompt = config.prompt || inputs.prompt;
      if (!prompt && Object.keys(inputs).length === 0) {
        missingFields.push("prompt or input payload");
      }
    } else if (type === "logic") {
      if (!config.field && !config.condition) {
        errors.push("Logic node missing evaluation field or condition");
      }
    }

    const isValid = missingFields.length === 0 && errors.length === 0;

    await this.monitoringAgent.logEvent(
      executionId,
      this.name,
      isValid ? "VALIDATION_PASSED" : "VALIDATION_FAILED",
      isValid ? "info" : "warn",
      {
        nodeId: node.id,
        nodeType: node.type,
        isValid,
        missingFields,
        errors,
      },
      node.id,
      node.type
    );

    return {
      valid: isValid,
      missingFields,
      errors,
    };
  }

  /**
   * Validates post-execution outputs
   */
  async validateNodeOutputs(executionId, node, output) {
    const isValid = output !== null && output !== undefined;

    if (!isValid) {
      await this.monitoringAgent.logEvent(
        executionId,
        this.name,
        "OUTPUT_VALIDATION_FAILED",
        "error",
        {
          nodeId: node.id,
          reason: "Node produced null or undefined output",
        },
        node.id,
        node.type
      );
    }

    return {
      valid: isValid,
      output,
    };
  }
}

module.exports = ValidationAgent;
