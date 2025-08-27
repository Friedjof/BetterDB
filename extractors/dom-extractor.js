/**
 * DOM Extractor - extracts stops from DOM using "silent expand" technique
 */
import { BaseExtractor } from './base-extractor.js';
import { qsaDeep, qsDeep, clickAndWait } from '../utils/dom-utils.js';
import { timeFromText, extractTrackText, delay } from '../utils/helpers.js';

export class DOMExtractor extends BaseExtractor {
  constructor() {
    super('DOM');
  }

  /**
   * Check if DOM extraction is possible
   * @returns {boolean} - True if DOM elements are available
   */
  checkAvailability() {
    try {
      const toggleButtons = this.findToggleButtons();
      const stopContainers = this.findStopContainers();
      this.isAvailable = toggleButtons.length > 0 || stopContainers.length > 0;
      return this.isAvailable;
    } catch {
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Find toggle buttons for expanding stops
   * @returns {Array} - Array of toggle button elements
   */
  findToggleButtons() {
    const selectorCandidates = [
      ".verbindungs-zwischenhalte__toggle-button",
      "[class*='zwischenhalte'] button",
      "button[data-testid*='zwischenhalte']",
      "button[data-testid*='stops']",
      "button[data-testid*='stopovers']",
      "button[aria-controls*='zwischenhalte']",
      "button[aria-controls*='halte']",
      "button[aria-controls*='stops']",
      "button[aria-controls*='stopovers']",
      "[role='button'][aria-expanded]",
      "button[class*='toggle']",
      "button[class*='expand']",
      "button[class*='Detail']",
      "button[class*='details']",
      "button[class*='show']",
      "summary[class*='zwischenhalte']",
      "summary[class*='stops']",
      "details > summary"
    ];

    return qsaDeep(selectorCandidates.join(",")).filter((b) => {
      const txt = (b.textContent || "").trim();
      const aria = (b.getAttribute('aria-label') || '').trim();
      return /(Zwischenhalte|Halte|Stops|Haltestellen|Details|Stopovers|Zeige|Show)/i.test(txt) ||
             /(Zwischenhalte|Halte|Stops|Haltestellen|Details|Stopovers)/i.test(aria);
    });
  }

  /**
   * Find containers with stop information
   * @returns {Array} - Array of stop container elements
   */
  findStopContainers() {
    return qsaDeep([
      ".verbindungs-zwischenhalte",
      "[class*='verbindungs-zwischenhalte']",
      "[class*='zwischenhalte']",
      "[class*='zwischenhalt-container']",
      "[data-testid*='zwischenhalte']",
      "[data-testid*='stops']",
      "details[open] [class*='halt'], details[open] [class*='stop']"
    ].join(","));
  }

  /**
   * Extract stops using silent expand technique
   * @returns {Promise<Array>} - Array of stop lists
   */
  async doExtract() {
    this.debug('Starting silentlyExpandAllForStops');
    
    // Track opened elements for cleanup
    const opened = new Set();
    const toClose = [];

    // Multi-pass opening of toggle buttons
    for (let pass = 0; pass < 3; pass++) {
      const allButtons = this.findToggleButtons();
      this.debug(`Pass ${pass}: Found ${allButtons.length} buttons`);

      const targetButtons = allButtons.filter((b) => {
        if (opened.has(b)) return false;
        const expanded = b.getAttribute("aria-expanded") === "true" || 
                        b.classList.contains("verbindungs-zwischenhalte__toggle-button--expanded");
        return !expanded;
      });

      this.debug(`Pass ${pass}: ${targetButtons.length} target buttons to click`);
      if (targetButtons.length > 0) {
        this.debug('Target button texts:', targetButtons.map(b => b.textContent?.trim()).slice(0, 3));
      }

      if (!targetButtons.length) break;

      for (const b of targetButtons) {
        await clickAndWait(b, 400);
        opened.add(b);
        toClose.push(b);
      }
      await delay(500);
    }

    // Extract data from opened containers
    const blocks = [...new Set(this.findStopContainers())];
    this.debug(`Found ${blocks.length} stop blocks for processing`);

    const stopLists = blocks.map((blk, idx) => {
      const stops = this.extractStopsFromBlock(blk, idx);
      return stops;
    }).filter((l) => l.length);

    // Store DOM stops globally for later use (compatibility with existing code)
    window.__bdvExtractedStops = stopLists;

    // Restore original state
    for (const b of toClose) {
      await clickAndWait(b, 30);
    }

    this.debug(`Extracted ${stopLists.length} stop lists`);
    return stopLists;
  }

  /**
   * Extract stops from a single block/container
   * @param {Element} block - Container element
   * @param {number} idx - Block index for debugging
   * @returns {Array} - Array of stops
   */
  extractStopsFromBlock(block, idx) {
    let rows = qsaDeep([
      ".verbindungs-zwischenhalt",
      "[class*='verbindungs-zwischenhalt']",
      "[data-testid*='zwischenhalt']",
      "[class*='zwischenhalt-item']"
    ].join(","), block);

    if (!rows.length) {
      rows = [...qsaDeep("li", block)].filter((r) =>
        qsDeep(".verbindungs-zwischenhalt__name, .test-zwischenhalt-name, [class*='zwischenhalt__name']", r) &&
        qsDeep("[class*='ankunft'], [class*='abfahrt'], [class*='gleis']", r)
      );
    }

    const seen = new Set();
    const list = [];

    [...rows].forEach((el) => {
      const arrivalRaw = qsDeep(".verbindungs-zwischenhalt__ankunfts-zeit, [class*='ankunft']", el)?.textContent || "";
      const departureRaw = qsDeep(".verbindungs-zwischenhalt__abfahrts-zeit, [class*='abfahrt']", el)?.textContent || "";
      const arrival = timeFromText(arrivalRaw);
      const departure = timeFromText(departureRaw);

      // Name: prefer specific selectors, avoid overly generic a/span
      const nameEl = qsDeep(
        ".verbindungs-zwischenhalt__name, .test-zwischenhalt-name, [class*='zwischenhalt__name']",
        el
      ) || null;
      
      let name = (nameEl?.textContent || "").replace(/\s+/g, " ").trim() || null;
      
      if (!name) {
        // Fallback: try a child that looks like a station label without known noise words
        const guess = [...qsaDeep("span, a", el)]
          .map((n) => (n.textContent || "").replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .find((txt) => !/(Auslastung|Sitzplatz|Reservierung|Gleis|Gl\.)/i.test(txt));
        name = guess || null;
      }
      
      // Require a station-like name (contains letters), avoid names containing Gleis labels anywhere
      if (name && (!/[A-Za-zÄÖÜäöüß]/.test(name) || /(Gleis|Gl\.)/i.test(name))) name = null;

      // Track
      let track = extractTrackText(
        qsDeep(".verbindungs-zwischenhalt__gleis, [class*='gleis']", el)
      );

      // Filter out non-stop informational rows (capacity/hints)
      const rowText = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (/(Auslastung|Sitzplatz|Reservierung)/i.test(rowText)) return;

      // Must have a plausible station name
      if (!name || /^(Gleis|Gl\.|Auslastung)/i.test(name)) return;

      // If no time present, likely not a stop row (track is optional)
      if (!arrival && !departure) return;

      const key = [arrival || "", departure || "", name || "", track || ""].join("|");
      if (seen.has(key)) return;
      seen.add(key);

      list.push({
        arrival: arrival || null,
        departure: departure || null,
        name,
        track: track || null,
      });
    });

    this.debug(`Block ${idx}: Extracted ${list.length} stops`);
    if (list.length > 0) {
      this.debug(`Block ${idx} stops:`, list.map(s => s.name).slice(0, 3));
    }
    
    return list;
  }
}
