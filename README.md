# Nostr WebSocket Inspector

A Chrome/Brave/Edge DevTools extension for inspecting Nostr WebSocket traffic.

## Setup

### Install Dependencies
```bash
yarn install
```

### Build the Extension
```bash
yarn build
```

### Load in Browser
1. Open your browser and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select this project directory (not `src/`, the root)
5. The extension should now appear in your extensions list

### Open the DevTools Panel
1. Navigate to any Nostr web app (e.g., https://jumble.social, https://treasures.to)
2. Open DevTools (F12 or right-click → Inspect)
3. Click the **"Nostr"** tab in DevTools
4. Click **"Start Inspecting"** to begin capturing WebSocket traffic

## Development Workflow

### Auto-rebuild on Changes
```bash
yarn watch  # automatically rebuilds when you edit TypeScript files
```

### Viewing Your Changes
After making changes, you **must** follow this "reload dance" to see updates:

1. **Rebuild** - Run `yarn build` (or let `yarn watch` do it)
2. **Reload Extension** - Go to `chrome://extensions/` and click the reload icon ↻ on the extension
3. **Close DevTools Completely** - Don't just refresh the page, actually close the DevTools panel
4. **Reopen DevTools** - Press F12 again and go to the Nostr tab

**Why?** The browser aggressively caches the DevTools panel HTML. Simply refreshing won't load your changes.

### Common Development Commands
```bash
yarn build       # Build once
yarn watch       # Auto-rebuild on file changes
```

## Features

- **Event Stream** - Real-time view of all Nostr WebSocket traffic
- **Summary** - Aggregate statistics and sample events by kind
- **Build** - List of all event kinds used with links to NIP documentation
- **Filters** - Filter by event kind, pause/resume, expand events
- **Manual Inspection** - Control when the debugger attaches to avoid intrusive browser warnings

## Debugging

### Background Service Worker
To see logs from `bg.js`:
1. Go to `chrome://extensions/`
2. Find "Nostr WS Inspector"
3. Click "service worker" (or "Inspect views: service worker")
4. This opens the console for the background script

### DevTools Panel
Console logs from `panel.js` appear in the **DevTools console of the page you're inspecting** (not the extension's console).

## Project Structure

- `src/` - TypeScript source files
- `store-assets/` - Marketing assets for Chrome Web Store submission
  - `marquee-promo-tile.jpg` - Marquee promotional tile (440x280px)
  - `small-promo-tile.jpg` - Small promotional tile (920x680px)
  - Screenshots for store listing
- `screenshots/` - Development and testing screenshots
