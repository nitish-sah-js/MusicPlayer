import express, { Request, Response } from "express"
import cors from "cors"
import YTDlpWrap from "yt-dlp-wrap"
import fs from "fs"
import path from "path"

const app = express()
const PORT = 3001

// Middleware
app.use(cors())
app.use(express.json())

// ============ YOUTUBE DOWNLOAD ROUTE ============

// Initialize yt-dlp-wrap with auto-download
const binDir = path.join(__dirname, "../bin")
const tempDir = path.join(__dirname, "../temp")
const ytDlpBinaryPath = path.join(binDir, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp")
const ytDlpWrap = new YTDlpWrap(ytDlpBinaryPath)

// Ensure directories exist

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true })
}
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true })
}

// Download yt-dlp binary if it doesn't exist
;(async () => {
  try {
    if (!fs.existsSync(ytDlpBinaryPath)) {
      console.log("Downloading yt-dlp binary...")
      await YTDlpWrap.downloadFromGithub(ytDlpBinaryPath)
      console.log("yt-dlp binary downloaded successfully")
    } else {
      console.log("yt-dlp binary already exists")
    }
  } catch (error) {
    console.error("Failed to download yt-dlp binary:", error)
  }
})()

app.post("/api/youtube/download-audio", async (req: Request, res: Response) => {
  let outputPath: string | null = null

  try {
    const { videoId } = req.body

    if (!videoId) {
      return res.status(400).json({ error: "Video ID is required" })
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

    // Generate unique filename
    const timestamp = Date.now()
    const filename = `${videoId}_${timestamp}.m4a`
    outputPath = path.join(tempDir, filename)

    console.log(`Downloading audio for ${videoId}...`)

    // Download using yt-dlp-wrap
    await ytDlpWrap.execPromise([
      videoUrl,
      "-f", "bestaudio[ext=m4a]/bestaudio",
      "-o", outputPath,
      "--no-playlist",
      "--quiet",
      "--no-warnings"
    ])

    // Check if file was created
    if (!fs.existsSync(outputPath)) {
      throw new Error("Download failed: output file not created")
    }

    // Get file stats
    const stats = fs.statSync(outputPath)
    console.log(`Download complete: ${stats.size} bytes`)

    // Set response headers
    res.setHeader("Content-Type", "audio/mp4")
    res.setHeader("Content-Disposition", `attachment; filename="${videoId}.m4a"`)
    res.setHeader("Content-Length", stats.size)

    // Stream file to response
    const fileStream = fs.createReadStream(outputPath)
    fileStream.pipe(res)

    // Clean up file after streaming
    fileStream.on("end", () => {
      if (outputPath && fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath)
        console.log(`Cleaned up temp file: ${outputPath}`)
      }
    })

    // Handle stream errors
    fileStream.on("error", (error) => {
      console.error("Stream error:", error)
      if (outputPath && fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath)
      }
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to stream audio" })
      }
    })

  } catch (error: any) {
    console.error("YouTube download error:", error)

    // Clean up temp file on error
    if (outputPath && fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath)
    }

    if (!res.headersSent) {
      if (error.message.includes("Video unavailable") || error.message.includes("not available")) {
        return res.status(404).json({ error: "Video not found or unavailable" })
      }

      res.status(500).json({
        error: "Failed to download audio",
        details: error.message,
      })
    }
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
