/**
 * YouTube Button Controller - Content Script
 * Optimized Content Script for YouTube Button Controller
 * Provides efficient DOM manipulation and caching
 * 
 * Author: Alireza Talebi
 * GitHub: https://github.com/AlirezaTalebi/Youtube-Buttons-Controller-Firefox-Extention
 * License: GPL-3.0
 */

// Prevent multiple injections
if (window.youtubeControllerInjected) {
  
} else {
  
  window.youtubeControllerInjected = true;

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
    this.isVideoPage = window.location.pathname === '/watch' && 
                      window.location.search.includes('v=');
    
    
    
    
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
  
  window.youtubeController = new YouTubeController();
  
} else {
  
}
const youtubeController = window.youtubeController;



// Single message listener for all commands
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  
  
  

  // Always respond to getPlayerState for connection testing
  if (message.action === 'getPlayerState') {
    
    try {
      
      
      if (!youtubeController.isVideoPage) {
        
        const response = { success: false, error: 'Not on video page', state: { isValidPage: false } };
        
        sendResponse(response);
        return;
      }
      
      const playerState = youtubeController.getPlayerState();
      
      const response = { success: true, state: playerState };
      
      sendResponse(response);
      return;
    } catch (error) {
      
      const errorResponse = { success: false, error: 'Player state error: ' + error.message };
      
      sendResponse(errorResponse);
      return;
    }
  }

  if (!youtubeController.isVideoPage) {
    
    const response = { success: false, error: 'Not on video page' };
    
    sendResponse(response);
    return;
  }

  let result = { success: false };

  try {
    const command = message.action || message.command;
    
    switch (command) {
      case 'clickPlayPause':
      case 'play-pause':
        const playPauseState = youtubeController.clickPlayPause();
        result = { success: true, state: playPauseState };
        break;

      case 'clickNext':
      case 'next-video':
        const nextSuccess = youtubeController.clickNext();
        result = { success: nextSuccess };
        break;

      case 'clickBack':
      case 'clickPrevious':
      case 'previous-video':
        const prevSuccess = youtubeController.clickPrevious();
        result = { success: prevSuccess };
        break;

      // NEW: Stop and Restart commands
      case 'stop-video':
        const stopState = youtubeController.clickPlayPause();
        result = { success: true, state: stopState };
        break;

      case 'restart-video':
        if (youtubeController.video) {
          youtubeController.video.currentTime = 0;
          result = { success: true };
        } else {
          result = { success: false, error: 'Video not found' };
        }
        break;

      case 'clickMute':
      case 'toggle-mute':
        const muteState = youtubeController.clickMute();
        result = { success: true, state: muteState };
        break;

      // NEW: Volume shortcuts
      case 'volume-up':
        if (message.command === 'volume-up') {
          const video = document.querySelector('video');
          if (video) {
            const newVolume = Math.min(1, video.volume + 0.1);
            video.volume = newVolume;
            result = { success: true, volume: Math.round(newVolume * 100) };
          }
        }
        break;

      case 'volume-down':
        if (message.command === 'volume-down') {
          const video = document.querySelector('video');
          if (video) {
            const newVolume = Math.max(0, video.volume - 0.1);
            video.volume = newVolume;
            result = { success: true, volume: Math.round(newVolume * 100) };
          }
        }
        break;

      // NEW: Theater mode shortcut
      case 'theater-mode':
        if (message.command === 'theater-mode') {
          const theaterSuccess = youtubeController.toggleTheaterMode();
          result = { success: theaterSuccess };
        }
        break;

      // NEW: Speed control shortcuts
      case 'speed-up':
        if (message.command === 'speed-up') {
          const video = document.querySelector('video');
          if (video) {
            const newSpeed = Math.min(2, video.playbackRate + 0.25);
            video.playbackRate = newSpeed;
            result = { success: true, speed: newSpeed };
          }
        }
        break;

      case 'speed-down':
        if (message.command === 'speed-down') {
          const video = document.querySelector('video');
          if (video) {
            const newSpeed = Math.max(0.25, video.playbackRate - 0.25);
            video.playbackRate = newSpeed;
            result = { success: true, speed: newSpeed };
          }
        }
        break;

      // NEW: Skip shortcuts
      case 'skip-forward':
        if (message.command === 'skip-forward') {
          const skipSuccess = youtubeController.skip(10);
          result = { success: skipSuccess };
        }
        break;

      case 'skip-backward':
        if (message.command === 'skip-backward') {
          const skipSuccess = youtubeController.skip(-10);
          result = { success: skipSuccess };
        }
        break;
      case 'toggle-mute':
        if (message.command === 'toggle-mute' || message.action === 'clickMute') {
          const state = youtubeController.clickMute();
          result = { success: true, state: state };
        }
        break;

      case 'clickBack':
        const backSuccess = youtubeController.goBack();
        result = { success: backSuccess };
        break;

      case 'getPlayerState':
        const playerState = youtubeController.getPlayerState();
        result = { success: true, state: playerState };
        break;

      // Volume control commands
      case 'setVolume':
        const volumeSuccess = youtubeController.setVolume(message.volume);
        result = { success: volumeSuccess, volume: message.volume };
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
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  
  if (window.youtubeController) {
    window.youtubeController.destroy();
  }
});





} // End of injection guard
