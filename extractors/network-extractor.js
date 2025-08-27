/**
 * Network Extractor - collects stops from network hook (pagehook.js)
 */
import { BaseExtractor } from './base-extractor.js';
import { timeShort } from '../utils/helpers.js';

export class NetworkExtractor extends BaseExtractor {
  constructor() {
    super('Network');
    this.setupMessageListener();
  }

  /**
   * Check if network data is available
   * @returns {boolean} - True if network blocks are available
   */
  checkAvailability() {
    try {
      const blocks = this.getNetworkBlocks();
      this.isAvailable = blocks.length > 0;
      return this.isAvailable;
    } catch {
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Get network blocks from global storage
   * @returns {Array} - Array of stop blocks from network
   */
  getNetworkBlocks() {
    return (window.__bdvNetBlocks || []).filter(b => Array.isArray(b) && b.length > 0);
  }

  /**
   * Setup message listener for network data
   */
  setupMessageListener() {
    // Listen for messages from pagehook.js
    window.addEventListener('message', (event) => {
      try {
        if (event && event.source === window && event.data) {
          // Handle stops data
          if (event.data.type === 'BETTERDB_STOPS' && Array.isArray(event.data.blocks)) {
            this.processNetworkBlocks(event.data.blocks);
          }
          // Handle price data
          if (event.data.type === 'BETTERDB_PRICES' && Array.isArray(event.data.prices)) {
            this.processNetworkPrices(event.data.prices);
          }
        }
      } catch (error) {
        this.debug('Error processing network message:', error);
      }
    });
  }

  /**
   * Process incoming network blocks from pagehook
   * @param {Array} blocks - Array of stop blocks
   */
  processNetworkBlocks(blocks) {
    // Keep most recent up to 30 blocks
    const arr = (window.__bdvNetBlocks = window.__bdvNetBlocks || []);
    
    for (const block of blocks) {
      if (Array.isArray(block) && block.length) {
        const normalizedBlock = this.normalizeNetworkBlock(block);
        arr.push(normalizedBlock);
      }
    }
    
    if (arr.length > 30) {
      arr.splice(0, arr.length - 30);
    }

    this.debug(`Network blocks updated: ${arr.length} total blocks`);
  }

  /**
   * Normalize a network block to standard format
   * @param {Array} block - Raw block from network
   * @returns {Array} - Normalized stops
   */
  normalizeNetworkBlock(block) {
    return block.map(stop => ({
      arrival: this.normalizeTime(stop.arrival || stop.aTime || stop.a),
      departure: this.normalizeTime(stop.departure || stop.dTime || stop.d),
      name: this.normalizeName(stop),
      track: this.normalizeTrack(stop)
    })).filter(stop => stop.name);
  }

  /**
   * Normalize time format
   * @param {string} time - Raw time string
   * @returns {string|null} - Normalized HH:MM format
   */
  normalizeTime(time) {
    if (!time) return null;
    const normalized = timeShort(time);
    return normalized === time ? null : normalized; // Return null if no conversion happened
  }

  /**
   * Normalize stop name
   * @param {Object} stop - Stop object
   * @returns {string|null} - Normalized stop name
   */
  normalizeName(stop) {
    const name = stop.name || 
                 (stop.stop && stop.stop.name) || 
                 (stop.loc && stop.loc.name) || 
                 stop.stopName || 
                 null;
    
    return name ? String(name).replace(/\s+/g, ' ').trim() : null;
  }

  /**
   * Normalize track/platform information
   * @param {Object} stop - Stop object
   * @returns {string|null} - Normalized track
   */
  normalizeTrack(stop) {
    const track = stop.platform || 
                  stop.track || 
                  stop.platf || 
                  stop.pl || 
                  stop.trk || 
                  stop.aPlatf || 
                  stop.dPlatf || 
                  null;
    
    return track ? String(track).trim() : null;
  }

  /**
   * Extract stops from network data
   * @returns {Promise<Array>} - Array of stop lists
   */
  async doExtract() {
    const blocks = this.getNetworkBlocks();
    this.debug(`Found ${blocks.length} network blocks`);

    if (!blocks.length) {
      // Wait a bit to see if network data comes in
      await new Promise(resolve => setTimeout(resolve, 1000));
      const blocksAfterWait = this.getNetworkBlocks();
      this.debug(`After wait: ${blocksAfterWait.length} network blocks`);
      return blocksAfterWait;
    }

    return blocks;
  }

  /**
   * Clear old network data
   */
  clearNetworkBlocks() {
    window.__bdvNetBlocks = [];
    this.debug('Network blocks cleared');
  }

  /**
   * Process incoming price data from pagehook
   * @param {Array} prices - Array of price data
   */
  processNetworkPrices(prices) {
    // Keep price data in global storage for access
    const arr = (window.__bdvNetPrices = window.__bdvNetPrices || []);
    
    for (const price of prices) {
      arr.push({
        ...price,
        timestamp: Date.now()
      });
    }
    
    // Keep only recent 20 prices
    if (arr.length > 20) {
      arr.splice(0, arr.length - 20);
    }

    this.debug(`Network prices updated: ${arr.length} total prices`);
  }

  /**
   * Get network price data
   * @returns {Array} - Array of price data
   */
  getNetworkPrices() {
    return window.__bdvNetPrices || [];
  }

  /**
   * Get statistics about network data
   * @returns {Object} - Statistics object
   */
  getStats() {
    const blocks = this.getNetworkBlocks();
    const totalStops = blocks.reduce((sum, block) => sum + block.length, 0);
    const prices = this.getNetworkPrices();
    
    return {
      blockCount: blocks.length,
      totalStops: totalStops,
      avgStopsPerBlock: blocks.length ? (totalStops / blocks.length).toFixed(1) : 0,
      priceCount: prices.length
    };
  }
}
