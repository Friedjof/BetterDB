// content.js — extrahiert Verbindungen + Zwischenhalte und legt das Ergebnis in chrome.storage.local ab.
// Neu in v1.1.0:
// - Fallback auf window.digitalData (connection.info/restore.info), falls vuex noch nicht gefüllt ist
// - "Silent Expand": öffnet alle Zwischenhalte-Toggles programmatisch, liest, schließt wieder
// - Mehr Robustheit bei der Zuordnung & mehrfacher Re-Extraktion nach Page-Load

(function () {
  // Inject page hook to capture network JSON with stopovers
  try {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('pagehook.js');
    s.type = 'text/javascript';
    (document.documentElement || document.head || document.body).appendChild(s);
  } catch {}

  // ---------- Utils ----------
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim() || null;
  const isArr = (x) => Array.isArray(x);
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  function timeShort(iso) {
    if (!iso) return null;
    const m = String(iso).match(/T(\d{2}):?(\d{2})/);
    if (m) return `${m[1]}:${m[2]}`;
    const m2 = String(iso).match(/^(\d{2})(\d{2})$/); // "HHmm"
    if (m2) return `${m2[1]}:${m2[2]}`;
    return iso;
  }

  function toMinutes(t) {
    const s = timeShort(t);
    const m = s && String(s).match(/^(\d{2}):(\d{2})$/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  function timeFromText(text) {
    const m = /\b(\d{1,2}:\d{2})\b/.exec(text || "");
    return m ? m[1].padStart(5, "0") : null;
  }

  function extractTrackText(el) {
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

  // ---------- Deep DOM (Shadow DOM) Utilities ----------
  function collectRoots(start) {
    const roots = [];
    const queue = [start];
    const seen = new Set();
    while (queue.length) {
      const root = queue.shift();
      if (!root || seen.has(root)) continue;
      seen.add(root);
      roots.push(root);
      // enumerate elements inside this root
      const els = root.querySelectorAll ? root.querySelectorAll('*') : [];
      for (const el of els) {
        if (el.shadowRoot) queue.push(el.shadowRoot);
      }
    }
    return roots;
  }

  function qsaDeep(selector, scope = document) {
    const roots = collectRoots(scope);
    const out = [];
    const seen = new Set();
    for (const r of roots) {
      if (!r.querySelectorAll) continue;
      for (const el of r.querySelectorAll(selector)) {
        if (!seen.has(el)) { seen.add(el); out.push(el); }
      }
    }
    return out;
  }

  function qsDeep(selector, scope = document) {
    return qsaDeep(selector, scope)[0] || null;
  }

  // ---------- ctxRecon Parsing Helpers ----------
  function parseCtxReconLegs(ctx) {
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

  // ---------- Quelle 1: sessionStorage.vuex ----------
  function getVuex() {
    try {
      const raw =
        window.sessionStorage.getItem("vuex") ||
        (window.top && window.top.sessionStorage && window.top.sessionStorage.getItem("vuex"));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function connectionsFromVuex() {
    const vuex = getVuex();
    console.log('[BetterDB] Vuex data:', vuex ? 'found' : 'not found');
    
    const list = vuex?.reiseloesungState?.verbindungen;
    console.log('[BetterDB] Verbindungen in Vuex:', list ? list.length : 'none');
    
    if (!isArr(list)) return [];
    
    return list.map((verbindung, index) => {
      console.log(`[BetterDB] Processing connection ${index + 1}:`, {
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
      
      console.log(`[BetterDB] Connection ${index + 1} extracted stops:`, allStops.length);
      
      // Verkehrsmittel sammeln
      const vehicles = verbindung.verbindungsAbschnitte?.map(a => 
        a.verkehrsmittel?.name || a.verkehrsmittel?.gattung
      ).filter(Boolean) || [];
      
      return {
        tripId: verbindung.tripId || null,
        ctxRecon: verbindung.ctxRecon || null,
        start: firstAbschnitt?.abfahrtsOrt || null,
        destination: lastAbschnitt?.ankunftsOrt || null,
        departure: firstAbschnitt?.abfahrtsZeitpunkt || null,
        arrival: lastAbschnitt?.ankunftsZeitpunkt || null,
        countTransfers: verbindung.umstiegsAnzahl ?? null,
        priceFrom: null, // TODO: aus reiseAngebote extrahieren falls verfügbar
        vehicles: vehicles,
        segments: segments,
        stops: allStops // Alle Zwischenstopps direkt aus SessionStorage
      };
    });
  }

  // ---------- Quelle 2: window.digitalData ----------
  function getDigitalData() {
    try {
      return (window.digitalData && isArr(window.digitalData))
        ? window.digitalData
        : (window.top && window.top.digitalData && isArr(window.top.digitalData) ? window.top.digitalData : []);
    } catch {
      return [];
    }
  }

  function connectionsFromDigitalData() {
    const dd = getDigitalData();
    const events = dd.filter(
      (e) => e && typeof e === "object" && /connection\.info|restore\.info|search\.info/i.test(e.event || "")
    );

    const out = [];
    for (const ev of events) {
      const arr =
        (isArr(ev.connections) && ev.connections) ||
        (ev.search && isArr(ev.search.connections) && ev.search.connections) ||
        [];
      for (const r of arr) {
        out.push({
          tripId: r.tripId || null,            // häufig null in DD
          ctxRecon: r.ctxRecon || null,        // meist nicht enthalten – füllen wir später, falls matchbar
          start: r.start?.name || null,
          destination: r.destination?.name || null,
          departure: r.departure || null,
          arrival: r.arrival || null,
          countTransfers: r.countTransfers ?? null,
          priceFrom: r.priceFrom ?? r.regularPrice ?? null,
          vehicles: r.vehicles || [],
          segments:
            r.connectionSegments?.map((s) => ({
              start: s.start?.name || null,
              destination: s.destination?.name || null,
              departure: s.departure || null,
              arrival: s.arrival || null,
              vehicle: s.vehicle || null,
              transferTime: s.transferTime || null,
              capacity: s.capacityShortText || null,
            })) || [],
        });
      }
    }
    return out;
  }

  // ---------- Heuristische Zusammenführung DD + Vuex ----------
  function keyForMatch(c) {
    // kombinierte Heuristik: Zeitfenster + Ziel + erstes Fahrzeug
    const v0 = (c.vehicles && c.vehicles[0]) || "";
    return [c.start || "", c.destination || "", c.departure || "", c.arrival || "", v0].join("|");
  }

  function mergeVuexAndDD(vx, dd) {
    if (!vx.length && !dd.length) return [];
    if (!vx.length) return dd;
    if (!dd.length) return vx;

    const map = new Map();
    vx.forEach((c) => map.set(keyForMatch(c), c));

    const out = [];
    for (const d of dd) {
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
          priceFrom: v.priceFrom ?? d.priceFrom ?? null,
          vehicles: v.vehicles?.length ? v.vehicles : d.vehicles || [],
          segments: (v.segments && v.segments.length ? v.segments : d.segments) || [],
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

  // ---------- Stops aus ctxRecon (SC) — optional ----------
  async function decodeSCfromCtxRecon(ctxRecon) {
    if (!ctxRecon) return null;

    // Support multiple observed encodings of SC in ctxRecon
    const candidates = [];
    
    // Variant A: "¶SC¶1_" + base64(gzip)
    try {
      const a = ctxRecon.split("¶SC¶")[1];
      if (a) {
        const parts = a.split("_");
        if (parts.length > 1) {
          candidates.push(parts[1].trim().replace(/[^A-Za-z0-9+/=]+$/g, ""));
        }
      }
    } catch {}
    
    // Variant B: "[$SC|" + base64(gzip) + "]"
    try {
      const b = ctxRecon.split("[$SC|")[1];
      if (b) candidates.push((b.split("]")[0] || "").trim().replace(/[^A-Za-z0-9+/=]+$/g, ""));
    } catch {}

    // Debug: Log candidates
    if (candidates.length > 0) {
      console.log('[BetterDB] SC candidates found:', candidates.length);
    }

    for (const base64 of candidates.filter(Boolean)) {
      try {
        console.log('[BetterDB] Attempting SC decode, length:', base64.length);
        const binStr = atob(base64);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
        
        if (typeof DecompressionStream !== "function") {
          console.log('[BetterDB] DecompressionStream not available');
          continue;
        }
        
        const resp = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")));
        const buf = await resp.arrayBuffer();
        const txt = new TextDecoder().decode(buf);
        const sc = JSON.parse(txt);
        
        if (sc && typeof sc === "object") {
          console.log('[BetterDB] SC decoded successfully:', Object.keys(sc));
          return sc;
        }
      } catch (e) {
        console.log('[BetterDB] SC decode failed:', e.message);
      }
    }
    return null;
  }

  function stopsFromSC(sc) {
    // In vielen Fällen enthält SC nur die Request-Parameter und KEINE Passliste.
    // Falls du in deinem Setup eine echte Stopliste findest (z. B. sc.res.jnyL[0].stopL),
    // mappe sie hier – ansonsten return null -> DOM/Toggles übernehmen.
    if (!sc) return null;

    // Try known shapes
    let raw =
      sc?.res?.jnyL?.[0]?.stopL ||
      sc?.jnyL?.[0]?.stopL ||
      sc?.passList ||
      sc?.stopL ||
      sc?.stops ||
      null;

    // Alternative shape seen in console: { journey: { stopovers: [...] } }
    if (!raw && Array.isArray(sc?.journey?.stopovers)) raw = sc.journey.stopovers;

    if (!raw || !isArr(raw)) return null;

    const mapTime = (t) => {
      if (!t) return null;
      const m = String(t).match(/^(\d{2})(\d{2})$/);
      if (m) return `${m[1]}:${m[2]}`;
      return timeShort(t);
    };

    const normName = (v) => (typeof v === "string" ? norm(v) : norm(v?.name || v?.txt || v?.n));

    const stops = raw
      .map((st) => ({
        arrival: mapTime(st.aTime || st.arrival || st.a),
        departure: mapTime(st.dTime || st.departure || st.d),
        name: normName(st.name || st.loc?.name || st.stopName || st.stop?.name),
        track: norm(st.track || st.platf || st.pl || st.trk || st.aPlatf || st.dPlatf || st.platform) || null,
      }))
      .filter((s) => s.name);

    return stops.length ? stops : null;
  }

  // ---------- Stops aus DOM: „silent expand“ ----------
  async function silentlyExpandAllForStops() {
    console.log('[BetterDB] Starting silentlyExpandAllForStops');
    // Mehrstufiges Öffnen aller relevanten Toggle-Buttons
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

    const opened = new Set();
    const toClose = [];
    for (let pass = 0; pass < 3; pass++) {
      const allButtons = qsaDeep(selectorCandidates.join(","));
      console.log(`[BetterDB] Pass ${pass}: Found ${allButtons.length} buttons`);
      
      const targetButtons = allButtons.filter((b) => {
        const txt = (b.textContent || "").trim();
        const aria = (b.getAttribute('aria-label') || '').trim();
        if (!/(Zwischenhalte|Halte|Stops|Haltestellen|Details|Stopovers|Zeige|Show)/i.test(txt) && !/(Zwischenhalte|Halte|Stops|Haltestellen|Details|Stopovers)/i.test(aria)) return false;
        if (opened.has(b)) return false;
        const expanded = b.getAttribute("aria-expanded") === "true" || b.classList.contains("verbindungs-zwischenhalte__toggle-button--expanded");
        return !expanded;
      });
      
      console.log(`[BetterDB] Pass ${pass}: ${targetButtons.length} target buttons to click`);
      if (targetButtons.length > 0) {
        console.log('[BetterDB] Target button texts:', targetButtons.map(b => b.textContent?.trim()).slice(0, 3));
      }
      
      if (!targetButtons.length) break;
      for (const b of targetButtons) {
        b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        opened.add(b);
        toClose.push(b);
        await delay(400);
      }
      await delay(500);
    }

    // Daten ziehen
    const blocks = [
      ...new Set([
        ...qsaDeep(
          [
            ".verbindungs-zwischenhalte",
            "[class*='verbindungs-zwischenhalte']",
            "[class*='zwischenhalte']",
            "[class*='zwischenhalt-container']",
            "[data-testid*='zwischenhalte']",
            "[data-testid*='stops']",
            "details[open] [class*='halt'], details[open] [class*='stop']"
          ].join(",")
        ),
      ]),
    ];

    console.log(`[BetterDB] Found ${blocks.length} stop blocks for processing`);
    
    const stopLists = blocks.map((blk, idx) => {
      let rows = [
        ...qsaDeep(
          [
            ".verbindungs-zwischenhalt",
            "[class*='verbindungs-zwischenhalt']",
            "[data-testid*='zwischenhalt']",
            "[class*='zwischenhalt-item']"
          ].join(","),
          blk
        )
      ];
      if (!rows.length) {
        rows = [...qsaDeep("li", blk)].filter((r) =>
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
        ".verbindungs-zwischenhalt__name, .test-zwischenhalt-name, [class*='zwischenhalt__name']"
      , el) || null;
        let name = norm(nameEl?.textContent || "");
        if (!name) {
          // Fallback: try a child that looks like a station label without known noise words
          const guess = [...qsaDeep("span, a", el)]
            .map((n) => norm(n.textContent))
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

      console.log(`[BetterDB] Block ${idx}: Extracted ${list.length} stops`);
      if (list.length > 0) {
        console.log(`[BetterDB] Block ${idx} stops:`, list.map(s => s.name).slice(0, 3));
      }
      return list;
    }).filter((l) => l.length);

    // DOM-Stops global speichern für spätere Verwendung
    window.__bdvExtractedStops = stopLists;

    // Ursprungszustand wiederherstellen
    for (const b of toClose) {
      b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      await delay(30);
    }

    return stopLists;
  }

  function addStopsToConnections(conns) {
    const out = conns.map((c) => ({ ...c, stops: c.stops || [] }));
    
    // Wenn bereits Stops aus Vuex vorhanden sind, diese bevorzugen
    const connectionsWithVuexStops = out.filter(c => c.stops && c.stops.length > 0);
    if (connectionsWithVuexStops.length === out.length) {
      console.log('[BetterDB] All connections have stops from Vuex, skipping DOM extraction');
      return out;
    }

    // DOM-Blöcke sind bereits in silentlyExpandAllForStops() extrahiert
    // Hier nehmen wir sie aus einer globalen Variable oder leeren Array
    const domBlocks = window.__bdvExtractedStops || [];
    if (!domBlocks.length) return out;

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

    // Include blocks captured via page network hook
    const netBlocks = (window.__bdvNetBlocks || []);
    const allBlocks = [...domBlocks, ...netBlocks].filter((b) => Array.isArray(b) && b.length);

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

  async function extractAll() {
    console.log('[BetterDB] Starting extractAll()');
    
    // Basismengen
    const vx = connectionsFromVuex();
    const dd = connectionsFromDigitalData();
    
    console.log('[BetterDB] Vuex connections:', vx.length);
    console.log('[BetterDB] DigitalData connections:', dd.length);
    
    let merged = mergeVuexAndDD(vx, dd);
    console.log('[BetterDB] Merged connections:', merged.length);

    // Fallback: aus ctxRecon parsen, wenn wesentliche Felder fehlen
    function fallbackFromCtxRecon(ctx) {
      try {
        const legs = parseCtxReconLegs(ctx);
        if (!legs.length) return null;
        const vehicles = Array.from(new Set(
          legs
            .map((l) => (l.vehicle || "").trim())
            .filter(Boolean)
            .map((v) => v.replace(/\s+/g, " ").split(" ")[0])
        ));
        return {
          start: legs[0].start || null,
          destination: legs[legs.length - 1].destination || null,
          departure: legs[0].departure || null,
          arrival: legs[legs.length - 1].arrival || null,
          countTransfers: Math.max(legs.length - 1, 0),
          vehicles,
          segments: legs,
        };
      } catch { return null; }
    }

    merged = merged.map((c) => {
      if (!c?.ctxRecon) return c;
      const fb = fallbackFromCtxRecon(c.ctxRecon);
      if (!fb) return c;
      return {
        ...c,
        start: c.start || fb.start || null,
        destination: c.destination || fb.destination || null,
        departure: c.departure || fb.departure || null,
        arrival: c.arrival || fb.arrival || null,
        countTransfers: Number.isFinite(c.countTransfers) ? c.countTransfers : fb.countTransfers ?? null,
        vehicles: (c.vehicles && c.vehicles.length ? c.vehicles : fb.vehicles) || [],
        segments: (c.segments && c.segments.length ? c.segments : fb.segments) || [],
      };
    });

    // Falls nach wie vor leer: trotzdem versuchen, DOM zu lesen (z.B. wenn Seite anders strukturiert ist)
    // Silent expand → Stop-Listen
    const domStopBlocks = await silentlyExpandAllForStops();
    console.log('[BetterDB] DOM stop blocks:', domStopBlocks.length);
    
    // kurze Wartezeit, damit Netzwerk-Hook Antworten sammeln kann
    await delay(400);
    merged = addStopsToConnections(merged);
    console.log('[BetterDB] Final merged connections with stops:', merged.length);

    // Optional: SC decodieren (falls echte Passliste enthalten → bevorzugen)
    const scArray = await Promise.all(merged.map((c) => decodeSCfromCtxRecon(c.ctxRecon)));
    merged = merged.map((c, i) => {
      const scStops = stopsFromSC(scArray[i]);
      return scStops && scStops.length ? { ...c, stops: scStops } : c;
    });

    // Aufräumen
    return merged.map((c) => ({
      ...c,
      vehicles: c.vehicles || [],
      segments: c.segments || [],
      stops: (c.stops || []).filter((s) => s && s.name),
    }));
  }

  async function runAndStore() {
    try {
      const data = await extractAll();
      chrome.storage.local.set({ 
        dbConnections: data, 
        dbExtractedAt: Date.now(), 
        dbError: null,
        dbDebugInfo: {
          connectionsCount: data.length,
          stopsCount: data.reduce((sum, c) => sum + (c.stops?.length || 0), 0),
          timestamp: new Date().toISOString()
        }
      });
    } catch (e) {
      chrome.storage.local.set({
        dbConnections: [],
        dbExtractedAt: Date.now(),
        dbError: String(e && e.message ? e.message : e),
        dbDebugInfo: { error: e.stack || e.toString() }
      });
    }
  }

  // initial + Re-Läufe (um spät gefüllte Daten zu erwischen)
  runAndStore();
  setTimeout(runAndStore, 1200);
  setTimeout(runAndStore, 3500);

  // auf Anfrage vom Popup neu extrahieren
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.cmd === "extractNow") {
      runAndStore().then(() => {
        chrome.storage.local.get(["dbConnections", "dbExtractedAt", "dbError"], (o) => sendResponse(o));
      });
      return true; // async
    }
  });

  // Sammle Stopplisten aus dem Netzwerk-Hook (page context)
  window.__bdvNetBlocks = window.__bdvNetBlocks || [];
  window.addEventListener('message', (ev) => {
    try {
      if (ev && ev.source === window && ev.data && ev.data.type === 'BETTERDB_STOPS' && Array.isArray(ev.data.blocks)) {
        // keep most recent up to 30
        const arr = (window.__bdvNetBlocks = window.__bdvNetBlocks || []);
        for (const b of ev.data.blocks) if (Array.isArray(b) && b.length) arr.push(b);
        if (arr.length > 30) arr.splice(0, arr.length - 30);
      }
    } catch {}
  });

  // Debug in der Konsole aktivieren:
  // chrome.storage.onChanged.addListener((ch) => { if (ch.dbConnections) console.log("DB Connections:", ch.dbConnections.newValue); });
})();
