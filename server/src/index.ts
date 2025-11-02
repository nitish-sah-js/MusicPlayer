import express, { Request, Response } from "express"
import cors from "cors"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import ytdl from "@distube/ytdl-core"
import YTDlpWrap from "yt-dlp-wrap"
import fs from "fs"
import path from "path"
import db from "./database"
import { verifyToken, AuthRequest } from "./auth"

// Load environment variables
require("dotenv").config()

const app = express()
const PORT = process.env.JWT_SECRET ? process.env.PORT || 3001 : 3001

// Middleware
app.use(cors())
app.use(express.json())

// ============ AUTH ROUTES ============

// Signup
app.post("/api/auth/signup", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Insert user
    const stmt = db.prepare(
      "INSERT INTO users (username, password) VALUES (?, ?)"
    )
    const result = stmt.run(username, hashedPassword)

    // Generate token
    const token = jwt.sign(
      { userId: result.lastInsertRowid },
      process.env.JWT_SECRET || "secret"
    )

    res.json({
      token,
      user: {
        id: result.lastInsertRowid,
        username,
      },
    })
  } catch (error: any) {
    if (error.message.includes("UNIQUE constraint failed")) {
      return res.status(400).json({ error: "Username already exists" })
    }
    res.status(500).json({ error: "Server error" })
  }
})

// Login
app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body

    const user = db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username) as any

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const validPassword = await bcrypt.compare(password, user.password)

    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || "secret"
    )

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Get current user
app.get("/api/auth/me", verifyToken, (req: AuthRequest, res: Response) => {
  try {
    const user = db
      .prepare("SELECT id, username FROM users WHERE id = ?")
      .get(req.userId) as any

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    res.json({ user })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// ============ PRESETS ROUTES ============

// Get all presets for user
app.get("/api/presets", verifyToken, (req: AuthRequest, res: Response) => {
  try {
    const presets = db
      .prepare(
        "SELECT * FROM presets WHERE user_id = ? ORDER BY created_at DESC"
      )
      .all(req.userId)
    res.json({ presets })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Create preset
app.post("/api/presets", verifyToken, (req: AuthRequest, res: Response) => {
  try {
    const { name, speed, loop_start, loop_end, video_url } = req.body

    const stmt = db.prepare(
      "INSERT INTO presets (user_id, name, speed, loop_start, loop_end, video_url) VALUES (?, ?, ?, ?, ?, ?)"
    )
    const result = stmt.run(
      req.userId,
      name,
      speed,
      loop_start,
      loop_end,
      video_url
    )

    const preset = db
      .prepare("SELECT * FROM presets WHERE id = ?")
      .get(result.lastInsertRowid)

    res.json({ preset })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Update preset
app.put("/api/presets/:id", verifyToken, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, speed, loop_start, loop_end, video_url } = req.body

    const stmt = db.prepare(
      "UPDATE presets SET name = ?, speed = ?, loop_start = ?, loop_end = ?, video_url = ? WHERE id = ? AND user_id = ?"
    )
    stmt.run(name, speed, loop_start, loop_end, video_url, id, req.userId)

    const preset = db.prepare("SELECT * FROM presets WHERE id = ?").get(id)

    res.json({ preset })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Delete preset
app.delete(
  "/api/presets/:id",
  verifyToken,
  (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params

      db.prepare("DELETE FROM presets WHERE id = ? AND user_id = ?").run(
        id,
        req.userId
      )

      res.json({ success: true })
    } catch (error) {
      res.status(500).json({ error: "Server error" })
    }
  }
)

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
