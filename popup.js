/**
 * YouTube Button Controller - Enhanced Popup Script v2.5.0
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
    title: 'YouTube Thumbnail Mini-Player (Top)',
    items: [
      'All main playback & volume controls live directly on the top video thumbnail, just like YouTube.',
      'Click anywhere on the thumbnail image (or the Play/Pause button) to Play/Pause.',
      'Use Previous/Next track buttons for playlist/video navigation, and the Speaker icon to Mute/Unmute.',
      'Adjust volume right on the overlay using -, the slider, or +.',
      'Drag the red progress bar along the bottom of the thumbnail to seek.'
    ]
  },
  {
    title: 'UI Scale (Small / Medium / Large)',
    items: [
      'Use the Small / Medium / Large selector in the top header to resize the entire interface.',
      'Small scale compacts spacing, fonts, and thumbnail height so you can see almost all sections at once without scrolling.',
      'Medium is the balanced default; Large gives wider controls and extra breathing room.'
    ]
  },
  {
    title: 'Reorder & Collapse Sections',
    items: [
      'Every section below the player can be moved up/down using the Up/Down chevron buttons or by dragging its header grip.',
      'Click the Collapse chevron (or the section header title) to collapse or expand sections you use less often.',
      'Your custom section order and collapsed states are saved automatically (and can be reset in Settings).'
    ]
  },
  {
    title: 'Settings Profiles & Auto-Pause',
    items: [
      'Save Channel Profile stores speed, volume, and mute for the current channel.',
      'Save/Apply Global Default manages fallback settings for channels without a saved profile.',
      'Auto-Pause pauses the current YouTube video automatically when you switch to another tab.'
    ]
  },
  {
    title: 'Watch History + Resume',
    items: [
      'Watched videos are saved locally with their playback progress.',
      'Click any entry in Resume to reopen the video at your saved timestamp, or filter with Search.'
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
const SECTION_ORDER_KEY = 'ytControllerSectionOrder';
const COLLAPSED_SECTIONS_KEY = 'ytControllerCollapsedSections';
const DEFAULT_SECTION_ORDER = ['speed', 'profiles', 'resume', 'advanced', 'sleep', 'stats'];

const SVG_ICONS = {
  play: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4" fill="currentColor"></polygon></svg>',
  pause: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"></rect><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"></rect></svg>',
  volumeHigh: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07" fill="none"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14" fill="none"></path></svg>',
  volumeMuted: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>',
  grip: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.8" fill="currentColor"></circle><circle cx="15" cy="6" r="1.8" fill="currentColor"></circle><circle cx="9" cy="12" r="1.8" fill="currentColor"></circle><circle cx="15" cy="12" r="1.8" fill="currentColor"></circle><circle cx="9" cy="18" r="1.8" fill="currentColor"></circle><circle cx="15" cy="18" r="1.8" fill="currentColor"></circle></svg>',
  chevronUp: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"></polyline></svg>',
  chevronDown: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>',
  playCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"></polygon></svg>',
  keyboard: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><line x1="6" y1="8" x2="6.01" y2="8"></line><line x1="10" y1="8" x2="10.01" y2="8"></line><line x1="14" y1="8" x2="14.01" y2="8"></line><line x1="18" y1="8" x2="18.01" y2="8"></line><line x1="8" y1="12" x2="8.01" y2="12"></line><line x1="12" y1="12" x2="12.01" y2="12"></line><line x1="16" y1="12" x2="16.01" y2="12"></line><line x1="7" y1="16" x2="17" y2="16"></line></svg>',
  reset: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  close: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
  sections: {
    speed: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 14l4-4"></path><path d="M3.34 19a10 10 0 1 1 17.32 0"></path></svg>',
    profiles: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>',
    resume: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l4 2"></path></svg>',
    advanced: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
    sleep: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
    stats: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'
  }
};

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
      darkMode: true,
      volumeStep: 10,
      updateInterval: 1000
    };
    this.autoDetectInterval = null;
    this.updateInterval = null;
    this.sleepTimerEndTime = null;
    this.sleepCountdownInterval = null;
    this.statsUpdateInterval = null;
    this.historySaveInterval = null;
    this.watchHistory = [];
    this.historySearchTerm = '';
    this.popupSize = 'normal';
    this.sectionOrder = [...DEFAULT_SECTION_ORDER];
    this.collapsedSections = [];
    this.draggedSection = null;
    this.updateFailureCount = 0;
    this.maxUpdateFailures = 3;
    this.isDragging = false;
    this.debugLogQueue = Promise.resolve();
    this.init();
  }

  async init() {
    this.addDebugLog('[Popup]', 'info', 'init', 'popup opened');
    // Cache button references
    this.cacheButtons();
    
    // Setup event listeners & reorderable sections
    this.setupEventListeners();
    this.initReorderableSections();
    this.renderHelpTopics();
    
    // Load saved settings & layout
    await this.loadSettings();
    await this.loadPopupSize();
    await this.loadSectionLayout();
    this.applyTheme();
    await this.loadWatchHistory();
    await this.syncSleepTimer();
    
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

  addDebugLog(scope, level, action, message, data = {}) {
    this.debugLogQueue = this.debugLogQueue.then(async () => {
      try {
        const { ytControllerDebugLog = [] } = await browser.storage.local.get('ytControllerDebugLog');
        const logs = Array.isArray(ytControllerDebugLog) ? ytControllerDebugLog : [];
        logs.push({ time: new Date().toISOString(), scope, level, action, message, data });
        while (logs.length > 150) logs.shift();
        await browser.storage.local.set({ ytControllerDebugLog: logs });
      } catch (e) {
        console.error('[DebugLog] Storage error:', e);
      }
    });
    return this.debugLogQueue;
  }

  cacheButtons() {
    const buttonIds = [
      'nextButton', 'stopButton', 'backButton', 'muteButton', 'getTabButton', 'getTabButtonText',
      'thumbnailPlayArea', 'thumbCenterBadge', 'sectionsContainer',
      'volumeSlider', 'volumeUp', 'volumeDown', 'volumeValue',
      'autoPauseToggle', 'captionsToggle', 'settingsButton',
      'statusDot', 'statusIndicator', 'videoInfo', 'videoTitle',
      'currentVideoThumbnail', 'currentVideoThumbnailPlaceholder', 'currentVideoChannel',
      'currentVideoProgressBar', 'currentVideoTime',
      'focusTabButton', 'openVideoButton',
      'darkModeToggle',
      'cancelSleepBtn', 'sleepTimerDisplay', 'sleepCountdown',
      'statsPanel', 'statsDuration', 'statsProgress', 'statsBitrate', 'statsResolution',
      'saveChannelProfile', 'clearChannelProfile', 'saveGlobalProfile', 'applyGlobalProfile',
      'profileStatus', 'resumeSearch', 'resumeList', 'resumeStatus',
      'popupSizeSelect',
      'helpToggle', 'helpToggleText', 'helpPanel', 'helpContent',
      'donateToggleHeader', 'donateToggleBtn', 'donateDrawer', 'donatePaypalDrawerBtn'
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
    // Donation controls
    const toggleDonateDrawer = () => {
      if (!this.buttons.donateDrawer) return;
      const isHidden = this.buttons.donateDrawer.hidden;
      this.buttons.donateDrawer.hidden = !isHidden;
      if (this.buttons.donateToggleBtn) {
        this.buttons.donateToggleBtn.setAttribute('aria-expanded', String(isHidden));
      }
    };

    const openPaypal = () => {
      browser.tabs.create({ url: 'https://paypal.me/alirezatalebi' });
    };

    const copyAddress = async (address, coinName, btnEl) => {
      if (!address) return;
      let copied = false;
      try {
        await navigator.clipboard.writeText(address);
        copied = true;
      } catch (err) {
        try {
          const input = document.createElement('input');
          input.value = address;
          document.body.appendChild(input);
          input.select();
          copied = document.execCommand('copy');
          document.body.removeChild(input);
        } catch (e) {
          copied = false;
        }
      }

      if (copied) {
        this.showStatus(`${coinName} address copied to clipboard!`, 'success');
        const spanText = btnEl?.querySelector('span');
        if (spanText) {
          const originalText = spanText.textContent;
          spanText.textContent = 'Copied!';
          setTimeout(() => {
            if (spanText) {
              spanText.textContent = originalText;
            }
          }, 2000);
        }
      } else {
        this.showStatus('Please select and copy the address manually.', 'warning');
      }
    };

    this.buttons.donateToggleHeader?.addEventListener('click', toggleDonateDrawer);
    this.buttons.donateToggleBtn?.addEventListener('click', toggleDonateDrawer);
    this.buttons.donatePaypalDrawerBtn?.addEventListener('click', openPaypal);

    document.querySelectorAll('.donate-copy-crypto-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const address = btn.getAttribute('data-address');
        const coin = btn.getAttribute('data-coin') || 'Crypto';
        copyAddress(address, coin, btn);
      });
    });

    document.querySelectorAll('.donate-crypto-grid .donate-address-code').forEach(codeEl => {
      codeEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = codeEl.closest('.donate-address-row');
        const btn = row?.querySelector('.donate-copy-crypto-btn');
        const address = btn?.getAttribute('data-address') || codeEl.textContent.trim();
        const coin = btn?.getAttribute('data-coin') || 'Crypto';
        copyAddress(address, coin, btn);
      });
    });

    // Basic control buttons (on thumbnail overlay)
    this.buttons.nextButton?.addEventListener('click', () => {
      this.sendCommand('clickNext');
    });

    this.buttons.stopButton?.addEventListener('click', () => {
      this.sendCommand('clickPlayPause');
    });

    this.buttons.thumbnailPlayArea?.addEventListener('click', () => {
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
      this.setVolume(parseInt(e.target.value, 10));
    });

    this.buttons.volumeUp?.addEventListener('click', () => {
      const step = Number(this.settings.volumeStep) || 10;
      this.adjustVolume(step);
    });

    this.buttons.volumeDown?.addEventListener('click', () => {
      const step = Number(this.settings.volumeStep) || 10;
      this.adjustVolume(-step);
    });

    this.buttons.focusTabButton?.addEventListener('click', () => {
      this.focusControlledTab();
    });

    this.buttons.openVideoButton?.addEventListener('click', () => {
      this.openCurrentVideo();
    });

    // Progress bar seeking & drag state tracking
    const stopDragging = () => {
      if (this.isDragging) {
        this.isDragging = false;
      }
    };

    this.buttons.currentVideoProgressBar?.addEventListener('pointerdown', () => {
      this.isDragging = true;
    });

    this.buttons.currentVideoProgressBar?.addEventListener('mousedown', () => {
      this.isDragging = true;
    });

    this.buttons.currentVideoProgressBar?.addEventListener('pointerup', stopDragging);
    this.buttons.currentVideoProgressBar?.addEventListener('mouseup', stopDragging);
    this.buttons.currentVideoProgressBar?.addEventListener('pointercancel', stopDragging);
    this.buttons.currentVideoProgressBar?.addEventListener('blur', stopDragging);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('mouseup', stopDragging);

    this.buttons.currentVideoProgressBar?.addEventListener('input', (e) => {
      this.isDragging = true;
      const value = Number(e.target.value);
      const percent = value / 1000;
      e.target.style.setProperty('--progress-pct', `${(percent * 100).toFixed(1)}%`);
      const duration = Number(this.lastPlayerState?.duration) || 0;
      if (duration > 0 && this.buttons.currentVideoTime) {
        const previewTime = duration * percent;
        this.buttons.currentVideoTime.textContent = `${this.formatTime(previewTime)} / ${this.formatTime(duration)}`;
      }
    });

    this.buttons.currentVideoProgressBar?.addEventListener('change', (e) => {
      this.isDragging = false;
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
        const speed = parseFloat(e.currentTarget.dataset.speed);
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
        const minutes = parseInt(e.currentTarget.dataset.sleep, 10);
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

  setSvgIcon(targetEl, svgMarkup) {
    if (!targetEl || !svgMarkup) return;
    targetEl.textContent = '';
    try {
      const normalized = svgMarkup.includes('xmlns=')
        ? svgMarkup
        : svgMarkup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      const parser = new DOMParser();
      const doc = parser.parseFromString(normalized, 'image/svg+xml');
      const svgEl = doc.documentElement;
      if (svgEl && !doc.querySelector('parsererror') && svgEl.tagName.toLowerCase() === 'svg') {
        targetEl.appendChild(document.importNode(svgEl, true));
      }
    } catch (e) {
      console.error('[Icon] Failed to parse SVG icon:', e);
    }
  }

  setButtonWithIcon(btnEl, svgMarkup, labelText) {
    if (!btnEl) return;
    btnEl.textContent = '';
    const iconWrap = document.createElement('span');
    iconWrap.className = 'icon';
    iconWrap.style.display = 'inline-flex';
    iconWrap.style.alignItems = 'center';
    iconWrap.style.justifyContent = 'center';
    iconWrap.style.lineHeight = '0';
    this.setSvgIcon(iconWrap, svgMarkup);
    const textSpan = document.createElement('span');
    textSpan.textContent = labelText;
    btnEl.appendChild(iconWrap);
    btnEl.appendChild(textSpan);
  }

  toggleHelp() {
    if (!this.buttons.helpPanel || !this.buttons.helpToggle) return;

    const isHidden = this.buttons.helpPanel.hidden;
    this.buttons.helpPanel.hidden = !isHidden;
    this.buttons.helpToggle.setAttribute('aria-expanded', String(isHidden));
    const labelTarget = this.buttons.helpToggleText || this.buttons.helpToggle;
    labelTarget.textContent = isHidden ? 'Hide Help' : 'Help / Usage';

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

  initReorderableSections() {
    const container = this.buttons.sectionsContainer;
    if (!container) return;

    const sections = Array.from(container.querySelectorAll('.reorderable-section'));
    sections.forEach(section => {
      const sectionId = section.dataset.sectionId;
      const titleBar = section.querySelector('.section-title');
      if (!titleBar || !sectionId) return;

      // Extract original label text
      const existingLabel = titleBar.textContent.trim();
      titleBar.textContent = '';

      // Left side: drag handle + section icon + label
      const leftWrap = document.createElement('div');
      leftWrap.className = 'section-title-left';
      leftWrap.title = 'Drag to reorder section, or click to collapse/expand';

      const dragHandle = document.createElement('span');
      dragHandle.className = 'section-drag-handle';
      dragHandle.setAttribute('aria-hidden', 'true');
      this.setSvgIcon(dragHandle, SVG_ICONS.grip);

      const sectionIcon = document.createElement('span');
      sectionIcon.className = 'section-icon';
      sectionIcon.setAttribute('aria-hidden', 'true');
      if (SVG_ICONS.sections[sectionId]) {
        this.setSvgIcon(sectionIcon, SVG_ICONS.sections[sectionId]);
      }

      const labelSpan = document.createElement('span');
      labelSpan.textContent = existingLabel;

      leftWrap.appendChild(dragHandle);
      leftWrap.appendChild(sectionIcon);
      leftWrap.appendChild(labelSpan);

      // Clicking the title label toggles collapse
      leftWrap.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleSectionCollapse(sectionId);
      });

      // Right side: Move Up, Move Down, Collapse/Expand with SVG icons
      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'section-header-actions';

      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'section-order-btn move-up-btn';
      upBtn.title = 'Move section up';
      upBtn.setAttribute('aria-label', 'Move section up');
      this.setSvgIcon(upBtn, SVG_ICONS.chevronUp);
      upBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.moveSection(sectionId, -1);
      });

      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'section-order-btn move-down-btn';
      downBtn.title = 'Move section down';
      downBtn.setAttribute('aria-label', 'Move section down');
      this.setSvgIcon(downBtn, SVG_ICONS.chevronDown);
      downBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.moveSection(sectionId, 1);
      });

      const collapseBtn = document.createElement('button');
      collapseBtn.type = 'button';
      collapseBtn.className = 'section-collapse-btn';
      collapseBtn.title = 'Collapse or expand section';
      collapseBtn.setAttribute('aria-label', 'Collapse or expand section');
      this.setSvgIcon(collapseBtn, SVG_ICONS.chevronDown);
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleSectionCollapse(sectionId);
      });

      actionsWrap.appendChild(upBtn);
      actionsWrap.appendChild(downBtn);
      actionsWrap.appendChild(collapseBtn);

      titleBar.appendChild(leftWrap);
      titleBar.appendChild(actionsWrap);

      // HTML5 Drag & Drop support on section via its header only
      section.setAttribute('draggable', 'false');

      leftWrap.addEventListener('mousedown', () => {
        section.setAttribute('draggable', 'true');
      });
      leftWrap.addEventListener('mouseup', () => {
        section.setAttribute('draggable', 'false');
      });

      section.addEventListener('dragstart', (e) => {
        if (section.getAttribute('draggable') !== 'true') {
          e.preventDefault();
          return;
        }
        this.draggedSection = section;
        section.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', sectionId);
        }
      });

      section.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!this.draggedSection || this.draggedSection === section) return;
        section.classList.add('drag-over');
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
      });

      section.addEventListener('dragleave', () => {
        section.classList.remove('drag-over');
      });

      section.addEventListener('drop', async (e) => {
        e.preventDefault();
        section.classList.remove('drag-over');
        if (!this.draggedSection || this.draggedSection === section) return;

        const allSections = Array.from(container.querySelectorAll('.reorderable-section'));
        const draggedIdx = allSections.indexOf(this.draggedSection);
        const targetIdx = allSections.indexOf(section);

        if (draggedIdx < targetIdx) {
          container.insertBefore(this.draggedSection, section.nextSibling);
        } else {
          container.insertBefore(this.draggedSection, section);
        }

        await this.saveSectionOrder();
        this.updateSectionHeaderButtons();
      });

      section.addEventListener('dragend', () => {
        section.setAttribute('draggable', 'false');
        section.classList.remove('dragging');
        container.querySelectorAll('.reorderable-section').forEach(s => s.classList.remove('drag-over'));
        this.draggedSection = null;
      });
    });

    this.updateSectionHeaderButtons();
  }

  async loadSectionLayout() {
    const container = this.buttons.sectionsContainer;
    if (!container) return;

    try {
      const stored = await browser.storage.local.get([SECTION_ORDER_KEY, COLLAPSED_SECTIONS_KEY]);
      const savedOrder = Array.isArray(stored[SECTION_ORDER_KEY]) ? stored[SECTION_ORDER_KEY] : DEFAULT_SECTION_ORDER;
      const savedCollapsed = Array.isArray(stored[COLLAPSED_SECTIONS_KEY]) ? stored[COLLAPSED_SECTIONS_KEY] : [];

      this.collapsedSections = savedCollapsed;

      // Reorder DOM elements according to savedOrder
      const sectionMap = new Map();
      Array.from(container.querySelectorAll('.reorderable-section')).forEach(el => {
        sectionMap.set(el.dataset.sectionId, el);
      });

      const finalOrder = [
        ...savedOrder.filter(id => sectionMap.has(id)),
        ...DEFAULT_SECTION_ORDER.filter(id => sectionMap.has(id) && !savedOrder.includes(id))
      ];

      this.sectionOrder = finalOrder;
      finalOrder.forEach(id => {
        const el = sectionMap.get(id);
        if (el) {
          container.appendChild(el);
          el.classList.toggle('is-collapsed', this.collapsedSections.includes(id));
        }
      });

      this.updateSectionHeaderButtons();
      this.addDebugLog('[Layout]', 'info', 'sectionLayout', 'loaded', {
        order: this.sectionOrder,
        collapsed: this.collapsedSections
      });
    } catch (error) {
      this.addDebugLog('[Layout]', 'warn', 'sectionLayout', 'failed to load', { error: error.message });
    }
  }

  async saveSectionOrder() {
    const container = this.buttons.sectionsContainer;
    if (!container) return;

    this.sectionOrder = Array.from(container.querySelectorAll('.reorderable-section'))
      .map(el => el.dataset.sectionId)
      .filter(Boolean);

    try {
      await browser.storage.local.set({ [SECTION_ORDER_KEY]: this.sectionOrder });
      this.addDebugLog('[Layout]', 'info', 'sectionOrder', 'saved', { order: this.sectionOrder });
    } catch (error) {
      this.addDebugLog('[Layout]', 'warn', 'sectionOrder', 'save failed', { error: error.message });
    }
  }

  async moveSection(sectionId, direction) {
    const container = this.buttons.sectionsContainer;
    if (!container) return;

    const sections = Array.from(container.querySelectorAll('.reorderable-section'));
    const index = sections.findIndex(el => el.dataset.sectionId === sectionId);
    if (index === -1) return;

    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const currentEl = sections[index];
    const targetEl = sections[targetIndex];

    if (direction < 0) {
      container.insertBefore(currentEl, targetEl);
    } else {
      container.insertBefore(currentEl, targetEl.nextSibling);
    }

    await this.saveSectionOrder();
    this.updateSectionHeaderButtons();
  }

  async toggleSectionCollapse(sectionId) {
    const container = this.buttons.sectionsContainer;
    if (!container) return;

    const section = container.querySelector(`.reorderable-section[data-section-id="${sectionId}"]`);
    if (!section) return;

    const isCollapsed = section.classList.toggle('is-collapsed');
    if (isCollapsed) {
      if (!this.collapsedSections.includes(sectionId)) {
        this.collapsedSections.push(sectionId);
      }
    } else {
      this.collapsedSections = this.collapsedSections.filter(id => id !== sectionId);
    }

    this.updateSectionHeaderButtons();

    try {
      await browser.storage.local.set({ [COLLAPSED_SECTIONS_KEY]: this.collapsedSections });
      this.addDebugLog('[Layout]', 'info', 'sectionCollapse', 'toggled', {
        sectionId,
        collapsed: isCollapsed
      });
    } catch (error) {
      this.addDebugLog('[Layout]', 'warn', 'sectionCollapse', 'save failed', { error: error.message });
    }
  }

  updateSectionHeaderButtons() {
    const container = this.buttons.sectionsContainer;
    if (!container) return;

    const sections = Array.from(container.querySelectorAll('.reorderable-section'));
    sections.forEach((section, idx) => {
      const upBtn = section.querySelector('.move-up-btn');
      const downBtn = section.querySelector('.move-down-btn');
      const collapseBtn = section.querySelector('.section-collapse-btn');
      const isCollapsed = section.classList.contains('is-collapsed');

      if (upBtn) upBtn.disabled = idx === 0;
      if (downBtn) downBtn.disabled = idx === sections.length - 1;
      if (collapseBtn) {
        collapseBtn.title = isCollapsed ? 'Expand section' : 'Collapse section';
        collapseBtn.setAttribute('aria-expanded', String(!isCollapsed));
      }
    });
  }

  async resetSectionLayout() {
    await browser.storage.local.remove([SECTION_ORDER_KEY, COLLAPSED_SECTIONS_KEY]);
    this.collapsedSections = [];
    this.sectionOrder = [...DEFAULT_SECTION_ORDER];
    await this.loadSectionLayout();
    this.showStatus('Section order and layout reset to default', 'success');
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

  isYouTubeVideoUrl(url) {
    return typeof url === 'string' && (
      url.includes('youtube.com/watch') ||
      url.includes('youtube.com/shorts/')
    );
  }

  async autoDetectYouTubeTab() {
    try {
      console.log('Popup: Starting YouTube tab auto-detection...');
      // Get all YouTube tabs using correct patterns (both watch and shorts)
      const youtubeTabs = await browser.tabs.query({ 
        url: [
          '*://*.youtube.com/watch*',
          '*://youtube.com/watch*',
          '*://*.youtube.com/shorts/*',
          '*://youtube.com/shorts/*'
        ]
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

      if (activeTab && this.isYouTubeVideoUrl(activeTab.url)) {
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
        this.updateUI();
        if (message) {
          this.updateStatusIndicator(message, 'success');
        }
        this.addDebugLog('[Popup]', 'info', 'getPlayerState', 'initial getPlayerState requested', { tabId });
        await this.updatePlayerState({ initial: true, saveHistory: true });
        await this.updateVideoStats();
        this.startUpdates();
        return true;
      }
    } catch (error) {
      console.log('Popup: Ping failed:', error.message);
    }
    
    this.updateStatusIndicator('Content script not responding', 'error');
    return false;
  }

  async connectToTab(tabId, message) {
    this.activeTabId = tabId;
    this.isYouTubeTab = true;
    await browser.storage.local.set({ activeTabId: tabId });
    await this.updatePlayerState({ initial: true, saveHistory: true });
    await this.updateVideoStats();
    this.updateUI();
    if (message) {
      this.updateStatusIndicator(message, 'success');
    }
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

    const intervalMs = Number(this.settings.updateInterval) || 1000;

    // Update progress and time at the configured interval when connected
    this.updateInterval = setInterval(async () => {
      if (this.isYouTubeTab && this.activeTabId && !this.isDragging) {
        await this.updatePlayerState();
        // Update stats every ~2 ticks
        if (Math.random() > 0.5) {
          await this.updateVideoStats();
        }
      }
    }, intervalMs);
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
        } else if (command === 'toggleCaptions') {
          this.showStatus(response.state || 'Captions toggled', 'success');
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
    const shouldShowPause = state.isPlaying === true || state.paused === false;
    const renderedAs = shouldShowPause ? 'Pause' : 'Play';
    const playPauseSvg = shouldShowPause ? SVG_ICONS.pause : SVG_ICONS.play;

    // Update play/pause button
    if (this.buttons.stopButton) {
      const iconSpan = this.buttons.stopButton.querySelector('.icon');
      const textSpan = this.buttons.stopButton.querySelector('span:not(.icon)');
      
      if (iconSpan) {
        this.setSvgIcon(iconSpan, playPauseSvg);
      }
      if (textSpan) {
        textSpan.textContent = renderedAs;
      }
      this.buttons.stopButton.title = `${renderedAs} (Ctrl+Alt+P)`;
      this.addDebugLog('[Popup]', 'info', 'renderPlayButton', 'play button rendered as Play/Pause', {
        renderedAs,
        paused: state.paused,
        isPlaying: state.isPlaying
      });
    }

    if (this.buttons.thumbCenterBadge) {
      this.setSvgIcon(this.buttons.thumbCenterBadge, playPauseSvg);
    }
    
    // Update mute button
    if (this.buttons.muteButton) {
      const iconSpan = this.buttons.muteButton.querySelector('.icon');
      const textSpan = this.buttons.muteButton.querySelector('span:not(.icon)');
      const muteSvg = state.isMuted ? SVG_ICONS.volumeMuted : SVG_ICONS.volumeHigh;
      
      if (iconSpan) {
        this.setSvgIcon(iconSpan, muteSvg);
      }
      if (textSpan) {
        textSpan.textContent = state.isMuted ? 'Unmute' : 'Mute';
      }
      this.buttons.muteButton.title = `${state.isMuted ? 'Unmute' : 'Mute'} (Ctrl+Alt+M)`;
    }

    // Update captions button active state
    if (this.buttons.captionsToggle) {
      this.updateToggleUI('captionsToggle', state.captionsEnabled === true);
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
      this.buttons.volumeSlider.style.setProperty('--volume-pct', `${this.currentVolume}%`);
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

      const iconWrap = document.createElement('span');
      iconWrap.className = 'resume-entry-icon';
      iconWrap.setAttribute('aria-hidden', 'true');
      this.setSvgIcon(iconWrap, SVG_ICONS.playCircle);

      const textWrap = document.createElement('span');
      textWrap.className = 'resume-entry-text';

      const title = document.createElement('span');
      title.className = 'resume-title';
      title.textContent = entry.title || 'Untitled video';

      const meta = document.createElement('span');
      meta.className = 'resume-meta';
      meta.textContent = this.formatHistoryMeta(entry);

      textWrap.appendChild(title);
      textWrap.appendChild(meta);
      button.appendChild(iconWrap);
      button.appendChild(textWrap);
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
      success: 'var(--success)',
      error: 'var(--danger)',
      warning: 'var(--warning)',
      info: 'var(--info)'
    };

    if (this.buttons.profileStatus) {
      this.buttons.profileStatus.textContent = message;
      this.buttons.profileStatus.style.color = colors[type] || colors.info;
      if (this.profileStatusTimeout) {
        clearTimeout(this.profileStatusTimeout);
      }
      this.profileStatusTimeout = setTimeout(() => {
        if (this.buttons.profileStatus) {
          this.buttons.profileStatus.textContent = '';
        }
      }, 3500);
    }
    this.showStatus(message, type);
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

    if (!this.isDragging) {
      if (this.buttons.currentVideoTime) {
        const timeText = duration > 0
          ? `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`
          : '--:-- / --:--';
        this.buttons.currentVideoTime.textContent = timeText;
      }

      if (this.buttons.currentVideoProgressBar) {
        this.buttons.currentVideoProgressBar.value = Math.round(progress * 10);
        this.buttons.currentVideoProgressBar.style.setProperty('--progress-pct', `${progress.toFixed(1)}%`);
      }
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
    this.setButtonWithIcon(modalCloseBtn, SVG_ICONS.close, 'Close');
    
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
    const currentVolumeStep = String(this.settings.volumeStep || 10);
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
      if (value === currentVolumeStep) option.selected = true;
      volumeSelect.appendChild(option);
    });
    const volumeDesc = document.createElement('p');
    volumeDesc.className = 'setting-desc';
    volumeDesc.textContent = 'Volume change amount for +/- buttons';
    volumeDiv.appendChild(volumeLabel);
    volumeDiv.appendChild(volumeSelect);
    volumeDiv.appendChild(volumeDesc);
    
    // Update interval setting
    const currentUpdateInterval = String(this.settings.updateInterval || 1000);
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
      if (value === currentUpdateInterval) option.selected = true;
      intervalSelect.appendChild(option);
    });
    const intervalDesc = document.createElement('p');
    intervalDesc.className = 'setting-desc';
    intervalDesc.textContent = 'How often to update video information';
    intervalDiv.appendChild(intervalLabel);
    intervalDiv.appendChild(intervalSelect);
    intervalDiv.appendChild(intervalDesc);
    
    // Shortcuts & Reset Layout buttons
    const shortcutsDiv = document.createElement('div');
    shortcutsDiv.className = 'setting-item';
    const modalShortcutsBtn = document.createElement('button');
    modalShortcutsBtn.className = 'btn primary';
    modalShortcutsBtn.id = 'shortcuts-btn';
    modalShortcutsBtn.style.width = '100%';
    modalShortcutsBtn.style.marginTop = '10px';
    this.setButtonWithIcon(modalShortcutsBtn, SVG_ICONS.keyboard, 'View Keyboard Shortcuts');
    const shortcutsDesc = document.createElement('p');
    shortcutsDesc.className = 'setting-desc';
    shortcutsDesc.textContent = 'View all available keyboard shortcuts and how to customize them';
    shortcutsDiv.appendChild(modalShortcutsBtn);
    shortcutsDiv.appendChild(shortcutsDesc);

    const resetLayoutDiv = document.createElement('div');
    resetLayoutDiv.className = 'setting-item';
    const resetLayoutBtn = document.createElement('button');
    resetLayoutBtn.className = 'btn secondary';
    resetLayoutBtn.id = 'reset-layout-btn';
    resetLayoutBtn.style.width = '100%';
    resetLayoutBtn.style.marginTop = '6px';
    this.setButtonWithIcon(resetLayoutBtn, SVG_ICONS.reset, 'Reset Section Order & Layout');
    const resetLayoutDesc = document.createElement('p');
    resetLayoutDesc.className = 'setting-desc';
    resetLayoutDesc.textContent = 'Restore default section order and expand all collapsed sections';
    resetLayoutDiv.appendChild(resetLayoutBtn);
    resetLayoutDiv.appendChild(resetLayoutDesc);
    
    // Append all settings to modal body
    modalBody.appendChild(autoDetectDiv);
    modalBody.appendChild(autoPauseDiv);
    modalBody.appendChild(darkModeDiv);
    modalBody.appendChild(volumeDiv);
    modalBody.appendChild(intervalDiv);
    modalBody.appendChild(shortcutsDiv);
    modalBody.appendChild(resetLayoutDiv);
    
    // Footer
    const modalFooter = document.createElement('div');
    modalFooter.className = 'modal-footer';
    
    const modalSaveBtn = document.createElement('button');
    modalSaveBtn.className = 'btn primary';
    modalSaveBtn.id = 'modal-save-btn';
    this.setButtonWithIcon(modalSaveBtn, SVG_ICONS.check, 'Save Changes');
    
    const modalCancelBtn = document.createElement('button');
    modalCancelBtn.className = 'btn secondary';
    modalCancelBtn.id = 'modal-cancel-btn';
    this.setButtonWithIcon(modalCancelBtn, SVG_ICONS.close, 'Cancel');
    
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

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };

    const closeModal = () => {
      document.removeEventListener('keydown', handleEscape);
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
      document.removeEventListener('keydown', handleEscape);
      this.saveModalSettings();
    });

    // Shortcuts button to show keyboard shortcuts
    const shortcutsBtn = modal.querySelector('#shortcuts-btn');
    shortcutsBtn.addEventListener('click', () => {
      this.showShortcuts();
    });

    const resetBtn = modal.querySelector('#reset-layout-btn');
    resetBtn?.addEventListener('click', async () => {
      await this.resetSectionLayout();
    });

    // Close modal with Escape key
    document.addEventListener('keydown', handleEscape);
  }

  saveModalSettings() {
    const autoDetect = document.getElementById('autoDetectSetting').checked;
    const autoPause = document.getElementById('autoPauseSetting').checked;
    const darkMode = document.getElementById('darkModeSetting').checked;
    const volumeStep = parseInt(document.getElementById('volumeStepSetting').value, 10);
    const updateInterval = parseInt(document.getElementById('updateIntervalSetting').value, 10);

    // Update settings
    this.settings.autoDetect = autoDetect;

    if (this.settings.autoPause !== autoPause) {
      this.settings.autoPause = autoPause;
      this.updateAllToggles();
      browser.runtime.sendMessage({
        type: 'SET_AUTO_PAUSE',
        enabled: this.settings.autoPause
      }).catch(() => {});
    }
    
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
    const existingShortcutsModal = document.getElementById('shortcutsModal');
    if (existingShortcutsModal) {
      existingShortcutsModal.remove();
    }

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

    const modal = document.createElement('div');
    modal.id = 'shortcutsModal';
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
    this.setButtonWithIcon(shortcutsCloseBtn, SVG_ICONS.close, 'Close');
    
    shortcutsModalHeader.appendChild(shortcutsTitle);
    shortcutsModalHeader.appendChild(shortcutsCloseBtn);
    
    // Body
    const shortcutsModalBody = document.createElement('div');
    shortcutsModalBody.className = 'modal-body';
    shortcutsModalBody.style.maxHeight = '350px';
    shortcutsModalBody.style.overflowY = 'auto';
    
    // Description
    const shortcutsDesc = document.createElement('p');
    shortcutsDesc.style.marginBottom = '12px';
    shortcutsDesc.style.color = 'var(--text-secondary)';
    shortcutsDesc.style.fontSize = '12px';
    shortcutsDesc.textContent = 'These keyboard shortcuts work when you\'re on a YouTube page with this extension active.';
    shortcutsModalBody.appendChild(shortcutsDesc);
    
    // Create shortcuts list
    shortcuts.forEach(shortcut => {
      const shortcutDiv = document.createElement('div');
      shortcutDiv.style.display = 'flex';
      shortcutDiv.style.justifyContent = 'space-between';
      shortcutDiv.style.alignItems = 'center';
      shortcutDiv.style.padding = '8px 0';
      shortcutDiv.style.borderBottom = '1px solid var(--border-subtle)';
      
      const leftDiv = document.createElement('div');
      const keyStrong = document.createElement('strong');
      keyStrong.style.color = 'var(--accent)';
      keyStrong.style.fontFamily = "'JetBrains Mono', monospace";
      keyStrong.style.fontSize = '11.5px';
      keyStrong.textContent = shortcut.key;
      
      const descDiv = document.createElement('div');
      descDiv.style.fontSize = '11px';
      descDiv.style.color = 'var(--text-muted)';
      descDiv.style.marginTop = '2px';
      descDiv.textContent = shortcut.description;
      
      leftDiv.appendChild(keyStrong);
      leftDiv.appendChild(descDiv);
      
      const rightDiv = document.createElement('div');
      rightDiv.style.fontWeight = '600';
      rightDiv.style.fontSize = '11.5px';
      rightDiv.textContent = shortcut.action;
      
      shortcutDiv.appendChild(leftDiv);
      shortcutDiv.appendChild(rightDiv);
      shortcutsModalBody.appendChild(shortcutDiv);
    });
    
    // Tips section
    const tipsDiv = document.createElement('div');
    tipsDiv.style.marginTop = '14px';
    tipsDiv.style.padding = '12px';
    tipsDiv.style.background = 'var(--bg-elevated)';
    tipsDiv.style.borderRadius = '8px';
    tipsDiv.style.borderLeft = '3px solid var(--accent)';
    
    const tipsTitle = document.createElement('h4');
    tipsTitle.style.margin = '0 0 6px 0';
    tipsTitle.style.color = 'var(--accent)';
    tipsTitle.style.fontSize = '12px';
    tipsTitle.textContent = 'Customizing Shortcuts';
    
    const tipsText = document.createElement('p');
    tipsText.style.margin = '0';
    tipsText.style.fontSize = '11.5px';
    tipsText.style.color = 'var(--text-secondary)';
    tipsText.textContent = 'To customize in Firefox: open about:addons → click the gear icon → Manage Extension Shortcuts.';
    
    tipsDiv.appendChild(tipsTitle);
    tipsDiv.appendChild(tipsText);
    shortcutsModalBody.appendChild(tipsDiv);
    
    // Footer
    const shortcutsModalFooter = document.createElement('div');
    shortcutsModalFooter.className = 'modal-footer';
    
    const shortcutsCloseFooterBtn = document.createElement('button');
    shortcutsCloseFooterBtn.className = 'btn secondary';
    shortcutsCloseFooterBtn.id = 'close-shortcuts-btn';
    this.setButtonWithIcon(shortcutsCloseFooterBtn, SVG_ICONS.close, 'Close');
    
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

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };

    // Close modal functionality
    const closeModal = () => {
      document.removeEventListener('keydown', handleEscape);
      // Add smooth close animation
      modal.style.opacity = '0';
      modal.style.transform = 'scale(0.9)';
      
      setTimeout(() => {
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal);
        }
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
    document.addEventListener('keydown', handleEscape);
  }

  // Enhanced status indicator
  updateStatusIndicator(message, type = 'info') {
    if (this.buttons.statusIndicator) {
      this.buttons.statusIndicator.textContent = message;
      this.buttons.statusIndicator.style.color = '';
    }

    const statusBar = this.buttons.statusIndicator?.closest('.top-status-bar');
    if (statusBar) {
      statusBar.classList.remove('is-connected', 'is-error');
      if (type === 'success') {
        statusBar.classList.add('is-connected');
      } else if (type === 'error') {
        statusBar.classList.add('is-error');
      }
    }

    if (this.buttons.statusDot) {
      this.buttons.statusDot.classList.remove('is-connected', 'is-error', 'is-info');
      if (type === 'success') {
        this.buttons.statusDot.classList.add('is-connected');
      } else if (type === 'error') {
        this.buttons.statusDot.classList.add('is-error');
      } else if (type === 'info') {
        this.buttons.statusDot.classList.add('is-info');
      }
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
              this.setSvgIcon(iconSpan, SVG_ICONS.volumeMuted);
              textSpan.textContent = 'Unmute';
            } else if (state.includes('Mute')) {
              this.setSvgIcon(iconSpan, SVG_ICONS.volumeHigh);
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
      this.buttons.thumbnailPlayArea, this.buttons.currentVideoProgressBar,
      this.buttons.volumeSlider, this.buttons.volumeUp, this.buttons.volumeDown,
      this.buttons.saveChannelProfile, this.buttons.clearChannelProfile,
      this.buttons.saveGlobalProfile, this.buttons.applyGlobalProfile,
      this.buttons.captionsToggle
    ];

    if (this.isYouTubeTab && this.activeTabId) {
      // Enable control buttons
      controlButtons.forEach(button => {
        if (button) {
          button.disabled = false;
          button.style.opacity = '';
        }
      });
      
      // Enable speed buttons
      this.speedButtons.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '';
      });
      
      // Update get tab button
      if (this.buttons.getTabButton) {
        const labelEl = this.buttons.getTabButtonText || this.buttons.getTabButton;
        labelEl.textContent = 'Rescan';
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
          button.style.opacity = '';
        }
      });
      if (this.buttons.captionsToggle) {
        this.buttons.captionsToggle.classList.remove('active');
      }
      
      // Disable speed buttons
      this.speedButtons.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '';
      });
      
      // Reset get tab button
      if (this.buttons.getTabButton) {
        const labelEl = this.buttons.getTabButtonText || this.buttons.getTabButton;
        labelEl.textContent = 'Find Tab';
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
    if (!message) return;

    let statusEl = document.getElementById('status');
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.id = 'status';
      statusEl.className = 'status-toast';

      const dotEl = document.createElement('span');
      dotEl.className = 'status-toast-dot';
      dotEl.setAttribute('aria-hidden', 'true');

      const textEl = document.createElement('span');
      textEl.className = 'status-toast-text';

      statusEl.appendChild(dotEl);
      statusEl.appendChild(textEl);
      document.body.appendChild(statusEl);
    }

    statusEl.dataset.type = type || 'info';
    const textEl = statusEl.querySelector('.status-toast-text');
    if (textEl) {
      textEl.textContent = message;
    } else {
      statusEl.textContent = message;
    }

    if (this.statusToastTimeout) {
      clearTimeout(this.statusToastTimeout);
    }
    if (this.statusToastRemoveTimeout) {
      clearTimeout(this.statusToastRemoveTimeout);
    }

    requestAnimationFrame(() => {
      if (statusEl) {
        statusEl.classList.add('is-visible');
      }
    });

    this.statusToastTimeout = setTimeout(() => {
      if (statusEl) {
        statusEl.classList.remove('is-visible');
        this.statusToastRemoveTimeout = setTimeout(() => {
          if (statusEl && statusEl.parentNode && !statusEl.classList.contains('is-visible')) {
            statusEl.parentNode.removeChild(statusEl);
          }
        }, 240);
      }
    }, 2200);
  }

  // Sleep Timer (backed by background script so it survives popup close)
  async syncSleepTimer() {
    try {
      const response = await browser.runtime.sendMessage({ type: 'GET_SLEEP_TIMER' });
      if (response?.success && response.endTime && response.endTime > Date.now()) {
        this.startSleepCountdown(response.endTime);
      } else {
        this.stopSleepCountdownUI();
      }
    } catch (error) {
      this.stopSleepCountdownUI();
    }
  }

  async startSleepTimer(minutes) {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'START_SLEEP_TIMER',
        minutes
      });
      if (response?.success && response.endTime) {
        this.startSleepCountdown(response.endTime);
        this.showStatus(`Sleep timer set to ${minutes} minutes`, 'info');
      } else {
        this.showStatus(response?.error || 'Failed to start sleep timer', 'error');
      }
    } catch (error) {
      this.showStatus('Failed to start sleep timer', 'error');
    }
  }

  startSleepCountdown(endTime) {
    if (this.sleepCountdownInterval) {
      clearInterval(this.sleepCountdownInterval);
      this.sleepCountdownInterval = null;
    }

    this.sleepTimerEndTime = endTime;
    if (this.buttons.sleepTimerDisplay) {
      this.buttons.sleepTimerDisplay.style.display = 'block';
    }
    if (this.buttons.cancelSleepBtn) {
      this.buttons.cancelSleepBtn.style.display = 'inline-flex';
    }

    const updateCountdown = () => {
      const remainingMs = Math.max(0, this.sleepTimerEndTime - Date.now());
      if (remainingMs <= 0) {
        this.stopSleepCountdownUI();
        this.showStatus('Sleep timer expired - pausing videos', 'info');
        setTimeout(() => this.updatePlayerState(), 200);
        return;
      }
      const mins = Math.floor(remainingMs / 60000);
      const secs = Math.floor((remainingMs % 60000) / 1000);
      if (this.buttons.sleepCountdown) {
        this.buttons.sleepCountdown.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      }
    };

    updateCountdown();
    this.sleepCountdownInterval = setInterval(updateCountdown, 1000);
  }

  stopSleepCountdownUI() {
    if (this.sleepCountdownInterval) {
      clearInterval(this.sleepCountdownInterval);
      this.sleepCountdownInterval = null;
    }
    this.sleepTimerEndTime = null;
    if (this.buttons.sleepTimerDisplay) {
      this.buttons.sleepTimerDisplay.style.display = 'none';
    }
    if (this.buttons.cancelSleepBtn) {
      this.buttons.cancelSleepBtn.style.display = 'none';
    }
  }

  async cancelSleepTimer() {
    try {
      await browser.runtime.sendMessage({ type: 'CANCEL_SLEEP_TIMER' });
    } catch (error) {
      // Ignore error
    }
    this.stopSleepCountdownUI();
    this.showStatus('Sleep timer cancelled', 'info');
  }

  async pauseAllVideos() {
    if (this.activeTabId) {
      try {
        await browser.tabs.sendMessage(this.activeTabId, {
          action: 'pauseIfPlaying'
        });
      } catch (error) {
        // Tab may no longer exist
      }
    }
  }

  // Video Stats Display
  async updateVideoStats() {
    if (!this.activeTabId || !this.isYouTubeTab) {
      if (this.buttons.statsDuration) this.buttons.statsDuration.textContent = '--:--';
      if (this.buttons.statsProgress) this.buttons.statsProgress.textContent = '0%';
      if (this.buttons.statsBitrate) this.buttons.statsBitrate.textContent = 'N/A';
      if (this.buttons.statsResolution) this.buttons.statsResolution.textContent = 'N/A';
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
        if (this.buttons.statsPanel) {
          this.buttons.statsPanel.style.display = 'grid';
        }
      }
    } catch (error) {
      // Keep last known or default stats visible inside section
    }
  }

  formatTime(seconds) {
    if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '--:--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
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
    window.popupController.stopSleepCountdownUI();
  }
});

// Debug logs stored in browser.storage.local - see instructions below
