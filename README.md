# Music Speed Controller

A professional web-based music practice tool for slowing down, speeding up, and manipulating audio with crystal-clear quality. Perfect for musicians, dancers, language learners, and anyone who needs precise control over audio playback.

## Features

### 🎵 Dual Player Modes

#### YouTube Player
- Direct YouTube video playback with speed control
- A-B loop repeat functionality
- Speed range: 0.25x to 2x
- Keyboard shortcuts for efficient control

#### Local File Player
- Professional audio processing with **Tone.js**
- **Zero artifacts** pitch-preserved time-stretching
- Drag-and-drop file upload
- Visual waveform display with **WaveSurfer.js**
- Advanced audio manipulation controls

### ⚡ Advanced Features

#### Audio Controls
- **Speed Control**: 0.25x - 2x with fine-tune mode (hold Shift for 10x precision)
- **Pitch Shifting**: ±12 semitones with independent tempo control
- **Volume Control**: Smooth volume adjustment
- **A-B Loop Repeat**: Set custom loop points for practice
- **Visual Loop Markers**: See loop points directly on waveform

#### User Experience
- **Click-to-Seek**: Click anywhere on waveform to jump to that position
- **Named Speed Presets**: Quick access to common speeds (Super Slow, Practice, Normal, Fast, etc.)
- **Visual Feedback**: Toast notifications for all actions
- **Keyboard Shortcuts**: Comprehensive keyboard controls for hands-free operation
- **Dark/Light Mode**: Beautiful themes for any lighting condition
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile

#### Audio Export
- Export modified audio with FFmpeg processing
- Maintain speed changes in exported files
- Multiple format support: MP3, WAV, OGG
- Browser-based processing (no server required)

#### Quality & Reliability
- **Format Detection**: Automatically detects supported audio formats
- **Error Handling**: Comprehensive validation and recovery
- **Memory Optimization**: Proper resource cleanup
- **Loading Indicators**: Clear progress feedback
- **File Validation**: Size limits and type checking

## Tech Stack

### Frontend
- **React 19** - Modern UI framework
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first styling with dark mode

### Audio Processing
- **Tone.js** - Professional Web Audio API library for pitch-shifting
- **WaveSurfer.js** - Audio waveform visualization
- **FFmpeg.js** - Browser-based audio export
- **react-youtube** - YouTube player integration

### Backend (Optional)
- **Express** - REST API server
- **SQLite** (better-sqlite3) - Local database
- **JWT** - Authentication
- **@distube/ytdl-core** - YouTube audio download

## Installation

### Prerequisites
- Node.js 18+ and npm

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd musicPlayer
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies (optional):
```bash
cd server
npm install
```

4. Create `.env` file in `server/` directory (if using backend):
```env
PORT=3001
JWT_SECRET=your_secret_key_here
```

## Development

### Run Frontend
```bash
npm run dev
```
Opens at `http://localhost:5173`

### Run Backend (Optional)
```bash
cd server
npm run dev
```
Runs at `http://localhost:3001`

### Build for Production
```bash
npm run build
npm run preview
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `←` `→` | Seek backward / forward 5 seconds |
| `↑` `↓` | Increase / decrease speed by 0.25x |
| `1-8` | Set speed preset (0.25x - 2x) |
| `A` | Set loop start point (Point A) |
| `B` | Set loop end point (Point B) |
| `C` | Clear loop |
| `R` | Reset speed & pitch to normal |
| `L` | Toggle loop on/off |
| `M` | Mute / Unmute |
| `?` | Show keyboard shortcuts help |
| `Shift` + Drag | Fine-tune mode on sliders (10x precision) |

## Usage

### Local Files

1. **Upload Audio**: Drag & drop or click to browse for audio files
2. **Adjust Speed**: Use slider or preset buttons (0.25x - 2x)
3. **Change Pitch**: Shift pitch ±12 semitones independently
4. **Set Loops**: Press `A` at start point, `B` at end point
5. **Click Waveform**: Jump to any position by clicking
6. **Fine-Tune**: Hold Shift while dragging sliders for precision control
7. **Export**: Download your modified audio as MP3, WAV, or OGG

### YouTube Videos

1. **Paste URL**: Enter YouTube video URL
2. **Control Playback**: Use speed slider and loop controls
3. **Note**: YouTube doesn't support independent pitch control

## Supported Audio Formats

The app automatically detects your browser's supported formats. Common formats include:
- MP3
- WAV
- OGG
- M4A/AAC
- FLAC
- WebM

## Project Structure

```
musicPlayer/
├── src/
│   ├── components/
│   │   ├── LocalFilePlayer.tsx      # Main local audio player
│   │   ├── YouTubePlayer.tsx        # YouTube player interface
│   │   └── KeyboardShortcutsHelp.tsx # Shortcuts modal
│   ├── hooks/
│   │   ├── useTonePlayer.ts         # Tone.js audio engine
│   │   └── useFFmpeg.ts             # FFmpeg export logic
│   ├── contexts/
│   │   └── ThemeContext.tsx         # Dark/light mode
│   ├── App.tsx                      # Main app component
│   └── main.tsx                     # Entry point
├── server/                          # Optional backend
│   ├── src/
│   │   ├── index.ts                 # Express server
│   │   ├── database.ts              # SQLite setup
│   │   └── auth.ts                  # JWT middleware
│   └── package.json
├── public/                          # Static assets
├── CLAUDE.md                        # AI assistant context
└── README.md                        # This file
```

## How It Works

### Audio Processing Pipeline

**Local Files (Tone.js Mode)**:
```
File → AudioBuffer → Tone.Player → Tone.PitchShift → Tone.Volume → Destination
                          ↓
                    WaveSurfer (visualization only)
```

1. **Loading**: Audio file decoded to AudioBuffer via Web Audio API
2. **Playback**: Tone.Player handles tempo/speed changes
3. **Pitch**: Tone.PitchShift provides artifact-free pitch shifting
4. **Volume**: Tone.Volume controls gain
5. **Visualization**: WaveSurfer displays waveform, synced with Tone.js playback
6. **Looping**: Custom loop logic checks playback position every 50ms

### Export Process
1. User selects tempo and format
2. FFmpeg.js loads in browser (WASM)
3. Audio processed with `atempo` filters
4. Speeds outside 0.5-2.0x use chained filters
5. Output downloaded as selected format

## Performance Optimizations

- **Lazy Loading**: FFmpeg loads on-demand
- **Resource Cleanup**: Proper disposal of audio nodes and waveforms
- **Error Recovery**: Comprehensive try-catch with user-friendly messages
- **Memory Management**: Cleanup on component unmount
- **HMR**: Fast hot module replacement in development

## Browser Support

- **Modern Browsers**: Chrome, Firefox, Edge, Safari (latest versions)
- **Web Audio API**: Required for Tone.js
- **File API**: For drag-and-drop uploads
- **WASM**: For FFmpeg export functionality

## Troubleshooting

### Audio won't load
- Check file format is supported by your browser
- File size limit: 500MB
- Try refreshing the page

### Export not working
- Ensure FFmpeg has loaded (check loading indicator)
- Refresh page if FFmpeg fails to load
- Check browser console for errors

### Poor audio quality
- Tone.js provides professional-grade processing
- Extreme speed/pitch changes may affect quality
- Try smaller adjustments for best results

## Future Improvements

Planned features:
- Save/load user presets to localStorage
- Audio file history/library
- 3-band equalizer (EQ)
- Metronome overlay with BPM control
- Reverse playback feature
- Multiple loop points (A-B-C-D) system

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

This project is open source and available under the MIT License.

## Credits

Built with:
- [Tone.js](https://tonejs.github.io/) - Web Audio framework
- [WaveSurfer.js](https://wavesurfer-js.org/) - Audio visualization
- [FFmpeg.js](https://github.com/ffmpegwasm/ffmpeg.wasm) - Audio processing
- [React](https://react.dev/) - UI framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Vite](https://vitejs.dev/) - Build tool

---

Made with ♥ for musicians and audio enthusiasts
