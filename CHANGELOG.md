# Changelog

All notable changes to the YouTube Button Controller extension.

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
