/**
 * YouTube Button Controller - Content Script
 * Optimized Content Script for YouTube Button Controller (Manifest V3)
 * Provides efficient DOM manipulation and caching
 * 
 * Author: Alireza Talebi
 * GitHub: https://github.com/AlirezaTalebi/Youtube-Buttons-Controller-Firefox-Extention
 * License: GPL-3.0
 */

console.log('YT Controller: Content script loaded, URL:', window.location.href);

// Prevent multiple injections
if (window.youtubeControllerInjected) {
  console.log('YT Controller: Already injected, skipping');
} else {
  console.log('YT Controller: First injection, initializing...');
  
  window.youtubeControllerInjected = true;
  let youtubeController = null;
  const commandQueue = [];

// Debug logging to browser.storage.local
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

function buildCommandSuccess(action, result) {
  return { ok: true, success: true, action, result };
}

function buildPlayerStateSuccess(result) {
  return { ok: true, success: true, action: 'getPlayerState', result, state: result };
}

function buildCommandFailure(action, error) {
  return {
    ok: false,
    success: false,
    action,
    error: error instanceof Error ? error.message : String(error)
  };
}

// Register message listener IMMEDIATELY - before YouTubeController initialization
console.log('YT Controller: Registering message listener...');
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const action = message.action || message.command;
  console.log('YT Controller: [Command] received:', action);
  addDebugLog('[Content]', 'info', action, 'command received');
  addDebugLog('[Command]', 'info', action, 'received');
  
  // Handle ping action immediately - verify content script is alive
  if (action === 'ping') {
    console.log('YT Controller: Ping received');
    const pingResp = { success: true, action: 'ping', source: 'content', youtubeReady: !!youtubeController };
    addDebugLog('[Content]', 'info', 'ping', 'ping responded', pingResp);
    sendResponse(pingResp);
    return;
  }
  
  let result = { success: false, error: 'Not initialized yet' };

  // If youtubeController is not ready, queue the command
  if (!youtubeController || !youtubeController.isInitialized) {
    console.log('YT Controller: Controller not ready, queueing command:', message.action || message.command);
    commandQueue.push({ message, sendResponse });
    return true; // Keep channel open
  }

  // Process the command
  try {
    switch (message.action || message.command) {
      // Player state queries
      case 'getPlayerState':
        const state = youtubeController.getPlayerState();
        result = buildPlayerStateSuccess(state);
        addDebugLog('[Content]', 'info', 'getPlayerState', 'getPlayerState returned paused/isPlaying', {
          paused: state.paused,
          isPlaying: state.isPlaying
        });
        break;

      case 'isValidPage':
        result = { ok: true, success: true, action: 'isValidPage', isValidPage: youtubeController.isVideoPage };
        break;

      // Playback control commands
      case 'clickPlayPause':
        const playSuccess = youtubeController.clickPlayPause();
        result = playSuccess
          ? buildCommandSuccess('clickPlayPause', { executed: true })
          : buildCommandFailure('clickPlayPause', 'Play/Pause control unavailable');
        break;
      
      case 'pauseIfPlaying':
        const video = document.querySelector('video');
        if (video && !video.paused) {
          video.pause();
          addDebugLog('[Content]', 'info', 'pauseIfPlaying', 'video paused');
          result = { ok: true, success: true, action: 'pauseIfPlaying', result: { paused: true } };
        } else if (video && video.paused) {
          result = { ok: true, success: true, action: 'pauseIfPlaying', result: { paused: false, reason: 'already paused' } };
        } else {
          result = { ok: true, success: true, action: 'pauseIfPlaying', result: { paused: false, reason: 'no video' } };
        }
        break;

      case 'clickNext':
        const nextSuccess = youtubeController.clickNext();
        result = { ok: nextSuccess, success: nextSuccess, action: 'clickNext' };
        break;

      case 'clickPrevious':
        const prevSuccess = youtubeController.clickPrevious();
        result = { ok: prevSuccess, success: prevSuccess, action: 'clickPrevious' };
        break;

      case 'clickBack':
        // clickBack is an alias for clickPrevious
        const backSuccess = youtubeController.clickPrevious();
        result = { ok: backSuccess, success: backSuccess, action: 'clickBack' };
        break;

      case 'clickMute':
        const muteSuccess = youtubeController.clickMute();
        result = { ok: muteSuccess, success: muteSuccess, action: 'clickMute' };
        break;

      // Volume control
      case 'setVolume':
        const volumeSuccess = youtubeController.setVolume(message.volume);
        result = { ok: volumeSuccess, success: volumeSuccess, action: 'setVolume', volume: message.volume };
        break;

      case 'getVolume':
        const volume = youtubeController.getVolume();
        result = { ok: volume !== null, success: volume !== null, action: 'getVolume', volume: volume };
        break;

      case 'volumeUp':
        const upSuccess = youtubeController.volumeUp();
        result = { ok: upSuccess, success: upSuccess, action: 'volumeUp' };
        break;

      case 'volumeDown':
        const downSuccess = youtubeController.volumeDown();
        result = { ok: downSuccess, success: downSuccess, action: 'volumeDown' };
        break;

      // Playback speed commands
      case 'setPlaybackSpeed':
        const speedSuccess = youtubeController.setPlaybackSpeed(message.speed);
        result = { ok: speedSuccess, success: speedSuccess, action: 'setPlaybackSpeed', speed: message.speed };
        break;

      // Settings profiles
      case 'getCurrentProfileContext':
        result = buildCommandSuccess('getCurrentProfileContext', youtubeController.getCurrentProfileContext());
        break;

      case 'applyProfile':
        result = buildCommandSuccess('applyProfile', youtubeController.applyProfile(message.profile));
        break;

      // Video progress commands
      case 'getVideoProgress':
        const progress = youtubeController.getVideoProgress();
        result = { ok: !!progress, success: !!progress, action: 'getVideoProgress', progress: progress };
        break;

      case 'seekTo':
        const seekSuccess = youtubeController.seekTo(message.time);
        result = { ok: seekSuccess, success: seekSuccess, action: 'seekTo' };
        break;

      case 'skip':
        const skipSuccess = youtubeController.skip(message.seconds);
        result = { ok: skipSuccess, success: skipSuccess, action: 'skip' };
        break;

      // Captions toggle
      case 'toggleCaptions':
        const captionsSuccess = youtubeController.toggleCaptions();
        result = { ok: captionsSuccess, success: captionsSuccess, action: 'toggleCaptions' };
        break;

      // Video stats
      case 'getVideoStats':
        const stats = youtubeController.getVideoStats();
        result = { ok: true, success: true, action: 'getVideoStats', stats: stats };
        break;

      default:
        const unknownCmd = action;
        result = buildCommandFailure(unknownCmd, 'Unknown command: ' + unknownCmd);
        addDebugLog('[Content]', 'warn', unknownCmd, 'unknown command');
        console.log('YT Controller: [Command] unknown command:', unknownCmd);
    }
  } catch (error) {
    result = buildCommandFailure(action, error);
    addDebugLog('[Content]', 'error', action, 'exception: ' + error.message);
    if (action === 'applyProfile') {
      console.log('[Profile] apply failed', error.message);
      addDebugLog('[Profile]', 'error', 'applyProfile', 'apply failed', { error: error.message });
    }
  }

  const sendFinalResponse = (finalResult) => {
    finalResult.action = action;
    addDebugLog('[Content]', finalResult.success ? 'info' : 'warn', action, 'result', { success: finalResult.success, error: finalResult.error });
    addDebugLog('[Command]', finalResult.success ? 'info' : 'warn', action, 'result', { success: finalResult.success, error: finalResult.error });
    sendResponse(finalResult);
  };

  if (result && typeof result.then === 'function') {
    result
      .then(sendFinalResponse)
      .catch(error => sendFinalResponse(buildCommandFailure(action, error)));
    return true;
  }

  sendFinalResponse(result);
  return true; // Keep channel open for async operations
});

console.log('YT Controller: Message listener registered');

class YouTubeController {
  constructor() {
    this.elements = new Map();
    this.isInitialized = false;
    this.observers = [];
    this.isVideoPage = false;
    this.lastProfileApplyTarget = null;
    this.profileApplyTimer = null;
    this.profileUrlCheckTimer = null;
    this.lastProfileUrl = window.location.href;
    
    // Check if this is a video page
    this.checkVideoPage();
    this.setupProfileAutoApply();
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  checkVideoPage() {
    // Check if current page is a YouTube watch page (both youtube.com and www.youtube.com)
    this.updateVideoPageFlag();
    
    // Debug log
    console.log('YT Controller: Video page check -', { 
      isVideoPage: this.isVideoPage,
      pathname: window.location.pathname,
      search: window.location.search,
      hostname: window.location.hostname
    });
    
    
    
    
    // Listen for navigation changes (YouTube is a SPA)
    window.addEventListener('yt-navigate-finish', () => {
      
      this.checkVideoPage();
      if (this.isVideoPage) {
        setTimeout(() => {
          this.cacheElements();
          this.isInitialized = true;
        }, 1000); // Delay for DOM updates
      }
    });
    
    // Also listen for URL changes via pushState/replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function() {
      originalPushState.apply(history, arguments);
      setTimeout(() => {
        if (window.youtubeController) {
          window.youtubeController.checkVideoPage();
          if (window.youtubeController.isVideoPage) {
            window.youtubeController.cacheElements();
            window.youtubeController.isInitialized = true;
          }
        }
      }, 1000);
    };
    
    history.replaceState = function() {
      originalReplaceState.apply(history, arguments);
      setTimeout(() => {
        if (window.youtubeController) {
          window.youtubeController.checkVideoPage();
          if (window.youtubeController.isVideoPage) {
            window.youtubeController.cacheElements();
            window.youtubeController.isInitialized = true;
          }
        }
      }, 1000);
    };
  }

  updateVideoPageFlag() {
    const isYouTube = window.location.hostname.includes('youtube.com');
    const isWatch = /\/watch/.test(window.location.pathname) && window.location.search.includes('v=');
    const isShorts = /^\/shorts\/[^/]+/.test(window.location.pathname);
    this.isVideoPage = isYouTube && (isWatch || isShorts);
    return this.isVideoPage;
  }

  init() {
    // Always set up message handling
    this.isInitialized = true;
    
    if (this.isVideoPage) {
      this.cacheElements();
      this.setupObservers();
      this.scheduleProfileAutoApply('initial video page', 1200);
    } else {
      // Ready for navigation detection
    }
  }

  // Cache frequently used DOM elements
  cacheElements() {
    const selectors = {
      playButton: '.ytp-play-button',
      nextButton: '.ytp-next-button',
      prevButton: '.ytp-prev-button',
      muteButton: '.ytp-mute-button',
      player: '#movie_player, .html5-video-player'
    };

    for (const [key, selector] of Object.entries(selectors)) {
      const element = document.querySelector(selector);
      if (element) {
        this.elements.set(key, element);
      }
    }
  }

  // Setup mutation observers to update cached elements when DOM changes
  setupObservers() {
    const observer = new MutationObserver((mutations) => {
      let shouldRecache = false;
      
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE && 
              (node.classList?.contains('ytp-chrome-controls') || 
               node.querySelector?.('.ytp-chrome-controls'))) {
            shouldRecache = true;
          }
        });
      });

      if (shouldRecache) {
        this.cacheElements();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.observers.push(observer);
  }

  // Get cached element or query DOM as fallback
  getElement(key) {
    let element = this.elements.get(key);
    
    // If element not cached or no longer in DOM, re-query
    if (!element || !document.contains(element)) {
      this.cacheElements();
      element = this.elements.get(key);
    }
    
    return element;
  }

  // Optimized button click methods
  clickPlayPause() {
    const video = document.querySelector('video');
    const wasPaused = video ? video.paused : null;
    const playButton = this.getElement('playButton');

    if (playButton) {
      playButton.click();
    } else if (video) {
      if (video.paused) {
        video.play().catch(error => {
          addDebugLog('[Error]', 'warn', 'clickPlayPause', 'video play rejected', { error: error.message });
        });
      } else {
        video.pause();
      }
    } else {
      return false;
    }

    console.log('[Content] playPause executed', { wasPaused });
    addDebugLog('[Content]', 'info', 'clickPlayPause', 'playPause executed', { wasPaused });
    return true;
  }

  clickNext() {
    const nextButton = this.getElement('nextButton');
    if (nextButton && !nextButton.disabled) {
      nextButton.click();
      return true;
    }
    return false;
  }

  clickPrevious() {
    const prevButton = this.getElement('prevButton');
    if (prevButton && !prevButton.disabled) {
      prevButton.click();
      return true;
    }
    return false;
  }

  clickMute() {
    const muteButton = this.getElement('muteButton');
    if (muteButton) {
      const title = muteButton.getAttribute('title') || muteButton.getAttribute('aria-label') || '';
      muteButton.click();
      
      // Send state to background script
      browser.runtime.sendMessage({
        type: 'BUTTON_STATE_CHANGED',
        button: 'mute',
        state: title
      });
      
      return true;
    }
    return null;
  }

  // Navigate back in history
  goBack() {
    try {
      window.history.back();
      return true;
    } catch (error) {
      
      return false;
    }
  }

  // Get current player state
  getPlayerState() {
    this.updateVideoPageFlag();
    const video = document.querySelector('video');
    const hasVideo = !!video;
    const isValidPage = this.isVideoPage;
    const detectedTitle = this.detectVideoTitle();
    let title = detectedTitle.title;
    const channel = this.detectCurrentChannel();

    if (hasVideo) {
      addDebugLog('[PlayerState]', 'info', 'getPlayerState', 'video found', {
        url: window.location.href,
        readyState: video.readyState
      });
    }

    if (title) {
      addDebugLog('[PlayerState]', 'info', 'getPlayerState', 'title detected', {
        title,
        source: detectedTitle.source
      });
    } else if (hasVideo && isValidPage) {
      title = 'Video detected - title unavailable';
      addDebugLog('[PlayerState]', 'warn', 'getPlayerState', 'title unavailable', {
        url: window.location.href
      });
    }

    const paused = video ? video.paused : true;
    const isPlaying = video ? (!video.paused && !video.ended && video.readyState > 2) : false;
    addDebugLog('[PlayerState]', 'info', 'getPlayerState', 'play/pause state detection', {
      paused,
      isPlaying,
      ended: video ? video.ended : null,
      readyState: video ? video.readyState : null
    });

    const state = {
      hasVideo,
      isValidPage,
      isReady: hasVideo && video.readyState > 0,
      title: title || '',
      videoTitle: title || '',
      url: window.location.href,
      videoId: this.getVideoId(),
      channelName: channel.channelName,
      channelKey: channel.channelKey,
      channelUrl: channel.channelUrl,
      thumbnailUrl: this.getThumbnailUrl(),
      paused,
      isPlaying,
      duration: video ? (video.duration || 0) : 0,
      currentTime: video ? video.currentTime : 0,
      volume: video ? Math.round(video.volume * 100) : 0,
      muted: video ? video.muted : false,
      isMuted: video ? video.muted : false,
      playbackRate: video ? video.playbackRate : 1,
      buffered: video && video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0
    };

    addDebugLog('[PlayerState]', 'info', 'getPlayerState', 'returned to popup', {
      hasVideo: state.hasVideo,
      isValidPage: state.isValidPage,
      title: state.title,
      paused: state.paused,
      isPlaying: state.isPlaying
    });

    return state;
  }

  detectVideoTitle() {
    const selectors = [
      'h1.ytd-watch-metadata yt-formatted-string',
      'ytd-watch-metadata h1 yt-formatted-string',
      'h1.title yt-formatted-string',
      '#title h1 yt-formatted-string',
      'yt-formatted-string.ytd-video-primary-info-renderer',
      'h1.ytd-video-primary-info-renderer',
      'ytd-video-primary-info-renderer h1',
      '#title h1',
      'h1[class*="title"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const title = this.cleanVideoTitle(element?.textContent);
      if (title) {
        return { title, source: selector };
      }
    }

    const metaTitle = this.cleanVideoTitle(document.querySelector('meta[name="title"]')?.getAttribute('content'));
    if (metaTitle) {
      return { title: metaTitle, source: 'meta[name="title"]' };
    }

    const ogTitle = this.cleanVideoTitle(document.querySelector('meta[property="og:title"]')?.getAttribute('content'));
    if (ogTitle) {
      return { title: ogTitle, source: 'meta[property="og:title"]' };
    }

    const documentTitle = this.cleanDocumentTitle(document.title);
    if (documentTitle) {
      return { title: documentTitle, source: 'document.title' };
    }

    return { title: null, source: null };
  }

  getThumbnailUrl() {
    return this.cleanText(
      document.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
      document.querySelector('link[itemprop="thumbnailUrl"]')?.getAttribute('href')
    );
  }

  cleanVideoTitle(value) {
    const title = this.cleanText(value);
    if (!title) return null;

    return title
      .replace(/\s*-\s*YouTube\s*$/i, '')
      .replace(/\s*\|\s*YouTube\s*$/i, '')
      .replace(/\s*-\s*Playlist\s*$/i, '')
      .trim() || null;
  }

  cleanDocumentTitle(value) {
    let title = this.cleanVideoTitle(value);
    if (!title) return null;

    title = title
      .replace(/^YouTube\s*-\s*/i, '')
      .replace(/\s*-\s*YouTube.*$/i, '')
      .replace(/\s*\|\s*YouTube.*$/i, '')
      .replace(/\s*-\s*(Mix|Playlist).*$/i, '')
      .trim();

    if (!title || title.toLowerCase() === 'youtube') {
      return null;
    }

    return title;
  }

  // Volume control methods
  setVolume(volume) {
    const video = document.querySelector('video');
    if (video) {
      video.volume = Math.max(0, Math.min(1, volume / 100));
      
      // Send state change notification
      browser.runtime.sendMessage({
        type: 'BUTTON_STATE_CHANGED',
        button: 'volume',
        state: `Volume: ${volume}%`
      });
      
      return true;
    }
    return false;
  }

  // Playback speed control
  setPlaybackSpeed(speed) {
    const video = document.querySelector('video');
    if (video) {
      video.playbackRate = speed;
      
      // Send state change notification
      browser.runtime.sendMessage({
        type: 'BUTTON_STATE_CHANGED',
        button: 'speed',
        state: `Speed: ${speed}x`
      });
      
      return true;
    }
    return false;
  }

  setupProfileAutoApply() {
    window.addEventListener('yt-navigate-finish', () => {
      this.scheduleProfileAutoApply('yt-navigate-finish', 1000);
    });

    window.addEventListener('popstate', () => {
      this.scheduleProfileAutoApply('popstate', 1000);
    });

    this.profileUrlCheckTimer = window.setInterval(() => {
      if (window.location.href !== this.lastProfileUrl) {
        this.lastProfileUrl = window.location.href;
        this.scheduleProfileAutoApply('url changed', 1000);
      }
    }, 1000);
  }

  scheduleProfileAutoApply(reason, delay = 800, retryCount = 0) {
    if (this.profileApplyTimer) {
      clearTimeout(this.profileApplyTimer);
    }

    this.profileApplyTimer = setTimeout(() => {
      this.autoApplyProfile(reason, retryCount);
    }, delay);
  }

  async autoApplyProfile(reason, retryCount = 0) {
    this.updateVideoPageFlag();

    if (!this.isVideoPage) {
      this.logProfileSkip('not a video page', { reason });
      return;
    }

    let context;
    try {
      context = this.getCurrentProfileContext();
    } catch (error) {
      if (retryCount < 5) {
        this.logProfileSkip('profile context not ready', { reason, retryCount, error: error.message });
        this.scheduleProfileAutoApply(reason, 1000, retryCount + 1);
        return;
      }

      this.logProfileSkip('profile context unavailable', { reason, error: error.message });
      return;
    }

    const targetKey = `${context.videoId || window.location.href}|${context.channelKey || context.channelUrl || 'global'}`;
    if (this.lastProfileApplyTarget === targetKey) {
      this.logProfileSkip('already applied for target', { reason, targetKey });
      return;
    }

    try {
      const stored = await browser.storage.local.get(['ytControllerProfiles', 'ytControllerGlobalProfile']);
      const profiles = stored.ytControllerProfiles && typeof stored.ytControllerProfiles === 'object'
        ? stored.ytControllerProfiles
        : {};
      const channelProfile = context.channelKey ? profiles[context.channelKey] : null;
      const profile = channelProfile || stored.ytControllerGlobalProfile;
      const source = channelProfile ? 'channel' : 'global';

      if (!profile) {
        this.lastProfileApplyTarget = targetKey;
        this.logProfileSkip('no profile found', { reason, targetKey, channelKey: context.channelKey });
        return;
      }

      const applied = this.applyProfile(profile);
      this.lastProfileApplyTarget = targetKey;
      console.log('[Profile] profile applied', { source, applied });
      addDebugLog('[Profile]', 'info', 'autoApply', 'profile applied', {
        source,
        targetKey,
        channelKey: context.channelKey,
        result: applied
      });
    } catch (error) {
      console.log('[Profile] apply failed', error.message);
      addDebugLog('[Profile]', 'error', 'autoApply', 'apply failed', {
        reason,
        error: error.message
      });
    }
  }

  logProfileSkip(reason, data = {}) {
    console.log('[Profile] skipped:', reason, data);
    addDebugLog('[Profile]', 'info', 'autoApply', 'skipped with reason', {
      reason,
      ...data
    });
  }

  getCurrentProfileContext() {
    this.updateVideoPageFlag();

    if (!this.isVideoPage) {
      throw new Error('Not on a YouTube video page');
    }

    const video = document.querySelector('video');
    if (!video) {
      throw new Error('Video element not found');
    }

    const channel = this.detectCurrentChannel();
    const context = {
      channelKey: channel.channelKey,
      channelName: channel.channelName,
      channelUrl: channel.channelUrl,
      videoId: this.getVideoId(),
      speed: video.playbackRate,
      volume: Math.round(video.volume * 100),
      muted: video.muted
    };

    console.log('[Profile] context detected', context);
    addDebugLog('[Profile]', 'info', 'context', 'context detected', context);
    return context;
  }

  detectCurrentChannel() {
    const metaChannelId = this.getMetaContent('meta[itemprop="channelId"]');
    const metaChannelName =
      this.getMetaContent('span[itemprop="author"] link[itemprop="name"]') ||
      this.getMetaContent('meta[itemprop="author"]');
    const metaChannelUrl = this.getMetaContent('span[itemprop="author"] link[itemprop="url"]');
    const channelAnchor = this.findChannelAnchor();

    const anchorUrl = channelAnchor ? this.normalizeChannelUrl(channelAnchor.getAttribute('href')) : null;
    const channelUrl = anchorUrl || this.normalizeChannelUrl(metaChannelUrl) ||
      (metaChannelId ? `https://www.youtube.com/channel/${metaChannelId}` : null);
    const channelName = this.cleanText(channelAnchor?.textContent) || metaChannelName || null;
    const channelKey = this.buildChannelKey(metaChannelId, channelUrl);

    return {
      channelKey,
      channelName,
      channelUrl
    };
  }

  findChannelAnchor() {
    const selectors = [
      'ytd-video-owner-renderer a.yt-simple-endpoint[href*="/channel/"]',
      'ytd-video-owner-renderer a.yt-simple-endpoint[href^="/@"]',
      'ytd-watch-metadata ytd-channel-name a[href]',
      '#owner ytd-channel-name a[href]',
      '#upload-info ytd-channel-name a[href]',
      '#channel-name a[href*="/channel/"]',
      '#channel-name a[href^="/@"]',
      'a.yt-simple-endpoint.yt-formatted-string[href*="/channel/"]',
      'a.yt-simple-endpoint.yt-formatted-string[href^="/@"]'
    ];

    for (const selector of selectors) {
      const anchor = document.querySelector(selector);
      if (anchor && anchor.getAttribute('href')) {
        return anchor;
      }
    }

    return null;
  }

  getMetaContent(selector) {
    const element = document.querySelector(selector);
    if (!element) return null;

    return this.cleanText(
      element.getAttribute('content') ||
      element.getAttribute('href') ||
      element.textContent
    );
  }

  cleanText(value) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : null;
  }

  normalizeChannelUrl(value) {
    if (!value) return null;

    try {
      const url = new URL(value, window.location.origin);
      url.hash = '';
      url.search = '';
      return url.href.replace(/\/$/, '');
    } catch (error) {
      return null;
    }
  }

  buildChannelKey(channelId, channelUrl) {
    if (channelId) {
      return channelId;
    }

    if (!channelUrl) {
      return null;
    }

    try {
      const url = new URL(channelUrl);
      const channelMatch = url.pathname.match(/\/channel\/([^/]+)/);
      if (channelMatch) {
        return decodeURIComponent(channelMatch[1]);
      }

      const handleMatch = url.pathname.match(/\/@([^/]+)/);
      if (handleMatch) {
        return '@' + decodeURIComponent(handleMatch[1]);
      }

      return channelUrl;
    } catch (error) {
      return channelUrl;
    }
  }

  normalizeProfile(profile) {
    if (!profile || typeof profile !== 'object') {
      throw new Error('Invalid profile');
    }

    const speed = Number(profile.speed);
    const volume = Number(profile.volume);

    if (!Number.isFinite(speed) || speed <= 0) {
      throw new Error('Invalid profile speed');
    }

    if (!Number.isFinite(volume)) {
      throw new Error('Invalid profile volume');
    }

    if (typeof profile.muted !== 'boolean') {
      throw new Error('Invalid profile mute state');
    }

    return {
      speed: Math.max(0.25, Math.min(16, speed)),
      volume: Math.max(0, Math.min(100, Math.round(volume))),
      muted: profile.muted
    };
  }

  applyProfile(profile) {
    const video = document.querySelector('video');
    if (!video) {
      throw new Error('Video element not found');
    }

    const normalized = this.normalizeProfile(profile);
    video.playbackRate = normalized.speed;
    video.volume = normalized.volume / 100;
    video.muted = normalized.muted;

    browser.runtime.sendMessage({
      type: 'BUTTON_STATE_CHANGED',
      button: 'mute',
      state: normalized.muted ? 'Unmute' : 'Mute'
    }).catch(() => {});

    const result = {
      speed: video.playbackRate,
      volume: Math.round(video.volume * 100),
      muted: video.muted
    };

    console.log('[Profile] profile applied', result);
    addDebugLog('[Profile]', 'info', 'applyProfile', 'profile applied', result);
    return result;
  }

  // Seek to specific time
  seekTo(time) {
    const video = document.querySelector('video');
    if (video && !isNaN(time)) {
      video.currentTime = Math.max(0, Math.min(time, video.duration));
      return true;
    }
    return false;
  }

  // Toggle captions/subtitles
  toggleCaptions() {
    const captionButton = document.querySelector('.ytp-subtitles-button');
    if (captionButton) {
      captionButton.click();
      return true;
    }
    return false;
  }

  // Get detailed video statistics
  getVideoStats() {
    const state = this.getPlayerState();
    const video = document.querySelector('video');
    
    let bitrate = 'N/A';
    let resolution = 'N/A';

    if (video) {
      const videoElement = video;
      // Try to get video dimensions
      resolution = `${videoElement.videoWidth}x${videoElement.videoHeight}`;
      
      // Bitrate estimation (requires more complex logic with MediaSource)
      try {
        if (window.performance && window.performance.getEntriesByType) {
          const resourceTimings = window.performance.getEntriesByType('resource');
          const videoResources = resourceTimings.filter(r => 
            r.name.includes('videoplayback') || r.name.includes('range=')
          );
          if (videoResources.length > 0) {
            const lastResource = videoResources[videoResources.length - 1];
            bitrate = `${Math.round(lastResource.transferSize / 1024 / (lastResource.duration / 1000))} kbps`;
          }
        }
      } catch (e) {
        // Continue with N/A
      }
    }

    return {
      duration: state?.duration || 0,
      currentTime: state?.currentTime || 0,
      progress: state?.duration > 0 ? Math.round((state.currentTime / state.duration) * 100) : 0,
      bitrate: bitrate,
      resolution: resolution,
      isPlaying: state?.isPlaying || false,
      volume: state?.volume || 0,
      playbackRate: state?.playbackRate || 1
    };
  }

  // Get video ID from URL
  getVideoId() {
    const shortsMatch = window.location.pathname.match(/^\/shorts\/([^/?#]+)/);
    if (shortsMatch) {
      return decodeURIComponent(shortsMatch[1]);
    }

    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  // Get video progress information
  getVideoProgress() {
    const video = document.querySelector('video');
    if (video) {
      return {
        currentTime: video.currentTime,
        duration: video.duration,
        progress: (video.currentTime / video.duration) * 100
      };
    }
    return null;
  }

  // Skip forward/backward
  skip(seconds) {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
      return true;
    }
    return false;
  }

  // Cleanup method
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    if (this.profileApplyTimer) {
      clearTimeout(this.profileApplyTimer);
      this.profileApplyTimer = null;
    }
    if (this.profileUrlCheckTimer) {
      clearInterval(this.profileUrlCheckTimer);
      this.profileUrlCheckTimer = null;
    }
    this.elements.clear();
  }
}

// Initialize controller only once
if (!window.youtubeController) {
  youtubeController = new YouTubeController();
  window.youtubeController = youtubeController;
  
  console.log('YT Controller: YouTubeController initialized, processing queued commands...');
  
  // Process queued commands
  while (commandQueue.length > 0) {
    const queued = commandQueue.shift();
    console.log('YT Controller: Processing queued command:', queued.message.action || queued.message.command);
    
    // Re-send the queued message to the listener
    const fakeMessage = queued.message;
    const fakeSendResponse = queued.sendResponse;
    
    let result = { success: false, error: 'Not initialized yet' };
    
    try {
      switch (fakeMessage.action || fakeMessage.command) {
        case 'getPlayerState':
          const state = youtubeController.getPlayerState();
          result = buildPlayerStateSuccess(state);
          addDebugLog('[Content]', 'info', 'getPlayerState', 'getPlayerState returned paused/isPlaying', {
            paused: state.paused,
            isPlaying: state.isPlaying
          });
          break;
        
        case 'isValidPage':
          result = { ok: true, success: true, action: 'isValidPage', isValidPage: youtubeController.isVideoPage };
          break;
        
        case 'clickPlayPause':
          const playSuccess = youtubeController.clickPlayPause();
          result = playSuccess
            ? buildCommandSuccess('clickPlayPause', { executed: true })
            : buildCommandFailure('clickPlayPause', 'Play/Pause control unavailable');
          break;
        
        case 'clickNext':
          const nextSuccess = youtubeController.clickNext();
          result = { ok: nextSuccess, success: nextSuccess, action: 'clickNext' };
          break;
        
        case 'clickPrevious':
          const prevSuccess = youtubeController.clickPrevious();
          result = { ok: prevSuccess, success: prevSuccess, action: 'clickPrevious' };
          break;
        
        case 'clickBack':
          // clickBack is an alias for clickPrevious
          const backSuccess = youtubeController.clickPrevious();
          result = { ok: backSuccess, success: backSuccess, action: 'clickBack' };
          break;

        case 'clickMute':
          const muteSuccess = youtubeController.clickMute();
          result = { ok: muteSuccess, success: muteSuccess, action: 'clickMute' };
          break;
        
        case 'pauseIfPlaying':
          const video = document.querySelector('video');
          if (video && !video.paused) {
            video.pause();
            result = { ok: true, success: true, action: 'pauseIfPlaying', result: { paused: true } };
          } else if (video && video.paused) {
            result = { ok: true, success: true, action: 'pauseIfPlaying', result: { paused: false, reason: 'already paused' } };
          } else {
            result = { ok: true, success: true, action: 'pauseIfPlaying', result: { paused: false, reason: 'no video' } };
          }
          break;
        
        case 'setVolume':
          const volumeSuccess = youtubeController.setVolume(fakeMessage.volume);
          result = { ok: volumeSuccess, success: volumeSuccess, action: 'setVolume', volume: fakeMessage.volume };
          break;
        
        case 'getVolume':
          const volume = youtubeController.getVolume();
          result = { ok: volume !== null, success: volume !== null, action: 'getVolume', volume: volume };
          break;
        
        case 'volumeUp':
          const upSuccess = youtubeController.volumeUp();
          result = { ok: upSuccess, success: upSuccess, action: 'volumeUp' };
          break;
        
        case 'volumeDown':
          const downSuccess = youtubeController.volumeDown();
          result = { ok: downSuccess, success: downSuccess, action: 'volumeDown' };
          break;
        
        case 'setPlaybackSpeed':
          const speedSuccess = youtubeController.setPlaybackSpeed(fakeMessage.speed);
          result = { ok: speedSuccess, success: speedSuccess, action: 'setPlaybackSpeed', speed: fakeMessage.speed };
          break;

        case 'getCurrentProfileContext':
          result = buildCommandSuccess('getCurrentProfileContext', youtubeController.getCurrentProfileContext());
          break;

        case 'applyProfile':
          result = buildCommandSuccess('applyProfile', youtubeController.applyProfile(fakeMessage.profile));
          break;

        case 'getVideoProgress':
          const progress = youtubeController.getVideoProgress();
          result = { ok: !!progress, success: !!progress, action: 'getVideoProgress', progress: progress };
          break;
        
        case 'seekTo':
          const seekSuccess = youtubeController.seekTo(fakeMessage.time);
          result = { ok: seekSuccess, success: seekSuccess, action: 'seekTo' };
          break;
        
        case 'skip':
          const skipSuccess = youtubeController.skip(fakeMessage.seconds);
          result = { ok: skipSuccess, success: skipSuccess, action: 'skip' };
          break;
        
        default:
          const unknownQueuedCmd = fakeMessage.action || fakeMessage.command;
          result = { ok: false, success: false, error: 'Unknown command: ' + unknownQueuedCmd, action: unknownQueuedCmd };
      }
    } catch (error) {
      result = { ok: false, success: false, error: error.message, action: fakeMessage.action || fakeMessage.command };
      if ((fakeMessage.action || fakeMessage.command) === 'applyProfile') {
        console.log('[Profile] apply failed', error.message);
        addDebugLog('[Profile]', 'error', 'applyProfile', 'apply failed', { error: error.message });
      }
    }
    
    fakeSendResponse(result);
  }
} else {
  youtubeController = window.youtubeController;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.youtubeController) {
    window.youtubeController.destroy();
  }
});

console.log('YT Controller: Content script fully initialized, ready for messages');

} // End of injection guard
