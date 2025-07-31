# YouTube Button Controller

A powerful Firefox extension for advanced YouTube video control with keyboard shortcuts and enhanced features.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Firefox](https://img.shields.io/badge/Firefox-Supported-orange.svg)](https://www.mozilla.org/firefox/)

## Features

### Media Controls
- **Play/Pause Control**: Toggle video playback with one click
- **Volume Management**: Adjust volume with buttons or keyboard shortcuts
- **Speed Control**: Change playback speed from 0.25x to 2x
- **Seek Controls**: Skip forward/backward, next/previous video
- **Mute/Unmute**: Quick audio toggle

### Enhanced Experience
- **Theater Mode**: Toggle YouTube's theater mode
- **Dark Mode**: Beautiful dark theme (enabled by default)
- **Seek Bar**: Visual progress bar with click-to-seek functionality
- **Auto-Detection**: Automatically find and connect to YouTube tabs
- **Auto-Pause**: Pause videos when switching tabs

### Keyboard Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Alt+P` | Play/Pause | Toggle video playback |
| `Ctrl+Alt+S` | Stop Video | Stop current video |
| `Ctrl+Alt+R` | Restart Video | Restart from beginning |
| `Ctrl+Alt+M` | Mute/Unmute | Toggle audio |
| `Ctrl+Alt+↑` | Volume Up | Increase volume by 10% |
| `Ctrl+Alt+↓` | Volume Down | Decrease volume by 10% |
| `Ctrl+Alt+T` | Theater Mode | Toggle theater view |
| `Ctrl+Alt+.` | Speed Up | Increase playback speed |
| `Ctrl+Alt+,` | Speed Down | Decrease playback speed |
| `Ctrl+Alt+→` | Next Video | Go to next video |
| `Ctrl+Alt+←` | Previous Video | Go to previous video |
| `Ctrl+Alt+F` | Skip Forward | Skip forward 10 seconds |
| `Ctrl+Alt+B` | Skip Backward | Skip backward 10 seconds |

## 📦 Installation

### Option 1: Install from Firefox Add-ons Store (Recommended)

**[📥 Install YouTube Button Controller for Firefox](https://addons.mozilla.org/en-US/firefox/addon/youtube-button-controller/)**

### Option 2: Manual Installation for Development

1. **Download the Extension**
   ```bash
   git clone https://github.com/AlirezaTalebi/Youtube-Buttons-Controller-Firefox-Extention.git
   cd Youtube-Buttons-Controller-Firefox-Extention
   ```

2. **Load in Firefox**
   - Open Firefox
   - Navigate to `about:debugging`
   - Click **"This Firefox"**
   - Click **"Load Temporary Add-on"**
   - Select the `manifest.json` file from the extension folder

3. **Verify Installation**
   - The extension icon should appear in your toolbar
   - Visit any YouTube video to test functionality

## 🎯 Usage

### Quick Start
1. Navigate to any YouTube video page
2. Click the extension icon in your toolbar
3. The extension will automatically detect and connect to the YouTube tab
4. Use the popup interface or keyboard shortcuts to control playback

### Settings Configuration
- Access settings through the extension popup
- Customize volume steps, update intervals, and behavior
- Toggle dark mode, auto-detection, and auto-pause features
## Configuration Options

- **Auto-detect YouTube tabs**: Automatically find and connect to YouTube videos
- **Auto-pause on tab switch**: Pause videos when switching to other tabs  
- **Dark mode**: Toggle dark theme for the extension popup (default: enabled)
- **Volume step**: Set volume change amount (5%, 10%, 15%, 20%)
- **Update interval**: Set how often video information updates

## Technical Details

**Browser Compatibility:** Firefox (Manifest V2) - Fully supported

**System Requirements:** Firefox 89.0 or later

## License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.

You are free to use, study, modify, and distribute this software. For full license details, see the [LICENSE](LICENSE) file.

## Contributing

Contributions are welcome! Here's how you can help:

- Report bugs via GitHub Issues
- Suggest features and improvements
- Submit pull requests with fixes or features
- Test on different Firefox versions

## Support

Need help or found a bug? [Report issues on GitHub](https://github.com/AlirezaTalebi/Youtube-Buttons-Controller-Firefox-Extention)

---

**Made by [Alireza Talebi](https://github.com/AlirezaTalebi/Youtube-Buttons-Controller-Firefox-Extention)**
