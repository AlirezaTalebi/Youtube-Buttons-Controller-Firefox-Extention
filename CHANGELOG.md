# Changelog

All notable changes to the YouTube Button Controller extension.

## [2.2.0] - 2026-05-11

### Fixed

- **Critical**: Content script injection issue on YouTube tabs
  - Changed `run_at` from `document_end` to `document_start` for proper injection timing
  - YouTube is a Single-Page App (SPA) that never reaches idle state; `document_start` ensures injection before page initialization
- Removed unsupported `browser.scripting.executeScript()` API calls (not yet available in Firefox)
- Implemented intelligent message queuing system for commands arriving before controller initialization
- Enhanced URL pattern matching to catch all YouTube pages (changed from `/watch*` pattern to broader `/*` pattern)
- Fixed duplicate message listener registration
- Improved error handling and logging throughout

### Improved

- Message handling system now queues commands and processes them sequentially
- Better error reporting and console logging for debugging
- Extension now works reliably with YouTube tabs open and playing (no refresh needed)

## [2.0.0] - 2025-07-31

### Added

- Dark Mode enabled by default
- Complete keyboard shortcuts system
- Auto-detection of YouTube tabs
- Auto-pause when switching tabs
- Visual seek bar with click-to-seek
- Speed control (0.25x to 2x)
- Enhanced volume controls
- Settings modal
- GPL-3.0 License

## [1.0.0] - Previous Version - 18.01.2024

- Basic YouTube video controls
- Simple popup interface
- Limited keyboard shortcuts
