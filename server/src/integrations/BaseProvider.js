/**
 * BaseIntegrationProvider
 * Abstract interface that every third-party integration provider must implement.
 */
class BaseIntegrationProvider {
  constructor(name) {
    if (this.constructor === BaseIntegrationProvider) {
      throw new Error("BaseIntegrationProvider is an abstract class and cannot be instantiated directly.");
    }
    this.name = name;
  }

  /**
   * Generates the OAuth 2.0 authorization redirect URL with signed state
   */
  async getAuthUrl(userId, stateToken) {
    throw new Error(`getAuthUrl() not implemented on ${this.name}`);
  }

  /**
   * Handles the authorization code exchange and returns tokens & profile
   */
  async handleCallback(code, stateToken) {
    throw new Error(`handleCallback() not implemented on ${this.name}`);
  }

  /**
   * Refreshes an expired access token using the stored refresh token
   */
  async refreshAccessToken(account) {
    throw new Error(`refreshAccessToken() not implemented on ${this.name}`);
  }

  /**
   * Executes a provider-specific action (e.g. 'send_email', 'read_email')
   */
  async executeAction(actionName, params, credentials) {
    throw new Error(`executeAction() not implemented on ${this.name}`);
  }
}

module.exports = BaseIntegrationProvider;
