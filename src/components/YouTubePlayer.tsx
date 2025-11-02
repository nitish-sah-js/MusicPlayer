import { useState, useRef, useEffect } from 'react'
import YouTube from 'react-youtube'
import type { YouTubeProps, YouTubePlayer } from 'react-youtube'
import { Play, Pause, SkipBack, SkipForward, Repeat, Keyboard, Download } from 'lucide-react'
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp'

export default function YouTubePlayer() {
  const [videoUrl, setVideoUrl] = useState('')
  const [videoId, setVideoId] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [loopStart, setLoopStart] = useState<number | null>(null)
  const [loopEnd, setLoopEnd] = useState<number | null>(null)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [hasAcceptedDisclaimer, setHasAcceptedDisclaimer] = useState(false)
  const playerRef = useRef<YouTubePlayer | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingSeekRef = useRef<number>(0)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input field
      if (e.target instanceof HTMLInputElement) return

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault()
          togglePlayPause()
          break
        case 'arrowleft':
          e.preventDefault()
          handleSeek(-5)
          break
        case 'arrowright':
          e.preventDefault()
          handleSeek(5)
          break
        case 'arrowup':
          e.preventDefault()
          handleSpeedChange(Math.min(speed + 0.25, 2))
          break
        case 'arrowdown':
          e.preventDefault()
          handleSpeedChange(Math.max(speed - 0.25, 0.25))
          break
        case 'a':
          e.preventDefault()
          handleSetLoopStart()
          break
        case 'b':
          e.preventDefault()
          handleSetLoopEnd()
          break
        case 'c':
          e.preventDefault()
          handleClearLoop()
          break
        case '1':
          handleSpeedChange(0.25)
          break
        case '2':
          handleSpeedChange(0.5)
          break
        case '3':
          handleSpeedChange(0.75)
          break
        case '4':
          handleSpeedChange(1)
          break
        case '5':
          handleSpeedChange(1.25)
          break
        case '6':
          handleSpeedChange(1.5)
          break
        case '7':
          handleSpeedChange(1.75)
          break
        case '8':
          handleSpeedChange(2)
          break
        case '?':
          e.preventDefault()
          setShowShortcutsHelp(prev => !prev)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [speed, isPlaying, currentTime, loopStart, loopEnd])

  // Extract video ID from YouTube URL
  const extractVideoId = (url: string): string => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return ''
  }

  const handleLoadVideo = () => {
    const id = extractVideoId(videoUrl)
    if (id) {
      setVideoId(id)
    } else {
      alert('Invalid YouTube URL. Please enter a valid URL or video ID.')
    }
  }

  const onReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target
    setDuration(event.target.getDuration())
  }

  const onStateChange: YouTubeProps['onStateChange'] = (event) => {
    setIsPlaying(event.data === 1)
  }

  const togglePlayPause = () => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pauseVideo()
      } else {
        playerRef.current.playVideo()
      }
    }
  }

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed)
    if (playerRef.current) {
      playerRef.current.setPlaybackRate(newSpeed)
    }
  }

  const handleSeek = (seconds: number) => {
    if (!playerRef.current) return

    // Accumulate seek requests
    pendingSeekRef.current += seconds

    // Clear existing timeout
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current)
    }

    // Debounce: apply the accumulated seek after a short delay
    seekTimeoutRef.current = setTimeout(() => {
      if (playerRef.current) {
        const currentPlayerTime = playerRef.current.getCurrentTime()
        const newTime = Math.max(0, Math.min(currentPlayerTime + pendingSeekRef.current, duration))
        playerRef.current.seekTo(newTime, true)
        setCurrentTime(newTime)
        pendingSeekRef.current = 0
      }
    }, 100) // 100ms debounce
  }

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    setCurrentTime(newTime)
    if (playerRef.current) {
      playerRef.current.seekTo(newTime, true)
    }
  }

  // Update current time and handle looping
  useEffect(() => {
    if (isPlaying && playerRef.current) {
      intervalRef.current = setInterval(() => {
        if (playerRef.current) {
          const time = playerRef.current.getCurrentTime()
          setCurrentTime(time)

          // Handle loop
          if (loopEnabled && loopStart !== null && loopEnd !== null) {
            if (time >= loopEnd) {
              playerRef.current.seekTo(loopStart, true)
            }
          }
        }
      }, 100)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current)
      }
    }
  }, [isPlaying, loopEnabled, loopStart, loopEnd])

  const handleSetLoopStart = () => {
    setLoopStart(currentTime)
    if (loopEnd === null || currentTime >= loopEnd) {
      setLoopEnd(null)
    }
  }

  const handleSetLoopEnd = () => {
    if (loopStart === null) {
      alert('Please set loop start point first')
      return
    }
    if (currentTime <= loopStart) {
      alert('Loop end must be after loop start')
      return
    }
    setLoopEnd(currentTime)
    setLoopEnabled(true)
  }

  const handleClearLoop = () => {
    setLoopEnabled(false)
    setLoopStart(null)
    setLoopEnd(null)
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Load disclaimer acceptance from localStorage
  useEffect(() => {
    const accepted = localStorage.getItem('youtube_download_disclaimer_accepted')
    if (accepted === 'true') {
      setHasAcceptedDisclaimer(true)
    }
  }, [])

  const handleDownloadAudio = async () => {
    // Show disclaimer if not accepted
    if (!hasAcceptedDisclaimer) {
      setShowDisclaimer(true)
      return
    }

    await performDownload()
  }

  const acceptDisclaimerAndDownload = () => {
    setHasAcceptedDisclaimer(true)
    localStorage.setItem('youtube_download_disclaimer_accepted', 'true')
    setShowDisclaimer(false)
    performDownload()
  }

  const performDownload = async () => {
    if (!videoId || isDownloading) return

    setIsDownloading(true)

    try {
      const response = await fetch('http://localhost:3001/api/youtube/download-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId, quality: 'highestaudio' }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Download failed')
      }

      // Get the blob from the response
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `youtube_audio_${videoId}.m4a`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      alert('Audio downloaded successfully!')
    } catch (error: any) {
      console.error('Download error:', error)
      alert(`${error.message}`)
    } finally {
      setIsDownloading(false)
    }
  }

  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp isOpen={showShortcutsHelp} onClose={() => setShowShortcutsHelp(false)} />

      {/* Legal Disclaimer Modal */}
      {showDisclaimer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full border border-red-500/50">
            <h2 className="text-xl font-bold text-red-400 mb-4">Important Legal Notice</h2>

            <div className="space-y-3 text-sm text-gray-300 mb-6">
              <p>
                <span className="font-semibold text-white">Disclaimer:</span> Downloading YouTube videos or audio may violate YouTube's Terms of Service.
              </p>
              <p>
                This feature is provided for:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Personal music practice purposes</li>
                <li>Content you own or have permission to download</li>
                <li>Educational and fair use scenarios</li>
              </ul>
              <p className="font-semibold text-yellow-400">
                By proceeding, you acknowledge that you are responsible for ensuring your use complies with all applicable laws and terms of service.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDisclaimer(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={acceptDisclaimerAndDownload}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                I Understand, Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* URL Input */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <input
          type="text"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="Paste YouTube URL or video ID..."
          className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm sm:text-base"
          onKeyPress={(e) => e.key === 'Enter' && handleLoadVideo()}
        />
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={handleLoadVideo}
            className="flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors text-sm sm:text-base"
          >
            Load Video
          </button>
          <button
            onClick={() => setShowShortcutsHelp(true)}
            className="px-3 sm:px-4 py-2 sm:py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Video Player */}
      {videoId && (
        <div className="space-y-3 sm:space-y-4">
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <YouTube
              videoId={videoId}
              opts={{
                width: '100%',
                height: '100%',
                playerVars: {
                  autoplay: 0,
                  controls: 0,
                  modestbranding: 1,
                },
              }}
              onReady={onReady}
              onStateChange={onStateChange}
              className="w-full h-full"
            />
          </div>

          {/* Download Audio Button */}
          <div className="flex justify-center">
            <button
              onClick={handleDownloadAudio}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm sm:text-base"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              {isDownloading ? 'Downloading...' : 'Download Audio (MP3)'}
            </button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleProgressChange}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <div className="flex justify-between text-xs sm:text-sm text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={() => handleSeek(-10)}
              className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>

            <button
              onClick={togglePlayPause}
              className="p-3 sm:p-4 bg-purple-600 hover:bg-purple-700 rounded-full transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              ) : (
                <Play className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              )}
            </button>

            <button
              onClick={() => handleSeek(10)}
              className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>
          </div>

          {/* Loop Section Controls */}
          <div className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                <label className="text-white font-semibold text-sm sm:text-base">
                  <span className="hidden sm:inline">Loop Section (A-B Repeat)</span>
                  <span className="sm:hidden">A-B Loop</span>
                </label>
              </div>
              {loopEnabled && (
                <span className="text-green-400 text-xs sm:text-sm font-medium">Active</span>
              )}
            </div>

            {/* Loop Points Display */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="bg-white/5 rounded-lg p-2 sm:p-3">
                <p className="text-xs text-gray-400 mb-1">Point A (Start)</p>
                <p className="text-white font-semibold text-sm sm:text-base">
                  {loopStart !== null ? formatTime(loopStart) : '--:--'}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-2 sm:p-3">
                <p className="text-xs text-gray-400 mb-1">Point B (End)</p>
                <p className="text-white font-semibold text-sm sm:text-base">
                  {loopEnd !== null ? formatTime(loopEnd) : '--:--'}
                </p>
              </div>
            </div>

            {/* Loop Control Buttons */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <button
                onClick={handleSetLoopStart}
                className="py-1.5 sm:py-2 px-2 sm:px-3 bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors"
              >
                <span className="hidden sm:inline">Set Point A</span>
                <span className="sm:hidden">Point A</span>
              </button>
              <button
                onClick={handleSetLoopEnd}
                disabled={loopStart === null}
                className="py-1.5 sm:py-2 px-2 sm:px-3 bg-green-600/80 hover:bg-green-600 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="hidden sm:inline">Set Point B</span>
                <span className="sm:hidden">Point B</span>
              </button>
              <button
                onClick={handleClearLoop}
                disabled={loopStart === null && loopEnd === null}
                className="py-1.5 sm:py-2 px-2 sm:px-3 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            </div>

            {/* Loop Toggle */}
            {loopStart !== null && loopEnd !== null && (
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-sm text-gray-300">Enable Loop</span>
                <button
                  onClick={() => setLoopEnabled(!loopEnabled)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    loopEnabled ? 'bg-green-600' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      loopEnabled ? 'transform translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Instructions */}
            {loopStart === null && (
              <p className="text-xs text-gray-400 text-center">
                Play to the start position, then click "Set Point A"
              </p>
            )}
            {loopStart !== null && loopEnd === null && (
              <p className="text-xs text-gray-400 text-center">
                Play to the end position, then click "Set Point B"
              </p>
            )}
          </div>

          {/* Speed Control */}
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-white font-semibold text-sm sm:text-base">Playback Speed</label>
              <span className="text-purple-400 font-bold text-sm sm:text-base">{speed}x</span>
            </div>

            <input
              type="range"
              min="0.25"
              max="2"
              step="0.25"
              value={speed}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />

            {/* Speed Presets */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 sm:gap-2">
              {speedOptions.map((speedOption) => (
                <button
                  key={speedOption}
                  onClick={() => handleSpeedChange(speedOption)}
                  className={`py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    speed === speedOption
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  {speedOption}x
                </button>
              ))}
            </div>

            {/* Pitch Preservation Notice */}
            {speed !== 1 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mt-2">
                <p className="text-xs text-yellow-300">
                  <span className="font-semibold">Note:</span> YouTube's player doesn't support pitch preservation.
                  Audio will sound {speed < 1 ? 'deeper/slower' : 'higher/faster'} at this speed.
                  For pitch-preserved playback, use the Local Files tab.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      {!videoId && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">
            Enter a YouTube URL or video ID above to get started
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ
          </p>
        </div>
      )}
    </div>
  )
}
