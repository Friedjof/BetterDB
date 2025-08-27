/**
 * Helper utilities for data extraction and formatting
 */

// Normalize text - remove extra whitespace and trim
export const norm = (s) => (s || "").replace(/\s+/g, " ").trim() || null;

// Check if value is an array
export const isArr = (x) => Array.isArray(x);

// Create delay promise
export const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Convert ISO time or time string to short HH:mm format
 * @param {string} iso - ISO timestamp or time string
 * @returns {string|null} - Formatted time string or null
 */
export function timeShort(iso) {
  if (!iso) return null;
  
  // Match ISO format: "2023-12-25T14:30:00Z" -> "14:30"
  const m = String(iso).match(/T(\d{2}):?(\d{2})/);
  if (m) return `${m[1]}:${m[2]}`;
  
  // Match HHMM format: "1430" -> "14:30"
  const m2 = String(iso).match(/^(\d{2})(\d{2})$/);
  if (m2) return `${m2[1]}:${m2[2]}`;
  
  return iso;
}

/**
 * Convert time string to minutes since midnight
 * @param {string} t - Time string in HH:mm format
 * @returns {number|null} - Minutes since midnight or null
 */
export function toMinutes(t) {
  const s = timeShort(t);
  const m = s && String(s).match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/**
 * Extract time from text content
 * @param {string} text - Text containing time
 * @returns {string|null} - Extracted time in HH:mm format or null
 */
export function timeFromText(text) {
  const m = /\b(\d{1,2}:\d{2})\b/.exec(text || "");
  return m ? m[1].padStart(5, "0") : null;
}

/**
 * Extract track/platform information from DOM element
 * @param {Element} el - DOM element containing track info
 * @returns {string|null} - Track number/letter or null
 */
export function extractTrackText(el) {
  if (!el) return null;
  
  const t = (el.textContent || "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  
  // Prefer explicit markers "Gl." or "Gleis" and take the last occurrence
  let m, last = null;
  const re = /(Gl\.|Gleis)\s*([A-Za-z0-9]+)\b/gi;
  while ((m = re.exec(t))) last = m[2];
  if (last) return last;
  
  // Fallback: a plain trailing track token (e.g., ends with a number/letter)
  const m2 = t.match(/\b([A-Za-z]?\d{1,3}[A-Za-z]?)\b(?!.*\b[A-Za-z]?\d{1,3}[A-Za-z]?\b)/);
  return m2 ? m2[1] : null;
}

/**
 * Parse ctxRecon legs for fallback data
 * @param {string} ctx - ctxRecon string
 * @returns {Array} - Array of connection legs
 */
export function parseCtxReconLegs(ctx) {
  if (!ctx || typeof ctx !== "string") return [];
  
  const hki = (ctx.split("¶HKI¶")[1] || "").split("¶")[0];
  if (!hki) return [];
  
  const blocks = hki.split("§");
  const out = [];
  
  for (const p of blocks) {
    const names = [];
    const reNames = /A=1@O=([^@]+)@/g;
    let mN;
    while ((mN = reNames.exec(p))) names.push(mN[1]);
    if (names.length < 2) continue;
    
    const mT = p.match(/\$(\d{12})\$(\d{12})\$/);
    if (!mT) continue;
    
    let veh = null;
    const idx = p.indexOf(mT[0]);
    if (idx >= 0) {
      const tail = p.slice(idx + mT[0].length);
      const mV = tail.match(/^([^$]*)\$/);
      veh = norm(mV && mV[1]);
    }
    
    const dep = mT[1].slice(8, 12);
    const arr = mT[2].slice(8, 12);
    
    out.push({
      start: norm(names[0]) || null,
      destination: norm(names[1]) || null,
      departure: dep,
      arrival: arr,
      vehicle: veh || null,
    });
  }
  
  return out;
}

/**
 * Create connection key for matching/merging
 * @param {Object} connection - Connection object
 * @returns {string} - Unique key for matching
 */
export function keyForMatch(connection) {
  const v0 = (connection.vehicles && connection.vehicles[0]) || "";
  return [
    connection.start || "",
    connection.destination || "",
    connection.departure || "",
    connection.arrival || "",
    v0
  ].join("|");
}
