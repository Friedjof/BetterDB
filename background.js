// background.js - Minimal Service Worker for Manifest V3
console.log('[BetterDB] Service Worker started');

// Handle messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[BetterDB] Background received message:', msg);
  
  if (msg?.type === "POPUP_EXTRACT") {
    runExtractInActiveTab();
    sendResponse({ ok: true });
    return true;
  }
  
  // Handle any future download requests here if needed
  if (msg?.type === "DB_EXTRACT_RESULT" && msg?.json) {
    console.log('[BetterDB] Received extraction result, but download feature is disabled for now');
    sendResponse({ ok: true });
    return true;
  }
});

async function runExtractInActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      console.warn('[BetterDB] No active tab found');
      return;
    }
    
    console.log('[BetterDB] Sending extract command to tab:', tab.id);
    chrome.tabs.sendMessage(tab.id, { cmd: "extractNow" }).catch(error => {
      console.warn('[BetterDB] Message send failed:', error);
    });
  } catch (error) {
    console.error('[BetterDB] Failed to send extract command:', error);
  }
}
