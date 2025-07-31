/**
 * YouTube Button Controller - Background Script
 * Manifest V2 Background Script for Firefox
 * 
 * Author: Alireza Talebi
 * GitHub: https://github.com/AlirezaTalebi/Youtube-Buttons-Controller-Firefox-Extention
 * License: GPL-3.0
 */

// Cache for active YouTube tab to avoid repeated queries
let activeYouTubeTabId = null;
let autoPauseEnabled = false;
let tabDetectionInterval = null;

// Handle extension install/startup
browser.runtime.onInstalled.addListener((details) => {
  // Inject content script into existing YouTube tabs
  if (details.reason === 'install' || details.reason === 'update') {
    setTimeout(injectIntoExistingTabs, 1000);
  }
  
  // Start continuous tab detection
  startTabDetection();
});

// Start extension - setup continuous tab detection
browser.runtime.onStartup.addListener(() => {
  startTabDetection();
});

// Continuous tab detection for better responsiveness
function startTabDetection() {
  if (tabDetectionInterval) {
    clearInterval(tabDetectionInterval);
  }
  
  // Check for new YouTube tabs every 3 seconds
  tabDetectionInterval = setInterval(async () => {
    try {
      const tabId = await getActiveYouTubeTab();
      if (tabId && tabId !== activeYouTubeTabId) {
        activeYouTubeTabId = tabId;
        // Update storage for popup
        try {
          await browser.storage.local.set({ activeTabId: tabId });
        } catch (error) {
          // Storage error, but continue
        }
      }
    } catch (error) {
      // Detection error, continue silently
    }
  }, 3000);
}

// Inject content script into existing YouTube tabs
async function injectIntoExistingTabs() {
  try {
    const tabs = await browser.tabs.query({ url: '*://*.youtube.com/*' });
    
    if (tabs.length === 0) {
      return;
    }
    
    for (const tab of tabs) {
      try {
        await browser.tabs.executeScript(tab.id, { file: 'content.js' });
      } catch (error) {
        // Could not inject into tab - tab may be loading or restricted
      }
    }
  } catch (error) {
    // Error injecting into existing tabs
  }
}

// Monitor tab changes for automatic YouTube detection
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    // Handle both page completion and URL changes
    if ((changeInfo.status === 'complete' || changeInfo.url) && tab.url && tab.url.includes('youtube.com/watch')) {
      // Update active tab cache
      activeYouTubeTabId = tabId;
      
      // Store in extension storage for popup to access
      try {
        await browser.storage.local.set({ activeTabId: tabId });
      } catch (error) {
        // Storage error
      }
      
      // Notify popup about new YouTube tab (if popup is open)
      try {
        await browser.runtime.sendMessage({
          type: 'NEW_YOUTUBE_TAB',
          tabId: tabId,
          url: tab.url
        });
      } catch (error) {
        // No popup to notify about new tab (popup might be closed) - this is normal
      }
    }
  } catch (error) {
    // Error in tabs.onUpdated listener
  }
});

// Monitor tab activation for smart switching
browser.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await browser.tabs.get(activeInfo.tabId);
    
    if (tab && tab.url && tab.url.includes('youtube.com/watch')) {
      // Update active YouTube tab cache
      activeYouTubeTabId = activeInfo.tabId;
      
      // Store in extension storage for popup to access
      try {
        await browser.storage.local.set({ activeTabId: activeInfo.tabId });
      } catch (error) {
        // Storage error
      }
      
      // Notify popup about tab switch (if popup is open)
      try {
        await browser.runtime.sendMessage({
          type: 'YOUTUBE_TAB_ACTIVATED',
          tabId: activeInfo.tabId,
          url: tab.url
        });
      } catch (error) {
        // No popup to notify about tab activation (popup might be closed) - this is normal
      }
    }
  } catch (error) {
    // Error in tabs.onActivated listener
  }
});

// Handle keyboard shortcuts
browser.commands.onCommand.addListener(async (command) => {
  try {
    const tabId = await getActiveYouTubeTab();
    
    if (!tabId) {
      return;
    }
    
    try {
      const response = await browser.tabs.sendMessage(tabId, {
        command: command
      });
    } catch (error) {
      // Error sending keyboard shortcut command
    }
  } catch (error) {
    // Error handling keyboard shortcut
  }
});

// Listen for messages from popup and content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  
  
  try {
    if (message.type === 'GET_ACTIVE_TAB') {
      
      handleGetActiveTab(sendResponse);
      return true; // Keep message channel open for async response
    } 
    
    if (message.type === 'BUTTON_STATE_CHANGED') {
      
      // Forward button state changes to popup if it's open
      forwardToPopup(message);
    }

    if (message.type === 'SEND_COMMAND') {
      
      handleSendCommand(message, sendResponse);
      return true;
    }

    if (message.type === 'SET_AUTO_PAUSE') {
      
      handleAutoPauseToggle(message.enabled);
      sendResponse({ success: true });
    }
  } catch (error) {
    
    sendResponse({ success: false, error: error.message });
  }
});

// Optimized function to get active YouTube tab with smart detection
async function getActiveYouTubeTab() {
  try {
    // First check if cached tab is still valid and playing
    if (activeYouTubeTabId) {
      try {
        const tab = await browser.tabs.get(activeYouTubeTabId);
        if (tab && tab.url.includes('youtube.com/watch')) {
          return activeYouTubeTabId;
        }
      } catch (error) {
        // Tab no longer exists, clear cache
        activeYouTubeTabId = null;
      }
    }

    // Strategy 1: Find active YouTube tab in current window
    const activeTabs = await browser.tabs.query({ 
      active: true, 
      currentWindow: true,
      url: "*://www.youtube.com/watch*"
    });

    if (activeTabs.length > 0) {
      activeYouTubeTabId = activeTabs[0].id;
      // Save to storage for popup
      try {
        await browser.storage.local.set({ activeTabId: activeYouTubeTabId });
      } catch (error) {
        // Storage error, but continue
      }
      return activeYouTubeTabId;
    }

    // Strategy 2: Find any playing YouTube tab
    const allYoutubeTabs = await browser.tabs.query({
      url: "*://www.youtube.com/watch*"
    });

    for (const tab of allYoutubeTabs) {
      try {
        const response = await browser.tabs.sendMessage(tab.id, { 
          action: 'getPlayerState' 
        });
        
        if (response && response.success && response.state.isPlaying) {
          activeYouTubeTabId = tab.id;
          // Save to storage for popup
          try {
            await browser.storage.local.set({ activeTabId: activeYouTubeTabId });
          } catch (error) {
            // Storage error, but continue
          }
          return activeYouTubeTabId;
        }
      } catch (error) {
        // Content script might not be ready, continue
        continue;
      }
    }

    // Strategy 3: Use most recently accessed YouTube tab
    if (allYoutubeTabs.length > 0) {
      const recentTab = allYoutubeTabs.reduce((latest, current) => {
        return (!latest || current.lastAccessed > latest.lastAccessed) ? current : latest;
      });
      
      activeYouTubeTabId = recentTab.id;
      // Save to storage for popup
      try {
        await browser.storage.local.set({ activeTabId: activeYouTubeTabId });
      } catch (error) {
        // Storage error, but continue
      }
      return activeYouTubeTabId;
    }

    return null;
  } catch (error) {
    
    return null;
  }
}

// Handle get active tab request from popup
async function handleGetActiveTab(sendResponse) {
  try {
    // Use the optimized detection logic
    const tabId = await getActiveYouTubeTab();
    
    if (tabId) {
      const response = { success: true, tabId: tabId };
      sendResponse(response);
    } else {
      const response = { success: false, error: 'No YouTube tabs found' };
      sendResponse(response);
    }
  } catch (error) {
    const errorResponse = { success: false, error: error.message };
    sendResponse(errorResponse);
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
    
    sendResponse({ success: false, error: error.message });
  }
}

// Handle auto-pause feature toggle
async function handleAutoPauseToggle(enabled) {
  try {
    await browser.storage.local.set({ autoPauseEnabled: enabled });
    
    if (enabled) {
      // Set up tab activation listener for auto-pause
      browser.tabs.onActivated.addListener(handleTabActivation);
      browser.windows.onFocusChanged.addListener(handleWindowFocus);
    } else {
      // Remove listeners
      browser.tabs.onActivated.removeListener(handleTabActivation);
      browser.windows.onFocusChanged.removeListener(handleWindowFocus);
    }
  } catch (error) {
    
  }
}

// Auto-pause functionality
async function handleTabActivation(activeInfo) {
  try {
    const result = await browser.storage.local.get(['autoPauseEnabled']);
    if (!result.autoPauseEnabled) return;

    // Check if we're leaving a YouTube tab
    if (activeYouTubeTabId && activeYouTubeTabId !== activeInfo.tabId) {
      try {
        await browser.tabs.sendMessage(activeYouTubeTabId, {
          action: 'clickPlayPause'
        });
      } catch (error) {
        // Tab might be closed, ignore error
      }
    }
  } catch (error) {
    
  }
}

async function handleWindowFocus(windowId) {
  try {
    const result = await browser.storage.local.get(['autoPauseEnabled']);
    if (!result.autoPauseEnabled) return;

    if (windowId === browser.windows.WINDOW_ID_NONE && activeYouTubeTabId) {
      // Window lost focus, pause video
      try {
        await browser.tabs.sendMessage(activeYouTubeTabId, {
          action: 'clickPlayPause'
        });
      } catch (error) {
        // Tab might be closed, ignore error
      }
    }
  } catch (error) {
    
  }
}

// Forward messages to popup (stored in browser.storage for popup to retrieve)
async function forwardToPopup(message) {
  try {
    await browser.storage.local.set({
      lastButtonState: message,
      stateTimestamp: Date.now()
    });
  } catch (error) {
    
  }
}

// Clear cache when tabs are closed or updated
browser.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeYouTubeTabId) {
    activeYouTubeTabId = null;
  }
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === activeYouTubeTabId && changeInfo.url && !changeInfo.url.includes('youtube.com')) {
    activeYouTubeTabId = null;
  }
});

// Extension lifecycle events
browser.runtime.onStartup.addListener(() => {
  
  activeYouTubeTabId = null;
});

browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    
  } else if (details.reason === 'update') {
    
  }
  activeYouTubeTabId = null;
});

// Handle get active tab request from popup
async function handleGetActiveTab(sendResponse) {
  try {
    const tabs = await browser.tabs.query({ 
      active: true, 
      currentWindow: true 
    });
    
    if (tabs && tabs.length > 0) {
      const tab = tabs[0];
      if (tab.url.includes('youtube.com')) {
        activeYouTubeTabId = tab.id;
        await browser.storage.local.set({ activeTabId: tab.id });
        sendResponse({ success: true, tabId: tab.id });
      } else {
        sendResponse({ success: false, error: 'Not a YouTube tab' });
      }
    } else {
      sendResponse({ success: false, error: 'No active tab found' });
    }
  } catch (error) {
    
    sendResponse({ success: false, error: error.message });
  }
}

// Forward messages to popup if it's open
function forwardToPopup(message) {
  // Note: In Manifest V3, we can't directly check if popup is open
  // The popup will register itself when opened and handle its own state
}

// Clear cache when tabs are closed or updated
browser.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeYouTubeTabId) {
    activeYouTubeTabId = null;
  }
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    if (tabId === activeYouTubeTabId && changeInfo.url && !changeInfo.url.includes('youtube.com')) {
      
      activeYouTubeTabId = null;
    }
  } catch (error) {
    
  }
});

// Initialize on startup
browser.runtime.onStartup.addListener(() => {
  
  activeYouTubeTabId = null;
});




