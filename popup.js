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
      c.arrival ? `an ${timeShort(c.arrival)}` : ""
    ].filter(Boolean);

    header.textContent = titleParts.join(" ");

    // Preis-Chip als erstes hinzufügen
    const priceChip = document.createElement("span");
    const bestPrice = c.networkPrice || c.priceFrom; // Einfache Fallback-Logik
    
    if (bestPrice != null && bestPrice > 0) {
      priceChip.className = "chip price-chip";
      priceChip.textContent = `ab ${priceFmt(bestPrice)}`;
      if (c.networkPrice) {
        priceChip.title = "Preis von API";
      }
    } else {
      priceChip.className = "chip price-chip no-price";
      priceChip.textContent = "Preis ermitteln";
    }
    chips.appendChild(priceChip);

    // Ticket-Splitting-Chip hinzufügen (falls verfügbar)
    if (c.splittingAnalysis) {
      const splittingChip = document.createElement("span");
      
      if (c.splittingAnalysis.error) {
        splittingChip.className = "chip splitting-chip error";
        splittingChip.textContent = "Splitting-Fehler";
        splittingChip.title = c.splittingAnalysis.error;
      } else if (c.splittingAnalysis.hasOpportunities) {
        splittingChip.className = "chip splitting-chip savings";
        const savings = c.splittingAnalysis.bestSavingsPercentage;
        splittingChip.textContent = `💰 -${savings}%`;
        splittingChip.title = `Ticket-Splitting möglich: ${priceFmt(c.splittingAnalysis.bestSavings)} sparen (${savings}%)`;
        
        // Click handler für Details
        splittingChip.style.cursor = "pointer";
        splittingChip.addEventListener("click", (e) => {
          e.stopPropagation();
          showSplittingDetails(c);
        });
      } else {
        splittingChip.className = "chip splitting-chip no-savings";
        splittingChip.textContent = "Kein Split-Vorteil";
        splittingChip.title = "Keine günstigeren Ticket-Kombinationen gefunden";
      }
      
      chips.appendChild(splittingChip);
    }

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
      // Check if it's a context invalidation error
      if (o.dbError.toLowerCase().includes('context invalidated')) {
        statusEl.innerHTML = `⚠️ Extension wurde neu geladen. <button onclick="location.reload()" style="margin-left:8px;padding:2px 8px;border:1px solid #ccc;background:#f9f9f9;border-radius:4px;cursor:pointer;">Popup neu laden</button>`;
      } else {
        statusEl.textContent = `Fehler beim Extrahieren: ${o.dbError}`;
      }
    }
    
    // Debug info anzeigen
    if (o.dbDebugInfo) {
      console.log('[BetterDB] Debug info:', o.dbDebugInfo);
      if (o.dbDebugInfo.error) {
        console.error('[BetterDB] Extraction error:', o.dbDebugInfo.error);
      }
      
      // Show context status in debug info
      if (o.dbDebugInfo.contextValid === false) {
        console.warn('[BetterDB] Extension context is invalid');
      }
    }
    
    // DEBUGGING: Preis-Daten im Detail loggen
    console.log('=== PRICE DEBUG ===');
    console.log('Total connections:', (o.dbConnections || []).length);
    (o.dbConnections || []).forEach((conn, i) => {
      console.log(`Connection ${i + 1}:`, {
        tripId: conn.tripId,
        start: conn.start,
        destination: conn.destination,
        priceFrom: conn.priceFrom,
        rawPriceData: {
          priceFrom: conn.priceFrom,
          type: typeof conn.priceFrom,
          isNull: conn.priceFrom === null,
          isUndefined: conn.priceFrom === undefined,
          isZero: conn.priceFrom === 0,
          greaterThanZero: conn.priceFrom > 0
        }
      });
    });
    console.log('================');
    
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
    
    // Check if we can inject content script first
    try {
      await chrome.tabs.get(tab.id);
    } catch (error) {
      statusEl.textContent = "Tab ist nicht mehr verfügbar.";
      return;
    }
    
    chrome.tabs.sendMessage(tab.id, { cmd: "extractNow" }, (response) => {
      // Proper chrome.runtime.lastError handling
      if (chrome.runtime.lastError) {
        console.warn('[BetterDB] Content script communication failed:', chrome.runtime.lastError.message);
        
        // Check if it's a context invalidation error
        const errorMsg = chrome.runtime.lastError.message.toLowerCase();
        if (errorMsg.includes('receiving end does not exist')) {
          statusEl.innerHTML = `⚠️ Content Script nicht geladen. <button onclick="location.reload()" style="margin-left:8px;padding:2px 8px;border:1px solid #ccc;background:#f9f9f9;border-radius:4px;cursor:pointer;">Seite neu laden</button> und erneut versuchen.`;
        } else if (errorMsg.includes('context invalidated')) {
          statusEl.innerHTML = `⚠️ Extension wurde neu geladen. <button onclick="location.reload()" style="margin-left:8px;padding:2px 8px;border:1px solid #ccc;background:#f9f9f9;border-radius:4px;cursor:pointer;">Popup neu laden</button>`;
        } else {
          statusEl.textContent = `Kommunikationsfehler: ${chrome.runtime.lastError.message}`;
        }
        return;
      }
      
      // Success case - content script responded (or messaging succeeded silently)
      console.log('[BetterDB] Content script message sent successfully');
      setTimeout(loadFromStorage, 150); // kurz warten bis content.js geschrieben hat
    });
  } catch (e) {
    console.error('[BetterDB] Extract from active tab error:', e);
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

function showSplittingDetails(connection) {
  if (!connection.splittingAnalysis || !connection.splittingAnalysis.hasOpportunities) {
    return;
  }

  const analysis = connection.splittingAnalysis;
  const route = `${connection.start} → ${connection.destination}`;
  
  // Create modal dialog
  const modal = document.createElement('div');
  modal.className = 'splitting-modal';
  modal.innerHTML = `
    <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>🎫 Ticket-Splitting für ${route}</h3>
        <button class="close-btn" onclick="this.closest('.splitting-modal').remove()">×</button>
      </div>
      
      <div class="modal-body">
        <div class="original-price">
          <strong>Originalpreis:</strong> ${priceFmt(connection.priceFrom)}
        </div>
        
        <div class="best-option">
          <strong>Beste Option:</strong> ${priceFmt(analysis.bestSavings)} sparen (${analysis.bestSavingsPercentage}%)
        </div>
        
        <div class="options-list">
          <h4>Splitting-Optionen:</h4>
          ${analysis.options.map((option, i) => `
            <div class="splitting-option">
              <div class="option-header">
                <span class="option-number">#${i + 1}</span>
                <span class="savings ${option.savings > 0 ? 'positive' : 'neutral'}">
                  ${option.savings > 0 ? '-' : ''}${priceFmt(Math.abs(option.savings))} 
                  (${option.savingsPercentage}%)
                </span>
              </div>
              
              <div class="route-segments">
                ${option.route || 'Route nicht verfügbar'}
              </div>
              
              <div class="option-details">
                <span>Gesamtpreis: ${priceFmt(option.totalPrice)}</span>
                <span>Segmente: ${option.segmentCount}</span>
              </div>
              
              <div class="recommendation">
                ${option.recommendation || 'Keine Empfehlung verfügbar'}
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="disclaimer">
          <small>
            ⚠️ <strong>Hinweis:</strong> Ticket-Splitting erfordert separate Buchungen für jedes Segment. 
            Prüfen Sie die Zugbindung und mögliche Anschlussrisiken. Die Preise können sich ändern.
          </small>
        </div>
      </div>
      
      <div class="modal-footer">
        <button onclick="this.closest('.splitting-modal').remove()">Schließen</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Log detailed analysis to console
  console.log('[BetterDB] Detailed Splitting Analysis for', route, analysis);
}

document.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();
  refreshBtn.addEventListener("click", extractFromActiveTab);
  debugBtn.addEventListener("click", showDebugInfo);
  copyBtn.addEventListener("click", copyJSON);
});
