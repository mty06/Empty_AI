# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**EmptyButHD** is an Electron desktop application that functions as an AI problem-solving assistant. It integrates Google's Gemini API to provide intelligent responses based on screenshots, text input, and conversation context. The app operates in stealth mode (disguising itself as system processes) and communicates through global keyboard shortcuts.

## Quick Start

### Development
```bash
npm install
npm run dev              # Run with auto-reload (uses electron-reloader)
npm start               # Production run
```

### Building
```bash
npm run build           # Build for current platform
npm run build:mac       # macOS (DMG + ZIP for x64 & arm64)
npm run build:win       # Windows (NSIS + portable for x64 & ia32)
npm run build:linux     # Linux (AppImage + deb for x64)
npm run build:all       # All platforms
npm run clean           # Remove dist/ directory
npm run rebuild         # Clean + build
```

## Architecture

### Core Structure
- **main.js** - Electron main process entry point; ApplicationController manages app lifecycle, IPC handlers, and global shortcuts
- **src/core/** - Core utilities (logger with Winston, config, Electron preload script)
- **src/managers/** - Window manager (multi-window coordination) and session manager (conversation history)
- **src/services/** - Business logic for screenshot capture and Gemini LLM integration
- **src/ui/controllers/** - Renderer process controllers for each window type (chat, main, settings, LLM response)
- **src/utils/** - Prompt loader for skill-based prompting

### Key Design Patterns

#### Window Management
The app maintains multiple windows (main, chat, settings, llm-response) coordinated by `window.manager.js`. Windows communicate via IPC (Electron's Inter-Process Communication). The window manager handles:
- Always-on-top behavior across spaces
- Visibility toggling and window binding (moving windows together)
- Desktop detection for context-aware window placement

#### Session Management
`session.manager.js` maintains conversation history and context. The session includes:
- User inputs (from chat, transcription, LLM requests)
- Model responses with metadata
- Conversation events for system state changes
- Memory optimization for large sessions (stores only recent history for API calls)

#### IPC Communication
Main process exposes handlers via `ipcMain.handle()` for async operations (e.g., screenshot, LLM processing). Renderer processes invoke these via `ipcRenderer.invoke()`. Key IPC events:
- `take-screenshot` - Trigger screenshot + OCR
- `send-chat-message` - Process typed message
- `get-session-history` - Retrieve conversation context
- `update-active-skill` - Switch AI skill mode
- Window control events (visibility, interaction, resize, move)

#### LLM Integration
`llm.service.js` wraps Google Generative AI (Gemini API). It:
- Manages API key configuration
- Processes both text and images with skill context
- Provides fallback responses when API fails
- Includes session history in prompts for context-aware responses
- Supports programming language context (for DSA skill)

#### Skill System
Skills are prompt templates loaded from `public/assets/prompts/`. Currently available:
- `general` - General AI assistance
- `dsa` - Data Structures & Algorithms (supports multiple programming languages: cpp, python, java, js)

When processing with a skill, the LLM service loads the skill prompt and includes it with the user's input.

#### Stealth Mode
The app disguises itself by:
- Setting process title and app name to system process names (Terminal, Activity Monitor, System Settings)
- Hiding from macOS Dock via `app.dock.hide()`
- Disabling Chrome/Electron network noise
- Configurable icon swapping in settings

### IPC Handler Flow Example
1. User presses `Cmd+Shift+S` → global shortcut triggers `triggerScreenshotOCR()`
2. Main process captures screen via `captureService.captureAndProcess()`
3. Screenshot buffer passed to `llmService.processImageWithSkill()` with active skill
4. LLM response sent to all windows via `broadcastToAllWindows("transcription-llm-response", ...)`
5. Chat window displays response to user

## Global Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+S` | Screenshot + OCR |
| `Cmd+Shift+V` | Toggle window visibility |
| `Cmd+Shift+I` | Toggle interaction mode |
| `Cmd+Shift+C` | Switch to chat window |
| `Cmd+Shift+\` | Clear session memory |
| `Cmd+,` | Open settings |
| `Cmd+Shift+Q` | Quit app |
| `Alt+A` | Toggle interaction |
| `Cmd+Shift+T` | Force always-on-top |
| `Cmd+↑` / `Cmd+↓` | Navigate skills (interactive) / Move window (non-interactive) |
| `Cmd+←` / `Cmd+→` | Move window left/right (non-interactive) |

## Configuration

The app stores settings in memory during runtime. Key settings:
- `codingLanguage` - Programming language for DSA skill (default: cpp)
- `activeSkill` - Current skill mode (default: general)
- `appIcon` - Stealth mode appearance (terminal, activity, settings)

Settings are sent to renderer processes via IPC and broadcast to all windows when changed.

## Important Implementation Notes

### Screenshot Capture
- Uses native Electron APIs for cross-platform capture
- Captures current display or selected area
- Falls back gracefully if capture fails
- Image passed as buffer to LLM service for processing

### Session History
- Optimized for memory: `getOptimizedHistory()` returns only recent messages for API calls
- Full history kept for user context but limited in API prompts
- System events logged separately for debugging
- Memory usage tracked via `getMemoryUsage()` on shutdown

### Error Handling
- Errors logged via Winston to console and rotating files
- LLM errors broadcast to chat window for user notification
- Screenshot failures show inline error messages
- Graceful fallback patterns (e.g., missing skill prompt returns null)

### Renderer Preload Security
The preload script (`src/core/preload.js`) exposes controlled IPC API to renderer processes. Only necessary functions should be exposed here to prevent security issues.

## Dependencies

**Key Production Dependencies:**
- `electron` - Desktop app framework
- `@google/generative-ai` - Gemini API client
- `marked` - Markdown parser (for response formatting)
- `prismjs` - Syntax highlighting
- `winston` - Logging with file rotation
- `dotenv` - Environment variable management

**Development:**
- `electron-builder` - App packaging/distribution
- `electron-reloader` - Auto-reload during development

## Debugging

Enable debug logging by checking `logger.debug()` calls throughout. The logger uses Winston with:
- Console output in development
- Daily rotating file logs in production
- Service-specific loggers via `createServiceLogger()`

Check `src/core/logger.js` for logger configuration.

## Platform-Specific Notes

**macOS:**
- App hidden from Dock by default
- Uses hardened runtime and entitlements (config/build/entitlements.mac.plist)
- Supports both Intel (x64) and Apple Silicon (arm64)
- Dock icon updated via `app.dock.setIcon()`

**Windows/Linux:**
- Uses NSIS installer and portable exe (Windows)
- Uses AppImage and deb packages (Linux)
- Window icons set via `window.setIcon()`

## Network Configuration

`setupNetworkConfiguration()` in main.js configures the session to:
- Spoof User-Agent for Google APIs (to avoid detection)
- Handle HTTPS certificate verification for generativelanguage.googleapis.com
- Allow necessary Chromium network features

This is required for Gemini API calls to work reliably in Electron.

## Dock Hiding (macOS)

The app is configured to be completely hidden from the macOS Dock via multiple mechanisms:

1. **Early Hide** - `app.dock.hide()` called at startup before app is ready
2. **Window Configuration** - All windows use `type: 'panel'` on macOS to avoid standard app listing
3. **LSUIElement Flag** - Set in `package.json` under `mac.extendInfo.LSUIElement: true` to mark app as background app (requires rebuild to take effect)
4. **Continuous Enforcement** - Window manager re-enforces dock hiding every 5 seconds to prevent macOS from re-showing the app when windows become active
5. **Focus Management** - Only the main window is focusable; other windows are non-focusable to minimize Dock appearance triggers

For the complete hiding to work in production builds:
```bash
npm run build:mac  # Builds with LSUIElement flag in app Info.plist
```

Note: LSUIElement flag only takes effect when building/running the packaged app. During `npm run dev`, the app may briefly show in Dock when clicked, but hiding should persist during normal usage.
