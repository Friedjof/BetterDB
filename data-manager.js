/**
 * Data Manager - coordinates all extractors and handles auto-refresh
 */
import { VuexExtractor } from './extractors/vuex-extractor.js';
import { DigitalDataExtractor } from './extractors/digital-data-extractor.js';
import { DOMExtractor } from './extractors/dom-extractor.js';
import { NetworkExtractor } from './extractors/network-extractor.js';
import { mergeVuexAndDigitalData, applyCtxReconFallback, addStopsToConnections, cleanConnections } from './utils/data-merger.js';
import { ticketSplitter } from './utils/ticket-splitter.js';
import { delay } from './utils/helpers.js';

export class DataManager {
  constructor() {
    this.extractors = {
      vuex: new VuexExtractor(),
      digitalData: new DigitalDataExtractor(),
      dom: new DOMExtractor(),
      network: new NetworkExtractor()
    };
    
    this.isExtracting = false;
    this.lastExtractionTime = 0;
    this.lastUrl = '';
    this.autoRefreshEnabled = true;
    this.extractionThrottle = 2000; // Min 2 seconds between extractions
    
    this.setupAutoRefresh();
  }

  /**
   * Setup auto-refresh functionality
   */
  setupAutoRefresh() {
    if (!this.autoRefreshEnabled) return;

    // Method 1: Page navigation detection
    this.setupNavigationListener();
    
    // Method 2: URL change detection (for SPA navigation)
    this.setupUrlChangeDetection();
    
    // Method 3: DOM mutation observer for dynamic content
    this.setupMutationObserver();
    
    // Method 4: Initial extraction on load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.scheduleExtraction('DOMContentLoaded'));
    } else {
      this.scheduleExtraction('immediate');
    }

    console.log('[BetterDB] Auto-refresh setup completed');
  }

  /**
   * Setup navigation event listeners
   */
  setupNavigationListener() {
    // Modern Navigation API (if available)
    if ('navigation' in window) {
      window.navigation.addEventListener('navigate', (event) => {
        console.log('[BetterDB] Navigation detected via Navigation API');
        this.scheduleExtraction('navigate', 1000);
      });
    }

    // Page visibility changes (tab switching back)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('[BetterDB] Tab became visible');
        this.scheduleExtraction('visibility', 500);
      }
    });

    // Fallback: periodically check for content changes
    if (this.contentCheckInterval) {
      clearInterval(this.contentCheckInterval);
    }
    
    this.contentCheckInterval = setInterval(() => {
      if (this.hasContentChanged()) {
        this.scheduleExtraction('content-change');
      }
    }, 5000);
  }

  /**
   * Setup URL change detection
   */
  setupUrlChangeDetection() {
    // Clear existing interval if any
    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
    }
    
    this.urlCheckInterval = setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== this.lastUrl) {
        console.log('[BetterDB] URL change detected:', this.lastUrl, '->', currentUrl);
        this.lastUrl = currentUrl;
        this.scheduleExtraction('url-change');
      }
    }, 1000);
  }

  /**
   * Setup mutation observer for dynamic content
   */
  setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      const relevantChanges = mutations.some(mutation => {
        // Check if search results or connection elements changed
        const target = mutation.target;
        if (!target || !target.classList) return false;
        
        const relevantClasses = [
          'verbindung', 'connection', 'reise', 'journey',
          'suchergebnis', 'search-result', 'fahrplan'
        ];
        
        return relevantClasses.some(className => 
          target.classList.contains(className) ||
          target.closest(`[class*="${className}"]`)
        );
      });

      if (relevantChanges) {
        console.log('[BetterDB] Relevant DOM mutations detected');
        this.scheduleExtraction('dom-mutation', 1500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });
  }

  /**
   * Check if page content has changed significantly
   * @returns {boolean} - True if content changed
   */
  hasContentChanged() {
    // Simple heuristic: check if connection containers exist
    const connectionElements = document.querySelectorAll([
      '[class*="verbindung"]',
      '[class*="connection"]',
      '[class*="reise"]',
      '[data-testid*="connection"]'
    ].join(','));

    const currentCount = connectionElements.length;
    const lastCount = this.lastConnectionCount || 0;
    this.lastConnectionCount = currentCount;

    return currentCount !== lastCount && currentCount > 0;
  }

  /**
   * Schedule extraction with throttling
   * @param {string} trigger - What triggered the extraction
   * @param {number} delayMs - Delay before extraction
   */
  scheduleExtraction(trigger, delayMs = 0) {
    const now = Date.now();
    const timeSinceLastExtraction = now - this.lastExtractionTime;
    
    if (timeSinceLastExtraction < this.extractionThrottle) {
      console.log(`[BetterDB] Extraction throttled (${timeSinceLastExtraction}ms < ${this.extractionThrottle}ms)`);
      return;
    }

    if (this.isExtracting) {
      console.log('[BetterDB] Extraction already in progress');
      return;
    }

    console.log(`[BetterDB] Scheduling extraction (trigger: ${trigger}, delay: ${delayMs}ms)`);
    
    setTimeout(() => {
      this.extractAndStore().catch(error => {
        console.error('[BetterDB] Auto-extraction failed:', error);
      });
    }, delayMs);
  }

  /**
   * Main extraction method - coordinates all extractors
   * @returns {Promise<Array>} - Array of connections
   */
  async extract() {
    if (this.isExtracting) {
      console.log('[BetterDB] Extraction already in progress, skipping');
      return [];
    }

    this.isExtracting = true;
    this.lastExtractionTime = Date.now();

    try {
      console.log('[BetterDB] Starting comprehensive data extraction');

      // Phase 1: Extract base connection data from primary sources
      const vuexConnections = await this.extractors.vuex.extract();
      const digitalDataConnections = await this.extractors.digitalData.extract();

      console.log(`[BetterDB] Phase 1 complete: ${vuexConnections.length} Vuex + ${digitalDataConnections.length} DigitalData`);
      
      // Debug: Preis-Extraktion
      console.log('[BetterDB] Vuex prices:', vuexConnections.map(c => ({ tripId: c.tripId, priceFrom: c.priceFrom })));
      console.log('[BetterDB] DigitalData prices:', digitalDataConnections.map(c => ({ tripId: c.tripId, priceFrom: c.priceFrom })));

      // Phase 2: Merge primary sources
      let merged = mergeVuexAndDigitalData(vuexConnections, digitalDataConnections);
      console.log(`[BetterDB] Phase 2 complete: ${merged.length} merged connections`);
      console.log('[BetterDB] Merged prices:', merged.map(c => ({ tripId: c.tripId, priceFrom: c.priceFrom })));

      // Phase 3: Apply ctxRecon fallback for missing data
      merged = applyCtxReconFallback(merged);
      console.log(`[BetterDB] Phase 3 complete: ctxRecon fallback applied`);

      // Phase 4: Extract stops from DOM and Network (if needed)
      const connectionsWithStops = merged.filter(c => c.stops && c.stops.length > 0);
      if (connectionsWithStops.length < merged.length) {
        console.log(`[BetterDB] Phase 4: Need stops for ${merged.length - connectionsWithStops.length} connections`);
        
        // Extract DOM stops
        const domStopLists = await this.extractors.dom.extract();
        
        // Get network stops (usually already collected by background listener)
        const networkStopLists = await this.extractors.network.extract();
        
        // Combine all stop sources
        const allStopLists = [...domStopLists, ...networkStopLists];
        console.log(`[BetterDB] Found ${allStopLists.length} stop lists (${domStopLists.length} DOM + ${networkStopLists.length} Network)`);
        
        // Add stops to connections
        merged = addStopsToConnections(merged, allStopLists);
      }

      // Phase 5: Simple price enhancement from network data
      try {
        const networkPrices = this.extractors.network.getNetworkPrices();
        if (networkPrices.length > 0) {
          console.log(`[BetterDB] Found ${networkPrices.length} network prices, applying to connections`);
          merged = this.applySimplePriceMatching(merged, networkPrices);
        }
      } catch (error) {
        console.error('[BetterDB] Simple price matching failed:', error);
      }

      // Phase 6: Final cleanup and validation
      let result = cleanConnections(merged);

      // Phase 7: Ticket splitting analysis (optional, only if enabled)
      try {
        if (ticketSplitter.getStatus().enabled && result.length > 0) {
          console.log('[BetterDB] Phase 7: Starting ticket splitting analysis');
          result = await ticketSplitter.analyzeConnections(result);
          
          const summary = ticketSplitter.getSplittingSummary(result);
          console.log('[BetterDB] Ticket splitting summary:', summary);
        }
      } catch (error) {
        console.error('[BetterDB] Ticket splitting analysis failed, continuing without it:', error);
        // Continue with results even if splitting analysis fails
      }
      
      console.log(`[BetterDB] Extraction complete: ${result.length} final connections`);
      console.log('[BetterDB] Final prices:', result.map(c => ({ tripId: c.tripId, priceFrom: c.priceFrom })));

      return result;
    } finally {
      this.isExtracting = false;
    }
  }

  /**
   * Check if Chrome extension context is valid
   * @returns {boolean} - True if context is valid
   */
  isContextValid() {
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
  isContextInvalidationError(error) {
    const message = error?.message?.toLowerCase() || '';
    return message.includes('extension context invalidated') ||
           message.includes('context invalidated') ||
           message.includes('runtime.lastError');
  }

  /**
   * Safely store data in Chrome storage with context validation
   * @param {Object} data - Data to store
   * @returns {Promise<boolean>} - True if successful
   */
  async safeStorageSet(data) {
    if (!this.isContextValid()) {
      console.warn('[BetterDB] Extension context invalid, cannot store data');
      this.handleContextInvalidation();
      return false;
    }

    try {
      await chrome.storage.local.set(data);
      return true;
    } catch (error) {
      if (this.isContextInvalidationError(error)) {
        console.warn('[BetterDB] Context invalidated during storage operation');
        this.handleContextInvalidation();
        return false;
      }
      throw error; // Re-throw non-context errors
    }
  }

  /**
   * Handle extension context invalidation
   */
  handleContextInvalidation() {
    console.log('[BetterDB] Extension context invalidated - stopping auto-refresh');
    this.autoRefreshEnabled = false;
    this.isExtracting = false;
    
    // Clear any running intervals (if we stored references)
    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
      this.urlCheckInterval = null;
    }
    if (this.contentCheckInterval) {
      clearInterval(this.contentCheckInterval);
      this.contentCheckInterval = null;
    }
  }

  /**
   * Extract data and store in Chrome storage
   * @returns {Promise<void>}
   */
  async extractAndStore() {
    try {
      // Early context validation
      if (!this.isContextValid()) {
        console.warn('[BetterDB] Extension context invalid, aborting extraction');
        this.handleContextInvalidation();
        return;
      }

      const connections = await this.extract();
      
      const data = {
        dbConnections: connections,
        dbExtractedAt: Date.now(),
        dbError: null,
        dbDebugInfo: {
          connectionsCount: connections.length,
          stopsCount: connections.reduce((sum, c) => sum + (c.stops?.length || 0), 0),
          timestamp: new Date().toISOString(),
          extractors: {
            vuex: this.extractors.vuex.isAvailable,
            digitalData: this.extractors.digitalData.isAvailable,
            dom: this.extractors.dom.isAvailable,
            network: this.extractors.network.isAvailable
          }
        }
      };

      const success = await this.safeStorageSet(data);
      if (success) {
        console.log(`[BetterDB] Data stored: ${connections.length} connections`);
      }
    } catch (error) {
      console.error('[BetterDB] Extract and store failed:', error);
      
      // Try to store error info, but handle context invalidation gracefully
      const errorData = {
        dbConnections: [],
        dbExtractedAt: Date.now(),
        dbError: error.message || String(error),
        dbDebugInfo: { 
          error: error.stack || error.toString(),
          timestamp: new Date().toISOString(),
          contextValid: this.isContextValid()
        }
      };

      await this.safeStorageSet(errorData);
    }
  }

  /**
   * Manual extraction (called from popup)
   * @returns {Promise<Object>} - Storage data
   */
  async extractNow() {
    console.log('[BetterDB] Manual extraction requested');
    
    if (!this.isContextValid()) {
      console.warn('[BetterDB] Extension context invalid for manual extraction');
      return {
        dbConnections: [],
        dbExtractedAt: Date.now(),
        dbError: 'Extension context invalidated',
        dbDebugInfo: { contextValid: false, timestamp: new Date().toISOString() }
      };
    }
    
    await this.extractAndStore();
    
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['dbConnections', 'dbExtractedAt', 'dbError', 'dbDebugInfo'], resolve);
      } catch (error) {
        if (this.isContextInvalidationError(error)) {
          resolve({
            dbConnections: [],
            dbExtractedAt: Date.now(),
            dbError: 'Extension context invalidated during retrieval',
            dbDebugInfo: { contextValid: false, timestamp: new Date().toISOString() }
          });
        } else {
          resolve({
            dbConnections: [],
            dbExtractedAt: Date.now(),
            dbError: error.message || String(error),
            dbDebugInfo: { error: error.toString(), timestamp: new Date().toISOString() }
          });
        }
      }
    });
  }

  /**
   * Enable/disable auto-refresh
   * @param {boolean} enabled - Whether to enable auto-refresh
   */
  setAutoRefresh(enabled) {
    this.autoRefreshEnabled = enabled;
    console.log(`[BetterDB] Auto-refresh ${enabled ? 'enabled' : 'disabled'}`);
    
    if (enabled) {
      this.setupAutoRefresh();
    }
  }

  /**
   * Simple price matching logic
   * @param {Array} connections - Array of connections
   * @param {Array} networkPrices - Array of network price data
   * @returns {Array} - Enhanced connections
   */
  applySimplePriceMatching(connections, networkPrices) {
    if (!networkPrices.length) return connections;
    
    return connections.map(connection => {
      // Skip if connection already has a price
      if (connection.priceFrom > 0) return connection;
      
      // Simple matching: use the most recent price
      // In a real implementation, we'd match by journey ID, route, etc.
      const recentPrice = networkPrices[networkPrices.length - 1];
      
      if (recentPrice && recentPrice.price > 0) {
        return {
          ...connection,
          networkPrice: recentPrice.price
        };
      }
      
      return connection;
    });
  }

  /**
   * Get extraction statistics
   * @returns {Object} - Statistics about extractors
   */
  getStats() {
    return {
      isExtracting: this.isExtracting,
      lastExtractionTime: this.lastExtractionTime,
      extractors: Object.fromEntries(
        Object.entries(this.extractors).map(([key, extractor]) => [
          key, 
          {
            available: extractor.checkAvailability(),
            name: extractor.name
          }
        ])
      )
    };
  }
}

// Global instance for the extension
export const dataManager = new DataManager();
