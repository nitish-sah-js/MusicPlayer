import express, { Request, Response } from "express"
import cors from "cors"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import ytdl from "@distube/ytdl-core"
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

app.post("/api/youtube/download-audio", async (req: Request, res: Response) => {
  try {
    const { videoId, quality = "highestaudio" } = req.body

    if (!videoId) {
      return res.status(400).json({ error: "Video ID is required" })
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

    // Validate video exists and is accessible
    const info = await ytdl.getInfo(videoUrl)
    const videoTitle = info.videoDetails.title
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()

    // Set response headers for audio download
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${videoTitle}.m4a"`
    )
    res.setHeader("Content-Type", "audio/mp4")

    // Stream audio directly to response
    const audioStream = ytdl(videoUrl, {
      quality: quality as any,
      filter: "audioonly",
    })

    audioStream.pipe(res)

    // Handle errors
    audioStream.on("error", (error) => {
      console.error("Stream error:", error)
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to download audio" })
      }
    })
  } catch (error: any) {
    console.error("YouTube download error:", error)

    if (!res.headersSent) {
      if (error.message.includes("Video unavailable")) {
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
