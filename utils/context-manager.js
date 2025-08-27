/**
 * Context Manager - Utilities for handling Chrome extension context invalidation
 */

export class ContextManager {
  /**
   * Check if Chrome extension context is valid
   * @returns {boolean} - True if context is valid
   */
  static isContextValid() {
    try {
      return !!(chrome?.runtime?.id);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if error is due to extension context invalidation
   * @param {Error} error - The error to check
   * @returns {boolean} - True if context invalidation error
   */
  static isContextInvalidationError(error) {
    if (!error) return false;
    const message = error?.message?.toLowerCase() || '';
    return message.includes('extension context invalidated') ||
           message.includes('context invalidated') ||
           message.includes('runtime.lastError') ||
           message.includes('receiving end does not exist');
  }

  /**
   * Safely execute a Chrome API call with context validation
   * @param {Function} apiCall - The Chrome API function to call
   * @param {*} defaultValue - Default value to return if context is invalid
   * @returns {*} - Result or default value
   */
  static async safeApiCall(apiCall, defaultValue = null) {
    if (!this.isContextValid()) {
      console.warn('[BetterDB] Extension context invalid, skipping API call');
      return defaultValue;
    }

    try {
      return await apiCall();
    } catch (error) {
      if (this.isContextInvalidationError(error)) {
        console.warn('[BetterDB] Context invalidated during API call');
        return defaultValue;
      }
      throw error; // Re-throw non-context errors
    }
  }

  /**
   * Get user-friendly context status message
   * @returns {string} - Status message
   */
  static getContextStatusMessage() {
    if (this.isContextValid()) {
      return 'Extension context is valid';
    } else {
      return 'Extension context invalidated - extension needs to be reloaded';
    }
  }

  /**
   * Log context status with appropriate level
   */
  static logContextStatus() {
    const valid = this.isContextValid();
    const message = this.getContextStatusMessage();
    
    if (valid) {
      console.log(`[BetterDB] ${message}`);
    } else {
      console.warn(`[BetterDB] ${message}`);
    }
  }

  /**
   * Create error data object for storage
   * @param {Error} error - The error that occurred
   * @param {string} operation - What operation was being performed
   * @returns {Object} - Error data object
   */
  static createErrorData(error, operation = 'unknown') {
    return {
      dbConnections: [],
      dbExtractedAt: Date.now(),
      dbError: error?.message || String(error),
      dbDebugInfo: {
        error: error?.stack || error?.toString(),
        timestamp: new Date().toISOString(),
        operation,
        contextValid: this.isContextValid(),
        isContextError: this.isContextInvalidationError(error)
      }
    };
  }
}

// Export convenience functions
export const {
  isContextValid,
  isContextInvalidationError,
  safeApiCall,
  getContextStatusMessage,
  logContextStatus,
  createErrorData
} = ContextManager;
