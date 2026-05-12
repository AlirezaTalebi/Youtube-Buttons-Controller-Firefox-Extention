/**
 * YouTube Button Controller - Enhanced Popup Script v2.3.0
 * Advanced YouTube controller with volume, speed, and smart features
 * 
 * Author: Alireza Talebi
 * GitHub: https://github.com/AlirezaTalebi/Youtube-Buttons-Controller-Firefox-Extention
 * License: GPL-3.0
 * 
 * This software is free to use, share, modify, and distribute under GPL-3.0.
 * Report issues and contribute at: https://github.com/AlirezaTalebi/Youtube-Buttons-Controller-Firefox-Extention
 */

const HELP_TOPICS = [
  {
    title: 'Basic Controls',
    items: [
      'Play/Pause controls the current YouTube video.',
      'Previous/Next use YouTube playlist/video navigation when available.',
      'Mute toggles video sound.',
      'Speed and Volume controls affect the active video.'
    ]
  },
  {
    title: 'Current Video Card',
    items: [
      'Shows the current video thumbnail, title, channel, and playback progress.',
      'The progress bar updates while the popup is open.',
      'Drag the progress bar to seek forward or backward in the video.',
      'Focus Tab brings the YouTube tab to the foreground.',
      'Open Video opens or focuses the current video URL.'
    ]
  },
  {
    title: 'Auto-pause on Tab Switch',
    items: [
      'Enable this in Settings.',
      'When you leave a playing YouTube tab, the extension pauses the old tab.',
      'It does not resume videos automatically.'
    ]
  },
  {
    title: 'Settings Profiles',
    items: [
      'Save Channel Profile stores speed, volume, and mute for the current channel.',
      'Clear Channel Profile removes the saved profile for this channel.',
      'Save Global Default stores a fallback profile for channels without their own profile.',
      'Apply Global Default applies the global speed, volume, and mute immediately.'
    ]
  },
  {
    title: 'Watch History + Resume',
    items: [
      'Watched videos are saved locally in the extension.',
      'The Resume section shows recent videos with their saved playback position.',
      'Click a video in Resume to reopen it at the saved timestamp.',
      'Search filters the local watch history.'
    ]
  },
  {
    title: 'Popup Size and Theme',
    items: [
      'Popup Size changes between Compact (340px), Normal (390px), and Wide (480px) layouts.',
      'Theme switches between Light and Dark mode based on your preference.'
    ]
  },
  {
    title: 'Debug Logs',
    items: [
      'Logs are stored under ytControllerDebugLog.',
      'Read logs with: await browser.storage.local.get("ytControllerDebugLog")',
      'Clear logs with: await browser.storage.local.remove("ytControllerDebugLog")'
    ]
  }
];

const WATCH_HISTORY_KEY = 'ytControllerWatchHistory';
const WATCH_HISTORY_LIMIT = 300;
const WATCH_HISTORY_VISIBLE_LIMIT = 10;
const WATCH_HISTORY_SAVE_INTERVAL = 12000;
const POPUP_SIZE_KEY = 'ytControllerPopupSize';
const POPUP_SIZE_VALUES = ['compact', 'normal', 'wide'];

class PopupController {
  constructor() {
    this.activeTabId = null;
    this.isYouTubeTab = false;
    this.buttons = {};
    this.currentVolume = 50;
    this.currentSpeed = 1;
    this.videoInfo = {};
    this.settings = {
      autoPause: false,
      autoDetect: true,
      darkMode: true
    };
    this.autoDetectInterval = null;
    this.updateInterval = null;
    this.sleepTimerId = null;
    this.sleepCountdownInterval = null;
    this.statsUpdateInterval = null;
    this.historySaveInterval = null;
    this.watchHistory = [];
    this.historySearchTerm = '';
    this.popupSize = 'normal';
    this.updateFailureCount = 0;
    this.maxUpdateFailures = 3;
    this.init();
  }

  async init() {
    this.addDebugLog('[Popup]', 'info', 'init', 'popup opened');
    // Cache button references
    this.cacheButtons();
    
    // Setup event listeners
    this.setupEventListeners();
    this.renderHelpTopics();
    
    // Load saved settings
    await this.loadSettings();
    await this.loadPopupSize();
    this.applyTheme();
    await this.loadWatchHistory();
    
    // Load saved tab or detect current tab
    await this.loadActiveTab();
    
    // Initialize UI components
    this.updateVolumeUI();
    this.updateSpeedUI();
    this.updateAllToggles();
    
    // Update UI state
    this.updateUI();
    
    // Start auto-detection if enabled
    if (this.settings.autoDetect) {
      this.startAutoDetection();
      // Also trigger immediate detection when popup opens
      setTimeout(async () => {
        if (!this.isYouTubeTab || !this.activeTabId) {
          await this.autoDetectYouTubeTab();
        }
      }, 50); // Reduced delay for faster response
    }

    this.startHistoryTracking();
  }

  async addDebugLog(scope, level, action, message, data = {}) {
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

  cacheButtons() {
    const buttonIds = [
      'nextButton', 'stopButton', 'backButton', 'muteButton', 'getTabButton',
      'volumeSlider', 'volumeUp', 'volumeDown', 'volumeValue',
      'autoPauseToggle', 'captionsToggle', 'settingsButton',
      'statusIndicator', 'videoInfo', 'videoTitle',
      'currentVideoThumbnail', 'currentVideoThumbnailPlaceholder', 'currentVideoChannel',
      'currentVideoProgressBar', 'currentVideoTime',
      'focusTabButton', 'openVideoButton',
      'darkModeToggle', 'seekBar', 'currentTimeDisplay', 'durationDisplay',
      'cancelSleepBtn', 'sleepTimerDisplay', 'sleepCountdown',
      'statsPanel', 'statsDuration', 'statsProgress', 'statsBitrate', 'statsResolution',
      'saveChannelProfile', 'clearChannelProfile', 'saveGlobalProfile', 'applyGlobalProfile',
      'profileStatus', 'resumeSearch', 'resumeList', 'resumeStatus',
      'popupSizeSelect',
      'helpToggle', 'helpPanel', 'helpContent'
    ];
    
    buttonIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        this.buttons[id] = element;
      }
    });

    // Cache speed buttons
    this.speedButtons = document.querySelectorAll('[data-speed]');
    
    // Cache sleep timer buttons
    this.sleepButtons = document.querySelectorAll('[data-sleep]');
  }

  setupEventListeners() {
    // Basic control buttons
    this.buttons.nextButton?.addEventListener('click', () => {
      this.sendCommand('clickNext');
    });

    this.buttons.stopButton?.addEventListener('click', () => {
      this.sendCommand('clickPlayPause');
    });

    this.buttons.backButton?.addEventListener('click', () => {
      this.sendCommand('clickBack');
    });

    this.buttons.muteButton?.addEventListener('click', () => {
      this.sendCommand('clickMute');
    });

    this.buttons.getTabButton?.addEventListener('click', async () => {
      if (this.isYouTubeTab && this.activeTabId) {
        // If already connected, this becomes a refresh/rescan button
        this.showStatus('Rescanning for YouTube tabs...', 'info');
        this.isYouTubeTab = false;
        this.activeTabId = null;
        await this.autoDetectYouTubeTab();
      } else {
        // Original behavior - manual tab selection
        await this.setActiveTab();
      }
    });

    // Volume controls
    this.buttons.volumeSlider?.addEventListener('input', (e) => {
      this.setVolume(parseInt(e.target.value));
    });

    this.buttons.volumeUp?.addEventListener('click', () => {
      this.adjustVolume(10);
    });

    this.buttons.volumeDown?.addEventListener('click', () => {
      this.adjustVolume(-10);
    });

    this.buttons.focusTabButton?.addEventListener('click', () => {
      this.focusControlledTab();
    });

    this.buttons.openVideoButton?.addEventListener('click', () => {
      this.openCurrentVideo();
    });

    // Progress bar seeking
    this.buttons.currentVideoProgressBar?.addEventListener('change', (e) => {
      const value = Number(e.target.value);
      const percent = value / 1000;
      if (this.lastPlayerState?.duration > 0) {
        const targetTime = this.lastPlayerState.duration * percent;
        this.seekTo(targetTime);
      }
    });

    // Speed controls
    this.speedButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const speed = parseFloat(e.target.dataset.speed);
        this.setPlaybackSpeed(speed);
      });
    });

    // Profile controls
    this.buttons.saveChannelProfile?.addEventListener('click', () => {
      this.saveChannelProfile();
    });

    this.buttons.clearChannelProfile?.addEventListener('click', () => {
      this.clearChannelProfile();
    });

    this.buttons.saveGlobalProfile?.addEventListener('click', () => {
      this.saveGlobalProfile();
    });

    this.buttons.applyGlobalProfile?.addEventListener('click', () => {
      this.applyGlobalProfile();
    });

    this.buttons.resumeSearch?.addEventListener('input', (event) => {
      this.historySearchTerm = event.target.value.trim().toLowerCase();
      this.addDebugLog('[History]', 'info', 'search', 'search', { query: this.historySearchTerm });
      this.renderResumeList();
    });

    this.buttons.popupSizeSelect?.addEventListener('change', (event) => {
      this.setPopupSize(event.target.value);
    });

    // Advanced toggles
    this.buttons.autoPauseToggle?.addEventListener('click', () => {
      this.toggleAutoPause();
    });

    this.buttons.captionsToggle?.addEventListener('click', () => {
      this.sendCommand('toggleCaptions');
    });

    // Sleep timer buttons
    this.sleepButtons?.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const minutes = parseInt(e.target.dataset.sleep);
        this.startSleepTimer(minutes);
      });
    });

    this.buttons.cancelSleepBtn?.addEventListener('click', () => {
      this.cancelSleepTimer();
    });

    this.buttons.settingsButton?.addEventListener('click', () => {
      this.openSettings();
    });

    this.buttons.helpToggle?.addEventListener('click', () => {
      this.toggleHelp();
    });

    // Dark mode toggle
    this.buttons.darkModeToggle?.addEventListener('click', () => {
      this.toggleDarkMode();
    });

    // Seek bar functionality
    this.buttons.seekBar?.addEventListener('input', (e) => {
      const percentage = parseFloat(e.target.value);
      this.seekToPercentage(percentage);
    });

    this.buttons.seekBar?.addEventListener('mousedown', () => {
      this.isDragging = true;
    });

    this.buttons.seekBar?.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Listen for background script messages
    browser.runtime.onMessage.addListener((message) => {
      this.handleBackgroundMessage(message);
    });

  }

  renderHelpTopics() {
    if (!this.buttons.helpContent) return;

    this.buttons.helpContent.textContent = '';
    HELP_TOPICS.forEach(topic => {
      const topicEl = document.createElement('section');
      topicEl.className = 'help-topic';

      const titleEl = document.createElement('h3');
      titleEl.textContent = topic.title;
      topicEl.appendChild(titleEl);

      const listEl = document.createElement('ul');
      topic.items.forEach(item => {
        const itemEl = document.createElement('li');
        itemEl.textContent = item;
        listEl.appendChild(itemEl);
      });

      topicEl.appendChild(listEl);
      this.buttons.helpContent.appendChild(topicEl);
    });
  }

  toggleHelp() {
    if (!this.buttons.helpPanel || !this.buttons.helpToggle) return;

    const isHidden = this.buttons.helpPanel.hidden;
    this.buttons.helpPanel.hidden = !isHidden;
    this.buttons.helpToggle.setAttribute('aria-expanded', String(isHidden));
    this.buttons.helpToggle.textContent = isHidden ? 'Hide Help' : 'Help / Usage';

    if (isHidden) {
      console.log('[Help] opened');
      this.addDebugLog('[Help]', 'info', 'toggleHelp', 'opened');
    }
  }

  normalizePopupSize(value) {
    return POPUP_SIZE_VALUES.includes(value) ? value : 'normal';
  }

  async loadPopupSize() {
    try {
      const result = await browser.storage.local.get(POPUP_SIZE_KEY);
      this.popupSize = this.normalizePopupSize(result[POPUP_SIZE_KEY]);
      this.addDebugLog('[Layout]', 'info', 'popupSize', 'popup size loaded', { size: this.popupSize });
      this.applyPopupSize(this.popupSize);
    } catch (error) {
      this.popupSize = 'normal';
      this.addDebugLog('[Layout]', 'warn', 'popupSize', 'popup size loaded', { size: this.popupSize, error: error.message });
      this.applyPopupSize(this.popupSize);
    }
  }

  async setPopupSize(size) {
    const nextSize = this.normalizePopupSize(size);
    this.popupSize = nextSize;
    await browser.storage.local.set({ [POPUP_SIZE_KEY]: nextSize });
    this.addDebugLog('[Layout]', 'info', 'popupSize', 'popup size changed', { size: nextSize });
    this.applyPopupSize(nextSize);
  }

  applyPopupSize(size) {
    const normalized = this.normalizePopupSize(size);
    document.body.classList.remove('popup-size-compact', 'popup-size-normal', 'popup-size-wide');
    document.body.classList.add(`popup-size-${normalized}`);
    if (this.buttons.popupSizeSelect) {
      this.buttons.popupSizeSelect.value = normalized;
    }
    this.addDebugLog('[Layout]', 'info', 'popupSize', 'popup size applied', { size: normalized });
  }

  async loadActiveTab() {
    try {
      // Try to load from storage first (set by background script)
      const result = await browser.storage.local.get(['activeTabId']);
      
      if (result.activeTabId) {
        try {
          const tab = await browser.tabs.get(result.activeTabId);
          if (tab && tab.url && tab.url.includes('youtube.com')) {
            console.log('Popup: Reconnecting to saved tab:', result.activeTabId);
            // Test connection before setting as active
            await this.testAndConnectToTab(result.activeTabId, 'Reconnected to saved tab');
            return;
          }
        } catch (error) {
          console.log('Popup: Saved tab no longer exists');
          // Tab no longer exists, clear storage
          await browser.storage.local.remove(['activeTabId']);
        }
      }

      // If no saved tab or saved tab is invalid, trigger auto-detection
      await this.autoDetectYouTubeTab();
    } catch (error) {
      this.updateUI();
    }
  }

  async autoDetectYouTubeTab() {
    try {
      console.log('Popup: Starting YouTube tab auto-detection...');
      // Get all YouTube tabs using correct patterns (both www and non-www)
      const youtubeTabs = await browser.tabs.query({ 
        url: ['*://*.youtube.com/watch*', '*://youtube.com/watch*']
      });

      console.log('Popup: Found', youtubeTabs.length, 'YouTube tabs');

      if (youtubeTabs.length === 0) {
        // No YouTube tabs found
        this.showStatus('No YouTube videos open', 'warning');
        return;
      }

      // Strategy 1: Check if current active tab is YouTube
      const [activeTab] = await browser.tabs.query({ 
        active: true, 
        currentWindow: true 
      });

      if (activeTab && activeTab.url.includes('youtube.com/watch')) {
        await this.testAndConnectToTab(activeTab.id, 'Connected to active YouTube tab');
        return;
      }

      // Strategy 2: Find a playing YouTube tab
      const playingTab = await this.findPlayingYouTubeTab(youtubeTabs);
      if (playingTab) {
        await this.testAndConnectToTab(playingTab.id, 'Connected to playing video');
        return;
      }

      // Strategy 3: Use the most recently accessed YouTube tab
      const recentTab = youtubeTabs.reduce((latest, current) => {
        return (!latest || current.lastAccessed > latest.lastAccessed) ? current : latest;
      });

      if (recentTab) {
        await this.testAndConnectToTab(recentTab.id, 'Connected to recent video');
        return;
      }

    } catch (error) {
      this.showStatus('Error detecting YouTube tabs', 'error');
    }
  }

  async findPlayingYouTubeTab(youtubeTabs) {
    console.log('Popup: Searching for playing YouTube tab...');
    for (const tab of youtubeTabs) {
      try {
        console.log('Popup: Checking tab', tab.id, '-', tab.url);
        const response = await browser.tabs.sendMessage(tab.id, { 
          action: 'getPlayerState' 
        });
        
        console.log('Popup: Tab response:', response);
        const ok = this.isSuccessfulResponse(response);
        const state = this.getResponseResult(response);
        if (ok && state && state.isValidPage && state.isReady && state.isPlaying) {
          console.log('Popup: Found playing tab:', tab.id);
          return tab;
        }
      } catch (error) {
        // Tab might not have content script injected yet, skip
        console.debug('Popup: Tab', tab.id, 'error:', error.message);
        continue;
      }
    }
    console.log('Popup: No playing tabs found');
    return null;
  }

  async testAndConnectToTab(tabId, message) {
    console.log('Popup: Testing connection to tab', tabId, '-', message);
    try {
      // First, ping to verify content script is alive
      const pingResponse = await browser.tabs.sendMessage(tabId, { action: 'ping' });
      
      if (this.isSuccessfulResponse(pingResponse) && pingResponse.source === 'content') {
        console.log('Popup: Ping successful, content script is alive');
        this.addDebugLog('[Popup]', 'info', 'ping', 'ping success', { tabId });
        this.activeTabId = tabId;
        this.isYouTubeTab = true;
        this.updateFailureCount = 0;
        await browser.storage.local.set({ activeTabId: tabId });
        this.showStatus(message, 'success');
        this.updateUI();
        this.addDebugLog('[Popup]', 'info', 'getPlayerState', 'initial getPlayerState requested', { tabId });
        await this.updatePlayerState({ initial: true, saveHistory: true });
        this.startUpdates();
        return true;
      }
    } catch (error) {
      console.log('Popup: Ping failed:', error.message);
    }
    
    this.showStatus('Content script not responding', 'error');
    return false;
  }

  async connectToTab(tabId, message) {
    this.activeTabId = tabId;
    this.isYouTubeTab = true;
    await browser.storage.local.set({ activeTabId: tabId });
    await this.updatePlayerState({ initial: true, saveHistory: true });
    this.showStatus(message, 'success');
    this.updateUI();
  }

  startAutoDetection() {
    // Clear any existing interval
    if (this.autoDetectInterval) {
      clearInterval(this.autoDetectInterval);
    }

    // Check for YouTube tabs every 2 seconds if not connected (more frequent)
    this.autoDetectInterval = setInterval(async () => {
      if (!this.isYouTubeTab || !this.activeTabId) {
        await this.autoDetectYouTubeTab();
      } else {
        // Verify current connection is still valid
        await this.verifyConnection();
      }
    }, 2000); // Reduced from 5000 to 2000 for faster detection
  }

  stopAutoDetection() {
    if (this.autoDetectInterval) {
      clearInterval(this.autoDetectInterval);
      this.autoDetectInterval = null;
    }
  }

  startUpdates() {
    this.startTimeUpdates();
  }

  startTimeUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Update progress and time every second when connected
    this.updateInterval = setInterval(async () => {
      if (this.isYouTubeTab && this.activeTabId && !this.isDragging) {
        await this.updatePlayerState();
        // Update stats every 2 seconds
        if (Math.random() > 0.5) {
          await this.updateVideoStats();
        }
        // Auto-save position every 5 seconds if enabled
        if (Math.floor(Date.now() / 5000) % 2 === 0) {
          await this.savePlaybackPosition();
        }
      }
    }, 1000);
  }

  stopTimeUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  stopUpdates() {
    this.stopTimeUpdates();
  }

  async updateTimeDisplay() {
    if (!this.activeTabId) return;

    try {
      const response = await browser.tabs.sendMessage(this.activeTabId, { 
        action: 'getPlayerState' 
      });

      const ok = this.isSuccessfulResponse(response);
      const state = this.getResponseResult(response);
      if (ok && state?.isReady) {
        
        // Update time displays
        if (this.buttons.currentTimeDisplay && state.currentTime !== undefined) {
          this.buttons.currentTimeDisplay.textContent = this.formatTime(state.currentTime);
        }
        
        if (this.buttons.durationDisplay && state.duration !== undefined) {
          this.buttons.durationDisplay.textContent = this.formatTime(state.duration);
        }

        // Update seek bar with progress gradient
        if (this.buttons.seekBar && state.duration > 0) {
          const percentage = (state.currentTime / state.duration) * 100;
          this.buttons.seekBar.value = percentage;
          
          // Update the progress gradient
          const isDark = document.body.classList.contains('dark-mode');
          const progressColor = '#6495ed';
          const trackColor = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.4)';
          
          this.buttons.seekBar.style.background = 
            `linear-gradient(to right, ${progressColor} 0%, ${progressColor} ${percentage}%, ${trackColor} ${percentage}%)`;
        }

      }
    } catch (error) {
      // Connection lost, will be handled by verification
    }
  }

  async seekToPercentage(percentage) {
    if (!this.activeTabId) return;

    try {
      const response = await browser.tabs.sendMessage(this.activeTabId, { 
        action: 'getPlayerState' 
      });

      const ok = this.isSuccessfulResponse(response);
      const state = this.getResponseResult(response);
      if (ok && state?.duration) {
        const seekTime = (percentage / 100) * state.duration;
        
        await browser.tabs.sendMessage(this.activeTabId, {
          action: 'seekTo',
          time: seekTime
        });
      }
    } catch (error) {
      // Connection lost, will be handled by verification
    }
  }

  toggleDarkMode() {
    this.settings.darkMode = !this.settings.darkMode;
    this.applyTheme();
    this.saveSettings();
    this.addDebugLog('[Settings]', 'info', 'theme', 'theme changed', { darkMode: this.settings.darkMode });
    this.showStatus(`${this.settings.darkMode ? 'Dark' : 'Light'} mode enabled`, 'success');
  }

  applyTheme() {
    const popup = document.body;
    if (this.settings.darkMode) {
      popup.classList.add('dark-mode');
      popup.classList.add('theme-dark');
      popup.classList.remove('light-mode');
      popup.classList.remove('theme-light');
    } else {
      popup.classList.add('light-mode');
      popup.classList.add('theme-light');
      popup.classList.remove('dark-mode');
      popup.classList.remove('theme-dark');
    }

    if (this.buttons.darkModeToggle) {
      this.buttons.darkModeToggle.setAttribute('aria-pressed', String(this.settings.darkMode));
      this.buttons.darkModeToggle.classList.toggle('is-dark', this.settings.darkMode);
      this.buttons.darkModeToggle.classList.toggle('is-light', !this.settings.darkMode);
      this.buttons.darkModeToggle.title = `Switch to ${this.settings.darkMode ? 'light' : 'dark'} mode`;
    }
  }

  async verifyConnection() {
    if (!this.activeTabId) return;

    try {
      await browser.tabs.get(this.activeTabId);
      // Tab still exists, check if it's still YouTube
      const response = await browser.tabs.sendMessage(this.activeTabId, { 
        action: 'getPlayerState' 
      });
      
      if (!this.isSuccessfulResponse(response)) {
        // Connection lost, restart auto-detection silently
        this.isYouTubeTab = false;
        this.activeTabId = null;
        this.updateUI();
      }
    } catch (error) {
      // Tab was closed, restart auto-detection silently  
      this.isYouTubeTab = false;
      this.activeTabId = null;
      this.updateUI();
    }
  }

  async setActiveTab() {
    try {
      const response = await browser.runtime.sendMessage({ 
        type: 'GET_ACTIVE_TAB' 
      });

      if (this.isSuccessfulResponse(response)) {
        this.activeTabId = response.tabId;
        this.isYouTubeTab = true;
        await this.updatePlayerState({ initial: true, saveHistory: true });
        this.showStatus('Tab set successfully!', 'success');
      } else {
        this.isYouTubeTab = false;
        this.showStatus(response.error || 'Please select a YouTube tab', 'error');
      }
      
      this.updateUI();
    } catch (error) {
      this.showStatus('Error setting tab', 'error');
    }
  }

  async sendCommand(command, params = {}) {
    if (!this.activeTabId || !this.isYouTubeTab) {
      this.showStatus('Please connect to a YouTube tab first', 'warning');
      return;
    }

    try {
      console.log('[Popup] Sending command:', command, params);
      this.addDebugLog('[Popup]', 'info', command, 'command sent', params);
      this.addDebugLog('[Command]', 'info', command, 'sent', params);
      
      const response = await browser.tabs.sendMessage(this.activeTabId, { 
        action: command,
        ...params
      });

      console.log('[Popup] Response for', command, ':', response);
      this.addDebugLog('[Popup]', 'info', command, 'response received', { ok: response?.ok, success: response?.success, error: response?.error });

      const isSuccess = this.isSuccessfulResponse(response);
      this.logCommandInterpretation(command, response, isSuccess);
      
      if (isSuccess) {
        // Update button states based on response
        this.updateButtonStates(command, response.state);
        
        // Add a small delay then refresh the full player state to ensure UI is in sync
        setTimeout(async () => {
          await this.updatePlayerState();
        }, 100);
        
        // Show success feedback for certain commands
        if (['clickNext', 'clickBack'].includes(command)) {
          this.showStatus(`${command === 'clickNext' ? 'Next' : 'Previous'} video`, 'success');
        }
        this.addDebugLog('[Popup]', 'info', command, 'command succeeded');
      } else {
        const errorMsg = response?.error || 'Command failed';
        this.showStatus(errorMsg, 'error');
        this.addDebugLog('[Popup]', 'warn', command, 'command failed', { error: errorMsg });
      }
    } catch (error) {
      // Tab might be closed or inactive, try to refresh
      await this.loadActiveTab();
      this.showStatus('Connection lost, please reconnect', 'error');
    }
  }

  async updatePlayerState(options = {}) {
    if (!this.activeTabId) return;

    try {
      const response = await browser.tabs.sendMessage(this.activeTabId, { 
        action: 'getPlayerState' 
      });

      const ok = this.isSuccessfulResponse(response);
      this.logCommandInterpretation('getPlayerState', response, ok);

      if (ok) {
        const state = this.getResponseResult(response);
        this.addDebugLog('[Popup]', 'info', 'getPlayerState', 'player state received', {
          title: state?.title || state?.videoTitle,
          paused: state?.paused,
          isPlaying: state?.isPlaying
        });
        if (options.initial) {
          this.addDebugLog('[Popup]', 'info', 'getPlayerState', 'initial player state received', {
            title: state?.title || state?.videoTitle,
            paused: state?.paused,
            isPlaying: state?.isPlaying
          });
        }

        if (!state) {
          throw new Error('Missing player state result');
        }

        this.updateFailureCount = 0; // Reset on success
        
        // Check if it's a valid YouTube video page
        if (!state.isValidPage) {
          this.showStatus('Tab is not a YouTube video page', 'warning');
          this.isYouTubeTab = false;
          this.activeTabId = null;
          this.updateUI();
          return;
        }

        // Update player UI with fresh state
        this.updatePlayerUI(state);
        if (options.saveHistory) {
          await this.saveHistoryFromState(state, 'initial state');
        }
        
        // Update status with video info
        const displayTitle = state.title || state.videoTitle;
        if (displayTitle) {
          const shortTitle = displayTitle.length > 25 ? 
                            displayTitle.substring(0, 25) + '...' : 
                            displayTitle;
          this.updateStatusIndicator(`Connected: ${shortTitle}`, 'success');
        } else {
          this.updateStatusIndicator('Connected to YouTube', 'success');
        }
      }
      return this.getResponseResult(response);
    } catch (error) {
      this.updateFailureCount++;
      
      // Stop polling after too many failures
      if (this.updateFailureCount >= this.maxUpdateFailures) {
        console.log('Popup: Stopping updates after', this.updateFailureCount, 'failures');
        this.stopUpdates();
        this.showStatus('Content script disconnected', 'error');
      } else {
        console.log('Popup: Update failed (' + this.updateFailureCount + '/' + this.maxUpdateFailures + '):', error.message);
      }
    }
  }

  updatePlayerUI(state) {
    this.videoInfo = state || {};

    // Update play/pause button
    if (this.buttons.stopButton) {
      const iconSpan = this.buttons.stopButton.querySelector('.icon');
      const textSpan = this.buttons.stopButton.querySelector('span:not(.icon)');
      
      if (iconSpan && textSpan) {
        const shouldShowPause = state.isPlaying === true || state.paused === false;
        const renderedAs = shouldShowPause ? 'Pause' : 'Play';
        iconSpan.textContent = shouldShowPause ? '||' : '>';
        textSpan.textContent = renderedAs;
        this.addDebugLog('[Popup]', 'info', 'renderPlayButton', 'play button rendered as Play/Pause', {
          renderedAs,
          paused: state.paused,
          isPlaying: state.isPlaying
        });
      }
    }
    
    // Update mute button
    if (this.buttons.muteButton) {
      const iconSpan = this.buttons.muteButton.querySelector('.icon');
      const textSpan = this.buttons.muteButton.querySelector('span:not(.icon)');
      
      if (iconSpan && textSpan) {
        iconSpan.textContent = state.isMuted ? 'M-' : 'M';
        textSpan.textContent = state.isMuted ? 'Unmute' : 'Mute';
      }
    }

    // Update video info
    this.updateCurrentVideoCard(state);
    
    // Update volume if available
    if (state.volume !== undefined) {
      this.currentVolume = state.volume;
      this.updateVolumeUI();
    }

    // Update speed if available
    if (state.playbackRate !== undefined) {
      this.currentSpeed = state.playbackRate;
      this.updateSpeedUI();
    }

    this.addDebugLog('[Popup]', 'info', 'updatePlayerUI', 'UI state rendered', {
      title: state.title || state.videoTitle,
      paused: state.paused,
      isPlaying: state.isPlaying,
      volume: state.volume,
      playbackRate: state.playbackRate
    });
  }

  // NEW: Volume control methods
  async setVolume(volume) {
    this.currentVolume = Math.max(0, Math.min(100, volume));
    this.updateVolumeUI();
    
    if (this.activeTabId) {
      try {
        const response = await browser.tabs.sendMessage(this.activeTabId, {
          action: 'setVolume',
          volume: this.currentVolume
        });
        const ok = this.isSuccessfulResponse(response);
        this.logCommandInterpretation('setVolume', response, ok);
        if (!ok) {
          this.showStatus(response?.error || 'Volume command failed', 'error');
        }
      } catch (error) {
        this.addDebugLog('[Error]', 'warn', 'setVolume', 'important failure', { error: error.message });
      }
    }
    return null;
  }

  adjustVolume(delta) {
    this.setVolume(this.currentVolume + delta);
  }

  updateVolumeUI() {
    if (this.buttons.volumeSlider) {
      this.buttons.volumeSlider.value = this.currentVolume;
    }
    if (this.buttons.volumeValue) {
      this.buttons.volumeValue.textContent = `${this.currentVolume}%`;
    }
  }

  // NEW: Playback speed control methods
  async setPlaybackSpeed(speed) {
    this.currentSpeed = speed;
    this.updateSpeedUI();
    
    if (this.activeTabId) {
      try {
        const response = await browser.tabs.sendMessage(this.activeTabId, {
          action: 'setPlaybackSpeed',
          speed: speed
        });
        const ok = this.isSuccessfulResponse(response);
        this.logCommandInterpretation('setPlaybackSpeed', response, ok);
        if (ok) {
          this.showStatus(`Speed set to ${speed}x`, 'success');
        } else {
          this.showStatus(response?.error || 'Speed command failed', 'error');
        }
      } catch (error) {
        this.addDebugLog('[Error]', 'warn', 'setPlaybackSpeed', 'important failure', { error: error.message });
      }
    }
  }

  updateSpeedUI() {
    this.speedButtons.forEach(btn => {
      const speed = parseFloat(btn.dataset.speed);
      if (speed === this.currentSpeed) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  startHistoryTracking() {
    this.stopHistoryTracking();
    this.historySaveInterval = setInterval(async () => {
      await this.saveCurrentHistoryEntry('interval');
    }, WATCH_HISTORY_SAVE_INTERVAL);
  }

  stopHistoryTracking() {
    if (this.historySaveInterval) {
      clearInterval(this.historySaveInterval);
      this.historySaveInterval = null;
    }
  }

  async loadWatchHistory() {
    try {
      const result = await browser.storage.local.get(WATCH_HISTORY_KEY);
      const history = Array.isArray(result[WATCH_HISTORY_KEY]) ? result[WATCH_HISTORY_KEY] : [];
      this.watchHistory = history.slice(0, WATCH_HISTORY_LIMIT);
      this.renderResumeList();
      this.addDebugLog('[History]', 'info', 'load', 'loaded', { count: this.watchHistory.length });
    } catch (error) {
      this.watchHistory = [];
      this.renderResumeList();
      this.addDebugLog('[History]', 'error', 'load', 'skipped with reason', { reason: error.message });
    }
  }

  async saveCurrentHistoryEntry(reason = 'manual') {
    if (!this.activeTabId || !this.isYouTubeTab) {
      this.addDebugLog('[History]', 'info', 'save', 'skipped with reason', { reason: 'no active YouTube tab', source: reason });
      return;
    }

    try {
      const response = await browser.tabs.sendMessage(this.activeTabId, {
        action: 'getPlayerState'
      });
      const ok = this.isSuccessfulResponse(response);
      const state = this.getResponseResult(response);
      if (!ok || !state) {
        this.addDebugLog('[History]', 'info', 'save', 'skipped with reason', { reason: 'missing player state', source: reason });
        return;
      }

      await this.saveHistoryFromState(state, reason);
    } catch (error) {
      this.addDebugLog('[History]', 'warn', 'save', 'skipped with reason', { reason: error.message, source: reason });
    }
  }

  async saveHistoryFromState(state, reason = 'state') {
    if (!state?.isValidPage || !state.hasVideo) {
      this.addDebugLog('[History]', 'info', 'save', 'skipped with reason', { reason: 'not a valid video page', source: reason });
      return;
    }

    if (!state.videoId) {
      this.addDebugLog('[History]', 'info', 'save', 'skipped with reason', { reason: 'missing videoId', source: reason });
      return;
    }

    const entry = this.buildHistoryEntry(state);
    if (!entry) {
      this.addDebugLog('[History]', 'info', 'save', 'skipped with reason', { reason: 'invalid history entry', source: reason });
      return;
    }

    const existing = this.watchHistory.filter(item => item.videoId !== entry.videoId);
    this.watchHistory = [entry, ...existing]
      .sort((a, b) => new Date(b.lastWatchedAt).getTime() - new Date(a.lastWatchedAt).getTime())
      .slice(0, WATCH_HISTORY_LIMIT);

    await browser.storage.local.set({ [WATCH_HISTORY_KEY]: this.watchHistory });
    this.renderResumeList();
    this.addDebugLog('[History]', 'info', 'save', 'saved', {
      videoId: entry.videoId,
      title: entry.title,
      progressPercent: entry.progressPercent,
      count: this.watchHistory.length
    });
  }

  buildHistoryEntry(state) {
    const duration = Number(state.duration) || 0;
    const currentTime = Math.max(0, Number(state.currentTime) || 0);
    const progressPercent = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;
    const title = state.title || state.videoTitle || 'Video detected - title unavailable';

    return {
      videoId: state.videoId,
      title,
      url: state.url || `https://www.youtube.com/watch?v=${encodeURIComponent(state.videoId)}`,
      channelName: state.channelName || '',
      channelKey: state.channelKey || '',
      currentTime: Math.floor(currentTime),
      duration: Math.floor(duration),
      progressPercent,
      lastWatchedAt: new Date().toISOString(),
      thumbnailUrl: state.thumbnailUrl || ''
    };
  }

  renderResumeList() {
    if (!this.buttons.resumeList) return;

    const query = this.historySearchTerm;
    const matches = this.watchHistory
      .filter(entry => {
        if (!query) return true;
        return `${entry.title || ''} ${entry.channelName || ''}`.toLowerCase().includes(query);
      })
      .slice(0, WATCH_HISTORY_VISIBLE_LIMIT);

    this.buttons.resumeList.textContent = '';
    if (this.buttons.resumeStatus) {
      this.buttons.resumeStatus.textContent = matches.length ? '' : 'No saved videos yet';
    }

    matches.forEach(entry => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'resume-entry';
      button.dataset.videoId = entry.videoId;

      const title = document.createElement('span');
      title.className = 'resume-title';
      title.textContent = entry.title || 'Untitled video';

      const meta = document.createElement('span');
      meta.className = 'resume-meta';
      meta.textContent = this.formatHistoryMeta(entry);

      button.appendChild(title);
      button.appendChild(meta);
      button.addEventListener('click', () => this.openResumeEntry(entry));
      this.buttons.resumeList.appendChild(button);
    });
  }

  formatHistoryMeta(entry) {
    const parts = [];
    if (entry.channelName) {
      parts.push(entry.channelName);
    }

    if (entry.progressPercent > 0) {
      parts.push(`${entry.progressPercent}% watched`);
    } else if (entry.currentTime > 0) {
      parts.push(this.formatTime(entry.currentTime));
    }

    parts.push(this.formatShortDate(entry.lastWatchedAt));
    return parts.join(' | ');
  }

  formatShortDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'recently';
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  buildResumeUrl(entry) {
    const seconds = Math.max(0, Math.floor(Number(entry.currentTime) || 0));
    const baseUrl = entry.url || `https://www.youtube.com/watch?v=${encodeURIComponent(entry.videoId)}`;

    try {
      const url = new URL(baseUrl);
      if (!url.searchParams.get('v') && entry.videoId && !url.pathname.startsWith('/shorts/')) {
        url.searchParams.set('v', entry.videoId);
      }
      if (seconds > 0) {
        url.searchParams.set('t', `${seconds}s`);
      }
      return url.href;
    } catch (error) {
      const fallback = new URL('https://www.youtube.com/watch');
      fallback.searchParams.set('v', entry.videoId);
      if (seconds > 0) {
        fallback.searchParams.set('t', `${seconds}s`);
      }
      return fallback.href;
    }
  }

  async openResumeEntry(entry) {
    const url = this.buildResumeUrl(entry);
    this.addDebugLog('[History]', 'info', 'resume', 'resume clicked', {
      videoId: entry.videoId,
      currentTime: entry.currentTime
    });
    this.addDebugLog('[History]', 'info', 'resume', 'open resume URL', { url });
    await browser.tabs.create({ url });
  }

  isSuccessfulResponse(response) {
    return response && (response.ok === true || response.success === true);
  }

  getResponseResult(response) {
    return response?.result || response?.state || response || null;
  }

  logCommandInterpretation(command, response, ok) {
    this.addDebugLog('[Popup]', ok ? 'info' : 'warn', command, 'command interpreted ok/fail', {
      ok,
      responseOk: response?.ok,
      responseSuccess: response?.success,
      error: response?.error
    });
    this.addDebugLog('[Command]', ok ? 'info' : 'warn', command, 'result', {
      ok,
      error: response?.error
    });
  }

  setProfileStatus(message, type = 'info') {
    const colors = {
      success: '#4CAF50',
      error: '#f44336',
      warning: '#ff9800',
      info: '#2196F3'
    };

    if (this.buttons.profileStatus) {
      this.buttons.profileStatus.textContent = message;
      this.buttons.profileStatus.style.color = colors[type] || colors.info;
    } else {
      this.showStatus(message, type);
    }
  }

  async getProfileContext() {
    if (!this.activeTabId || !this.isYouTubeTab) {
      this.setProfileStatus('No channel detected', 'warning');
      this.addDebugLog('[Profile]', 'info', 'context', 'skipped with reason', { reason: 'no active YouTube tab' });
      return null;
    }

    try {
      const response = await browser.tabs.sendMessage(this.activeTabId, {
        action: 'getCurrentProfileContext'
      });

      if (!this.isSuccessfulResponse(response) || !response.result) {
        throw new Error(response?.error || 'No channel detected');
      }

      return response.result;
    } catch (error) {
      console.log('[Profile] context failed', error.message);
      this.setProfileStatus('No channel detected', 'warning');
      this.addDebugLog('[Profile]', 'warn', 'context', 'skipped with reason', {
        reason: error.message
      });
      return null;
    }
  }

  buildProfileFromContext(context) {
    const speed = Number(context.speed);
    const volume = Number(context.volume);

    return {
      speed: Number.isFinite(speed) ? speed : 1,
      volume: Number.isFinite(volume) ? Math.max(0, Math.min(100, Math.round(volume))) : 100,
      muted: context.muted === true,
      updatedAt: new Date().toISOString()
    };
  }

  async saveChannelProfile() {
    const context = await this.getProfileContext();
    if (!context) return;

    if (!context.channelKey) {
      this.setProfileStatus('No channel detected', 'warning');
      this.addDebugLog('[Profile]', 'warn', 'channelProfile', 'skipped with reason', { reason: 'no channel detected' });
      return;
    }

    try {
      const stored = await browser.storage.local.get('ytControllerProfiles');
      const profiles = stored.ytControllerProfiles && typeof stored.ytControllerProfiles === 'object'
        ? { ...stored.ytControllerProfiles }
        : {};
      profiles[context.channelKey] = {
        channelName: context.channelName || '',
        channelUrl: context.channelUrl || '',
        ...this.buildProfileFromContext(context)
      };

      await browser.storage.local.set({ ytControllerProfiles: profiles });
      console.log('[Profile] channel profile saved', profiles[context.channelKey]);
      this.setProfileStatus('Channel profile saved', 'success');
      this.addDebugLog('[Profile]', 'info', 'channelProfile', 'channel profile saved', {
        channelKey: context.channelKey,
        profile: profiles[context.channelKey]
      });
    } catch (error) {
      console.log('[Profile] save channel failed', error.message);
      this.setProfileStatus(error.message, 'error');
      this.addDebugLog('[Profile]', 'error', 'channelProfile', 'channel profile save failed', { error: error.message });
    }
  }

  async clearChannelProfile() {
    const context = await this.getProfileContext();
    if (!context) return;

    if (!context.channelKey) {
      this.setProfileStatus('No channel detected', 'warning');
      this.addDebugLog('[Profile]', 'warn', 'channelProfile', 'skipped with reason', { reason: 'no channel detected' });
      return;
    }

    try {
      const stored = await browser.storage.local.get('ytControllerProfiles');
      const profiles = stored.ytControllerProfiles && typeof stored.ytControllerProfiles === 'object'
        ? { ...stored.ytControllerProfiles }
        : {};

      if (!profiles[context.channelKey]) {
        this.setProfileStatus('No profile found', 'warning');
        this.addDebugLog('[Profile]', 'info', 'channelProfile', 'skipped with reason', {
          reason: 'no profile found',
          channelKey: context.channelKey
        });
        return;
      }

      delete profiles[context.channelKey];
      await browser.storage.local.set({ ytControllerProfiles: profiles });
      console.log('[Profile] channel profile cleared', context.channelKey);
      this.setProfileStatus('Channel profile cleared', 'success');
      this.addDebugLog('[Profile]', 'info', 'channelProfile', 'channel profile cleared', {
        channelKey: context.channelKey
      });
    } catch (error) {
      console.log('[Profile] clear channel failed', error.message);
      this.setProfileStatus(error.message, 'error');
      this.addDebugLog('[Profile]', 'error', 'channelProfile', 'channel profile clear failed', { error: error.message });
    }
  }

  async saveGlobalProfile() {
    const context = await this.getProfileContext();
    if (!context) return;

    try {
      const profile = this.buildProfileFromContext(context);
      await browser.storage.local.set({ ytControllerGlobalProfile: profile });
      console.log('[Profile] global profile saved', profile);
      this.setProfileStatus('Global profile saved', 'success');
      this.addDebugLog('[Profile]', 'info', 'globalProfile', 'global profile saved', { profile });
    } catch (error) {
      console.log('[Profile] save global failed', error.message);
      this.setProfileStatus(error.message, 'error');
      this.addDebugLog('[Profile]', 'error', 'globalProfile', 'global profile save failed', { error: error.message });
    }
  }

  async applyGlobalProfile() {
    if (!this.activeTabId || !this.isYouTubeTab) {
      this.setProfileStatus('No channel detected', 'warning');
      this.addDebugLog('[Profile]', 'info', 'globalProfile', 'skipped with reason', { reason: 'no active YouTube tab' });
      return;
    }

    try {
      const { ytControllerGlobalProfile } = await browser.storage.local.get('ytControllerGlobalProfile');
      if (!ytControllerGlobalProfile) {
        this.setProfileStatus('No profile found', 'warning');
        this.addDebugLog('[Profile]', 'info', 'globalProfile', 'skipped with reason', { reason: 'no profile found' });
        return;
      }

      const response = await browser.tabs.sendMessage(this.activeTabId, {
        action: 'applyProfile',
        profile: ytControllerGlobalProfile
      });

      const ok = this.isSuccessfulResponse(response);
      this.logCommandInterpretation('applyProfile', response, ok);

      if (!ok) {
        throw new Error(response?.error || 'Profile apply failed');
      }

      if (response.result) {
        this.currentVolume = response.result.volume;
        this.currentSpeed = response.result.speed;
        this.updateVolumeUI();
        this.updateSpeedUI();
      }

      console.log('[Profile] global profile applied', response.result);
      this.setProfileStatus('Global profile applied', 'success');
      this.addDebugLog('[Profile]', 'info', 'globalProfile', 'global profile applied', {
        result: response.result
      });
      setTimeout(async () => {
        await this.updatePlayerState({ initial: true, saveHistory: true });
      }, 100);
    } catch (error) {
      console.log('[Profile] apply failed', error.message);
      this.setProfileStatus(error.message, 'error');
      this.addDebugLog('[Profile]', 'error', 'globalProfile', 'apply failed', {
        error: error.message
      });
    }
  }

  // Current video card
  updateCurrentVideoCard(state) {
    const safeState = state || {};
    this.lastPlayerState = safeState;
    const hasVideoId = !!safeState.videoId;
    const title = safeState.title || safeState.videoTitle || (safeState.hasVideo ? 'Video detected - title unavailable' : 'No video selected');
    const channelName = safeState.channelName || 'Unknown channel';
    const duration = Number(safeState.duration) || 0;
    const currentTime = Math.max(0, Number(safeState.currentTime) || 0);
    const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
    const thumbnailUrl = this.getThumbnailUrl(safeState);

    if (this.buttons.videoTitle) {
      this.buttons.videoTitle.textContent = title;
      this.buttons.videoTitle.setAttribute('title', title);
    }

    if (this.buttons.currentVideoChannel) {
      this.buttons.currentVideoChannel.textContent = channelName;
    }

    if (this.buttons.currentVideoTime) {
      const timeText = duration > 0
        ? `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`
        : '--:-- / --:--';
      this.buttons.currentVideoTime.textContent = timeText;
    }

    if (this.buttons.currentVideoProgressBar) {
      this.buttons.currentVideoProgressBar.value = Math.round(progress * 10);
    }

    if (this.buttons.currentVideoThumbnail && this.buttons.currentVideoThumbnailPlaceholder) {
      if (thumbnailUrl) {
        this.buttons.currentVideoThumbnail.src = thumbnailUrl;
        this.buttons.currentVideoThumbnail.style.display = 'block';
        this.buttons.currentVideoThumbnailPlaceholder.style.display = 'none';
        this.setupThumbnailFallback(this.buttons.currentVideoThumbnail, safeState.videoId);
        this.addDebugLog('[CurrentVideo]', 'info', 'thumbnail', 'image loading', { url: thumbnailUrl, videoId: safeState.videoId });
        console.log('[CurrentVideo] thumbnail loading:', thumbnailUrl);
      } else {
        this.buttons.currentVideoThumbnail.removeAttribute('src');
        this.buttons.currentVideoThumbnail.style.display = 'none';
        this.buttons.currentVideoThumbnailPlaceholder.style.display = 'flex';
        this.addDebugLog('[CurrentVideo]', 'info', 'thumbnail', 'no thumbnail url', { videoId: safeState.videoId });
        console.log('[CurrentVideo] no thumbnail url');
      }
    }

    if (this.buttons.focusTabButton) {
      this.buttons.focusTabButton.disabled = !this.activeTabId;
    }

    if (this.buttons.openVideoButton) {
      this.buttons.openVideoButton.disabled = !safeState.url && !hasVideoId;
    }

    if (!hasVideoId && !safeState.url) {
      console.log('[CurrentVideo] no video');
      this.addDebugLog('[CurrentVideo]', 'info', 'render', 'no video');
    } else {
      console.log('[CurrentVideo] card rendered', { videoId: safeState.videoId, title, channelName, duration, currentTime, progress });
      this.addDebugLog('[CurrentVideo]', 'info', 'render', 'card rendered', {
        videoId: safeState.videoId,
        title,
        channelName,
        duration,
        progress: Math.round(progress)
      });
    }

    if (!thumbnailUrl && hasVideoId) {
      console.log('[CurrentVideo] thumbnail fallback used');
      this.addDebugLog('[CurrentVideo]', 'info', 'render', 'thumbnail fallback used', {
        videoId: safeState.videoId
      });
    }
  }

  getThumbnailUrl(state = {}) {
    const videoId = state.videoId;
    
    if (videoId && !this.isGenericImage(state.thumbnailUrl)) {
      const url = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      this.addDebugLog('[CurrentVideo]', 'info', 'getThumbnailUrl', 'using videoId', { videoId });
      return url;
    }
    
    if (state.thumbnailUrl && !this.isGenericImage(state.thumbnailUrl)) {
      this.addDebugLog('[CurrentVideo]', 'info', 'getThumbnailUrl', 'using meta thumbnail', { url: state.thumbnailUrl });
      return state.thumbnailUrl;
    }
    
    if (videoId) {
      const url = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      this.addDebugLog('[CurrentVideo]', 'info', 'getThumbnailUrl', 'fallback to videoId', { videoId });
      return url;
    }
    
    return '';
  }

  isGenericImage(url) {
    if (!url) return true;
    const generic = ['yt_1200', '/img/desktop/', '/img/', 'logo', 'youtube.com/img'];
    return generic.some(pattern => url.toLowerCase().includes(pattern));
  }

  setupThumbnailFallback(imgElement, videoId) {
    if (!imgElement) return;

    let fallbackAttempts = ['hqdefault', 'mqdefault', 'default'];
    let currentAttempt = 0;

    imgElement.onerror = () => {
      currentAttempt++;
      if (currentAttempt < fallbackAttempts.length && videoId) {
        const quality = fallbackAttempts[currentAttempt];
        imgElement.src = `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
        this.addDebugLog('[CurrentVideo]', 'info', 'thumbnail', 'trying fallback quality', { quality, videoId });
      } else {
        imgElement.style.display = 'none';
        if (this.buttons.currentVideoThumbnailPlaceholder) {
          this.buttons.currentVideoThumbnailPlaceholder.style.display = 'flex';
        }
        this.addDebugLog('[CurrentVideo]', 'warn', 'thumbnail', 'all fallbacks exhausted', { videoId });
      }
    };
  }

  async seekTo(time) {
    if (!this.activeTabId) return;
    try {
      const response = await browser.tabs.sendMessage(this.activeTabId, {
        action: 'seekTo',
        time: Math.max(0, time)
      });
      if (this.isSuccessfulResponse(response)) {
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.updatePlayerState();
      }
    } catch (e) {
      console.log('[Seek] error:', e.message);
    }
  }

  async focusControlledTab() {
    if (!this.activeTabId) {
      this.showStatus('No video selected', 'warning');
      this.addDebugLog('[CurrentVideo]', 'info', 'focusTab', 'focus tab clicked', { success: false, reason: 'no active tab' });
      return;
    }

    console.log('[CurrentVideo] focus tab clicked');
    this.addDebugLog('[CurrentVideo]', 'info', 'focusTab', 'focus tab clicked', { tabId: this.activeTabId });

    try {
      const tab = await browser.tabs.get(this.activeTabId);
      await browser.tabs.update(tab.id, { active: true });
      if (tab.windowId !== undefined) {
        await browser.windows.update(tab.windowId, { focused: true });
      }
      console.log('[CurrentVideo] focus tab success');
      this.addDebugLog('[CurrentVideo]', 'info', 'focusTab', 'focus tab success', { tabId: tab.id, windowId: tab.windowId });
    } catch (error) {
      console.log('[CurrentVideo] focus tab failure', error.message);
      this.addDebugLog('[CurrentVideo]', 'error', 'focusTab', 'focus tab failure', { error: error.message });
      this.showStatus('Unable to focus tab', 'error');
    }
  }

  async openCurrentVideo() {
    const state = this.videoInfo || {};
    const url = state.url;

    console.log('[CurrentVideo] open video clicked');
    this.addDebugLog('[CurrentVideo]', 'info', 'openVideo', 'open video clicked', {
      videoId: state.videoId,
      url
    });

    if (!url) {
      this.showStatus('No video selected', 'warning');
      this.addDebugLog('[CurrentVideo]', 'info', 'openVideo', 'open video failure', { reason: 'missing url' });
      return;
    }

    try {
      const existingTab = this.activeTabId ? await browser.tabs.get(this.activeTabId).catch(() => null) : null;
      if (existingTab && existingTab.url && state.videoId && existingTab.url.includes(state.videoId)) {
        await browser.tabs.update(existingTab.id, { active: true });
        if (existingTab.windowId !== undefined) {
          await browser.windows.update(existingTab.windowId, { focused: true });
        }
        console.log('[CurrentVideo] open video success (focused existing tab)');
        this.addDebugLog('[CurrentVideo]', 'info', 'openVideo', 'open video success', {
          mode: 'focus-existing',
          tabId: existingTab.id
        });
        return;
      }

      const createdTab = await browser.tabs.create({ url, active: true });
      if (createdTab?.id) {
        this.activeTabId = createdTab.id;
      }
      console.log('[CurrentVideo] open video success (new tab)');
      this.addDebugLog('[CurrentVideo]', 'info', 'openVideo', 'open video success', {
        mode: 'new-tab',
        tabId: createdTab?.id,
        url
      });
    } catch (error) {
      console.log('[CurrentVideo] open video failure', error.message);
      this.addDebugLog('[CurrentVideo]', 'error', 'openVideo', 'open video failure', { error: error.message, url });
      this.showStatus('Unable to open video', 'error');
    }
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  // NEW: Advanced toggle features
  async toggleAutoPause() {
    this.settings.autoPause = !this.settings.autoPause;
    console.log('Popup: autoPause toggled to:', this.settings.autoPause);
    this.addDebugLog('[Settings]', 'info', 'autoPause', 'autoPause changed', { autoPause: this.settings.autoPause });
    this.updateToggleUI('autoPauseToggle', this.settings.autoPause);
    
    // Send to background script for tab monitoring
    try {
      await browser.runtime.sendMessage({
        type: 'SET_AUTO_PAUSE',
        enabled: this.settings.autoPause
      });
      this.showStatus(`Auto-pause ${this.settings.autoPause ? 'enabled' : 'disabled'}`, 'success');
    } catch (error) {
      console.error('Popup: Error sending SET_AUTO_PAUSE message:', error);
    }
    this.saveSettings();
  }

  updateToggleUI(toggleId, active) {
    const toggle = this.buttons[toggleId];
    if (toggle) {
      if (active) {
        toggle.classList.add('active');
      } else {
        toggle.classList.remove('active');
      }
    }
  }

  // NEW: Settings management
  async loadSettings() {
    try {
      const result = await browser.storage.local.get(['youtubeControllerSettings']);
      if (result.youtubeControllerSettings) {
        this.settings = { ...this.settings, ...result.youtubeControllerSettings };
        console.log('Popup: settings loaded:', this.settings);
        this.addDebugLog('[Popup]', 'info', 'settings', 'loaded', { settings: this.settings });
        this.updateAllToggles();
      }
    } catch (error) {
      console.error('Popup: Error loading settings:', error);
      this.addDebugLog('[Popup]', 'error', 'settings', 'failed to load', { error: error.message });
    }
  }

  async saveSettings() {
    try {
      console.log('Popup: saving settings:', this.settings);
      this.addDebugLog('[Popup]', 'info', 'settings', 'saved', { settings: this.settings });
      await browser.storage.local.set({
        youtubeControllerSettings: this.settings
      });
    } catch (error) {
      console.error('Popup: Error saving settings:', error);
      this.addDebugLog('[Popup]', 'error', 'settings', 'failed to save', { error: error.message });
    }
  }

  updateAllToggles() {
    this.updateToggleUI('autoPauseToggle', this.settings.autoPause);
  }

  openSettings() {
    // Remove any existing modal first
    const existingModal = document.getElementById('settingsModal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'settingsModal';
    modal.className = 'modal-overlay';
    
    // Create modal structure using DOM methods
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // Header
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    
    const headerTitle = document.createElement('h3');
    headerTitle.textContent = 'Settings';
    
    const modalCloseBtn = document.createElement('button');
    modalCloseBtn.className = 'close-btn';
    modalCloseBtn.id = 'modal-close-btn';
    modalCloseBtn.textContent = 'Close';
    
    modalHeader.appendChild(headerTitle);
    modalHeader.appendChild(modalCloseBtn);
    
    // Body
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    
    // Auto-detect setting
    const autoDetectDiv = document.createElement('div');
    autoDetectDiv.className = 'setting-item';
    const autoDetectLabel = document.createElement('label');
    const autoDetectInput = document.createElement('input');
    autoDetectInput.type = 'checkbox';
    autoDetectInput.id = 'autoDetectSetting';
    autoDetectInput.checked = this.settings.autoDetect;
    autoDetectLabel.appendChild(autoDetectInput);
    autoDetectLabel.appendChild(document.createTextNode(' Auto-detect YouTube tabs'));
    const autoDetectDesc = document.createElement('p');
    autoDetectDesc.className = 'setting-desc';
    autoDetectDesc.textContent = 'Automatically find and connect to YouTube video tabs';
    autoDetectDiv.appendChild(autoDetectLabel);
    autoDetectDiv.appendChild(autoDetectDesc);
    
    // Auto-pause setting
    const autoPauseDiv = document.createElement('div');
    autoPauseDiv.className = 'setting-item';
    const autoPauseLabel = document.createElement('label');
    const autoPauseInput = document.createElement('input');
    autoPauseInput.type = 'checkbox';
    autoPauseInput.id = 'autoPauseSetting';
    autoPauseInput.checked = this.settings.autoPause;
    autoPauseLabel.appendChild(autoPauseInput);
    autoPauseLabel.appendChild(document.createTextNode(' Auto-pause on tab switch'));
    const autoPauseDesc = document.createElement('p');
    autoPauseDesc.className = 'setting-desc';
    autoPauseDesc.textContent = 'Pause videos when switching to other tabs';
    autoPauseDiv.appendChild(autoPauseLabel);
    autoPauseDiv.appendChild(autoPauseDesc);
    
    // Dark mode setting
    const darkModeDiv = document.createElement('div');
    darkModeDiv.className = 'setting-item';
    const darkModeLabel = document.createElement('label');
    const darkModeInput = document.createElement('input');
    darkModeInput.type = 'checkbox';
    darkModeInput.id = 'darkModeSetting';
    darkModeInput.checked = this.settings.darkMode;
    darkModeLabel.appendChild(darkModeInput);
    darkModeLabel.appendChild(document.createTextNode(' Dark mode'));
    const darkModeDesc = document.createElement('p');
    darkModeDesc.className = 'setting-desc';
    darkModeDesc.textContent = 'Use dark theme for the extension popup';
    darkModeDiv.appendChild(darkModeLabel);
    darkModeDiv.appendChild(darkModeDesc);
    
    // Volume step setting
    const volumeDiv = document.createElement('div');
    volumeDiv.className = 'setting-item';
    const volumeLabel = document.createElement('label');
    volumeLabel.textContent = 'Volume step';
    volumeLabel.setAttribute('for', 'volumeStepSetting');
    const volumeSelect = document.createElement('select');
    volumeSelect.id = 'volumeStepSetting';
    ['5', '10', '15', '20'].forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value + '%';
      if (value === '10') option.selected = true;
      volumeSelect.appendChild(option);
    });
    const volumeDesc = document.createElement('p');
    volumeDesc.className = 'setting-desc';
    volumeDesc.textContent = 'Volume change amount for +/- buttons';
    volumeDiv.appendChild(volumeLabel);
    volumeDiv.appendChild(volumeSelect);
    volumeDiv.appendChild(volumeDesc);
    
    // Update interval setting
    const intervalDiv = document.createElement('div');
    intervalDiv.className = 'setting-item';
    const intervalLabel = document.createElement('label');
    intervalLabel.textContent = 'Update interval';
    intervalLabel.setAttribute('for', 'updateIntervalSetting');
    const intervalSelect = document.createElement('select');
    intervalSelect.id = 'updateIntervalSetting';
    [['500', '0.5 seconds'], ['1000', '1 second'], ['2000', '2 seconds'], ['3000', '3 seconds']].forEach(([value, text]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      if (value === '1000') option.selected = true;
      intervalSelect.appendChild(option);
    });
    const intervalDesc = document.createElement('p');
    intervalDesc.className = 'setting-desc';
    intervalDesc.textContent = 'How often to update video information';
    intervalDiv.appendChild(intervalLabel);
    intervalDiv.appendChild(intervalSelect);
    intervalDiv.appendChild(intervalDesc);
    
    // Shortcuts button
    const shortcutsDiv = document.createElement('div');
    shortcutsDiv.className = 'setting-item';
    const modalShortcutsBtn = document.createElement('button');
    modalShortcutsBtn.className = 'btn primary';
    modalShortcutsBtn.id = 'shortcuts-btn';
    modalShortcutsBtn.style.width = '100%';
    modalShortcutsBtn.style.marginTop = '10px';
    modalShortcutsBtn.textContent = 'View Keyboard Shortcuts';
    const shortcutsDesc = document.createElement('p');
    shortcutsDesc.className = 'setting-desc';
    shortcutsDesc.textContent = 'View all available keyboard shortcuts and how to customize them';
    shortcutsDiv.appendChild(modalShortcutsBtn);
    shortcutsDiv.appendChild(shortcutsDesc);
    
    // Append all settings to modal body
    modalBody.appendChild(autoDetectDiv);
    modalBody.appendChild(autoPauseDiv);
    modalBody.appendChild(darkModeDiv);
    modalBody.appendChild(volumeDiv);
    modalBody.appendChild(intervalDiv);
    modalBody.appendChild(shortcutsDiv);
    
    // Footer
    const modalFooter = document.createElement('div');
    modalFooter.className = 'modal-footer';
    
    const modalSaveBtn = document.createElement('button');
    modalSaveBtn.className = 'btn primary';
    modalSaveBtn.id = 'modal-save-btn';
    modalSaveBtn.textContent = 'Save Changes';
    
    const modalCancelBtn = document.createElement('button');
    modalCancelBtn.className = 'btn secondary';
    modalCancelBtn.id = 'modal-cancel-btn';
    modalCancelBtn.textContent = 'Cancel';
    
    modalFooter.appendChild(modalSaveBtn);
    modalFooter.appendChild(modalCancelBtn);
    
    // Assemble modal
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    modal.appendChild(modalContent);

    document.body.appendChild(modal);
    
    // Add smooth scroll to top and center the modal with animation
    const scrollToTop = () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    };

    // DON'T prevent body scroll - let users scroll normally
    // document.body.style.overflow = 'hidden'; // REMOVED

    // Set initial styles for animation
    modal.style.display = 'flex';
    modal.style.opacity = '0';
    modal.style.transform = 'scale(0.9)';
    modal.style.transition = 'all 0.3s ease';
    
    // Scroll to top first
    scrollToTop();
    
    // Then show and animate modal in
    setTimeout(() => {
      modal.style.opacity = '1';
      modal.style.transform = 'scale(1)';
    }, 100);

    // Add event listeners for modal buttons
    const closeBtn = modal.querySelector('#modal-close-btn');
    const saveBtn = modal.querySelector('#modal-save-btn');
    const cancelBtn = modal.querySelector('#modal-cancel-btn');

    const closeModal = () => {
      // Add smooth close animation
      modal.style.opacity = '0';
      modal.style.transform = 'scale(0.9)';
      
      setTimeout(() => {
        // Remove modal completely from DOM
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal);
        }
      }, 300);
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    // Close modal when clicking overlay (outside modal content)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    saveBtn.addEventListener('click', () => {
      this.saveModalSettings();
    });

    // Shortcuts button to show keyboard shortcuts
    const shortcutsBtn = modal.querySelector('#shortcuts-btn');
    shortcutsBtn.addEventListener('click', () => {
      this.showShortcuts();
    });

    // Close modal with Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  saveModalSettings() {
    const autoDetect = document.getElementById('autoDetectSetting').checked;
    const autoPause = document.getElementById('autoPauseSetting').checked;
    const darkMode = document.getElementById('darkModeSetting').checked;
    const volumeStep = parseInt(document.getElementById('volumeStepSetting').value);
    const updateInterval = parseInt(document.getElementById('updateIntervalSetting').value);

    // Update settings
    this.settings.autoDetect = autoDetect;
    this.settings.autoPause = autoPause;
    
    if (this.settings.darkMode !== darkMode) {
      this.settings.darkMode = darkMode;
      this.applyTheme();
      this.addDebugLog('[Settings]', 'info', 'theme', 'theme changed', { darkMode: this.settings.darkMode });
    }

    this.settings.volumeStep = volumeStep || 10;
    this.settings.updateInterval = updateInterval || 1000;

    // Apply auto-detection setting
    if (autoDetect && !this.autoDetectInterval) {
      this.startAutoDetection();
    } else if (!autoDetect && this.autoDetectInterval) {
      this.stopAutoDetection();
    }

    // Update time interval if changed
    if (this.updateInterval) {
      this.stopTimeUpdates();
      this.startTimeUpdates();
    }

    this.saveSettings();
    
    // Close the modal with animation
    const modal = document.getElementById('settingsModal');
    if (modal) {
      modal.style.opacity = '0';
      modal.style.transform = 'scale(0.9)';
      
      setTimeout(() => {
        // Remove modal completely from DOM
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal);
        }
      }, 300);
    }
    
    this.showStatus('Settings saved successfully!', 'success');
  }

  // Show keyboard shortcuts in a modal
  showShortcuts() {
    const shortcuts = [
      { key: 'Ctrl+Alt+P', action: 'Play/Pause Video', description: 'Toggle video playback' },
      { key: 'Ctrl+Alt+S', action: 'Stop Video', description: 'Stop video playback' },
      { key: 'Ctrl+Alt+R', action: 'Restart Video', description: 'Restart video from beginning' },
      { key: 'Ctrl+Alt+M', action: 'Mute/Unmute', description: 'Toggle video mute' },
      { key: 'Ctrl+Alt+Up', action: 'Volume Up', description: 'Increase volume by 10%' },
      { key: 'Ctrl+Alt+Down', action: 'Volume Down', description: 'Decrease volume by 10%' },
      { key: 'Ctrl+Alt+Period', action: 'Speed Up', description: 'Increase playback speed' },
      { key: 'Ctrl+Alt+Comma', action: 'Speed Down', description: 'Decrease playback speed' },
      { key: 'Ctrl+Alt+Right', action: 'Next Video', description: 'Go to next video' },
      { key: 'Ctrl+Alt+Left', action: 'Previous Video', description: 'Go to previous video' },
      { key: 'Ctrl+Alt+F', action: 'Skip Forward', description: 'Skip forward 10 seconds' },
      { key: 'Ctrl+Alt+B', action: 'Skip Backward', description: 'Skip backward 10 seconds' }
    ];

    const shortcutsHTML = shortcuts.map(shortcut => 
      `<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #333;">
        <div>
          <strong style="color: #6495ed;">${shortcut.key}</strong>
          <div style="font-size: 12px; color: #aaa; margin-top: 2px;">${shortcut.description}</div>
        </div>
        <div style="font-weight: 500;">${shortcut.action}</div>
      </div>`
    ).join('');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    // Create modal structure using DOM methods
    const shortcutsModalContent = document.createElement('div');
    shortcutsModalContent.className = 'modal-content';
    shortcutsModalContent.style.maxWidth = '380px';
    
    // Header
    const shortcutsModalHeader = document.createElement('div');
    shortcutsModalHeader.className = 'modal-header';
    
    const shortcutsTitle = document.createElement('h3');
    shortcutsTitle.textContent = 'Keyboard Shortcuts';
    
    const shortcutsCloseBtn = document.createElement('button');
    shortcutsCloseBtn.className = 'close-btn';
    shortcutsCloseBtn.id = 'close-shortcuts-modal';
    shortcutsCloseBtn.innerHTML = '&times;';
    
    shortcutsModalHeader.appendChild(shortcutsTitle);
    shortcutsModalHeader.appendChild(shortcutsCloseBtn);
    
    // Body
    const shortcutsModalBody = document.createElement('div');
    shortcutsModalBody.className = 'modal-body';
    shortcutsModalBody.style.maxHeight = '350px';
    shortcutsModalBody.style.overflowY = 'auto';
    
    // Description
    const shortcutsDesc = document.createElement('p');
    shortcutsDesc.style.marginBottom = '20px';
    shortcutsDesc.style.color = '#aaa';
    shortcutsDesc.style.fontSize = '14px';
    shortcutsDesc.textContent = 'These keyboard shortcuts work when you\'re on a YouTube page with this extension active.';
    shortcutsModalBody.appendChild(shortcutsDesc);
    
    // Create shortcuts list
    shortcuts.forEach(shortcut => {
      const shortcutDiv = document.createElement('div');
      shortcutDiv.style.display = 'flex';
      shortcutDiv.style.justifyContent = 'space-between';
      shortcutDiv.style.alignItems = 'center';
      shortcutDiv.style.padding = '8px 0';
      shortcutDiv.style.borderBottom = '1px solid #333';
      
      const leftDiv = document.createElement('div');
      const keyStrong = document.createElement('strong');
      keyStrong.style.color = '#6495ed';
      keyStrong.textContent = shortcut.key;
      
      const descDiv = document.createElement('div');
      descDiv.style.fontSize = '12px';
      descDiv.style.color = '#aaa';
      descDiv.style.marginTop = '2px';
      descDiv.textContent = shortcut.description;
      
      leftDiv.appendChild(keyStrong);
      leftDiv.appendChild(descDiv);
      
      const rightDiv = document.createElement('div');
      rightDiv.style.fontWeight = '500';
      rightDiv.textContent = shortcut.action;
      
      shortcutDiv.appendChild(leftDiv);
      shortcutDiv.appendChild(rightDiv);
      shortcutsModalBody.appendChild(shortcutDiv);
    });
    
    // Tips section
    const tipsDiv = document.createElement('div');
    tipsDiv.style.marginTop = '20px';
    tipsDiv.style.padding = '15px';
    tipsDiv.style.background = '#2a2a2a';
    tipsDiv.style.borderRadius = '8px';
    tipsDiv.style.borderLeft = '4px solid #6495ed';
    
    const tipsTitle = document.createElement('h4');
    tipsTitle.style.margin = '0 0 10px 0';
    tipsTitle.style.color = '#6495ed';
    tipsTitle.textContent = 'Customizing Shortcuts';
    
    const tipsText = document.createElement('p');
    tipsText.style.margin = '0';
    tipsText.style.fontSize = '14px';
    tipsText.style.color = '#ccc';
    tipsText.innerHTML = 'To customize these shortcuts in Firefox:<br>1. Go to <strong>about:addons</strong><br>2. Click on this extension<br>3. Go to "Preferences" or "Options"<br>4. Look for "Manage Extension Shortcuts"';
    
    tipsDiv.appendChild(tipsTitle);
    tipsDiv.appendChild(tipsText);
    shortcutsModalBody.appendChild(tipsDiv);
    
    // Footer
    const shortcutsModalFooter = document.createElement('div');
    shortcutsModalFooter.className = 'modal-footer';
    
    const shortcutsCloseFooterBtn = document.createElement('button');
    shortcutsCloseFooterBtn.className = 'btn secondary';
    shortcutsCloseFooterBtn.id = 'close-shortcuts-btn';
    shortcutsCloseFooterBtn.textContent = 'Close';
    
    shortcutsModalFooter.appendChild(shortcutsCloseFooterBtn);
    
    // Assemble shortcuts modal
    shortcutsModalContent.appendChild(shortcutsModalHeader);
    shortcutsModalContent.appendChild(shortcutsModalBody);
    shortcutsModalContent.appendChild(shortcutsModalFooter);
    modal.appendChild(shortcutsModalContent);

    document.body.appendChild(modal);

    // Add smooth scroll to top and center the modal with animation
    const scrollToTop = () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    };

    // DON'T prevent body scroll - let users scroll normally
    // document.body.style.overflow = 'hidden'; // REMOVED

    // Add entrance animation and scroll
    modal.style.opacity = '0';
    modal.style.transform = 'scale(0.9)';
    modal.style.transition = 'all 0.3s ease';
    
    // Scroll to top first
    scrollToTop();
    
    // Then animate modal in
    setTimeout(() => {
      modal.style.opacity = '1';
      modal.style.transform = 'scale(1)';
    }, 100);

    // Close modal functionality
    const closeModal = () => {
      // Add smooth close animation
      modal.style.opacity = '0';
      modal.style.transform = 'scale(0.9)';
      
      setTimeout(() => {
        document.body.removeChild(modal);
        // DON'T restore body scroll since we're not blocking it
        // document.body.style.overflow = ''; // REMOVED
      }, 300);
    };

    modal.querySelector('#close-shortcuts-modal').addEventListener('click', closeModal);
    modal.querySelector('#close-shortcuts-btn').addEventListener('click', closeModal);
    
    // Close when clicking overlay
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Close with Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  // Enhanced status indicator
  updateStatusIndicator(message, type = 'info') {
    if (this.buttons.statusIndicator) {
      this.buttons.statusIndicator.textContent = message;
      
      // Add visual feedback based on type
      const colors = {
        success: '#4CAF50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196F3'
      };
      
      this.buttons.statusIndicator.style.color = colors[type] || colors.info;
    }
  }

  updateButtonStates(command, state) {
    if (!state) return;

    switch (command) {
      case 'clickPlayPause':
        setTimeout(async () => {
          await this.updatePlayerState();
        }, 100);
        break;

      case 'clickMute':
        if (this.buttons.muteButton) {
          const iconSpan = this.buttons.muteButton.querySelector('.icon');
          const textSpan = this.buttons.muteButton.querySelector('span:not(.icon)');
          
          if (iconSpan && textSpan) {
            if (state.includes('Unmute')) {
              iconSpan.textContent = 'M-';
              textSpan.textContent = 'Unmute';
            } else if (state.includes('Mute')) {
              iconSpan.textContent = 'M';
              textSpan.textContent = 'Mute';
            }
          }
        }
        break;
    }
  }

  handleBackgroundMessage(message) {
    if (message.type === 'BUTTON_STATE_CHANGED') {
      this.updateButtonStates('click' + message.button.charAt(0).toUpperCase() + message.button.slice(1), message.state);
    }
    
    if (message.type === 'NEW_YOUTUBE_TAB' && this.settings.autoDetect) {
      this.handleNewYouTubeTab(message.tabId);
    }
    
    if (message.type === 'YOUTUBE_TAB_ACTIVATED' && this.settings.autoDetect) {
      this.handleTabChange(message.tabId);
    }
  }

  async handleTabChange(tabId) {
    if (!this.settings.autoDetect) return;

    // If this is a different tab than our current one, or we don't have an active tab
    if (tabId !== this.activeTabId || !this.isYouTubeTab) {
      // Small delay to ensure content script is loaded
      setTimeout(async () => {
        await this.testAndConnectToTab(tabId, 'Switched to YouTube tab');
      }, 300);
    }
  }

  async handleNewYouTubeTab(tabId) {
    // Always try to connect to new YouTube tabs if auto-detect is enabled
    if (!this.settings.autoDetect) return;

    // If we don't have an active tab, immediately connect
    if (!this.activeTabId || !this.isYouTubeTab) {
      // Small delay to ensure page is ready
      setTimeout(async () => {
        await this.testAndConnectToTab(tabId, 'New YouTube video detected');
      }, 500);
      return;
    }

    // Check if current tab is still valid and playing
    try {
      const currentState = await browser.tabs.sendMessage(this.activeTabId, { 
        action: 'getPlayerState' 
      });
      const ok = this.isSuccessfulResponse(currentState);
      const state = this.getResponseResult(currentState);

      // If current tab is not responding, not playing, or not ready, switch to new tab
      if (!ok || !state?.isPlaying || !state?.isReady) {
        await this.testAndConnectToTab(tabId, 'Switched to new YouTube video');
      }
    } catch (error) {
      // Current tab is no longer valid, switch to new tab
      await this.testAndConnectToTab(tabId, 'Reconnected to YouTube');
    }
  }

  updateUI() {
    const controlButtons = [
      this.buttons.nextButton, this.buttons.stopButton, 
      this.buttons.backButton, this.buttons.muteButton,
      this.buttons.volumeSlider, this.buttons.volumeUp, this.buttons.volumeDown,
      this.buttons.saveChannelProfile, this.buttons.clearChannelProfile,
      this.buttons.saveGlobalProfile, this.buttons.applyGlobalProfile
    ];

    if (this.isYouTubeTab && this.activeTabId) {
      // Enable control buttons
      controlButtons.forEach(button => {
        if (button) {
          button.disabled = false;
          button.style.opacity = '1';
        }
      });
      
      // Enable speed buttons
      this.speedButtons.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
      });
      
      // Update get tab button
      if (this.buttons.getTabButton) {
        this.buttons.getTabButton.textContent = 'Rescan Tabs';
        this.buttons.getTabButton.classList.add('primary');
        this.buttons.getTabButton.title = 'Click to rescan for YouTube tabs';
      }

      // Update status indicator with connection info
      this.updateStatusIndicator('Auto-connected to YouTube', 'success');
      if (this.buttons.videoInfo) {
        this.buttons.videoInfo.style.display = 'block';
      }
    } else {
      // Disable control buttons
      controlButtons.forEach(button => {
        if (button) {
          button.disabled = true;
          button.style.opacity = '0.5';
        }
      });
      
      // Disable speed buttons
      this.speedButtons.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
      });
      
      // Reset get tab button
      if (this.buttons.getTabButton) {
        this.buttons.getTabButton.textContent = 'Find YouTube Tab';
        this.buttons.getTabButton.classList.remove('primary');
        this.buttons.getTabButton.title = 'Click to search for YouTube tabs';
      }

      // Update status indicator
      this.updateStatusIndicator('Searching for YouTube tabs...', 'warning');
      if (this.buttons.videoInfo) {
        this.buttons.videoInfo.style.display = 'block';
      }
      this.videoInfo = {};
      this.updateCurrentVideoCard(null);
    }
  }

  showStatus(message, type = 'info') {
    // Create or update status element
    let statusEl = document.getElementById('status');
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.id = 'status';
      statusEl.style.cssText = `
        position: fixed;
        top: 5px;
        left: 5px;
        right: 5px;
        padding: 5px;
        border-radius: 3px;
        font-size: 11px;
        text-align: center;
        z-index: 1000;
        transition: opacity 0.3s;
      `;
      document.body.appendChild(statusEl);
    }

    // Set color based on type
    const colors = {
      success: '#4CAF50',
      error: '#f44336',
      warning: '#ff9800',
      info: '#2196F3'
    };

    statusEl.textContent = message;
    statusEl.style.backgroundColor = colors[type] || colors.info;
    statusEl.style.color = 'white';
    statusEl.style.opacity = '1';

    // Auto-hide after 3 seconds
    setTimeout(() => {
      if (statusEl) {
        statusEl.style.opacity = '0';
        setTimeout(() => {
          if (statusEl && statusEl.parentNode) {
            statusEl.parentNode.removeChild(statusEl);
          }
        }, 300);
      }
    }, 3000);
  }

  // New easy feature: Copy video info
  // New medium feature: Sleep Timer
  startSleepTimer(minutes) {
    if (this.sleepTimerId) {
      clearTimeout(this.sleepTimerId);
      clearInterval(this.sleepCountdownInterval);
    }

    const milliseconds = minutes * 60 * 1000;
    let remainingMs = milliseconds;

    // Show timer display
    this.buttons.sleepTimerDisplay.style.display = 'block';
    this.buttons.cancelSleepBtn.style.display = 'block';

    // Update countdown display
    const updateCountdown = () => {
      const mins = Math.floor(remainingMs / 60000);
      const secs = Math.floor((remainingMs % 60000) / 1000);
      this.buttons.sleepCountdown.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    updateCountdown();
    this.showStatus(`Sleep timer set to ${minutes} minutes`, 'info');

    // Update countdown every second
    this.sleepCountdownInterval = setInterval(() => {
      remainingMs -= 1000;
      if (remainingMs <= 0) {
        clearInterval(this.sleepCountdownInterval);
        this.pauseAllVideos();
        return;
      }
      updateCountdown();
    }, 1000);

    // Pause after timer expires
    this.sleepTimerId = setTimeout(() => {
      this.pauseAllVideos();
      this.showStatus('Sleep timer expired - pausing videos', 'info');
      this.buttons.sleepTimerDisplay.style.display = 'none';
      this.buttons.cancelSleepBtn.style.display = 'none';
    }, milliseconds);
  }

  cancelSleepTimer() {
    if (this.sleepTimerId) {
      clearTimeout(this.sleepTimerId);
      clearInterval(this.sleepCountdownInterval);
      this.sleepTimerId = null;
      this.buttons.sleepTimerDisplay.style.display = 'none';
      this.buttons.cancelSleepBtn.style.display = 'none';
      this.showStatus('Sleep timer cancelled', 'info');
    }
  }

  async pauseAllVideos() {
    if (this.activeTabId) {
      try {
        await browser.tabs.sendMessage(this.activeTabId, {
          action: 'clickPlayPause'
        });
      } catch (error) {
        // Tab may no longer exist
      }
    }
  }

  // New medium feature: Auto-Play Toggle
  // New medium feature: Video Stats Display
  async updateVideoStats() {
    if (!this.activeTabId || !this.isYouTubeTab) {
      this.buttons.statsPanel.style.display = 'none';
      return;
    }

    try {
      const response = await browser.tabs.sendMessage(this.activeTabId, {
        action: 'getVideoStats'
      });

      if (response && response.stats) {
        const stats = response.stats;
        this.buttons.statsDuration.textContent = this.formatTime(stats.duration);
        this.buttons.statsProgress.textContent = `${stats.progress}%`;
        this.buttons.statsBitrate.textContent = stats.bitrate;
        this.buttons.statsResolution.textContent = stats.resolution;
        this.buttons.statsPanel.style.display = 'block';
      }
    } catch (error) {
      this.buttons.statsPanel.style.display = 'none';
    }
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '--:--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  // Auto-save playback position
  async savePlaybackPosition() {
    if (!this.activeTabId || !this.settings.rememberPosition) {
      return;
    }

    try {
      await browser.tabs.sendMessage(this.activeTabId, {
        action: 'savePlaybackPosition'
      });
    } catch (error) {
      // Silently fail, tab may not be available
    }
  }

  // Resume playback from saved position
  async resumePlaybackPosition() {
    if (!this.activeTabId || !this.settings.rememberPosition) {
      return;
    }

    try {
      await browser.tabs.sendMessage(this.activeTabId, {
        action: 'resumePlaybackPosition'
      });
    } catch (error) {
      // Silently fail
    }
  }
}

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.popupController = new PopupController();
  });
} else {
  window.popupController = new PopupController();
}

// Clean up when popup is closed
window.addEventListener('beforeunload', () => {
  if (window.popupController) {
    window.popupController.stopAutoDetection();
    window.popupController.stopTimeUpdates();
    window.popupController.stopHistoryTracking();
  }
});

// Debug logs stored in browser.storage.local - see instructions below
