import { useState, useRef, useEffect } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { Play, Pause, SkipBack, SkipForward, Upload, X, Repeat, Download, Keyboard } from 'lucide-react'
import { useFFmpeg } from '../hooks/useFFmpeg'
import { useTonePlayer } from '../hooks/useTonePlayer'
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp'

export default function LocalFilePlayer() {
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [tempo, setTempo] = useState(1) // Speed/tempo control (0.25x - 2x)
  const [pitch, setPitch] = useState(0) // Pitch shift in semitones (-12 to +12)
  const [volume, setVolume] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [loopStart, setLoopStart] = useState<number | null>(null)
  const [loopEnd, setLoopEnd] = useState<number | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'mp3' | 'wav' | 'ogg'>('mp3')
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const [isShiftPressed, setIsShiftPressed] = useState(false)
  const [supportedFormats, setSupportedFormats] = useState<string[]>([])

  // Detect supported audio formats
  useEffect(() => {
    const audio = document.createElement('audio')
    const formats: string[] = []

    const testFormats = [
      { type: 'audio/mpeg', name: 'MP3' },
      { type: 'audio/wav', name: 'WAV' },
      { type: 'audio/ogg', name: 'OGG' },
      { type: 'audio/mp4', name: 'M4A' },
      { type: 'audio/flac', name: 'FLAC' },
      { type: 'audio/aac', name: 'AAC' },
      { type: 'audio/webm', name: 'WebM' },
    ]

    testFormats.forEach(({ type, name }) => {
      if (audio.canPlayType(type)) {
        formats.push(name)
      }
    })

    setSupportedFormats(formats)
  }, [])

  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { loaded: ffmpegLoaded, loading: ffmpegLoading, exportAudio } = useFFmpeg()

  // Tone.js for professional audio playback
  const { state: toneState, controls: toneControls } = useTonePlayer()

  // Derived state from Tone.js
  const isPlaying = toneState.isPlaying
  const currentTime = toneState.currentTime
  const duration = toneState.duration
  const loopEnabled = loopStart !== null && loopEnd !== null

  // Show notification temporarily
  const showNotification = (message: string) => {
    setNotification(message)
    setTimeout(() => setNotification(null), 2000)
  }

  // Track shift key for fine-tune mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

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
        case 'r':
          e.preventDefault()
          handleTempoChange(1)
          handlePitchChange(0)
          showNotification('Reset to Normal Speed & Pitch')
          break
        case 'l':
          e.preventDefault()
          if (loopEnabled) {
            handleClearLoop()
            showNotification('Loop Disabled')
          } else if (loopStart !== null) {
            showNotification('Set Loop End Point (B) first')
          } else {
            showNotification('Set Loop Points (A & B) first')
          }
          break
        case 'm':
          e.preventDefault()
          if (volume === 0) {
            setVolume(1)
            showNotification('Unmuted')
          } else {
            setVolume(0)
            showNotification('Muted')
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [tempo, isPlaying, currentTime, loopStart, loopEnd, audioFile])

  // Initialize WaveSurfer for visualization only when audio file is loaded
  useEffect(() => {
    if (!audioFile || !waveformRef.current) return

    // Destroy existing instance with proper cleanup
    if (wavesurferRef.current) {
      try {
        wavesurferRef.current.destroy()
      } catch (e) {
        console.warn('Error destroying WaveSurfer:', e)
      }
    }

    // Create new WaveSurfer instance (visualization only - no audio)
    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: 'rgba(168, 85, 247, 0.4)', // More visible purple
      progressColor: 'rgba(168, 85, 247, 1)', // Solid vibrant purple
      cursorColor: 'rgba(236, 72, 153, 1)',
      barWidth: 2,
      barRadius: 2,
      cursorWidth: 2,
      height: 80,
      barGap: 1,
      barHeight: 1, // Standard bar height
      minPxPerSec: 50, // More detailed waveform
      fillParent: true,
      responsive: true,
      interact: true,
      hideScrollbar: true,
      backend: 'WebAudio',
      normalize: true,
      splitChannels: false,
      mediaControls: false,
    })

    wavesurferRef.current = wavesurfer

    // Load audio file for visualization
    const fileUrl = URL.createObjectURL(audioFile)
    wavesurfer.load(fileUrl)

    // Handle waveform click to seek
    wavesurfer.on('interaction', () => {
      const clickedTime = wavesurfer.getCurrentTime()
      toneControls.seek(clickedTime)
      console.log('🎯 Seeked to', clickedTime.toFixed(2), 's via waveform click')
    })

    // Load audio into Tone.js for playback
    toneControls.loadAudio(audioFile)

    return () => {
      try {
        wavesurfer.destroy()
      } catch (e) {
        console.warn('Error destroying WaveSurfer in cleanup:', e)
      }
      try {
        URL.revokeObjectURL(fileUrl)
      } catch (e) {
        console.warn('Error revoking object URL:', e)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioFile]) // toneControls is stable

  // Sync WaveSurfer cursor with Tone.js playback
  useEffect(() => {
    if (wavesurferRef.current && duration > 0) {
      const progress = currentTime / duration
      wavesurferRef.current.seekTo(progress)
    }
  }, [currentTime, duration])

  // Update Tone.js tempo when tempo slider changes
  useEffect(() => {
    if (toneState.isLoaded) {
      toneControls.setSpeed(tempo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempo, toneState.isLoaded])

  // Update Tone.js pitch when pitch slider changes
  useEffect(() => {
    if (toneState.isLoaded) {
      toneControls.setPitch(pitch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitch, toneState.isLoaded])

  // Update Tone.js volume
  useEffect(() => {
    if (toneState.isLoaded) {
      toneControls.setVolume(volume)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume, toneState.isLoaded])

  // Update Tone.js loop points
  useEffect(() => {
    if (toneState.isLoaded) {
      toneControls.setLoopPoints(loopStart, loopEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopStart, loopEnd, toneState.isLoaded])

  const handleFileSelect = (file: File) => {
    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/flac', 'audio/aac', 'audio/webm']
    const isValidType = file.type.startsWith('audio/') || validTypes.some(type => file.name.toLowerCase().endsWith(type.split('/')[1]))

    if (!isValidType) {
      showNotification('❌ Invalid file type. Please select an audio file.')
      return
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024
    if (file.size > maxSize) {
      showNotification('❌ File too large. Maximum size is 500MB.')
      return
    }

    setAudioFile(file)
    showNotification(`✅ Loaded: ${file.name}`)
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
    if (file) {
      handleFileSelect(file)
    } else {
      showNotification('❌ No file detected. Please try again.')
    }
  }

  const togglePlayPause = () => {
    if (!toneState.isLoaded) {
      showNotification('⚠️ Audio not loaded yet. Please wait...')
      return
    }
    if (isPlaying) {
      toneControls.pause()
    } else {
      toneControls.play()
    }
  }

  const handleSeek = (seconds: number) => {
    if (!toneState.isLoaded || duration === 0) {
      showNotification('⚠️ Cannot seek: audio not loaded')
      return
    }
    const newTime = Math.max(0, Math.min(currentTime + seconds, duration))
    toneControls.seek(newTime)
  }

  const handleTempoChange = (newTempo: number) => {
    setTempo(newTempo)
    const presetName = speedOptions.find(opt => opt.value === newTempo)?.name
    if (presetName) {
      showNotification(`Speed: ${newTempo}x (${presetName})`)
    } else {
      showNotification(`Speed: ${newTempo}x`)
    }
  }

  const handlePitchChange = (newPitch: number) => {
    setPitch(newPitch)
    if (newPitch === 0) {
      showNotification('Pitch: Original')
    } else {
      const pitchStr = newPitch % 1 === 0 ? newPitch.toString() : newPitch.toFixed(1)
      showNotification(`Pitch: ${newPitch > 0 ? '+' : ''}${pitchStr} semitones`)
    }
  }

  const handleRemoveFile = () => {
    toneControls.reset()
    setAudioFile(null)
    setLoopStart(null)
    setLoopEnd(null)
    setTempo(1)
    setPitch(0)
    setVolume(1)
  }

  const handleSetLoopStart = () => {
    if (!toneState.isLoaded || duration === 0) {
      showNotification('⚠️ Cannot set loop: audio not loaded')
      return
    }
    setLoopStart(currentTime)
    if (loopEnd === null || currentTime >= loopEnd) {
      setLoopEnd(null)
    }
    showNotification(`✅ Loop Start (A) set at ${formatTime(currentTime)}`)
  }

  const handleSetLoopEnd = () => {
    if (!toneState.isLoaded || duration === 0) {
      showNotification('⚠️ Cannot set loop: audio not loaded')
      return
    }
    if (loopStart === null) {
      showNotification('⚠️ Please set loop start point first')
      return
    }
    if (currentTime <= loopStart) {
      showNotification('⚠️ Loop end must be after loop start')
      return
    }
    setLoopEnd(currentTime)
    showNotification(`✅ Loop End (B) set at ${formatTime(currentTime)}`)
  }

  const handleClearLoop = () => {
    setLoopStart(null)
    setLoopEnd(null)
    showNotification('✅ Loop cleared')
  }

  const handleExport = async () => {
    if (!audioFile) {
      showNotification('⚠️ No audio file loaded')
      return
    }

    if (!ffmpegLoaded) {
      showNotification('⚠️ FFmpeg not loaded. Please refresh the page.')
      return
    }

    setIsExporting(true)

    try {
      showNotification('🎬 Exporting audio with FFmpeg...')
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
        showNotification(`✅ Export complete: ${a.download}`)
      } else {
        showNotification('❌ Export failed: No output generated')
      }
    } catch (error) {
      console.error('Export failed:', error)
      showNotification(`❌ Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsExporting(false)
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const speedOptions = [
    { value: 0.25, label: '0.25x', name: 'Super Slow' },
    { value: 0.5, label: '0.5x', name: 'Slow' },
    { value: 0.75, label: '0.75x', name: 'Practice' },
    { value: 1, label: '1x', name: 'Normal' },
    { value: 1.25, label: '1.25x', name: 'Fast' },
    { value: 1.5, label: '1.5x', name: 'Review' },
    { value: 1.75, label: '1.75x', name: 'Faster' },
    { value: 2, label: '2x', name: 'Max' },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in-down">
          <div className="bg-purple-600 text-white px-6 py-3 rounded-lg shadow-lg font-semibold">
            {notification}
          </div>
        </div>
      )}

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
            {supportedFormats.length > 0 ? (
              <p className="text-xs sm:text-sm text-gray-500">
                Supported formats: {supportedFormats.join(', ')}
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-gray-500">
                Detecting supported audio formats...
              </p>
            )}
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
          <div className="bg-gradient-to-b from-black/40 via-purple-900/10 to-black/40 rounded-lg p-4 sm:p-6 relative shadow-inner border border-white/5">
            <div ref={waveformRef} className="w-full relative" style={{ minHeight: '80px' }} />

            {/* Loop Point Markers */}
            {duration > 0 && loopStart !== null && (
              <div
                className="absolute top-3 sm:top-4 bottom-3 sm:bottom-4 w-0.5 bg-blue-500 z-10"
                style={{ left: `calc(${(loopStart / duration) * 100}% + 0.75rem)` }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap font-semibold">
                  A
                </div>
              </div>
            )}
            {duration > 0 && loopEnd !== null && (
              <div
                className="absolute top-3 sm:top-4 bottom-3 sm:bottom-4 w-0.5 bg-green-500 z-10"
                style={{ left: `calc(${(loopEnd / duration) * 100}% + 0.75rem)` }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap font-semibold">
                  B
                </div>
              </div>
            )}
            {duration > 0 && loopStart !== null && loopEnd !== null && (
              <div
                className="absolute top-3 sm:top-4 bottom-3 sm:bottom-4 bg-purple-500/20 border-l border-r border-purple-500/50 z-0"
                style={{
                  left: `calc(${(loopStart / duration) * 100}% + 0.75rem)`,
                  width: `${((loopEnd - loopStart) / duration) * 100}%`
                }}
              />
            )}

            {!toneState.isLoaded && audioFile && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-lg z-20">
                <div className="text-center bg-black/50 p-6 rounded-lg border border-purple-500/30">
                  <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-white font-semibold mb-1">Loading Audio</p>
                  <p className="text-gray-400 text-xs">Initializing Tone.js engine...</p>
                  <p className="text-gray-500 text-xs mt-2">{audioFile.name}</p>
                </div>
              </div>
            )}
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
              step={isShiftPressed ? "0.001" : "0.01"}
              value={tempo}
              onChange={(e) => handleTempoChange(parseFloat(e.target.value))}
              className={`w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-600 ${isShiftPressed ? 'ring-2 ring-yellow-400' : ''}`}
              title={isShiftPressed ? 'Fine-tune mode (Shift held)' : 'Hold Shift for fine-tune mode'}
            />

            {/* Tempo Presets */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 sm:gap-2">
              {speedOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleTempoChange(option.value)}
                  className={`py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all group relative ${
                    tempo === option.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                  title={option.name}
                >
                  <span className="block sm:hidden">{option.label}</span>
                  <span className="hidden sm:block">{option.label}</span>
                  <span className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    {option.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Pitch Control */}
          <div className="space-y-2 sm:space-y-3 bg-white/5 rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <label className="text-white font-semibold text-sm sm:text-base">Pitch Shift</label>
              <span className="text-green-400 font-bold text-sm sm:text-base">
                {pitch > 0 ? '+' : ''}{pitch % 1 === 0 ? pitch : pitch.toFixed(1)} semitones
              </span>
            </div>

            <input
              type="range"
              min="-12"
              max="12"
              step={isShiftPressed ? "0.1" : "1"}
              value={pitch}
              onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
              className={`w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-green-600 ${isShiftPressed ? 'ring-2 ring-yellow-400' : ''}`}
              title={isShiftPressed ? 'Fine-tune mode (Shift held)' : 'Hold Shift for fine-tune mode'}
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

            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-2">
              <p className="text-xs text-purple-300 text-center">
                ✨ Powered by Tone.js • Professional pitch-shifting • Crystal clear audio
              </p>
            </div>
          </div>

          {/* Export Audio */}
          <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg sm:rounded-xl p-3 sm:p-4 space-y-2 sm:space-y-3 border border-purple-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                <label className="text-white font-semibold text-sm sm:text-base">
                  Export Audio
                </label>
              </div>
              {ffmpegLoading && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-purple-400">Loading FFmpeg...</span>
                </div>
              )}
            </div>

            <p className="text-xs sm:text-sm text-gray-300">
              Export your audio with {tempo}x tempo{pitch !== 0 && ` and ${pitch > 0 ? '+' : ''}${pitch} semitone pitch shift`} using FFmpeg processing
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
          </div>

          {/* Error Display */}
          {toneState.error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 sm:p-4">
              <div className="flex items-start gap-2">
                <span className="text-red-400 text-lg">⚠️</span>
                <div className="flex-1">
                  <p className="text-red-300 font-semibold text-sm">Audio Loading Error</p>
                  <p className="text-red-400 text-xs mt-1">{toneState.error}</p>
                  <button
                    onClick={handleRemoveFile}
                    className="mt-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded text-xs transition-colors"
                  >
                    Try Another File
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
