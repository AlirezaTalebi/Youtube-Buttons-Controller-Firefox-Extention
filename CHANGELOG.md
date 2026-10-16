# Changelog

All notable changes to the YouTube Button Controller extension.

## [2.5.0] - 2026-10-16

### Added

- Top YouTube thumbnail overlay media deck with integrated player controls (Play/Pause, Previous, Next, Mute, Volume slider, and live timecode)
- Modular drag-and-drop reorderable sections with custom order persistence via browser storage
- Collapsible modular sections with smooth chevron indicators and persistent folded/unfolded states
- Tri-scale popup layout selector (Small / Medium / Large) accessible directly in the header with persistent zoom scaling
- Top donation support banner with single toggle button and expandable drawer
- Multi-cryptocurrency donation support (BNB Smart Chain, Ethereum, Tron, Bitcoin) with one-click clipboard copying, button feedback, and toast alerts
- Direct PayPal donation link support (`paypal.me/alirezatalebi`)
- Modern copyright-safe vector SVG icons for all action buttons and status indicators
- Enhanced YouTube Shorts previous/next navigation support
- Interactive captions toggle state synchronization and feedback

### Changed

- Adopted official YouTube design system with YouTube Red (`#FF0000`), dark surfaces (`#0F0F0F`, `#1F1F1F`, `#272727`), and light surfaces (`#F9F9F9`, `#FFFFFF`)
- Enlarged extension toolbar icons with multi-resolution assets (16px, 32px, 48px, 128px) and enlarged popup logo badge
- Replaced intrusive top notification banner with modern floating status toasts
- Improved volume slider and control bar responsiveness across small, medium, and wide scales
- Streamlined top status indicator with connection dot and compact rescan button

### Fixed

- Volume slider and time counter collision / overflow in Small and Medium scale modes
- Shortcuts modal duplicate stacking and escape key listener cleanup
- Cached YouTube tab validation and active tab detection reliability

## [2.4.0] - 2026-05-12

### Added

- Current Video card with real YouTube thumbnail
- Live progress bar under the thumbnail
- Seekable progress bar (drag to seek)
- seekTo command for seeking to specific times

### Changed

- Improved Current Video card layout with thumbnail, title, channel, and progress
- Updated Help section to include Current Video card and Watch History features
- Progress bar now updates live while popup is open

### Fixed

- Thumbnail now uses videoId-based i.ytimg.com URLs instead of generic meta images
- Rejected generic YouTube logo thumbnails (yt_1200.png)
- Progress bar updates without closing and reopening popup
- Long video titles now display in up to 3 lines

## [2.3.0] - 2026-05-12

### Added

- Settings Profiles for global and per-channel speed/volume/mute preferences
- Watch History + Resume
- Popup Size presets
- Help / Usage section

### Changed

- Improved popup UI
- Improved Light/Dark theme switch
- Improved title detection and player-state sync
- Improved debug logging

### Fixed

- Auto-pause on tab switch storage/tab tracking
- False command-failed messages
- Popup Play/Pause state after reopening
- YouTube title detection fallbacks

### Removed

- Theater Mode
- Pin Controller

## [2.2.0] - 2026-05-11

### Fixed

- Content script injection timing for YouTube tabs
- Unsupported Firefox API calls removed
- Message queuing and duplicate listener issues
- URL matching and logging improvements
