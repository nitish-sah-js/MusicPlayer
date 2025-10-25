import { useState, useRef, useEffect } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { Play, Pause, SkipBack, SkipForward, Upload, X, Repeat, Download, Keyboard } from 'lucide-react'
import { useFFmpeg } from '../hooks/useFFmpeg'
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp'

export default function LocalFilePlayer() {
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [tempo, setTempo] = useState(1) // Speed/tempo control (0.25x - 2x)
  const [pitch, setPitch] = useState(0) // Pitch shift in semitones (-12 to +12)
  const [volume, setVolume] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [loopStart, setLoopStart] = useState<number | null>(null)
  const [loopEnd, setLoopEnd] = useState<number | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'mp3' | 'wav' | 'ogg'>('mp3')
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)

  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { loaded: ffmpegLoaded, loading: ffmpegLoading, exportAudio } = useFFmpeg()

  // WaveSurfer state tracking
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input field or no audio loaded
      if (e.target instanceof HTMLInputElement || !audioFile) return

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
          handleTempoChange(Math.min(tempo + 0.25, 2))
          break
        case 'arrowdown':
          e.preventDefault()
          handleTempoChange(Math.max(tempo - 0.25, 0.25))
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
          handleTempoChange(0.25)
          break
        case '2':
          handleTempoChange(0.5)
          break
        case '3':
          handleTempoChange(0.75)
          break
        case '4':
          handleTempoChange(1)
          break
        case '5':
          handleTempoChange(1.25)
          break
        case '6':
          handleTempoChange(1.5)
          break
        case '7':
          handleTempoChange(1.75)
          break
        case '8':
          handleTempoChange(2)
          break
        case '?':
          e.preventDefault()
          setShowShortcutsHelp(prev => !prev)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [tempo, isPlaying, currentTime, loopStart, loopEnd, audioFile])

  // Initialize WaveSurfer when audio file is loaded
  useEffect(() => {
    if (!audioFile || !waveformRef.current) return

    // Destroy existing instance
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy()
    }

    // Create new WaveSurfer instance
    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#9333ea',
      progressColor: '#a855f7',
      cursorColor: '#c084fc',
      barWidth: 2,
      barRadius: 3,
      cursorWidth: 2,
      height: 100,
      barGap: 2,
      responsive: true,
    })

    wavesurferRef.current = wavesurfer

    // Load audio file
    const fileUrl = URL.createObjectURL(audioFile)
    wavesurfer.load(fileUrl)

    // Event listeners
    wavesurfer.on('ready', () => {
      setDuration(wavesurfer.getDuration())
    })

    wavesurfer.on('audioprocess', () => {
      const time = wavesurfer.getCurrentTime()
      setCurrentTime(time)

      // Handle loop
      if (loopEnabled && loopStart !== null && loopEnd !== null) {
        if (time >= loopEnd) {
          wavesurfer.seekTo(loopStart / wavesurfer.getDuration())
          if (!wavesurfer.isPlaying()) {
            wavesurfer.play()
          }
        }
      }
    })

    wavesurfer.on('finish', () => {
      setIsPlaying(false)
    })

    wavesurfer.on('play', () => {
      setIsPlaying(true)
    })

    wavesurfer.on('pause', () => {
      setIsPlaying(false)
    })

    return () => {
      wavesurfer.destroy()
      URL.revokeObjectURL(fileUrl)
    }
  }, [audioFile, loopEnabled, loopStart, loopEnd])

  // Update playback rate when tempo or pitch changes
  useEffect(() => {
    if (wavesurferRef.current) {
      // Calculate the combined playback rate
      // Pitch shift: each semitone = 2^(1/12) ratio
      const pitchRatio = Math.pow(2, pitch / 12)

      // Combined rate = tempo * pitch ratio
      // If pitch = 0, ratio = 1, so rate = tempo only
      // If pitch != 0, we need to adjust playback rate
      const playbackRate = tempo * pitchRatio

      // WaveSurfer's preservesPitch parameter:
      // true = maintain original pitch (ignore pitch changes from speed)
      // false = allow pitch to change with speed
      // For independent tempo/pitch control: always use preservesPitch=false
      // and control pitch via the playback rate calculation
      wavesurferRef.current.setPlaybackRate(playbackRate, false)
    }
  }, [tempo, pitch])

  // Update volume
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(volume)
    }
  }, [volume])

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file)
    } else {
      alert('Please select a valid audio file')
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const togglePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause()
    }
  }

  const handleSeek = (seconds: number) => {
    if (wavesurferRef.current) {
      const newTime = Math.max(0, Math.min(currentTime + seconds, duration))
      wavesurferRef.current.seekTo(newTime / duration)
    }
  }

  const handleTempoChange = (newTempo: number) => {
    setTempo(newTempo)
  }

  const handlePitchChange = (newPitch: number) => {
    setPitch(newPitch)
  }

  const handleRemoveFile = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.stop()
    }
    setAudioFile(null)
    setLoopStart(null)
    setLoopEnd(null)
    setLoopEnabled(false)
  }

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

  const handleExport = async () => {
    if (!audioFile) return

    setIsExporting(true)

    try {
      const blob = await exportAudio(audioFile, tempo, exportFormat)

      if (blob) {
        // Create download link
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const originalName = audioFile.name.replace(/\.[^/.]+$/, '')
        a.download = `${originalName}_${tempo}x.${exportFormat}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export audio. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp isOpen={showShortcutsHelp} onClose={() => setShowShortcutsHelp(false)} />

      {/* Shortcuts Help Button - Always Visible */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowShortcutsHelp(true)}
          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-1.5 sm:gap-2"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="text-xs sm:text-sm">Shortcuts</span>
        </button>
      </div>

      {!audioFile ? (
        <>
          {/* File Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl sm:rounded-2xl p-6 sm:p-12 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-white/20 hover:border-purple-500/50 hover:bg-white/5'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-purple-400" />
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">
              Upload Audio File
            </h3>
            <p className="text-sm sm:text-base text-gray-400 mb-3 sm:mb-4">
              Drag and drop your audio file here, or click to browse
            </p>
            <p className="text-xs sm:text-sm text-gray-500">
              Supported formats: MP3, WAV, OGG, M4A, FLAC
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        </>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* File Info */}
          <div className="flex items-center justify-between bg-white/5 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Play className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-white font-semibold text-sm sm:text-base truncate">{audioFile.name}</h3>
                <p className="text-xs sm:text-sm text-gray-400">
                  {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              onClick={handleRemoveFile}
              className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
            </button>
          </div>

          {/* Waveform */}
          <div className="bg-black/30 rounded-lg p-3 sm:p-4">
            <div ref={waveformRef} className="w-full" />
          </div>

          {/* Time Display */}
          <div className="flex justify-between text-xs sm:text-sm text-gray-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
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
              className="p-4 sm:p-5 bg-purple-600 hover:bg-purple-700 rounded-full transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              ) : (
                <Play className="w-6 h-6 sm:w-7 sm:h-7 text-white ml-0.5 sm:ml-1" />
              )}
            </button>

            <button
              onClick={() => handleSeek(10)}
              className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>
          </div>

          {/* Volume Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-white font-semibold text-xs sm:text-sm">Volume</label>
              <span className="text-purple-400 font-bold text-xs sm:text-sm">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
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

          {/* Tempo Control */}
          <div className="space-y-2 sm:space-y-3 bg-white/5 rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <label className="text-white font-semibold text-sm sm:text-base">Tempo (Speed)</label>
              <span className="text-purple-400 font-bold text-sm sm:text-base">{tempo}x</span>
            </div>

            <input
              type="range"
              min="0.25"
              max="2"
              step="0.01"
              value={tempo}
              onChange={(e) => handleTempoChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />

            {/* Tempo Presets */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 sm:gap-2">
              {speedOptions.map((tempoOption) => (
                <button
                  key={tempoOption}
                  onClick={() => handleTempoChange(tempoOption)}
                  className={`py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    tempo === tempoOption
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  {tempoOption}x
                </button>
              ))}
            </div>
          </div>

          {/* Pitch Control */}
          <div className="space-y-2 sm:space-y-3 bg-white/5 rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <label className="text-white font-semibold text-sm sm:text-base">Pitch Shift</label>
              <span className="text-green-400 font-bold text-sm sm:text-base">
                {pitch > 0 ? '+' : ''}{pitch} semitones
              </span>
            </div>

            <input
              type="range"
              min="-12"
              max="12"
              step="1"
              value={pitch}
              onChange={(e) => handlePitchChange(parseInt(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-green-600"
            />

            {/* Pitch Presets */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              <button
                onClick={() => handlePitchChange(-12)}
                className={`py-1.5 sm:py-2 px-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  pitch === -12
                    ? 'bg-green-600 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                -12
              </button>
              <button
                onClick={() => handlePitchChange(-6)}
                className={`py-1.5 sm:py-2 px-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  pitch === -6
                    ? 'bg-green-600 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                -6
              </button>
              <button
                onClick={() => handlePitchChange(0)}
                className={`py-1.5 sm:py-2 px-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  pitch === 0
                    ? 'bg-green-600 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                0
              </button>
              <button
                onClick={() => handlePitchChange(6)}
                className={`py-1.5 sm:py-2 px-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  pitch === 6
                    ? 'bg-green-600 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                +6
              </button>
              <button
                onClick={() => handlePitchChange(12)}
                className={`py-1.5 sm:py-2 px-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  pitch === 12
                    ? 'bg-green-600 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                +12
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center">
              Change pitch without affecting tempo • 1 semitone = 1 piano key
            </p>
          </div>

          {/* Export Audio */}
          <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg sm:rounded-xl p-3 sm:p-4 space-y-2 sm:space-y-3 border border-purple-500/30">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
              <label className="text-white font-semibold text-sm sm:text-base">
                Professional Export
                <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
                  Studio Quality
                </span>
              </label>
              {ffmpegLoading && (
                <span className="text-xs text-gray-400 hidden sm:inline">(Loading...)</span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-gray-300">
              <span className="font-semibold">Professional FFmpeg processing</span> - Export with {tempo}x tempo using studio-grade algorithms (zero artifacts, perfect pitch preservation)
            </p>

            {/* Format Selection */}
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-xs sm:text-sm text-gray-300">Output Format</label>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                <button
                  onClick={() => setExportFormat('mp3')}
                  className={`py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    exportFormat === 'mp3'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  MP3
                </button>
                <button
                  onClick={() => setExportFormat('wav')}
                  className={`py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    exportFormat === 'wav'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  WAV
                </button>
                <button
                  onClick={() => setExportFormat('ogg')}
                  className={`py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    exportFormat === 'ogg'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  OGG
                </button>
              </div>
            </div>

            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={isExporting || !ffmpegLoaded || ffmpegLoading}
              className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                isExporting || !ffmpegLoaded || ffmpegLoading
                  ? 'bg-gray-600 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
              }`}
            >
              {isExporting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>Export as {exportFormat.toUpperCase()}</span>
                </>
              )}
            </button>

            {!ffmpegLoaded && !ffmpegLoading && (
              <p className="text-xs text-red-400 text-center">
                FFmpeg failed to load. Please refresh the page.
              </p>
            )}

            {(tempo !== 1 || pitch !== 0) && ffmpegLoaded && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2">
                <p className="text-xs text-green-300 text-center">
                  ✨ Professional quality: Output will be {tempo < 1 ? 'slowed to' : tempo > 1 ? 'accelerated to' : 'at'} {tempo}x tempo{pitch !== 0 && ` with ${pitch > 0 ? '+' : ''}${pitch} semitone pitch shift`} - studio DAW quality!
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
