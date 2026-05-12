/**
 * YouTube Button Controller - Background Script
 * Manifest V3 Service Worker for Firefox
 * 
 * Author: Alireza Talebi
 * GitHub: https://github.com/AlirezaTalebi/Youtube-Buttons-Controller-Firefox-Extention
 * License: GPL-3.0
 */

// Track current active tab to properly handle auto-pause
let currentActiveTabId = null;
let currentActiveTabUrl = null;
let autoPauseEnabled = false;

// Cache for finding YouTube tab when sending commands (separate from auto-pause tracking)
let cachedYouTubeTabId = null;

// Helper: Check if URL is a YouTube video tab (watch or shorts)
function isYouTubeVideoUrl(url) {
  return typeof url === 'string' && (
    url.includes('youtube.com/watch') ||
    url.includes('youtube.com/shorts/')
  );
}

// Load auto-pause setting on startup
async function loadAutoPauseSetting() {
  try {
    const { youtubeControllerSettings = {} } = await browser.storage.local.get('youtubeControllerSettings');
    autoPauseEnabled = youtubeControllerSettings.autoPause === true;
    console.log('Background: autoPauseEnabled loaded from youtubeControllerSettings:', autoPauseEnabled);
    addDebugLog('[Background]', 'info', 'startup', 'autoPause setting loaded', { autoPauseEnabled, source: 'youtubeControllerSettings' });
  } catch (error) {
    console.error('Background: Failed to load autoPauseSetting:', error);
    autoPauseEnabled = false;
    addDebugLog('[Background]', 'error', 'startup', 'failed to load autoPause', { error: error.message });
  }
}

// Handle extension install/startup
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Clear cache on fresh install only
    try {
      await browser.storage.local.clear();
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  } else if (details.reason === 'update') {
    // On update, reload settings
    await loadAutoPauseSetting();
  }
});

// Initialize on startup: load settings and track active tab
async function initializeOnStartup() {
  await loadAutoPauseSetting();
  
  try {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (activeTab) {
      currentActiveTabId = activeTab.id;
      currentActiveTabUrl = activeTab.url || '';
      console.log('Background: Initial active tab loaded:', currentActiveTabId, currentActiveTabUrl);
      addDebugLog('[Background]', 'info', 'startup', 'active tab initialized', { tabId: currentActiveTabId, url: currentActiveTabUrl });
    }
  } catch (error) {
    console.error('Background: Failed to query active tab on startup:', error);
  }
}

initializeOnStartup();

// Listen for storage changes (e.g., popup toggle)
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  
  if (changes.youtubeControllerSettings) {
    const oldSettings = changes.youtubeControllerSettings.oldValue || {};
    const newSettings = changes.youtubeControllerSettings.newValue || {};
    const oldAutoPause = oldSettings.autoPause === true;
    const newAutoPause = newSettings.autoPause === true;
    
    if (oldAutoPause !== newAutoPause) {
      autoPauseEnabled = newAutoPause;
      console.log('Background: autoPause updated from storage.onChanged:', oldAutoPause, '->', newAutoPause);
      addDebugLog('[Background]', 'info', 'autoPause', 'setting updated from storage', { oldAutoPause, newAutoPause });
    }
  }
});

// Listen for tab updates to track URL changes
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    // Update URL if this is the current active tab
    if (tabId === currentActiveTabId && changeInfo.url) {
      currentActiveTabUrl = changeInfo.url;
      console.log('Background: Current tab URL updated:', tabId, currentActiveTabUrl);
    }
  } catch (error) {
    console.error('Error in tabs.onUpdated listener:', error);
  }
});

// Monitor tab activation for auto-pause: pause old tab when switching away from YouTube
browser.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const oldTabId = currentActiveTabId;
    const oldTabUrl = currentActiveTabUrl;
    
    const newTab = await browser.tabs.get(activeInfo.tabId);
    currentActiveTabId = newTab.id;
    currentActiveTabUrl = newTab.url || '';
    
    console.log('Background: Tab switched:', oldTabId, oldTabUrl, '->', newTab.id, newTab.url);
    addDebugLog('[Background]', 'info', 'tabSwitch', 'tab activation detected', { oldTabId, oldTabUrl, newTabId: newTab.id, newTabUrl: newTab.url });
    
    // Auto-pause logic: pause old tab if it was a YouTube video and auto-pause is enabled
    if (!autoPauseEnabled) {
      console.log('Background: Auto-pause skipped - disabled');
      addDebugLog('[Background]', 'info', 'autoPause', 'skipped - disabled');
      return;
    }
    
    if (!oldTabId || !isYouTubeVideoUrl(oldTabUrl)) {
      console.log('Background: Auto-pause skipped - old tab not YouTube video:', oldTabId, oldTabUrl);
      addDebugLog('[Background]', 'info', 'autoPause', 'skipped - old tab not YouTube video', { oldTabId, oldTabUrl });
      return;
    }
    
    try {
      console.log('Background: Sending pauseIfPlaying to old tab:', oldTabId);
      addDebugLog('[Background]', 'info', 'autoPause', 'pauseIfPlaying sending to old tab', { oldTabId });
      const response = await browser.tabs.sendMessage(oldTabId, { action: 'pauseIfPlaying' });
      console.log('Background: pauseIfPlaying response:', response);
      addDebugLog('[Background]', 'info', 'autoPause', 'pauseIfPlaying response received', { response });
    } catch (error) {
      console.debug('Background: pauseIfPlaying failed for old tab', oldTabId, ':', error.message);
      addDebugLog('[Background]', 'warn', 'autoPause', 'pauseIfPlaying failed', { oldTabId, error: error.message });
    }
  } catch (error) {
    console.error('Error in tabs.onActivated listener:', error);
  }
});

// Handle keyboard shortcuts
browser.commands.onCommand.addListener(async (command) => {
  try {
    const tabId = await getActiveYouTubeTab();
    if (!tabId) return;
    
    try {
      await browser.tabs.sendMessage(tabId, {
        command: command
      });
    } catch (error) {
      console.debug('Error sending keyboard shortcut command:', error);
    }
  } catch (error) {
    console.error('Error handling keyboard shortcut:', error);
  }
});

// MAIN MESSAGE LISTENER - Single unified handler
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keep channel open for async responses
});

// Unified message handler
async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case 'GET_ACTIVE_TAB':
        handleGetActiveTab(sendResponse);
        break;
      
      case 'SEND_COMMAND':
        handleSendCommand(message, sendResponse);
        break;
      
      case 'SET_AUTO_PAUSE':
        handleAutoPauseToggle(message.enabled);
        sendResponse({ success: true });
        break;
      
      case 'BUTTON_STATE_CHANGED':
        // Just acknowledge the state change
        sendResponse({ success: true });
        break;
      
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Optimized function to get active YouTube tab with smart detection
async function getActiveYouTubeTab() {
  try {
    console.log('Background: Attempting to find active YouTube tab...');
    
    // First check if cached tab is still valid
    if (cachedYouTubeTabId) {
      try {
        const tab = await browser.tabs.get(cachedYouTubeTabId);
        if (tab && tab.url && tab.url.includes('youtube.com/watch')) {
          console.log('Background: Using cached YouTube tab:', cachedYouTubeTabId);
          return cachedYouTubeTabId;
        }
      } catch (error) {
        // Tab no longer exists
        console.log('Background: Cached tab no longer valid');
        cachedYouTubeTabId = null;
      }
    }

    // Strategy 1: Find active tab in current window that is YouTube
    const activeTabs = await browser.tabs.query({ 
      active: true, 
      currentWindow: true
    });

    if (activeTabs.length > 0 && activeTabs[0].url && activeTabs[0].url.includes('youtube.com/watch')) {
      cachedYouTubeTabId = activeTabs[0].id;
      console.log('Background: Found active YouTube tab:', cachedYouTubeTabId);
      try {
        await browser.storage.local.set({ activeTabId: cachedYouTubeTabId });
      } catch (error) {
        // Storage error, continue
      }
      return cachedYouTubeTabId;
    }

    // Strategy 2: Find all YouTube tabs matching patterns
    const allYoutubeTabs = await browser.tabs.query({
      url: ['*://*.youtube.com/watch*', '*://youtube.com/watch*']
    });

    console.log('Background: Found', allYoutubeTabs.length, 'YouTube tabs');

    // Try to find a playing tab
    for (const tab of allYoutubeTabs) {
      try {
        const response = await browser.tabs.sendMessage(tab.id, { 
          action: 'getPlayerState' 
        });
        
        if (response && response.success && response.state && response.state.isPlaying) {
          cachedYouTubeTabId = tab.id;
          console.log('Background: Found playing YouTube tab:', cachedYouTubeTabId);
          try {
            await browser.storage.local.set({ activeTabId: cachedYouTubeTabId });
          } catch (error) {
            // Storage error, continue
          }
          return cachedYouTubeTabId;
        }
      } catch (error) {
        // Content script might not be ready, continue
        console.debug('Background: Tab', tab.id, 'not responding yet');
        continue;
      }
    }

    // Strategy 3: Use most recently accessed YouTube tab
    if (allYoutubeTabs.length > 0) {
      const recentTab = allYoutubeTabs.reduce((latest, current) => {
        return (!latest || (current.lastAccessed > latest.lastAccessed)) ? current : latest;
      });
      
      cachedYouTubeTabId = recentTab.id;
      console.log('Background: Using recent YouTube tab:', cachedYouTubeTabId);
      try {
        await browser.storage.local.set({ activeTabId: cachedYouTubeTabId });
      } catch (error) {
        // Storage error, continue
      }
      return cachedYouTubeTabId;
    }

    console.log('Background: No YouTube tab found');
    return null;
  } catch (error) {
    console.error('Error getting active YouTube tab:', error);
    return null;
  }
}

// Handle get active tab request from popup
async function handleGetActiveTab(sendResponse) {
  try {
    const tabId = await getActiveYouTubeTab();
    
    if (tabId) {
      sendResponse({ success: true, tabId: tabId });
    } else {
      sendResponse({ success: false, error: 'No YouTube tabs found' });
    }
  } catch (error) {
    console.error('Error in handleGetActiveTab:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle send command request from popup
async function handleSendCommand(message, sendResponse) {
  try {
    const tabId = await getActiveYouTubeTab();
    if (!tabId) {
      sendResponse({ success: false, error: 'No YouTube tab available' });
      return;
    }

    const response = await browser.tabs.sendMessage(tabId, {
      action: message.command,
      ...message.params
    });
    
    sendResponse({ success: true, result: response });
  } catch (error) {
    console.error('Error sending command:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle auto-pause feature toggle
async function handleAutoPauseToggle(enabled) {
  try {
    const { youtubeControllerSettings = {} } = await browser.storage.local.get('youtubeControllerSettings');
    const newSettings = { ...youtubeControllerSettings, autoPause: enabled === true };
    await browser.storage.local.set({ youtubeControllerSettings: newSettings });
    autoPauseEnabled = enabled === true;
    console.log('Background: Auto-pause setting updated:', enabled);
    addDebugLog('[Background]', 'info', 'autoPause', 'toggle received', { enabled });
  } catch (error) {
    console.error('Error setting auto-pause:', error);
    addDebugLog('[Background]', 'error', 'autoPause', 'failed to update setting', { error: error.message });
  }
}

// Debug logging helper for background script
async function addDebugLog(scope, level, action, message, data = {}) {
  try {
    const { ytControllerDebugLog = [] } = await browser.storage.local.get('ytControllerDebugLog');
    const logs = Array.isArray(ytControllerDebugLog) ? ytControllerDebugLog : [];
    logs.push({ time: new Date().toISOString(), scope, level, action, message, data });
    if (logs.length > 150) logs.shift();
    await browser.storage.local.set({ ytControllerDebugLog: logs });
  } catch (e) {
    console.error('[DebugLog] Storage error:', e);
  }
}

// Clear cache when tabs are closed
browser.tabs.onRemoved.addListener((tabId) => {
  if (tabId === cachedYouTubeTabId) {
    cachedYouTubeTabId = null;
  }
});

// Global debug helper - access from extension console: await browser.runtime.sendMessage({type: 'GET_DEBUG_LOGS'})
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_DEBUG_LOGS') {
    browser.storage.local.get('ytControllerDebugLog').then(result => {
      sendResponse({ ytControllerDebugLog: result.ytControllerDebugLog || [] });
    });
    return true;
  }
  if (message.type === 'CLEAR_DEBUG_LOGS') {
    browser.storage.local.remove('ytControllerDebugLog').then(() => {
      sendResponse({ status: 'Logs cleared' });
    });
    return true;
  }
});
