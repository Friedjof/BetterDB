/**
 * Base extractor class - provides common interface for all data extractors
 */

export class BaseExtractor {
  constructor(name) {
    this.name = name;
    this.isAvailable = false;
  }

  /**
   * Check if this extractor can be used in current context
   * @returns {boolean} - True if extractor is available
   */
  checkAvailability() {
    // Override in subclasses
    return false;
  }

  /**
   * Extract connection data
   * @returns {Promise<Array>} - Array of connection objects
   */
  async extract() {
    if (!this.checkAvailability()) {
      console.log(`[BetterDB] ${this.name} extractor not available`);
      return [];
    }

    try {
      const startTime = Date.now();
      console.log(`[BetterDB] Starting ${this.name} extraction`);
      
      const result = await this.doExtract();
      const duration = Date.now() - startTime;
      
      console.log(`[BetterDB] ${this.name} extraction completed in ${duration}ms: ${result.length} connections`);
      return result;
    } catch (error) {
      console.error(`[BetterDB] ${this.name} extraction failed:`, error);
      return [];
    }
  }

  /**
   * Perform the actual extraction - override in subclasses
   * @returns {Promise<Array>} - Array of connection objects
   */
  async doExtract() {
    throw new Error('doExtract must be implemented in subclass');
  }

  /**
   * Normalize connection object to standard format
   * @param {Object} rawConnection - Raw connection data
   * @returns {Object} - Normalized connection object
   */
  normalizeConnection(rawConnection) {
    return {
      tripId: rawConnection.tripId || null,
      ctxRecon: rawConnection.ctxRecon || null,
      start: rawConnection.start || null,
      destination: rawConnection.destination || null,
      departure: rawConnection.departure || null,
      arrival: rawConnection.arrival || null,
      countTransfers: Number.isFinite(rawConnection.countTransfers) ? rawConnection.countTransfers : null,
      priceFrom: rawConnection.priceFrom ?? null,
      vehicles: Array.isArray(rawConnection.vehicles) ? rawConnection.vehicles : [],
      segments: Array.isArray(rawConnection.segments) ? rawConnection.segments : [],
      stops: Array.isArray(rawConnection.stops) ? rawConnection.stops : []
    };
  }

  /**
   * Validate extracted data
   * @param {Array} connections - Array of connections to validate
   * @returns {Array} - Validated connections
   */
  validateConnections(connections) {
    if (!Array.isArray(connections)) {
      console.warn(`[BetterDB] ${this.name}: Invalid connections format, expected array`);
      return [];
    }

    return connections
      .filter(conn => {
        // Basic validation - must have start/destination or be otherwise meaningful
        if (!conn) return false;
        if (!conn.start && !conn.destination && !conn.segments?.length) return false;
        return true;
      })
      .map(conn => this.normalizeConnection(conn));
  }

  /**
   * Log debug information
   * @param {string} message - Debug message
   * @param {*} data - Optional data to log
   */
  debug(message, data = null) {
    if (data) {
      console.log(`[BetterDB] ${this.name}: ${message}`, data);
    } else {
      console.log(`[BetterDB] ${this.name}: ${message}`);
    }
  }
}
