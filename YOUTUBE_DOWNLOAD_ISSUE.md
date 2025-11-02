# YouTube Download Feature Issue

## Problem
The YouTube audio download feature is currently not working due to limitations with the `@distube/ytdl-core` library.

### Error Details
```
WARNING: Could not parse decipher function.
Stream URLs will be missing.

WARNING: Could not parse n transform function.

Stream error: MinigetError: Status code: 403
```

## Root Cause
YouTube frequently updates their player code to prevent scraping and downloads. The `ytdl-core` family of libraries (including `@distube/ytdl-core`) relies on parsing YouTube's player JavaScript to extract video stream URLs. When YouTube updates their player, these libraries break until they're updated.

This is an ongoing cat-and-mouse game between ytdl-core maintainers and YouTube.

## Current Status
- **Backend endpoint**: `/api/youtube/download-audio` is implemented but returns 403 errors
- **Frontend UI**: Download button is present with legal disclaimer modal
- **Library version**: `@distube/ytdl-core@4.16.12` (latest as of implementation)

## Solutions

### Option 1: Use yt-dlp (Recommended)
`yt-dlp` is a more actively maintained fork of youtube-dl written in Python. It's more reliable than Node.js ytdl libraries.

**Steps**:
1. Install yt-dlp: `pip install yt-dlp` or download the executable
2. Update backend to use child_process to call yt-dlp
3. Example implementation:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

app.post("/api/youtube/download-audio", async (req, res) => {
  const { videoId } = req.body;
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const outputPath = `./temp/${videoId}.m4a`;
    await execAsync(`yt-dlp -f bestaudio -o "${outputPath}" "${videoUrl}"`);
    res.download(outputPath);
  } catch (error) {
    res.status(500).json({ error: 'Download failed' });
  }
});
```

### Option 2: Use Cookies for Authentication
YouTube is more lenient with authenticated requests. You can export your YouTube cookies and use them with ytdl-core.

**Steps**:
1. Export cookies from your browser (use extension like "Get cookies.txt")
2. Pass cookies to ytdl-core:

```typescript
import fs from 'fs';

const ytdlOptions = {
  quality: 'highestaudio',
  filter: 'audioonly',
  requestOptions: {
    headers: {
      cookie: fs.readFileSync('./youtube-cookies.txt', 'utf8')
    }
  }
};
```

### Option 3: Use YouTube API
Use the official YouTube Data API v3 to get video metadata, but note that Google doesn't officially support downloading videos.

### Option 4: Client-Side Download (Not Recommended)
Use browser extensions or client-side tools, but this defeats the purpose of a server-side solution.

### Option 5: Wait for Library Updates
Monitor the @distube/ytdl-core GitHub repository for updates:
- https://github.com/distubejs/ytdl-core/issues

## Recommendation
For production use, **Option 1 (yt-dlp)** is recommended because:
- More actively maintained
- Better at handling YouTube updates
- More robust error handling
- Supports many more sites than just YouTube

## Temporary Workaround
The feature can remain in the UI with a notice that it's temporarily unavailable due to YouTube's restrictions. Users can:
1. Use the YouTube player in the app to practice
2. Use Local Files player for downloaded audio
3. Download videos manually using external tools

## Legal Note
Remember that downloading YouTube videos may violate YouTube's Terms of Service. The disclaimer modal in the app addresses this, but users should be aware of the risks.
