/**
 * Data merger utilities for combining data from different sources
 */
import { keyForMatch, parseCtxReconLegs, norm, isArr } from './helpers.js';

/**
 * Merge Vuex and DigitalData connections intelligently
 * @param {Array} vuexConnections - Connections from Vuex
 * @param {Array} digitalDataConnections - Connections from DigitalData
 * @returns {Array} - Merged connections
 */
export function mergeVuexAndDigitalData(vuexConnections, digitalDataConnections) {
  if (!vuexConnections.length && !digitalDataConnections.length) return [];
  if (!vuexConnections.length) return digitalDataConnections;
  if (!digitalDataConnections.length) return vuexConnections;

  const map = new Map();
  vuexConnections.forEach((c) => map.set(keyForMatch(c), c));

  const out = [];
  for (const d of digitalDataConnections) {
    const k = keyForMatch(d);
    const v = map.get(k);
    if (v) {
      // Vuex bevorzugt für tripId/ctxRecon, Rest von DD nehmen wenn Vuex leer
      out.push({
        tripId: v.tripId || d.tripId || null,
        ctxRecon: v.ctxRecon || d.ctxRecon || null,
        start: v.start || d.start || null,
        destination: v.destination || d.destination || null,
        departure: v.departure || d.departure || null,
        arrival: v.arrival || d.arrival || null,
        countTransfers: Number.isFinite(v.countTransfers) ? v.countTransfers : d.countTransfers ?? null,
        priceFrom: d.priceFrom ?? v.priceFrom ?? null, // DigitalData Preise bevorzugen!
        vehicles: v.vehicles?.length ? v.vehicles : d.vehicles || [],
        segments: (v.segments && v.segments.length ? v.segments : d.segments) || [],
        stops: v.stops || d.stops || []
      });
      map.delete(k);
    } else {
      out.push(d);
    }
  }
  
  // Vuex-Reste, die DD nicht kannte
  for (const rest of map.values()) out.push(rest);
  return out;
}

/**
 * Apply fallback data from ctxRecon parsing
 * @param {Array} connections - Array of connections
 * @returns {Array} - Connections with fallback data applied
 */
export function applyCtxReconFallback(connections) {
  return connections.map((c) => {
    if (!c?.ctxRecon) return c;
    
    try {
      const legs = parseCtxReconLegs(c.ctxRecon);
      if (!legs.length) return c;
      
      const vehicles = Array.from(new Set(
        legs
          .map((l) => (l.vehicle || "").trim())
          .filter(Boolean)
          .map((v) => v.replace(/\s+/g, " ").split(" ")[0])
      ));
      
      const fallback = {
        start: legs[0].start || null,
        destination: legs[legs.length - 1].destination || null,
        departure: legs[0].departure || null,
        arrival: legs[legs.length - 1].arrival || null,
        countTransfers: Math.max(legs.length - 1, 0),
        vehicles,
        segments: legs,
      };
      
      return {
        ...c,
        start: c.start || fallback.start || null,
        destination: c.destination || fallback.destination || null,
        departure: c.departure || fallback.departure || null,
        arrival: c.arrival || fallback.arrival || null,
        countTransfers: Number.isFinite(c.countTransfers) ? c.countTransfers : fallback.countTransfers ?? null,
        vehicles: (c.vehicles && c.vehicles.length ? c.vehicles : fallback.vehicles) || [],
        segments: (c.segments && c.segments.length ? c.segments : fallback.segments) || [],
      };
    } catch {
      return c;
    }
  });
}

/**
 * Add stops to connections from extracted stop lists
 * @param {Array} connections - Array of connections
 * @param {Array} stopLists - Array of stop lists from different sources
 * @returns {Array} - Connections with stops added
 */
export function addStopsToConnections(connections, stopLists) {
  const out = connections.map((c) => ({ ...c, stops: c.stops || [] }));
  
  // Wenn bereits Stops aus Vuex vorhanden sind, diese bevorzugen
  const connectionsWithVuexStops = out.filter(c => c.stops && c.stops.length > 0);
  if (connectionsWithVuexStops.length === out.length) {
    console.log('[BetterDB] All connections have stops from Vuex, skipping DOM extraction');
    return out;
  }

  if (!stopLists.length) return out;

  const segWindows = out.map((c) => {
    const segs = (c.segments || []).map((s) => ({
      dep: toMinutes(timeShort(s.departure)),
      arr: toMinutes(timeShort(s.arrival)),
    }));
    const dep = toMinutes(timeShort(c.departure));
    const arr = toMinutes(timeShort(c.arrival));
    return { segs, dep, arr };
  });

  function blockWindow(list) {
    const times = list
      .map((st) => [toMinutes(st.departure), toMinutes(st.arrival)])
      .flat()
      .filter((v) => v != null)
      .sort((a, b) => a - b);
    if (!times.length) return { min: null, max: null };
    return { min: times[0], max: times[times.length - 1] };
  }

  const allBlocks = stopLists.filter((b) => Array.isArray(b) && b.length);

  // Try to assign each block to connections that don't have Vuex stops
  const assigned = new Array(out.length).fill(0);
  for (const list of allBlocks) {
    const win = blockWindow(list);
    let bestIdx = -1;
    let bestScore = -1;
    
    for (let i = 0; i < out.length; i++) {
      // Skip connections that already have Vuex stops
      if (out[i].stops && out[i].stops.length > 0) continue;
      
      const w = segWindows[i];
      const dep = w.dep, arr = w.arr;
      if (dep == null || arr == null || win.min == null || win.max == null) continue;
      
      // Overlap score with connection window
      const overlap = Math.max(0, Math.min(arr, win.max) - Math.max(dep, win.min));
      if (overlap > bestScore) {
        bestScore = overlap;
        bestIdx = i;
      }
    }
    
    if (bestIdx >= 0 && bestScore >= 0 && (!out[bestIdx].stops || out[bestIdx].stops.length === 0)) {
      out[bestIdx].stops = [...(out[bestIdx].stops || []), ...list];
      assigned[bestIdx]++;
    }
  }

  // Fallback for connections without Vuex stops and no DOM match
  if (!assigned.some((x) => x > 0)) {
    let ptr = 0;
    return out.map((c) => {
      if (c.stops && c.stops.length > 0) return c; // Keep Vuex stops
      const segCount = Math.max(c.segments?.length || 1, 1);
      const slice = allBlocks.slice(ptr, ptr + segCount).flat();
      ptr += segCount;
      return { ...c, stops: slice || [] };
    });
  }

  return out.map((c) => ({ ...c, stops: (c.stops || []) }));
}

/**
 * Clean and validate final connection data
 * @param {Array} connections - Array of connections
 * @returns {Array} - Cleaned connections
 */
export function cleanConnections(connections) {
  return connections.map((c) => ({
    ...c,
    vehicles: c.vehicles || [],
    segments: c.segments || [],
    stops: (c.stops || []).filter((s) => s && s.name),
  }));
}

// Import helper functions that are needed
function toMinutes(t) {
  const s = timeShort(t);
  const m = s && String(s).match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function timeShort(iso) {
  if (!iso) return null;
  const m = String(iso).match(/T(\d{2}):?(\d{2})/);
  if (m) return `${m[1]}:${m[2]}`;
  const m2 = String(iso).match(/^(\d{2})(\d{2})$/);
  if (m2) return `${m2[1]}:${m2[2]}`;
  return iso;
}
