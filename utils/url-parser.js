/**
 * URL Parser for Deutsche Bahn search URLs
 * Handles parsing and generation of DB search URLs for ticket splitting analysis
 */

export class DBUrlParser {
  /**
   * Parse a DB search URL to extract search parameters
   * @param {string} url - The DB search URL
   * @returns {Object} - Parsed search parameters
   */
  static parseSearchUrl(url) {
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.hash.substring(1)); // Remove # from hash
      
      const result = {
        startStation: this.decodeParam(params.get('so')),
        endStation: this.decodeParam(params.get('zo')),
        startStationId: params.get('soid'),
        endStationId: params.get('zoid'),
        datetime: params.get('hd'),
        class: params.get('kl'),
        passengers: params.get('r'),
        vehicleTypes: params.get('vm'),
        isOneWay: params.get('s') === 'true',
        searchType: params.get('sts'),
        startStationEvaId: params.get('soei'),
        endStationEvaId: params.get('zoei'),
        originalUrl: url
      };

      console.log('[BetterDB] Parsed DB URL:', result);
      return result;
    } catch (error) {
      console.error('[BetterDB] Failed to parse DB URL:', error);
      return null;
    }
  }

  /**
   * Generate a DB search URL for a specific route segment
   * @param {Object} baseParams - Base search parameters from original search
   * @param {Object} segment - Segment with start/end stations
   * @returns {string} - Generated DB search URL
   */
  static generateSearchUrl(baseParams, segment) {
    if (!baseParams || !segment) {
      console.error('[BetterDB] Missing parameters for URL generation');
      return null;
    }

    const params = new URLSearchParams();
    
    // Core search parameters
    params.set('sts', 'true');
    params.set('so', this.encodeStationName(segment.startStation));
    params.set('zo', this.encodeStationName(segment.endStation));
    
    // Station IDs (if available)
    if (segment.startStationId) {
      params.set('soid', segment.startStationId);
      params.set('soei', segment.startStationEvaId || '');
    }
    if (segment.endStationId) {
      params.set('zoid', segment.endStationId);
      params.set('zoei', segment.endStationEvaId || '');
    }

    // Copy parameters from base search
    params.set('kl', baseParams.class || '2');
    params.set('hd', baseParams.datetime || new Date().toISOString());
    params.set('r', baseParams.passengers || '13:16:KLASSENLOS:1');
    params.set('vm', baseParams.vehicleTypes || '00,01,02,03,04,05,06,07,08,09');
    params.set('s', baseParams.isOneWay ? 'true' : 'false');
    
    // Additional parameters
    params.set('sot', 'ST');
    params.set('zot', 'ST');
    params.set('hza', 'D');
    params.set('hz', '[]');
    params.set('ar', 'false');
    params.set('d', 'false');
    params.set('fm', 'false');
    params.set('bp', 'false');
    params.set('dlt', 'false');
    params.set('dltv', 'false');

    const url = `https://www.bahn.de/buchung/fahrplan/suche#${params.toString()}`;
    console.log('[BetterDB] Generated search URL:', url);
    
    return url;
  }

  /**
   * Extract current search parameters from the page
   * @returns {Object|null} - Current search parameters or null if not on search page
   */
  static extractCurrentSearchParams() {
    try {
      const currentUrl = window.location.href;
      if (!currentUrl.includes('bahn.de') || !currentUrl.includes('fahrplan/suche')) {
        console.warn('[BetterDB] Not on DB search page');
        return null;
      }

      return this.parseSearchUrl(currentUrl);
    } catch (error) {
      console.error('[BetterDB] Failed to extract current search params:', error);
      return null;
    }
  }

  /**
   * Decode URL-encoded station name
   * @param {string} encoded - URL-encoded station name
   * @returns {string} - Decoded station name
   */
  static decodeParam(encoded) {
    if (!encoded) return '';
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  }

  /**
   * Encode station name for URL
   * @param {string} stationName - Station name to encode
   * @returns {string} - URL-encoded station name
   */
  static encodeStationName(stationName) {
    if (!stationName) return '';
    return encodeURIComponent(stationName);
  }

  /**
   * Generate station ID string in DB format
   * @param {Object} station - Station object with name, coordinates, etc.
   * @returns {string} - DB-formatted station ID
   */
  static generateStationId(station) {
    if (!station) return '';
    
    // DB format: A=1@O=Station Name@X=longitude@Y=latitude@U=80@L=evaId@B=1@p=timestamp@i=U×evaId
    const parts = [
      'A=1',
      `O=${station.name || ''}`,
      `X=${station.longitude || '0'}`,
      `Y=${station.latitude || '0'}`,
      'U=80',
      `L=${station.evaId || ''}`,
      'B=1',
      `p=${Date.now()}`,
      `i=U×${station.evaId || ''}`
    ];

    return encodeURIComponent(parts.join('@'));
  }

  /**
   * Validate if a URL looks like a valid DB search URL
   * @param {string} url - URL to validate
   * @returns {boolean} - True if valid DB search URL
   */
  static isValidDBSearchUrl(url) {
    try {
      if (!url) return false;
      
      const urlObj = new URL(url);
      const isDBDomain = urlObj.hostname.includes('bahn.de');
      const isSearchPath = urlObj.pathname.includes('fahrplan/suche');
      const hasHashParams = urlObj.hash && urlObj.hash.length > 1;
      
      return isDBDomain && isSearchPath && hasHashParams;
    } catch {
      return false;
    }
  }

  /**
   * Extract all unique stations from current search results
   * @param {Array} connections - Array of connection objects
   * @returns {Array} - Array of unique stations with metadata
   */
  static extractStationsFromConnections(connections) {
    const stationsMap = new Map();
    
    connections.forEach(conn => {
      // Add start and end stations
      if (conn.start) {
        this.addStationToMap(stationsMap, conn.start, 'start');
      }
      if (conn.destination) {
        this.addStationToMap(stationsMap, conn.destination, 'end');
      }
      
      // Add all stops
      (conn.stops || []).forEach(stop => {
        this.addStationToMap(stationsMap, stop.name, 'stop', stop);
      });
      
      // Add segment stations
      (conn.segments || []).forEach(segment => {
        if (segment.start) {
          this.addStationToMap(stationsMap, segment.start, 'segment_start');
        }
        if (segment.destination) {
          this.addStationToMap(stationsMap, segment.destination, 'segment_end');
        }
      });
    });

    const stations = Array.from(stationsMap.values());
    console.log(`[BetterDB] Extracted ${stations.length} unique stations:`, stations.map(s => s.name));
    
    return stations;
  }

  /**
   * Add station to stations map with deduplication
   * @param {Map} stationsMap - Map to add station to
   * @param {string} stationName - Name of the station
   * @param {string} type - Type of station (start, end, stop, etc.)
   * @param {Object} metadata - Additional station metadata
   */
  static addStationToMap(stationsMap, stationName, type, metadata = {}) {
    if (!stationName || typeof stationName !== 'string') return;
    
    const cleanName = stationName.trim();
    if (!cleanName) return;
    
    if (!stationsMap.has(cleanName)) {
      stationsMap.set(cleanName, {
        name: cleanName,
        types: new Set([type]),
        metadata: { ...metadata },
        evaId: metadata.evaId || null,
        coordinates: {
          latitude: metadata.latitude || null,
          longitude: metadata.longitude || null
        }
      });
    } else {
      // Add type to existing station
      const existing = stationsMap.get(cleanName);
      existing.types.add(type);
      
      // Merge metadata (prefer non-null values)
      if (metadata.evaId && !existing.evaId) {
        existing.evaId = metadata.evaId;
      }
      if (metadata.latitude && !existing.coordinates.latitude) {
        existing.coordinates.latitude = metadata.latitude;
      }
      if (metadata.longitude && !existing.coordinates.longitude) {
        existing.coordinates.longitude = metadata.longitude;
      }
    }
  }
}
