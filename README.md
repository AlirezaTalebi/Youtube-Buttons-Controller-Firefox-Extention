# YouTube Button Controller

Firefox extension for controlling YouTube playback from the popup and keyboard shortcuts.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Firefox](https://img.shields.io/badge/Firefox-Supported-orange.svg)](https://www.mozilla.org/firefox/)

## Current Version

2.4.0

## Features

- Current Video card with real YouTube thumbnail
- Live seekable progress bar
- Play/Pause
- Previous/Next
- Mute
- Speed controls
- Volume controls
- Auto-pause on tab switch
- Settings Profiles
- Watch History + Resume
- Popup Size presets
- Light/Dark theme
- Help section
- Debug logs

## Removed

- Theater Mode
- Pin Controller

## Install in Firefox

[Install from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/youtube-button-controller/)

Or install locally for development:

1. Open Firefox and go to `about:debugging`
2. Click `This Firefox`
3. Click `Load Temporary Add-on`
4. Select `manifest.json`

## Test

1. Open a YouTube video.
2. Use the popup controls and keyboard shortcuts.
3. Switch tabs to confirm auto-pause.
4. Save and apply profiles from the popup.
5. Reopen the popup to confirm player-state sync.

## Debug Logs

Read logs:

```javascript
await browser.storage.local.get("ytControllerDebugLog")
```

Clear logs:

```javascript
await browser.storage.local.remove("ytControllerDebugLog")
```

## License

GPL-3.0
