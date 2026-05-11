/**
 * YouTube Button Controller - Background Script
 * Manifest V3 Service Worker for Firefox
 * 
 * Author: Alireza Talebi
 * GitHub: https://github.com/AlirezaTalebi/Youtube-Buttons-Controller-Firefox-Extention
 * License: GPL-3.0
 */

// Cache for active YouTube tab to avoid repeated queries
let activeYouTubeTabId = null;
let autoPauseEnabled = false;

// Handle extension install/startup
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    // Clear cache on install/update
    activeYouTubeTabId = null;
    try {
      browser.storage.local.clear();
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  }
});

// Monitor tab changes for automatic YouTube detection
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    // Check if this is a YouTube page
    if (tab.url && tab.url.includes('youtube.com')) {
      console.log('Background: YouTube tab detected:', tabId, tab.url);
      
      activeYouTubeTabId = tabId;
      try {
        await browser.storage.local.set({ activeTabId: tabId });
      } catch (error) {
        // Storage error, continue
      }
    }
  } catch (error) {
    console.error('Error in tabs.onUpdated listener:', error);
  }
});

// Monitor tab activation for smart switching
browser.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await browser.tabs.get(activeInfo.tabId);
    if (tab && tab.url && tab.url.includes('youtube.com/watch')) {
      activeYouTubeTabId = activeInfo.tabId;
      try {
        await browser.storage.local.set({ activeTabId: activeInfo.tabId });
      } catch (error) {
        // Storage error, continue
      }
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
    if (activeYouTubeTabId) {
      try {
        const tab = await browser.tabs.get(activeYouTubeTabId);
        if (tab && tab.url && tab.url.includes('youtube.com/watch')) {
          console.log('Background: Using cached YouTube tab:', activeYouTubeTabId);
          return activeYouTubeTabId;
        }
      } catch (error) {
        // Tab no longer exists
        console.log('Background: Cached tab no longer valid');
        activeYouTubeTabId = null;
      }
    }

    // Strategy 1: Find active tab in current window that is YouTube
    const activeTabs = await browser.tabs.query({ 
      active: true, 
      currentWindow: true
    });

    if (activeTabs.length > 0 && activeTabs[0].url && activeTabs[0].url.includes('youtube.com/watch')) {
      activeYouTubeTabId = activeTabs[0].id;
      console.log('Background: Found active YouTube tab:', activeYouTubeTabId);
      try {
        await browser.storage.local.set({ activeTabId: activeYouTubeTabId });
      } catch (error) {
        // Storage error, continue
      }
      return activeYouTubeTabId;
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
          activeYouTubeTabId = tab.id;
          console.log('Background: Found playing YouTube tab:', activeYouTubeTabId);
          try {
            await browser.storage.local.set({ activeTabId: activeYouTubeTabId });
          } catch (error) {
            // Storage error, continue
          }
          return activeYouTubeTabId;
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
      
      activeYouTubeTabId = recentTab.id;
      console.log('Background: Using recent YouTube tab:', activeYouTubeTabId);
      try {
        await browser.storage.local.set({ activeTabId: activeYouTubeTabId });
      } catch (error) {
        // Storage error, continue
      }
      return activeYouTubeTabId;
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
    await browser.storage.local.set({ autoPauseEnabled: enabled });
    autoPauseEnabled = enabled;
  } catch (error) {
    console.error('Error setting auto-pause:', error);
  }
}

// Clear cache when tabs are closed
browser.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeYouTubeTabId) {
    activeYouTubeTabId = null;
  }
});
