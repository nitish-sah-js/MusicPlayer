# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Music Speed Controller is a web application for practicing music at variable speeds. It supports both YouTube videos and local audio files with A-B repeat looping and audio export capabilities.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS (dark mode support via class-based theming)
- **Backend**: Express + TypeScript with better-sqlite3 + @distube/ytdl-core
- **Audio Processing**:
  - WaveSurfer.js for local audio visualization
  - rubberband-web for professional pitch-preserved audio playback (Web Audio API + WASM)
  - react-youtube for YouTube video playback
  - FFmpeg (browser-based via @ffmpeg/ffmpeg) for audio export with speed modifications

## Development Commands

### Frontend (root directory)
```bash
npm run dev          # Start Vite dev server (default: http://localhost:5173)
npm run build        # TypeScript compile + Vite production build
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Backend (server directory)
```bash
cd server
npm run dev          # Start nodemon with ts-node (watches src/, runs on http://localhost:3001)
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled JavaScript from dist/
```

## Architecture

### Frontend Structure

**Player Components**:
- `YouTubePlayer.tsx`: YouTube video playback using react-youtube wrapper, implements custom controls with speed and A-B loop
- `LocalFilePlayer.tsx`: Dual-mode audio player with:
  - **Quick Preview Mode**: WaveSurfer.js with browser's basic time-stretching (instant playback, may have artifacts)
  - **Studio Quality Mode**: rubberband-web with professional Rubber Band algorithm (zero artifacts, perfect pitch preservation)
  - Drag-and-drop file upload, waveform visualization, A-B loop, and FFmpeg export
- `KeyboardShortcutsHelp.tsx`: Modal component displaying all available keyboard shortcuts with responsive design

**Core Functionality**:
- `useFFmpeg.ts`: Hook managing FFmpeg WASM loading and audio export. Uses chained `atempo` filters for speeds outside 0.5-2.0 range
- `useRubberBand.ts`: Hook managing Rubber Band Web Audio API node for professional pitch-preserved playback with looping support
- `ThemeContext.tsx`: Dark/light mode theme management

**Note**: Authentication system is fully implemented (AuthContext, JWT, backend routes) but currently not actively used in the main player UI. The infrastructure exists for future user accounts and preset saving features.

### Backend Structure

The server uses a monolithic Express architecture with all routes in `index.ts`:

**Database** (`database.ts`):
- SQLite database with two tables: `users` and `presets`
- Foreign key constraints enabled
- Presets store speed, loop points (start/end), and optional video URL
- Database file: `server/database.db`

**Authentication** (`auth.ts`):
- JWT-based auth with bcrypt password hashing
- `verifyToken` middleware adds `userId` to request object
- Token stored in localStorage on client, sent via Authorization header

**API Endpoints**:
- `/api/auth/signup` - Create user account
- `/api/auth/login` - Authenticate user
- `/api/auth/me` - Get current user (requires auth)
- `/api/presets` - CRUD operations for user's saved speed/loop presets (all require auth)
- `/api/youtube/download-audio` - Download YouTube video audio as M4A file (uses @distube/ytdl-core)

### Key Design Patterns

**A-B Loop Implementation**:
Both players implement A-B repeat looping by:
1. Setting loop start point (Point A) at current playback time
2. Setting loop end point (Point B) after Point A
3. During playback, checking if current time >= loop end, then seeking back to loop start
4. YouTube version uses polling interval, WaveSurfer uses `audioprocess` event

**Pitch Preservation**:
- **Local Files - Quick Preview Mode**: Uses WaveSurfer's `setPlaybackRate(speed, true)` with browser's basic time-stretching (may have robotic/artificial artifacts)
- **Local Files - Studio Quality Mode**: Uses Rubber Band library via rubberband-web (professional frequency-domain algorithm, zero artifacts, same quality as competitors)
- **YouTube**: Native API doesn't support pitch preservation - displays warning notice to users when speed ≠ 1x

**Rubber Band Integration** (Studio Quality Mode):
- Uses `rubberband-web` npm package (GPL-2.0 license, free/open-source)
- Requires `public/rubberband-processor.js` AudioWorklet processor file
- Web Audio API architecture: AudioBuffer → AudioBufferSourceNode → RubberBandNode → AudioContext.destination
- Supports real-time tempo changes via `setTempo()`, maintains pitch at 1.0 via `setPitch(1.0)`
- WaveSurfer used only for waveform visualization (seekTo synced with Rubber Band playback position)
- Small loading delay (1-2 seconds) when switching to Studio mode or loading new audio
- A-B loop implemented by checking playback time and seeking back to loop start

**FFmpeg Audio Export**:
- FFmpeg loads asynchronously via CDN (unpkg.com) as WASM
- Speed changes applied via `atempo` filter (supports 0.5-2.0x)
- Extreme speeds use chained filters (e.g., 0.25x = atempo=0.5,atempo=0.5)
- Exports to MP3, WAV, or OGG format

**YouTube Audio Download**:
- Backend endpoint `/api/youtube/download-audio` streams YouTube audio using @distube/ytdl-core
- Accepts `videoId` and optional `quality` parameter (defaults to "highestaudio")
- Returns M4A audio file with sanitized video title as filename
- Validates video availability before streaming

**Keyboard Shortcuts**:
Both players support comprehensive keyboard controls:
- Space: Play/Pause
- Arrow keys: Left/Right (seek ±5s), Up/Down (speed ±0.25x)
- 1-8: Speed presets (0.25x - 2x)
- A/B/C: Set loop start, set loop end, clear loop
- ?: Toggle shortcuts help modal
- Event listeners filter out input fields to prevent conflicts

**Authentication Flow**:
1. User logs in/signs up via `AuthModal`
2. Backend returns JWT token
3. Token stored in localStorage and added to all API requests
4. On app load, `AuthContext` attempts to fetch user with stored token
5. Invalid/missing token results in unauthenticated state

## Environment Setup

Create `.env` file in `server/` directory:
```
PORT=3001
JWT_SECRET=your_secret_key_here
```

**Important Vite Configuration**:
- FFmpeg dependencies (`@ffmpeg/ffmpeg`, `@ffmpeg/util`) are excluded from Vite's optimization to prevent bundling issues
- See `vite.config.ts` for configuration details

## Common Patterns

**Component State Management**:
- Local state for UI (speed, loop points, playback state)
- Context for global state (auth, theme)
- No state management library - using built-in React context

**TypeScript Interfaces**:
- Shared types defined in `api/client.ts` (User, Preset)
- Backend uses `any` type casts for database queries (better-sqlite3 doesn't provide typed results out of box)
- Express extended with `AuthRequest` interface for authenticated routes

**Tailwind Theming**:
- Uses `class`-based dark mode (not media query)
- Theme toggle in header applies/removes `dark` class on document element
- Components use conditional classes: `dark:` and `light:` variants

**Responsive Design**:
- Mobile-first approach using Tailwind's `sm:` breakpoint (640px)
- Key responsive patterns:
  - Typography: `text-sm sm:text-base md:text-lg`
  - Spacing: `gap-2 sm:gap-3 md:gap-4`
  - Grids: `grid-cols-4 sm:grid-cols-8` (speed presets)
  - Conditional content: Labels shortened or hidden on mobile
  - Touch targets: Larger on mobile for better usability
- All components (App, YouTubePlayer, LocalFilePlayer, KeyboardShortcutsHelp) fully responsive
- Mobile optimizations: vertical layouts, compact UI, truncated text
