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

// Register message listener IMMEDIATELY - before YouTubeController initialization
console.log('YT Controller: Registering message listener...');
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('YT Controller: Received message:', message.action || message.command);
  
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
        result = { success: !!state, state: state };
        break;

      case 'isValidPage':
        result = { success: true, isValidPage: youtubeController.isVideoPage };
        break;

      // Playback control commands
      case 'clickPlayPause':
        const playSuccess = youtubeController.clickPlayPause();
        result = { success: playSuccess };
        break;

      case 'clickNext':
        const nextSuccess = youtubeController.clickNext();
        result = { success: nextSuccess };
        break;

      case 'clickPrevious':
        const prevSuccess = youtubeController.clickPrevious();
        result = { success: prevSuccess };
        break;

      case 'clickMute':
        const muteSuccess = youtubeController.clickMute();
        result = { success: muteSuccess };
        break;

      // Volume control
      case 'setVolume':
        const volumeSuccess = youtubeController.setVolume(message.volume);
        result = { success: volumeSuccess, volume: message.volume };
        break;

      case 'getVolume':
        const volume = youtubeController.getVolume();
        result = { success: volume !== null, volume: volume };
        break;

      case 'volumeUp':
        const upSuccess = youtubeController.volumeUp();
        result = { success: upSuccess };
        break;

      case 'volumeDown':
        const downSuccess = youtubeController.volumeDown();
        result = { success: downSuccess };
        break;

      // Playback speed commands
      case 'setPlaybackSpeed':
        const speedSuccess = youtubeController.setPlaybackSpeed(message.speed);
        result = { success: speedSuccess, speed: message.speed };
        break;

      // Theater mode toggle
      case 'toggleTheaterMode':
        const theaterSuccess = youtubeController.toggleTheaterMode();
        result = { success: theaterSuccess };
        break;

      // Video progress commands
      case 'getVideoProgress':
        const progress = youtubeController.getVideoProgress();
        result = { success: !!progress, progress: progress };
        break;

      case 'seekTo':
        const seekSuccess = youtubeController.seekTo(message.time);
        result = { success: seekSuccess };
        break;

      case 'skip':
        const skipSuccess = youtubeController.skip(message.seconds);
        result = { success: skipSuccess };
        break;

      default:
        result = { success: false, error: 'Unknown command: ' + (message.action || message.command) };
    }
  } catch (error) {
    result = { success: false, error: error.message };
  }

  sendResponse(result);
  return true; // Keep channel open for async operations
});

console.log('YT Controller: Message listener registered');

class YouTubeController {
  constructor() {
    this.elements = new Map();
    this.isInitialized = false;
    this.observers = [];
    this.isVideoPage = false;
    
    // Check if this is a video page
    this.checkVideoPage();
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  checkVideoPage() {
    // Check if current page is a YouTube watch page (both youtube.com and www.youtube.com)
    this.isVideoPage = /\/watch/.test(window.location.pathname) && 
                      window.location.search.includes('v=') &&
                      window.location.hostname.includes('youtube.com');
    
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

  init() {
    // Always set up message handling
    this.isInitialized = true;
    
    if (this.isVideoPage) {
      this.cacheElements();
      this.setupObservers();
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
    const playButton = this.getElement('playButton');
    if (playButton) {
      const title = playButton.getAttribute('title') || playButton.getAttribute('aria-label') || '';
      playButton.click();
      
      // Send state to background script
      browser.runtime.sendMessage({
        type: 'BUTTON_STATE_CHANGED',
        button: 'play',
        state: title
      });
      
      return title;
    }
    return null;
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
      
      return title;
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
    // First check if we're on a valid video page
    if (!this.isVideoPage) {
      return {
        isValidPage: false,
        error: 'Not on a YouTube video page'
      };
    }

    const video = document.querySelector('video');
    
    // If we have a video element, we can work with it even if other controls aren't ready
    if (video) {
      let state = {
        isValidPage: true,
        isReady: true,
        isPlaying: !video.paused,
        isMuted: video.muted,
        volume: Math.round(video.volume * 100),
        playbackRate: video.playbackRate,
        currentTime: video.currentTime,
        duration: video.duration || 0,
        paused: video.paused,
        buffered: video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0
      };

      // Try to get video title (not critical for basic functionality)
      const titleSelectors = [
        'h1.ytd-video-primary-info-renderer',
        'h1.title.ytd-video-primary-info-renderer', 
        'h1.style-scope.ytd-video-primary-info-renderer',
        '#title h1',
        '.ytd-video-primary-info-renderer h1',
        'h1[class*="title"]',
        '#container h1'
      ];

      for (const selector of titleSelectors) {
        const titleElement = document.querySelector(selector);
        if (titleElement && titleElement.textContent.trim()) {
          state.videoTitle = titleElement.textContent.trim();
          
          break;
        }
      }

      // Get video ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      state.videoId = urlParams.get('v');

      return state;
    }

    // If no video element found, page is still loading
    return {
      isValidPage: true,
      isReady: false,
      isPlaying: false,
      error: 'Video player still loading...'
    };
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

  // Seek to specific time
  seekTo(time) {
    const video = document.querySelector('video');
    if (video && !isNaN(time)) {
      video.currentTime = Math.max(0, Math.min(time, video.duration));
      return true;
    }
    return false;
  }

  // Theater mode toggle
  toggleTheaterMode() {
    const theaterButton = document.querySelector('.ytp-size-button');
    if (theaterButton) {
      theaterButton.click();
      return true;
    }
    
    // Alternative method - check for theater mode class on player
    const player = this.getElement('player');
    if (player) {
      const isTheater = player.classList.contains('ytp-fullscreen');
      // Try to find and click theater mode button in menu
      const menuButton = document.querySelector('.ytp-settings-button');
      if (menuButton) {
        // This would require more complex logic to navigate the settings menu
        // For now, just return the current state
        return !isTheater;
      }
    }
    return false;
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
          result = { success: !!state, state: state };
          break;
        
        case 'isValidPage':
          result = { success: true, isValidPage: youtubeController.isVideoPage };
          break;
        
        case 'clickPlayPause':
          const playSuccess = youtubeController.clickPlayPause();
          result = { success: playSuccess };
          break;
        
        case 'clickNext':
          const nextSuccess = youtubeController.clickNext();
          result = { success: nextSuccess };
          break;
        
        case 'clickPrevious':
          const prevSuccess = youtubeController.clickPrevious();
          result = { success: prevSuccess };
          break;
        
        case 'clickMute':
          const muteSuccess = youtubeController.clickMute();
          result = { success: muteSuccess };
          break;
        
        case 'setVolume':
          const volumeSuccess = youtubeController.setVolume(fakeMessage.volume);
          result = { success: volumeSuccess, volume: fakeMessage.volume };
          break;
        
        case 'getVolume':
          const volume = youtubeController.getVolume();
          result = { success: volume !== null, volume: volume };
          break;
        
        case 'volumeUp':
          const upSuccess = youtubeController.volumeUp();
          result = { success: upSuccess };
          break;
        
        case 'volumeDown':
          const downSuccess = youtubeController.volumeDown();
          result = { success: downSuccess };
          break;
        
        case 'setPlaybackSpeed':
          const speedSuccess = youtubeController.setPlaybackSpeed(fakeMessage.speed);
          result = { success: speedSuccess, speed: fakeMessage.speed };
          break;
        
        case 'toggleTheaterMode':
          const theaterSuccess = youtubeController.toggleTheaterMode();
          result = { success: theaterSuccess };
          break;
        
        case 'getVideoProgress':
          const progress = youtubeController.getVideoProgress();
          result = { success: !!progress, progress: progress };
          break;
        
        case 'seekTo':
          const seekSuccess = youtubeController.seekTo(fakeMessage.time);
          result = { success: seekSuccess };
          break;
        
        case 'skip':
          const skipSuccess = youtubeController.skip(fakeMessage.seconds);
          result = { success: skipSuccess };
          break;
        
        default:
          result = { success: false, error: 'Unknown command: ' + (fakeMessage.action || fakeMessage.command) };
      }
    } catch (error) {
      result = { success: false, error: error.message };
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
