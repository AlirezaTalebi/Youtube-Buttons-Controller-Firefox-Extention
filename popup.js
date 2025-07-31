/**
 * YouTube Button Controller - Enhanced Popup Script v2.0
 * Advanced YouTube controller with volume, speed, and smart features
 * 
 * Author: Alireza Talebi
 * GitHub: https://github.com/AlirezaTalebi/Youtube-Buttons-Controller-Firefox-Extention
 * License: GPL-3.0
 * 
 * This software is free to use, share, modify, and distribute under GPL-3.0.
 * Report issues and contribute at: https://github.com/AlirezaTalebi/Youtube-Buttons-Controller-Firefox-Extention
 */

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
      theaterMode: false,
      autoDetect: true,  // New setting for auto-detection
      darkMode: true     // Default to dark mode
    };
    this.autoDetectInterval = null;
    this.updateInterval = null;
    this.init();
  }

  async init() {
    // Cache button references
    this.cacheButtons();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Load saved settings
    await this.loadSettings();
    
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

    // Start continuous time updates
    this.startTimeUpdates();

    // Apply dark mode if enabled
    this.applyTheme();
  }

  cacheButtons() {
    const buttonIds = [
      'nextButton', 'stopButton', 'backButton', 'muteButton', 'getTabButton',
      'volumeSlider', 'volumeUp', 'volumeDown', 'volumeValue',
      'theaterToggle', 'autoPauseToggle', 'settingsButton',
      'statusIndicator', 'videoInfo', 'videoTitle',
      'darkModeToggle', 'seekBar', 'currentTimeDisplay', 'durationDisplay'
    ];
    
    buttonIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        this.buttons[id] = element;
      }
    });

    // Cache speed buttons
    this.speedButtons = document.querySelectorAll('[data-speed]');
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

    // Speed controls
    this.speedButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const speed = parseFloat(e.target.dataset.speed);
        this.setPlaybackSpeed(speed);
      });
    });

    // Advanced toggles
    this.buttons.theaterToggle?.addEventListener('click', () => {
      this.toggleTheaterMode();
    });

    this.buttons.autoPauseToggle?.addEventListener('click', () => {
      this.toggleAutoPause();
    });

    this.buttons.settingsButton?.addEventListener('click', () => {
      this.openSettings();
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

    // Load saved settings
    this.loadSettings();
  }

  async loadActiveTab() {
    try {
      // Try to load from storage first (set by background script)
      const result = await browser.storage.local.get(['activeTabId']);
      
      if (result.activeTabId) {
        try {
          const tab = await browser.tabs.get(result.activeTabId);
          if (tab && tab.url && tab.url.includes('youtube.com')) {
            // Test connection before setting as active
            await this.testAndConnectToTab(result.activeTabId, 'Reconnected to saved tab');
            return;
          }
        } catch (error) {
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
      // Get all YouTube tabs
      const youtubeTabs = await browser.tabs.query({ 
        url: '*://www.youtube.com/watch*'
      });

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
    for (const tab of youtubeTabs) {
      try {
        const response = await browser.tabs.sendMessage(tab.id, { 
          action: 'getPlayerState' 
        });
        
        if (response && response.success && response.state.isValidPage && 
            response.state.isReady && response.state.isPlaying) {
          return tab;
        }
      } catch (error) {
        // Tab might not have content script injected yet, skip
        continue;
      }
    }
    return null;
  }

  async testAndConnectToTab(tabId, message) {
    try {
      // Test if content script is responding
      const response = await browser.tabs.sendMessage(tabId, { 
        action: 'getPlayerState' 
      });
      
      if (response && response.success && response.state.isValidPage) {
        this.activeTabId = tabId;
        this.isYouTubeTab = true;
        await browser.storage.local.set({ activeTabId: tabId });
        await this.updatePlayerState();
        this.showStatus(message, 'success');
        this.updateUI();
      } else {
        // Page might not be ready, retry once after a delay
        setTimeout(async () => {
          try {
            const retryResponse = await browser.tabs.sendMessage(tabId, { 
              action: 'getPlayerState' 
            });
            
            if (retryResponse && retryResponse.success && retryResponse.state.isValidPage) {
              this.activeTabId = tabId;
              this.isYouTubeTab = true;
              await browser.storage.local.set({ activeTabId: tabId });
              await this.updatePlayerState();
              this.showStatus(message, 'success');
              this.updateUI();
            }
          } catch (retryError) {
            // Content script not ready, will be picked up by auto-detection
          }
        }, 1000);
      }
    } catch (error) {
      // Content script might not be injected yet, retry once
      setTimeout(async () => {
        try {
          const response = await browser.tabs.sendMessage(tabId, { 
            action: 'getPlayerState' 
          });
          
          if (response && response.success && response.state.isValidPage) {
            this.activeTabId = tabId;
            this.isYouTubeTab = true;
            await browser.storage.local.set({ activeTabId: tabId });
            await this.updatePlayerState();
            this.showStatus(message, 'success');
            this.updateUI();
          }
        } catch (retryError) {
          // Will be handled by auto-detection
        }
      }, 1500);
    }
  }

  async connectToTab(tabId, message) {
    this.activeTabId = tabId;
    this.isYouTubeTab = true;
    await browser.storage.local.set({ activeTabId: tabId });
    await this.updatePlayerState();
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

  startTimeUpdates() {
    // Update time every second when connected
    this.updateInterval = setInterval(async () => {
      if (this.isYouTubeTab && this.activeTabId && !this.isDragging) {
        await this.updateTimeDisplay();
      }
    }, 1000);
  }

  stopTimeUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  async updateTimeDisplay() {
    if (!this.activeTabId) return;

    try {
      const response = await browser.tabs.sendMessage(this.activeTabId, { 
        action: 'getPlayerState' 
      });

      if (response && response.success && response.state.isReady) {
        const state = response.state;
        
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

      if (response && response.success && response.state.duration) {
        const seekTime = (percentage / 100) * response.state.duration;
        
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
    this.showStatus(`${this.settings.darkMode ? 'Dark' : 'Light'} mode enabled`, 'success');
  }

  applyTheme() {
    const popup = document.body;
    if (this.settings.darkMode) {
      popup.classList.add('dark-mode');
      popup.classList.remove('light-mode');
    } else {
      popup.classList.add('light-mode');
      popup.classList.remove('dark-mode');
    }

    // Update dark mode button
    if (this.buttons.darkModeToggle) {
      this.buttons.darkModeToggle.textContent = this.settings.darkMode ? '☀️' : '🌙';
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
      
      if (!response || !response.success) {
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

      if (response.success) {
        this.activeTabId = response.tabId;
        this.isYouTubeTab = true;
        await this.updatePlayerState();
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
      const response = await browser.tabs.sendMessage(this.activeTabId, { 
        action: command,
        ...params
      });

      if (response && response.success) {
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
      } else {
        this.showStatus(response?.error || 'Command failed', 'error');
      }
    } catch (error) {
      // Tab might be closed or inactive, try to refresh
      await this.loadActiveTab();
      this.showStatus('Connection lost, please reconnect', 'error');
    }
  }

  async updatePlayerState() {
    if (!this.activeTabId) return;

    try {
      const response = await browser.tabs.sendMessage(this.activeTabId, { 
        action: 'getPlayerState' 
      });

      if (response && response.success) {
        const state = response.state;
        
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
        
        // Update status with video info
        if (state.videoTitle) {
          const shortTitle = state.videoTitle.length > 25 ? 
                            state.videoTitle.substring(0, 25) + '...' : 
                            state.videoTitle;
          this.updateStatusIndicator(`Connected: ${shortTitle}`, 'success');
        } else {
          this.updateStatusIndicator('Connected to YouTube', 'success');
        }
      }
    } catch (error) {
      // Connection lost
      this.showStatus('Connection to YouTube tab lost', 'error');
      this.isYouTubeTab = false;
      this.activeTabId = null;
      this.updateUI();
    }
  }

  updatePlayerUI(state) {
    // Update play/pause button
    if (this.buttons.stopButton) {
      const iconSpan = this.buttons.stopButton.querySelector('.icon');
      const textSpan = this.buttons.stopButton.querySelector('span:not(.icon)');
      
      if (iconSpan && textSpan) {
        iconSpan.textContent = state.isPlaying ? '⏸️' : '▶️';
        textSpan.textContent = state.isPlaying ? 'Pause' : 'Play';
      }
    }
    
    // Update mute button
    if (this.buttons.muteButton) {
      const iconSpan = this.buttons.muteButton.querySelector('.icon');
      const textSpan = this.buttons.muteButton.querySelector('span:not(.icon)');
      
      if (iconSpan && textSpan) {
        iconSpan.textContent = state.isMuted ? '🔇' : '🔊';
        textSpan.textContent = state.isMuted ? 'Unmute' : 'Mute';
      }
    }

    // Update video info
    this.updateVideoInfo(state);
    
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
  }

  // NEW: Volume control methods
  async setVolume(volume) {
    this.currentVolume = Math.max(0, Math.min(100, volume));
    this.updateVolumeUI();
    
    if (this.activeTabId) {
      try {
        await browser.tabs.sendMessage(this.activeTabId, {
          action: 'setVolume',
          volume: this.currentVolume
        });
      } catch (error) {
        // Error setting volume
      }
    }
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
        await browser.tabs.sendMessage(this.activeTabId, {
          action: 'setPlaybackSpeed',
          speed: speed
        });
        this.showStatus(`Speed set to ${speed}x`, 'success');
      } catch (error) {
        // Error setting playback speed
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

  // NEW: Video information display
  updateVideoInfo(state) {
    if (state.videoTitle && this.buttons.videoTitle) {
      this.buttons.videoTitle.textContent = state.videoTitle;
      this.buttons.videoInfo.style.display = 'block';
    }
    
    // Remove the time display line since user doesn't want it
    // if (state.duration && state.currentTime && this.buttons.videoDetails) {
    //   const current = this.formatTime(state.currentTime);
    //   const total = this.formatTime(state.duration);
    //   this.buttons.videoDetails.textContent = `${current} / ${total}`;
    // }
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  // NEW: Advanced toggle features
  async toggleTheaterMode() {
    this.settings.theaterMode = !this.settings.theaterMode;
    this.updateToggleUI('theaterToggle', this.settings.theaterMode);
    
    if (this.activeTabId) {
      try {
        await browser.tabs.sendMessage(this.activeTabId, {
          action: 'toggleTheaterMode',
          enabled: this.settings.theaterMode
        });
        this.showStatus(`Theater mode ${this.settings.theaterMode ? 'enabled' : 'disabled'}`, 'success');
      } catch (error) {
        // Error toggling theater mode
      }
    }
    this.saveSettings();
  }

  async toggleAutoPause() {
    this.settings.autoPause = !this.settings.autoPause;
    this.updateToggleUI('autoPauseToggle', this.settings.autoPause);
    
    // Send to background script for tab monitoring
    try {
      await browser.runtime.sendMessage({
        type: 'SET_AUTO_PAUSE',
        enabled: this.settings.autoPause
      });
      this.showStatus(`Auto-pause ${this.settings.autoPause ? 'enabled' : 'disabled'}`, 'success');
    } catch (error) {
      // Error setting auto-pause
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
        this.updateAllToggles();
      }
    } catch (error) {
      // Error loading settings
    }
  }

  async saveSettings() {
    try {
      await browser.storage.local.set({
        youtubeControllerSettings: this.settings
      });
    } catch (error) {
      // Error saving settings
    }
  }

  updateAllToggles() {
    this.updateToggleUI('theaterToggle', this.settings.theaterMode);
    this.updateToggleUI('pipToggle', this.settings.pipMode);
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
    headerTitle.textContent = '⚙️ Settings';
    
    const modalCloseBtn = document.createElement('button');
    modalCloseBtn.className = 'close-btn';
    modalCloseBtn.id = 'modal-close-btn';
    modalCloseBtn.textContent = '×';
    
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
    autoDetectLabel.appendChild(document.createTextNode(' 🔍 Auto-detect YouTube tabs'));
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
    autoPauseLabel.appendChild(document.createTextNode(' ⏸️ Auto-pause on tab switch'));
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
    darkModeLabel.appendChild(document.createTextNode(' 🌙 Dark mode'));
    const darkModeDesc = document.createElement('p');
    darkModeDesc.className = 'setting-desc';
    darkModeDesc.textContent = 'Use dark theme for the extension popup';
    darkModeDiv.appendChild(darkModeLabel);
    darkModeDiv.appendChild(darkModeDesc);
    
    // Volume step setting
    const volumeDiv = document.createElement('div');
    volumeDiv.className = 'setting-item';
    const volumeLabel = document.createElement('label');
    volumeLabel.textContent = '🔊 Volume step';
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
    intervalLabel.textContent = '⏱️ Update interval';
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
    modalShortcutsBtn.textContent = '⌨️ View Keyboard Shortcuts';
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
      { key: 'Ctrl+Alt+T', action: 'Theater Mode', description: 'Toggle YouTube theater mode' },
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
    shortcutsTitle.textContent = '⌨️ Keyboard Shortcuts';
    
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
    tipsTitle.textContent = '💡 Customizing Shortcuts';
    
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
        if (this.buttons.stopButton) {
          const iconSpan = this.buttons.stopButton.querySelector('.icon');
          const textSpan = this.buttons.stopButton.querySelector('span:not(.icon)');
          
          if (iconSpan && textSpan) {
            if (state.includes('Pause')) {
              iconSpan.textContent = '⏸️';
              textSpan.textContent = 'Pause';
            } else if (state.includes('Play')) {
              iconSpan.textContent = '▶️';
              textSpan.textContent = 'Play';
            }
          }
        }
        break;

      case 'clickMute':
        if (this.buttons.muteButton) {
          const iconSpan = this.buttons.muteButton.querySelector('.icon');
          const textSpan = this.buttons.muteButton.querySelector('span:not(.icon)');
          
          if (iconSpan && textSpan) {
            if (state.includes('Unmute')) {
              iconSpan.textContent = '🔇';
              textSpan.textContent = 'Unmute';
            } else if (state.includes('Mute')) {
              iconSpan.textContent = '🔊';
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

      // If current tab is not responding, not playing, or not ready, switch to new tab
      if (!currentState || !currentState.success || !currentState.state.isPlaying || !currentState.state.isReady) {
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
      this.buttons.volumeSlider, this.buttons.volumeUp, this.buttons.volumeDown
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
        this.buttons.getTabButton.textContent = '🔄 Rescan Tabs';
        this.buttons.getTabButton.classList.add('primary');
        this.buttons.getTabButton.title = 'Click to rescan for YouTube tabs';
      }

      // Update status indicator with connection info
      this.updateStatusIndicator('Auto-connected to YouTube', 'success');
      
      // Show video info section
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
        this.buttons.getTabButton.textContent = '🔍 Find YouTube Tab';
        this.buttons.getTabButton.classList.remove('primary');
        this.buttons.getTabButton.title = 'Click to search for YouTube tabs';
      }

      // Update status indicator
      this.updateStatusIndicator('Searching for YouTube tabs...', 'warning');
      
      // Hide video info section
      if (this.buttons.videoInfo) {
        this.buttons.videoInfo.style.display = 'none';
      }
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
  }
});
