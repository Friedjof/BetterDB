/**
 * Ticket Splitter - Main coordinator for ticket splitting analysis
 * Integrates URL parsing, graph building, and price optimization
 */

import { DBUrlParser } from './url-parser.js';
import { RouteGraph } from './route-graph.js';

export class TicketSplitter {
  constructor() {
    this.graph = new RouteGraph();
    this.isEnabled = true;
    this.analysisResults = new Map(); // connectionId -> analysis results
    this.isAnalyzing = false;
  }

  /**
   * Analyze connections for ticket splitting opportunities
   * @param {Array} connections - Array of connection objects
   * @returns {Promise<Array>} - Connections enhanced with splitting analysis
   */
  async analyzeConnections(connections) {
    if (!this.isEnabled || this.isAnalyzing) {
      console.log('[BetterDB] Ticket splitting analysis disabled or already running');
      return connections;
    }

    if (!connections || connections.length === 0) {
      console.log('[BetterDB] No connections to analyze');
      return connections;
    }

    console.log('[BetterDB] Starting ticket splitting analysis for', connections.length, 'connections');
    this.isAnalyzing = true;

    try {
      // Initialize graph with current connections
      const searchParams = DBUrlParser.extractCurrentSearchParams();
      this.graph.initialize(connections, searchParams);

      // Analyze each connection for splitting opportunities
      const enhancedConnections = [];
      
      for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];
        const enhanced = await this.analyzeConnection(connection, i);
        enhancedConnections.push(enhanced);
        
        // Add delay to avoid overwhelming the system
        if (i < connections.length - 1) {
          await this.delay(100); // 100ms delay between analyses
        }
      }

      console.log('[BetterDB] Ticket splitting analysis complete');
      return enhancedConnections;
      
    } catch (error) {
      console.error('[BetterDB] Ticket splitting analysis failed:', error);
      return connections; // Return original connections on error
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Analyze a single connection for ticket splitting opportunities
   * @param {Object} connection - Connection object
   * @param {number} connectionIndex - Index of the connection
   * @returns {Promise<Object>} - Enhanced connection with splitting analysis
   */
  async analyzeConnection(connection, connectionIndex) {
    if (!connection.start || !connection.destination) {
      console.warn('[BetterDB] Connection missing start/destination:', connection);
      return { ...connection, splittingAnalysis: null };
    }

    const connectionId = connection.tripId || `conn_${connectionIndex}`;
    console.log(`[BetterDB] Analyzing connection ${connectionIndex + 1}: ${connection.start} -> ${connection.destination}`);

    try {
      // Check if we already have analysis results cached
      if (this.analysisResults.has(connectionId)) {
        const cached = this.analysisResults.get(connectionId);
        if (Date.now() - cached.timestamp < 600000) { // 10 minutes cache
          return { ...connection, splittingAnalysis: cached.result };
        }
      }

      // Perform ticket splitting analysis
      const splittingOptions = await this.graph.calculateTicketSplittingOptions(
        connection.start,
        connection.destination
      );

      const analysis = {
        hasOpportunities: splittingOptions.length > 0,
        bestSavings: splittingOptions.length > 0 ? splittingOptions[0].savings : 0,
        bestSavingsPercentage: splittingOptions.length > 0 ? splittingOptions[0].savingsPercentage : 0,
        totalOptions: splittingOptions.length,
        options: splittingOptions.slice(0, 5), // Keep top 5 options
        originalPrice: connection.priceFrom,
        analysisTimestamp: Date.now()
      };

      // Cache the results
      this.analysisResults.set(connectionId, {
        result: analysis,
        timestamp: Date.now()
      });

      console.log(`[BetterDB] Analysis complete for ${connection.start} -> ${connection.destination}:`, 
        `${analysis.totalOptions} options, best savings: ${analysis.bestSavingsPercentage}%`);

      return { ...connection, splittingAnalysis: analysis };

    } catch (error) {
      console.error(`[BetterDB] Failed to analyze connection ${connectionIndex + 1}:`, error);
      return { ...connection, splittingAnalysis: { error: error.message, analysisTimestamp: Date.now() } };
    }
  }

  /**
   * Get summary statistics of ticket splitting opportunities
   * @param {Array} connections - Connections with splitting analysis
   * @returns {Object} - Summary statistics
   */
  getSplittingSummary(connections) {
    const analyzed = connections.filter(conn => conn.splittingAnalysis && !conn.splittingAnalysis.error);
    const withOpportunities = analyzed.filter(conn => conn.splittingAnalysis.hasOpportunities);
    
    const totalSavings = withOpportunities.reduce((sum, conn) => sum + (conn.splittingAnalysis.bestSavings || 0), 0);
    const totalOriginalPrice = analyzed.reduce((sum, conn) => sum + (conn.priceFrom || 0), 0);
    
    return {
      totalConnections: connections.length,
      analyzedConnections: analyzed.length,
      connectionsWithOpportunities: withOpportunities.length,
      totalPotentialSavings: totalSavings,
      totalOriginalPrice: totalOriginalPrice,
      averageSavingsPercentage: withOpportunities.length > 0 
        ? (withOpportunities.reduce((sum, conn) => sum + parseFloat(conn.splittingAnalysis.bestSavingsPercentage), 0) / withOpportunities.length).toFixed(1)
        : 0,
      topSavingsOpportunity: withOpportunities.length > 0 
        ? withOpportunities.reduce((best, conn) => conn.splittingAnalysis.bestSavings > best.splittingAnalysis.bestSavings ? conn : best)
        : null
    };
  }

  /**
   * Generate detailed report for a specific connection
   * @param {Object} connection - Connection with splitting analysis
   * @returns {Object} - Detailed splitting report
   */
  generateDetailedReport(connection) {
    if (!connection.splittingAnalysis) {
      return { error: 'No splitting analysis available' };
    }

    const analysis = connection.splittingAnalysis;
    
    return {
      connection: {
        route: `${connection.start} -> ${connection.destination}`,
        originalPrice: connection.priceFrom,
        departure: connection.departure,
        arrival: connection.arrival,
        duration: this.calculateDuration(connection.departure, connection.arrival)
      },
      analysis: {
        hasOpportunities: analysis.hasOpportunities,
        totalOptions: analysis.totalOptions,
        bestSavings: analysis.bestSavings,
        bestSavingsPercentage: analysis.bestSavingsPercentage,
        analysisTimestamp: analysis.analysisTimestamp
      },
      options: analysis.options?.map(option => ({
        route: option.route.join(' → '),
        segments: option.segments?.map(seg => `${seg.from} -> ${seg.to}`) || [],
        totalPrice: option.totalPrice,
        savings: option.savings,
        savingsPercentage: option.savingsPercentage,
        segmentCount: option.segmentCount,
        recommendation: this.generateRecommendation(option)
      })) || []
    };
  }

  /**
   * Generate recommendation for a splitting option
   * @param {Object} option - Splitting option
   * @returns {string} - Recommendation text
   */
  generateRecommendation(option) {
    const savings = parseFloat(option.savingsPercentage);
    
    if (savings <= 0) {
      return 'Nicht empfohlen - keine Ersparnis';
    } else if (savings < 5) {
      return 'Geringe Ersparnis - eventuell nicht lohnenswert wegen Aufwand';
    } else if (savings < 15) {
      return 'Moderate Ersparnis - kann sich lohnen';
    } else if (savings < 30) {
      return 'Gute Ersparnis - empfohlen';
    } else {
      return 'Sehr hohe Ersparnis - dringend empfohlen!';
    }
  }

  /**
   * Calculate duration between two timestamps
   * @param {string} departure - Departure timestamp
   * @param {string} arrival - Arrival timestamp
   * @returns {string} - Duration string
   */
  calculateDuration(departure, arrival) {
    if (!departure || !arrival) return 'Unknown';
    
    try {
      const depTime = new Date(departure);
      const arrTime = new Date(arrival);
      const diffMs = arrTime - depTime;
      
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      return `${hours}h ${minutes}m`;
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Enable or disable ticket splitting analysis
   * @param {boolean} enabled - Whether to enable analysis
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    console.log(`[BetterDB] Ticket splitting analysis ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Clear analysis cache
   */
  clearCache() {
    this.analysisResults.clear();
    this.graph = new RouteGraph();
    console.log('[BetterDB] Ticket splitting cache cleared');
  }

  /**
   * Get current analysis status
   * @returns {Object} - Status information
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      analyzing: this.isAnalyzing,
      cachedResults: this.analysisResults.size,
      graphStats: this.graph.exportGraph().stats
    };
  }

  /**
   * Export all analysis results for debugging
   * @returns {Object} - All analysis data
   */
  exportAnalysis() {
    return {
      status: this.getStatus(),
      results: Array.from(this.analysisResults.entries()),
      graph: this.graph.exportGraph()
    };
  }

  /**
   * Simple delay utility
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} - Delay promise
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Global instance
export const ticketSplitter = new TicketSplitter();
