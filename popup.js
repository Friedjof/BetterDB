// popup.js — zeigt extrahierte Daten an und erlaubt Refresh/Kopieren

const $ = (sel, root = document) => root.querySelector(sel);
const tpl = $("#connection-tpl");
const statusEl = $("#status");
const container = $("#connections");
const refreshBtn = $("#refreshBtn");
const debugBtn = $("#debugBtn");
const copyBtn = $("#copyBtn");

function timeShort(iso) {
  if (!iso) return "—";
  const m = String(iso).match(/T(\d{2}):?(\d{2})/);
  if (m) return `${m[1]}:${m[2]}`;
  const m2 = String(iso).match(/^(\d{2})(\d{2})$/);
  if (m2) return `${m2[1]}:${m2[2]}`;
  return iso;
}

function priceFmt(p) {
  if (p == null) return "";
  try {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(p);
  } catch {
    return `${p} €`;
  }
}

function render(conns, extractedAt) {
  container.innerHTML = "";
  if (!conns || !conns.length) {
    statusEl.textContent = "Keine Verbindungen gefunden. Öffne eine DB-Suchergebnisseite und klicke auf „Aktualisieren“.";
    return;
  }
  const dt = extractedAt ? new Date(extractedAt) : null;
  statusEl.textContent = dt ? `Stand: ${dt.toLocaleString()}` : "";

  conns.forEach((c, idx) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    const header = node.querySelector(".connection-header");
    const body = node.querySelector(".connection-body");
    const chips = node.querySelector(".chips");
    const segmentsDiv = node.querySelector(".segments");
    const stopsDiv = node.querySelector(".stops");
    const stopsCount = node.querySelector(".stops-wrap .count");

    const titleParts = [
      `${c.start || "?"} → ${c.destination || "?"}`,
      c.departure ? `ab ${timeShort(c.departure)}` : "",
      c.arrival ? `an ${timeShort(c.arrival)}` : "",
      c.priceFrom != null ? `· ${priceFmt(c.priceFrom)}` : ""
    ].filter(Boolean);

    header.textContent = titleParts.join(" ");

    if (c.tripId) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = `Trip: ${c.tripId}`;
      chips.appendChild(chip);
    }
    if (Number.isFinite(c.countTransfers)) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = `Umstiege: ${c.countTransfers}`;
      chips.appendChild(chip);
    }
    if (c.vehicles && c.vehicles.length) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = c.vehicles.join(" · ");
      chips.appendChild(chip);
    }

    (c.segments || []).forEach(seg => {
      const s = document.createElement("div");
      s.className = "segment";
      s.innerHTML = `
        <div class="time">
          ${timeShort(seg.departure)} → ${timeShort(seg.arrival)}
        </div>
        <div class="info">
          <div><strong>${seg.start || "?"}</strong> → <strong>${seg.destination || "?"}</strong></div>
          <div class="meta">${seg.vehicle || ""}${seg.transferTime ? ` · Umstieg: ${seg.transferTime}` : ""}${seg.capacity ? ` · ${seg.capacity}` : ""}</div>
        </div>
      `;
      segmentsDiv.appendChild(s);
    });

    (c.stops || []).forEach(st => {
      const row = document.createElement("div");
      row.className = "stop";
      row.innerHTML = `
        <div class="time">${[timeShort(st.arrival), timeShort(st.departure)].filter(Boolean).join(" / ")}</div>
        <div class="name">${st.name || "-"}</div>
        <div class="track">${st.track || ""}</div>
      `;
      stopsDiv.appendChild(row);
    });
    if (stopsCount) stopsCount.textContent = c.stops?.length ? ` (${c.stops.length})` : "";

    header.addEventListener("click", () => node.classList.toggle("open"));
    if (idx === 0) node.classList.add("open");
    container.appendChild(node);
  });
}

function loadFromStorage() {
  chrome.storage.local.get(["dbConnections", "dbExtractedAt", "dbError", "dbDebugInfo"], (o) => {
    if (o.dbError) {
      statusEl.textContent = `Fehler beim Extrahieren: ${o.dbError}`;
    }
    
    // Debug info anzeigen
    if (o.dbDebugInfo) {
      console.log('[BetterDB] Debug info:', o.dbDebugInfo);
      if (o.dbDebugInfo.error) {
        console.error('[BetterDB] Extraction error:', o.dbDebugInfo.error);
      }
    }
    
    render(o.dbConnections || [], o.dbExtractedAt || null);
  });
}

async function extractFromActiveTab() {
  statusEl.textContent = "Extrahiere aus aktivem Tab…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      statusEl.textContent = "Kein aktiver Tab.";
      return;
    }
    chrome.tabs.sendMessage(tab.id, { cmd: "extractNow" }, () => {
      // egal ob Antwort kommt – wir lesen den Storage (MV3 messaging kann still sein)
      setTimeout(loadFromStorage, 150); // kurz warten bis content.js geschrieben hat
    });
  } catch (e) {
    statusEl.textContent = `Fehler: ${e && e.message ? e.message : e}`;
  }
}

function copyJSON() {
  chrome.storage.local.get(["dbConnections"], (o) => {
    try {
      const text = JSON.stringify(o.dbConnections || [], null, 2);
      navigator.clipboard.writeText(text);
      statusEl.textContent = "JSON in die Zwischenablage kopiert.";
    } catch (e) {
      statusEl.textContent = "Kopieren fehlgeschlagen.";
    }
  });
}

function showDebugInfo() {
  chrome.storage.local.get(null, (data) => {
    console.log('=== BetterDB Debug Info ===');
    console.log('Connections:', data.dbConnections);
    console.log('Extracted at:', data.dbExtractedAt ? new Date(data.dbExtractedAt) : 'never');
    console.log('Error:', data.dbError);
    console.log('Debug info:', data.dbDebugInfo);
    console.log('=========================');
    statusEl.textContent = "Debug-Infos in der Konsole ausgegeben (F12 → Console)";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();
  refreshBtn.addEventListener("click", extractFromActiveTab);
  debugBtn.addEventListener("click", showDebugInfo);
  copyBtn.addEventListener("click", copyJSON);
});
