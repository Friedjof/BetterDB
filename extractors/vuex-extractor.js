/**
 * Vuex Extractor - extracts connections from sessionStorage.vuex
 */
import { BaseExtractor } from './base-extractor.js';
import { isArr } from '../utils/helpers.js';

export class VuexExtractor extends BaseExtractor {
  constructor() {
    super('Vuex');
  }

  /**
   * Check if Vuex data is available in sessionStorage
   * @returns {boolean} - True if Vuex data is available
   */
  checkAvailability() {
    try {
      const vuex = this.getVuex();
      const connections = vuex?.reiseloesungState?.verbindungen;
      this.isAvailable = isArr(connections) && connections.length > 0;
      return this.isAvailable;
    } catch {
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Get Vuex data from sessionStorage
   * @returns {Object|null} - Parsed Vuex data or null
   */
  getVuex() {
    try {
      const raw =
        window.sessionStorage.getItem("vuex") ||
        (window.top && window.top.sessionStorage && window.top.sessionStorage.getItem("vuex"));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Extract connections from Vuex data
   * @returns {Promise<Array>} - Array of connections
   */
  async doExtract() {
    const vuex = this.getVuex();
    const list = vuex?.reiseloesungState?.verbindungen;

    this.debug('Vuex data found', !!vuex);
    this.debug('Verbindungen in Vuex', list ? list.length : 'none');

    if (!isArr(list)) return [];

    const connections = list.map((verbindung, index) => {
      this.debug(`Processing connection ${index + 1}`, {
        tripId: verbindung.tripId,
        abschnitte: verbindung.verbindungsAbschnitte?.length || 0
      });

      // Grunddaten aus der Verbindung extrahieren
      const firstAbschnitt = verbindung.verbindungsAbschnitte?.[0];
      const lastAbschnitt = verbindung.verbindungsAbschnitte?.[verbindung.verbindungsAbschnitte.length - 1];

      // Segments aus verbindungsAbschnitte erstellen
      const segments = verbindung.verbindungsAbschnitte?.map((abschnitt) => ({
        start: abschnitt.abfahrtsOrt || null,
        destination: abschnitt.ankunftsOrt || null,
        departure: abschnitt.abfahrtsZeitpunkt || null,
        arrival: abschnitt.ankunftsZeitpunkt || null,
        vehicle: abschnitt.verkehrsmittel?.name || abschnitt.verkehrsmittel?.gattung || null,
        transferTime: null, // TODO: aus nachfolgendem Abschnitt ableiten
        capacity: null, // TODO: aus Auslastung ableiten falls gewünscht
      })) || [];

      // Alle Zwischenstopps aus allen Abschnitten sammeln
      const allStops = [];
      verbindung.verbindungsAbschnitte?.forEach((abschnitt) => {
        if (abschnitt.halte && Array.isArray(abschnitt.halte)) {
          abschnitt.halte.forEach((halt) => {
            allStops.push({
              name: halt.name || null,
              arrival: halt.ankunftsZeitpunkt || null,
              departure: halt.abfahrtsZeitpunkt || null,
              track: halt.gleis || null
            });
          });
        }
      });

      this.debug(`Connection ${index + 1} extracted stops`, allStops.length);

      // Verkehrsmittel sammeln
      const vehicles = verbindung.verbindungsAbschnitte?.map(a =>
        a.verkehrsmittel?.name || a.verkehrsmittel?.gattung
      ).filter(Boolean) || [];

      // Preis aus verschiedenen Quellen extrahieren
      let priceFrom = null;
      try {
        // Preis-Quellen in Prioritätsreihenfolge
        const priceSources = [
          // 1. angebotsPreis.betrag (HAUPTQUELLE - hier stehen die echten Preise!)
          () => {
            if (verbindung.angebotsPreis && typeof verbindung.angebotsPreis.betrag === 'number') {
              return verbindung.angebotsPreis.betrag > 0 ? verbindung.angebotsPreis.betrag : null;
            }
            return null;
          },
          // 2. reiseAngebote Array
          () => {
            if (verbindung.reiseAngebote && Array.isArray(verbindung.reiseAngebote)) {
              const prices = verbindung.reiseAngebote
                .map(angebot => angebot.preis || angebot.preisVon || angebot.preisAb)
                .filter(p => typeof p === 'number' && p > 0);
              return prices.length > 0 ? Math.min(...prices) : null;
            }
            return null;
          },
          // 3. Direkte Preis-Felder
          () => verbindung.preis || verbindung.preisVon || verbindung.preisAb || null,
          // 4. Erste Verbindungsabschnitt
          () => {
            const first = verbindung.verbindungsAbschnitte?.[0];
            return first?.preis || first?.preisVon || first?.preisAb || null;
          },
          // 5. Tief verschachtelte Preise
          () => {
            for (const abschnitt of verbindung.verbindungsAbschnitte || []) {
              if (abschnitt.angebote && Array.isArray(abschnitt.angebote)) {
                for (const angebot of abschnitt.angebote) {
                  const p = angebot.preis || angebot.preisVon || angebot.preisAb;
                  if (typeof p === 'number' && p > 0) return p;
                }
              }
            }
            return null;
          }
        ];

        for (const source of priceSources) {
          const price = source();
          if (typeof price === 'number' && price > 0) {
            priceFrom = price;
            this.debug(`Price found: ${price} from source ${priceSources.indexOf(source) + 1}`);
            break;
          }
        }

        if (!priceFrom) {
          this.debug('No price found in any source', {
            hasAngebotsPreis: !!(verbindung.angebotsPreis?.betrag),
            hasReiseAngebote: !!(verbindung.reiseAngebote?.length),
            directPrice: verbindung.preis,
            verbindungsAbschnitte: verbindung.verbindungsAbschnitte?.length
          });
        }
      } catch (e) {
        this.debug('Error extracting price', e.message);
      }

      return {
        tripId: verbindung.tripId || null,
        ctxRecon: verbindung.ctxRecon || null,
        start: firstAbschnitt?.abfahrtsOrt || null,
        destination: lastAbschnitt?.ankunftsOrt || null,
        departure: firstAbschnitt?.abfahrtsZeitpunkt || null,
        arrival: lastAbschnitt?.ankunftsZeitpunkt || null,
        countTransfers: verbindung.umstiegsAnzahl ?? null,
        priceFrom: priceFrom,
        vehicles: vehicles,
        segments: segments,
        stops: allStops // Alle Zwischenstopps direkt aus SessionStorage
      };
    });

    return this.validateConnections(connections);
  }
}
