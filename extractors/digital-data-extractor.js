/**
 * DigitalData Extractor - extracts connections from window.digitalData analytics
 */
import { BaseExtractor } from './base-extractor.js';
import { isArr } from '../utils/helpers.js';

export class DigitalDataExtractor extends BaseExtractor {
  constructor() {
    super('DigitalData');
  }

  /**
   * Check if digitalData is available
   * @returns {boolean} - True if digitalData is available
   */
  checkAvailability() {
    try {
      const digitalData = this.getDigitalData();
      this.isAvailable = Array.isArray(digitalData) && digitalData.length > 0;
      return this.isAvailable;
    } catch {
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Get digitalData from window
   * @returns {Array} - DigitalData array
   */
  getDigitalData() {
    try {
      return (window.digitalData && isArr(window.digitalData))
        ? window.digitalData
        : (window.top && window.top.digitalData && isArr(window.top.digitalData) 
           ? window.top.digitalData 
           : []);
    } catch {
      return [];
    }
  }

  /**
   * Extract connections from digitalData
   * @returns {Promise<Array>} - Array of connections
   */
  async doExtract() {
    const digitalData = this.getDigitalData();
    const events = digitalData.filter(
      (e) => e && typeof e === "object" && /connection\.info|restore\.info|search\.info/i.test(e.event || "")
    );

    this.debug('DigitalData events found', events.length);

    const connections = [];
    
    for (const ev of events) {
      const arr =
        (isArr(ev.connections) && ev.connections) ||
        (ev.search && isArr(ev.search.connections) && ev.search.connections) ||
        [];

      this.debug(`Processing event with ${arr.length} connections`, ev.event);

      for (const r of arr) {
        // Preis aus verschiedenen Quellen extrahieren
        let priceFrom = null;
        const priceSources = [
          r.priceFrom,
          r.regularPrice, 
          r.price,
          r.minPrice,
          r.cheapestPrice,
          r.basePrice,
          r.standardPrice
        ];
        
        for (const price of priceSources) {
          if (typeof price === 'number' && price > 0) {
            priceFrom = price;
            break;
          }
        }

        // Auch in nested Objekten suchen
        if (!priceFrom && r.pricing) {
          const nestedPrices = [
            r.pricing.from,
            r.pricing.min,
            r.pricing.base,
            r.pricing.standard
          ];
          for (const price of nestedPrices) {
            if (typeof price === 'number' && price > 0) {
              priceFrom = price;
              break;
            }
          }
        }

        const connection = {
          tripId: r.tripId || null,            // häufig null in DD
          ctxRecon: r.ctxRecon || null,        // meist nicht enthalten
          start: r.start?.name || null,
          destination: r.destination?.name || null,
          departure: r.departure || null,
          arrival: r.arrival || null,
          countTransfers: r.countTransfers ?? null,
          priceFrom: priceFrom,
          vehicles: r.vehicles || [],
          segments: this.extractSegments(r.connectionSegments),
          stops: [] // DigitalData hat normalerweise keine detaillierten Stops
        };

        // Debug: Log price extraction
        if (!priceFrom) {
          this.debug('No price found in DigitalData connection', {
            availableFields: Object.keys(r),
            checkedPrices: priceSources,
            hasPricing: !!r.pricing
          });
        } else {
          this.debug(`DigitalData price found: ${priceFrom}`);
        }

        connections.push(connection);
      }
    }

    this.debug('Total connections extracted', connections.length);
    return this.validateConnections(connections);
  }

  /**
   * Extract segments from connectionSegments data
   * @param {Array} connectionSegments - Raw segments data
   * @returns {Array} - Normalized segments
   */
  extractSegments(connectionSegments) {
    if (!isArr(connectionSegments)) return [];

    return connectionSegments.map((s) => ({
      start: s.start?.name || null,
      destination: s.destination?.name || null,
      departure: s.departure || null,
      arrival: s.arrival || null,
      vehicle: s.vehicle || null,
      transferTime: s.transferTime || null,
      capacity: s.capacityShortText || null,
    }));
  }
}
