/**
 * RecoveryAgent
 * Classifies runtime and validation failures and determines recovery action:
 * - retry_with_backoff
 * - escalate
 */

const ErrorCategory = {
  MISSING_FIELDS: "MISSING_FIELDS",
  API_FAILURE: "API_FAILURE",
  AUTH_EXPIRED: "AUTH_EXPIRED",
  RATE_LIMIT: "RATE_LIMIT",
  TRANSIENT: "TRANSIENT",
};

class RecoveryAgent {
  constructor(monitoringAgent) {
    this.name = "RecoveryAgent";
    this.monitoringAgent = monitoringAgent;
  }

  /**
   * Classifies error into known failure category
   */
  classifyError(error, context = {}) {
    const errorMsg = (error?.message || String(error || "")).toLowerCase();

    if (context.isValidationFailure || errorMsg.includes("missing") || errorMsg.includes("required field")) {
      return ErrorCategory.MISSING_FIELDS;
    }

    if (errorMsg.includes("401") || errorMsg.includes("unauthorized") || errorMsg.includes("token expired") || errorMsg.includes("auth")) {
      return ErrorCategory.AUTH_EXPIRED;
    }

    if (errorMsg.includes("429") || errorMsg.includes("rate limit") || errorMsg.includes("quota")) {
      return ErrorCategory.RATE_LIMIT;
    }

    if (errorMsg.includes("timeout") || errorMsg.includes("econnreset") || errorMsg.includes("network") || errorMsg.includes("503")) {
      return ErrorCategory.TRANSIENT;
    }

    return ErrorCategory.API_FAILURE;
  }

  /**
   * Decides recovery strategy
   */
  async handleFailure(execution, node, error, context = {}) {
    const category = this.classifyError(error, context);
    const retryCount = execution.retryCount || 0;
    const maxRetries = execution.maxRetries || 3;

    let decision = "escalate";
    let backoffMs = 0;
    let explanation = "";

    switch (category) {
      case ErrorCategory.TRANSIENT:
      case ErrorCategory.RATE_LIMIT:
      case ErrorCategory.API_FAILURE:
        if (retryCount < maxRetries) {
          decision = "retry_with_backoff";
          // Exponential backoff: base 50ms (for fast tests) * 2^retries
          backoffMs = Math.min(5000, 50 * Math.pow(2, retryCount));
          explanation = `Retryable ${category} error. Attempt ${retryCount + 1}/${maxRetries} scheduled after ${backoffMs}ms.`;
        } else {
          decision = "escalate";
          explanation = `Max retries (${maxRetries}) exceeded for ${category}. Escalating failure.`;
        }
        break;

      case ErrorCategory.MISSING_FIELDS:
        decision = "escalate";
        explanation = `Unrecoverable schema failure: Missing required fields in node ${node?.id}. Operator intervention required.`;
        break;

      case ErrorCategory.AUTH_EXPIRED:
        decision = "escalate";
        explanation = `Authentication expired for integration service in node ${node?.id}. Requires credential re-authorization.`;
        break;

      default:
        decision = "escalate";
        explanation = `Unhandled error: ${error?.message || error}. Escalating.`;
    }

    await this.monitoringAgent.logEvent(
      execution._id,
      this.name,
      decision === "retry_with_backoff" ? "RECOVERY_RETRY_SCHEDULED" : "RECOVERY_ESCALATED",
      decision === "retry_with_backoff" ? "warn" : "error",
      {
        nodeId: node?.id,
        category,
        decision,
        backoffMs,
        retryCount,
        maxRetries,
        explanation,
        error: error?.message || String(error),
      },
      node?.id,
      node?.type
    );

    return {
      category,
      decision,
      backoffMs,
      retryCount: retryCount + 1,
      explanation,
    };
  }
}

module.exports = {
  RecoveryAgent,
  ErrorCategory,
};
