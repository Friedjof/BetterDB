/**
 * Content Script - Refactored to use modular architecture
 * 
 * This script now uses the new DataManager which coordinates all extractors
 * and provides auto-refresh functionality.
 */

// Inject page hook to capture network JSON with stopovers
try {
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('pagehook.js');
  s.type = 'text/javascript';
  (document.documentElement || document.head || document.body).appendChild(s);
} catch (error) {
  console.warn('[BetterDB] Failed to inject pagehook.js:', error);
}

// Import and initialize the data manager
import('./data-manager.js').then(module => {
  const { dataManager } = module;
  
  console.log('[BetterDB] Content script loaded with modular architecture');
  
  // Set up message listener for manual extraction requests
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.cmd === "extractNow") {
      console.log('[BetterDB] Manual extraction request received');
      
      dataManager.extractNow()
        .then(result => {
          console.log('[BetterDB] Manual extraction completed');
          sendResponse(result);
        })
        .catch(error => {
          console.error('[BetterDB] Manual extraction failed:', error);
          sendResponse({
            dbConnections: [],
            dbExtractedAt: Date.now(),
            dbError: error.message || String(error)
          });
        });
      
      return true; // Indicates asynchronous response
    }
  });
  
  // Auto-refresh is now handled by the DataManager
  console.log('[BetterDB] Auto-refresh enabled, data will be extracted automatically');
  
}).catch(error => {
  console.error('[BetterDB] Failed to load data manager:', error);
  
  // Fallback: If module loading fails, provide basic functionality
  console.warn('[BetterDB] Falling back to basic mode without auto-refresh');
  
  // Basic message handler for manual extraction
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.cmd === "extractNow") {
      // Store error in chrome storage
      chrome.storage.local.set({
        dbConnections: [],
        dbExtractedAt: Date.now(),
        dbError: "Module loading failed: " + (error.message || String(error)),
        dbDebugInfo: {
          error: error.stack || error.toString(),
          timestamp: new Date().toISOString(),
          fallbackMode: true
        }
      });
      
      // Return empty result
      sendResponse({
        dbConnections: [],
        dbExtractedAt: Date.now(),
        dbError: "Module loading failed"
      });
    }
  });
});

// Legacy compatibility: Keep some global functions for debugging
window.__betterDB = {
  getStats: async () => {
    try {
      const module = await import('./data-manager.js');
      return module.dataManager.getStats();
    } catch (error) {
      return { error: error.message };
    }
  },
  
  extractNow: async () => {
    try {
      const module = await import('./data-manager.js');
      return await module.dataManager.extractNow();
    } catch (error) {
      console.error('[BetterDB] Manual extraction via debug interface failed:', error);
      return { error: error.message };
    }
  },
  
  setAutoRefresh: async (enabled) => {
    try {
      const module = await import('./data-manager.js');
      module.dataManager.setAutoRefresh(enabled);
      return { success: true, autoRefresh: enabled };
    } catch (error) {
      return { error: error.message };
    }
  },
  
  isContextValid: () => {
    try {
      return !!(chrome?.runtime?.id);
    } catch (error) {
      return false;
    }
  },
  
  restart: async () => {
    try {
      if (!chrome?.runtime?.id) {
        return { error: 'Extension context invalidated - reload extension' };
      }
      const module = await import('./data-manager.js');
      module.dataManager.setAutoRefresh(true);
      return { success: true, message: 'Auto-refresh restarted' };
    } catch (error) {
      return { error: error.message };
    }
  }
};

console.log('[BetterDB] Content script initialization complete');
console.log('[BetterDB] Debug interface available via window.__betterDB');
