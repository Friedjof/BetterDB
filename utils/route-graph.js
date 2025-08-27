/**
 * Route Graph for ticket splitting analysis
 * Builds a directed graph of train routes and calculates optimal ticket combinations
 */

import { DBUrlParser } from './url-parser.js';

export class RouteGraph {
  constructor() {
    this.nodes = new Map(); // stationName -> station object
    this.edges = new Map(); // "start->end" -> edge object
    this.baseSearchParams = null;
    this.priceCache = new Map(); // Cache for price lookups
  }

  /**
   * Initialize graph from current search results
   * @param {Array} connections - Array of connection objects from data extraction
   * @param {Object} searchParams - Current search parameters
   */
  initialize(connections, searchParams = null) {
    console.log('[BetterDB] Initializing route graph with', connections.length, 'connections');
    
    this.baseSearchParams = searchParams || DBUrlParser.extractCurrentSearchParams();
    this.nodes.clear();
    this.edges.clear();
    
    // Extract all unique stations
    const stations = DBUrlParser.extractStationsFromConnections(connections);
    
    // Add stations as nodes
    stations.forEach(station => {
      this.addNode(station);
    });

    // Build edges from connections
    connections.forEach((conn, connIndex) => {
      this.buildEdgesFromConnection(conn, connIndex);
    });

    console.log(`[BetterDB] Graph initialized: ${this.nodes.size} nodes, ${this.edges.size} edges`);
    this.logGraphSummary();
  }

  /**
   * Add a station node to the graph
   * @param {Object} station - Station object
   */
  addNode(station) {
    if (!station || !station.name) return;
    
    const existingNode = this.nodes.get(station.name);
    if (existingNode) {
      // Merge station data (prefer non-null values)
      if (station.evaId && !existingNode.evaId) {
        existingNode.evaId = station.evaId;
      }
      if (station.coordinates?.latitude && !existingNode.coordinates?.latitude) {
        existingNode.coordinates = station.coordinates;
      }
      existingNode.types = new Set([...existingNode.types, ...station.types]);
    } else {
      this.nodes.set(station.name, {
        name: station.name,
        evaId: station.evaId,
        coordinates: station.coordinates,
        types: station.types,
        metadata: station.metadata || {}
      });
    }
  }

  /**
   * Build edges from a single connection
   * @param {Object} connection - Connection object
   * @param {number} connIndex - Connection index for reference
   */
  buildEdgesFromConnection(connection, connIndex) {
    if (!connection.stops || connection.stops.length < 2) {
      // No intermediate stops, create direct edge
      if (connection.start && connection.destination) {
        this.addEdge(connection.start, connection.destination, {
          type: 'direct',
          connectionIndex: connIndex,
          price: connection.priceFrom,
          departure: connection.departure,
          arrival: connection.arrival,
          vehicles: connection.vehicles
        });
      }
      return;
    }

    // Create edges between consecutive stops
    const allStops = [
      { name: connection.start, departure: connection.departure },
      ...connection.stops,
      { name: connection.destination, arrival: connection.arrival }
    ];

    for (let i = 0; i < allStops.length - 1; i++) {
      const currentStop = allStops[i];
      const nextStop = allStops[i + 1];
      
      if (currentStop.name && nextStop.name) {
        this.addEdge(currentStop.name, nextStop.name, {
          type: 'segment',
          connectionIndex: connIndex,
          price: null, // To be determined by price lookup
          departure: currentStop.departure || currentStop.arrival,
          arrival: nextStop.arrival || nextStop.departure,
          vehicles: connection.vehicles,
          segmentIndex: i
        });
      }
    }

    // Also add direct edge for the full connection
    this.addEdge(connection.start, connection.destination, {
      type: 'full_connection',
      connectionIndex: connIndex,
      price: connection.priceFrom,
      departure: connection.departure,
      arrival: connection.arrival,
      vehicles: connection.vehicles
    });
  }

  /**
   * Add an edge to the graph
   * @param {string} fromStation - Start station name
   * @param {string} toStation - End station name
   * @param {Object} edgeData - Edge metadata
   */
  addEdge(fromStation, toStation, edgeData) {
    if (!fromStation || !toStation || fromStation === toStation) return;
    
    const edgeKey = `${fromStation}->${toStation}`;
    const existingEdge = this.edges.get(edgeKey);
    
    if (existingEdge) {
      // Merge edge data, prefer known prices
      if (edgeData.price && !existingEdge.price) {
        existingEdge.price = edgeData.price;
      }
      existingEdge.connections = existingEdge.connections || [];
      existingEdge.connections.push(edgeData);
    } else {
      this.edges.set(edgeKey, {
        from: fromStation,
        to: toStation,
        price: edgeData.price,
        priceStatus: edgeData.price ? 'known' : 'unknown',
        lastUpdated: edgeData.price ? Date.now() : null,
        connections: [edgeData]
      });
    }
  }

  /**
   * Get all possible route segments for ticket splitting analysis
   * @param {string} startStation - Start station
   * @param {string} endStation - End station
   * @returns {Array} - Array of possible route combinations
   */
  getPossibleRoutes(startStation, endStation) {
    console.log(`[BetterDB] Finding routes from ${startStation} to ${endStation}`);
    
    const routes = [];
    const visited = new Set();
    
    // Find all paths using DFS with cycle detection
    this.findPaths(startStation, endStation, [], visited, routes, 0, 5); // Max 5 hops
    
    console.log(`[BetterDB] Found ${routes.length} possible routes`);
    return routes.sort((a, b) => a.length - b.length); // Sort by number of segments
  }

  /**
   * Recursive path finding with DFS
   * @param {string} current - Current station
   * @param {string} target - Target station
   * @param {Array} path - Current path
   * @param {Set} visited - Visited stations in current path
   * @param {Array} routes - Found complete routes
   * @param {number} depth - Current search depth
   * @param {number} maxDepth - Maximum search depth
   */
  findPaths(current, target, path, visited, routes, depth, maxDepth) {
    if (depth > maxDepth) return;
    if (visited.has(current)) return; // Avoid cycles
    
    if (current === target) {
      if (path.length > 0) { // Only add routes with intermediate steps
        routes.push([...path]);
      }
      return;
    }

    visited.add(current);
    
    // Find all outgoing edges from current station
    for (const [edgeKey, edge] of this.edges) {
      if (edge.from === current) {
        const newPath = [...path, edge];
        this.findPaths(edge.to, target, newPath, visited, routes, depth + 1, maxDepth);
      }
    }
    
    visited.delete(current);
  }

  /**
   * Calculate the best ticket splitting options for a route
   * @param {string} startStation - Start station
   * @param {string} endStation - End station
   * @returns {Promise<Array>} - Array of ticket splitting options with prices
   */
  async calculateTicketSplittingOptions(startStation, endStation) {
    console.log(`[BetterDB] Calculating ticket splitting options: ${startStation} -> ${endStation}`);
    
    // Get direct connection price for comparison
    const directPrice = this.getDirectPrice(startStation, endStation);
    
    // Get all possible routes
    const routes = this.getPossibleRoutes(startStation, endStation);
    
    // Calculate prices for each route
    const options = [];
    
    for (const route of routes.slice(0, 10)) { // Limit to top 10 routes to avoid too many API calls
      try {
        const routePrice = await this.calculateRoutePrice(route);
        const savings = directPrice ? (directPrice - routePrice) : 0;
        
        options.push({
          route: route.map(edge => `${edge.from} -> ${edge.to}`),
          segments: route,
          totalPrice: routePrice,
          directPrice: directPrice,
          savings: savings,
          savingsPercentage: directPrice ? ((savings / directPrice) * 100).toFixed(1) : 0,
          segmentCount: route.length
        });
      } catch (error) {
        console.warn('[BetterDB] Failed to calculate price for route:', route, error);
      }
    }

    // Sort by savings (descending)
    options.sort((a, b) => b.savings - a.savings);
    
    console.log('[BetterDB] Ticket splitting analysis complete:', options);
    return options;
  }

  /**
   * Get direct connection price between two stations
   * @param {string} startStation - Start station
   * @param {string} endStation - End station
   * @returns {number|null} - Direct price or null if not found
   */
  getDirectPrice(startStation, endStation) {
    const edgeKey = `${startStation}->${endStation}`;
    const edge = this.edges.get(edgeKey);
    return edge?.price || null;
  }

  /**
   * Calculate total price for a route (sum of segment prices)
   * @param {Array} route - Array of edges representing the route
   * @returns {Promise<number>} - Total route price
   */
  async calculateRoutePrice(route) {
    let totalPrice = 0;
    
    for (const edge of route) {
      let segmentPrice = edge.price;
      
      // If price is not known, attempt to fetch it
      if (!segmentPrice) {
        segmentPrice = await this.fetchSegmentPrice(edge.from, edge.to);
      }
      
      if (segmentPrice) {
        totalPrice += segmentPrice;
      } else {
        throw new Error(`Could not determine price for segment ${edge.from} -> ${edge.to}`);
      }
    }
    
    return totalPrice;
  }

  /**
   * Fetch price for a specific segment (stub implementation)
   * @param {string} fromStation - Start station
   * @param {string} toStation - End station
   * @returns {Promise<number|null>} - Segment price or null
   */
  async fetchSegmentPrice(fromStation, toStation) {
    const cacheKey = `${fromStation}->${toStation}`;
    
    // Check cache first
    if (this.priceCache.has(cacheKey)) {
      const cached = this.priceCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
        return cached.price;
      }
    }

    try {
      console.log(`[BetterDB] Fetching price for ${fromStation} -> ${toStation}`);
      
      // Generate search URL for this segment
      if (!this.baseSearchParams) {
        throw new Error('No base search parameters available');
      }

      const segment = {
        startStation: fromStation,
        endStation: toStation
      };

      const searchUrl = DBUrlParser.generateSearchUrl(this.baseSearchParams, segment);
      
      if (!searchUrl) {
        throw new Error('Could not generate search URL');
      }

      // TODO: Implement actual price fetching
      // For now, return null to indicate price needs to be fetched
      console.warn('[BetterDB] Price fetching not yet implemented for:', searchUrl);
      
      // Cache the null result temporarily
      this.priceCache.set(cacheKey, {
        price: null,
        timestamp: Date.now()
      });
      
      return null;
      
    } catch (error) {
      console.error(`[BetterDB] Failed to fetch price for ${fromStation} -> ${toStation}:`, error);
      return null;
    }
  }

  /**
   * Log a summary of the current graph
   */
  logGraphSummary() {
    console.log('[BetterDB] Graph Summary:');
    console.log(`- Nodes: ${this.nodes.size}`);
    console.log(`- Edges: ${this.edges.size}`);
    
    const edgesWithPrices = Array.from(this.edges.values()).filter(e => e.price);
    console.log(`- Edges with prices: ${edgesWithPrices.length}`);
    
    const nodesList = Array.from(this.nodes.keys()).slice(0, 10);
    console.log(`- Sample nodes: ${nodesList.join(', ')}${this.nodes.size > 10 ? '...' : ''}`);
  }

  /**
   * Export graph data for debugging
   * @returns {Object} - Graph data
   */
  exportGraph() {
    return {
      nodes: Array.from(this.nodes.entries()),
      edges: Array.from(this.edges.entries()),
      baseSearchParams: this.baseSearchParams,
      stats: {
        nodeCount: this.nodes.size,
        edgeCount: this.edges.size,
        edgesWithPrices: Array.from(this.edges.values()).filter(e => e.price).length
      }
    };
  }
}
