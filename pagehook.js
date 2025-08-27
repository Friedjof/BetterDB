(() => {
  const W = window;
  const origFetch = W.fetch?.bind(W);

  if (origFetch) {
    W.fetch = async function (...args) {
      const res = await origFetch(...args);
      try {
        const clone = res.clone();
        const ct = (clone.headers && clone.headers.get && clone.headers.get('content-type')) || '';
        if (/json/i.test(ct)) {
          const data = await clone.json();
          processData(data);
        }
      } catch {}
      return res;
    };
  }

  const OrigXHR = W.XMLHttpRequest;
  if (OrigXHR) {
    const P = OrigXHR.prototype;
    const origOpen = P.open;
    const origSend = P.send;
    P.open = function (...args) {
      this.__bdv_method = args[0];
      this.__bdv_url = args[1];
      return origOpen.apply(this, args);
    };
    P.send = function (...args) {
      this.addEventListener('loadend', () => {
        try {
          const ct = this.getResponseHeader && this.getResponseHeader('content-type');
          if (ct && /json/i.test(ct)) {
            const txt = this.responseText;
            try { const data = JSON.parse(txt); processData(data); } catch {}
          }
        } catch {}
      });
      return origSend.apply(this, args);
    };
  }

  function hhmm(s) {
    if (!s) return null;
    const m = String(s).match(/T(\d{2}):?(\d{2})/);
    if (m) return `${m[1]}:${m[2]}`;
    const m2 = String(s).match(/^(\d{2})(\d{2})$/);
    if (m2) return `${m2[1]}:${m2[2]}`;
    const m3 = String(s).match(/^(\d{2}):(\d{2})$/);
    if (m3) return s;
    return null;
  }

  function normalizeStops(list) {
    return (list || [])
      .map(s => ({
        arrival: hhmm(s.arrival || s.aTime || s.a),
        departure: hhmm(s.departure || s.dTime || s.d),
        name: (s.name || (s.stop && s.stop.name) || (s.loc && s.loc.name) || s.stopName || null),
        track: s.platform || s.track || s.platf || s.pl || s.trk || s.aPlatf || s.dPlatf || null,
      }))
      .filter(s => s.name);
  }

  function processData(data) {
    try {
      const blocks = [];
      const prices = [];
      
      // Existing stops extraction (unchanged)
      if (Array.isArray(data?.journeys)) {
        for (const j of data.journeys) {
          if (Array.isArray(j.stopovers)) blocks.push(normalizeStops(j.stopovers));
          // Extract price if available
          if (j.price?.amount) {
            prices.push({
              type: 'journey',
              price: j.price.amount,
              journeyId: j.refreshToken || j.id
            });
          }
        }
      }
      if (Array.isArray(data?.journey?.stopovers)) {
        blocks.push(normalizeStops(data.journey.stopovers));
      }
      if (Array.isArray(data?.res?.jnyL)) {
        for (const j of data.res.jnyL) if (Array.isArray(j.stopL)) blocks.push(normalizeStops(j.stopL));
      }
      
      // Send stops data (existing functionality)
      if (blocks.length) {
        W.postMessage({ type: 'BETTERDB_STOPS', blocks }, '*');
      }
      
      // Send price data (new functionality)
      if (prices.length) {
        W.postMessage({ type: 'BETTERDB_PRICES', prices }, '*');
      }
    } catch {}
  }
})();

