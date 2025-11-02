import { useState, useEffect, useRef, useCallback } from 'react'
import * as Tone from 'tone'

export interface TonePlayerState {
  isLoaded: boolean
  isPlaying: boolean
  currentTime: number
  duration: number
  error: string | null
}

export interface TonePlayerControls {
  loadAudio: (file: File) => Promise<void>
  play: () => void
  pause: () => void
  stop: () => void
  seek: (time: number) => void
  setSpeed: (speed: number) => void
  setPitch: (semitones: number) => void
  setVolume: (volume: number) => void
  setLoopPoints: (start: number | null, end: number | null) => void
  reset: () => void
}

export const useTonePlayer = () => {
  const [state, setState] = useState<TonePlayerState>({
    isLoaded: false,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    error: null,
  })

  const bufferRef = useRef<Tone.ToneAudioBuffer | null>(null)
  const sourceRef = useRef<Tone.BufferSource | null>(null)
  const pitchShiftRef = useRef<Tone.PitchShift | null>(null)
  const volumeNodeRef = useRef<Tone.Volume | null>(null)
  const loopStartRef = useRef<number | null>(null)
  const loopEndRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const pauseTimeRef = useRef<number>(0)
  const playbackRateRef = useRef<number>(1)
  const isPlayingRef = useRef<boolean>(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (sourceRef.current) {
        try {
          sourceRef.current.stop()
          sourceRef.current.dispose()
        } catch (e) {}
      }
      if (pitchShiftRef.current) {
        pitchShiftRef.current.dispose()
      }
      if (volumeNodeRef.current) {
        volumeNodeRef.current.dispose()
      }
      if (bufferRef.current) {
        bufferRef.current.dispose()
      }
    }
  }, [])

  // Update current time during playback
  useEffect(() => {
    if (state.isPlaying) {
      intervalRef.current = window.setInterval(() => {
        const elapsed = (Tone.now() - startTimeRef.current) * playbackRateRef.current
        const currentTime = pauseTimeRef.current + elapsed

        // Check for loop
        if (loopStartRef.current !== null && loopEndRef.current !== null) {
          if (currentTime >= loopEndRef.current) {
            // Restart from loop start
            if (sourceRef.current) {
              sourceRef.current.stop()
              sourceRef.current.dispose()
            }

            pauseTimeRef.current = loopStartRef.current
            startTimeRef.current = Tone.now()

            const newSource = new Tone.BufferSource(bufferRef.current!)
            newSource.playbackRate.value = playbackRateRef.current
            newSource.chain(pitchShiftRef.current!, volumeNodeRef.current!, Tone.Destination)
            newSource.start(0, loopStartRef.current)
            sourceRef.current = newSource

            setState(prev => ({ ...prev, currentTime: loopStartRef.current! }))
            return
          }
        }

        // Check if reached end
        if (currentTime >= state.duration) {
          setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }))
          pauseTimeRef.current = 0
          return
        }

        setState(prev => ({ ...prev, currentTime }))
      }, 50)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [state.isPlaying, state.duration])

  const loadAudio = useCallback(async (file: File) => {
    try {
      console.log('🎵 [Tone.js] Loading audio file:', file.name)

      // Cleanup existing audio
      if (sourceRef.current) {
        try {
          sourceRef.current.stop()
          sourceRef.current.dispose()
        } catch (e) {}
        sourceRef.current = null
      }
      if (pitchShiftRef.current) {
        pitchShiftRef.current.dispose()
        pitchShiftRef.current = null
      }
      if (volumeNodeRef.current) {
        volumeNodeRef.current.dispose()
        volumeNodeRef.current = null
      }
      if (bufferRef.current) {
        bufferRef.current.dispose()
        bufferRef.current = null
      }

      setState(prev => ({
        ...prev,
        error: null,
        isLoaded: false,
        isPlaying: false,
        currentTime: 0,
      }))

      // Ensure Tone.js is started
      await Tone.start()
      console.log('✅ [Tone.js] AudioContext started')

      // Load audio buffer
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer)

      bufferRef.current = new Tone.ToneAudioBuffer(audioBuffer)

      console.log('✅ [Tone.js] Audio decoded:', bufferRef.current.duration, 'seconds')

      // Create pitch shift effect
      pitchShiftRef.current = new Tone.PitchShift({
        pitch: 0,
        windowSize: 0.1,
        delayTime: 0,
        feedback: 0,
      })

      // Create volume node
      volumeNodeRef.current = new Tone.Volume(0)

      // Connect effects chain (source will be created on play)
      pitchShiftRef.current.connect(volumeNodeRef.current)
      volumeNodeRef.current.toDestination()

      pauseTimeRef.current = 0
      startTimeRef.current = 0
      playbackRateRef.current = 1

      setState(prev => ({
        ...prev,
        isLoaded: true,
        duration: bufferRef.current!.duration,
        currentTime: 0,
      }))

      console.log('🎉 [Tone.js] Audio loaded successfully!')
    } catch (error) {
      console.error('❌ [Tone.js] Failed to load audio:', error)
      setState(prev => ({
        ...prev,
        error: 'Failed to load audio file. Please try a different file.',
      }))
    }
  }, [])

  const play = useCallback(() => {
    if (!bufferRef.current || isPlayingRef.current) return

    console.log('▶️ [Tone.js] Playing from', pauseTimeRef.current)

    // Create new source
    const source = new Tone.BufferSource(bufferRef.current)
    source.playbackRate.value = playbackRateRef.current
    source.chain(pitchShiftRef.current!, volumeNodeRef.current!, Tone.Destination)
    source.start(0, pauseTimeRef.current)
    sourceRef.current = source

    startTimeRef.current = Tone.now()
    isPlayingRef.current = true
    setState(prev => ({ ...prev, isPlaying: true }))
  }, [])

  const pause = useCallback(() => {
    if (!sourceRef.current || !isPlayingRef.current) return

    const currentTime = pauseTimeRef.current + (Tone.now() - startTimeRef.current) * playbackRateRef.current

    console.log('⏸️ [Tone.js] Paused at', currentTime)

    pauseTimeRef.current = currentTime
    sourceRef.current.stop()
    sourceRef.current.dispose()
    sourceRef.current = null
    isPlayingRef.current = false

    setState(prev => ({ ...prev, isPlaying: false, currentTime }))
  }, [])

  const stop = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.stop()
      sourceRef.current.dispose()
      sourceRef.current = null
    }

    pauseTimeRef.current = 0
    startTimeRef.current = 0
    isPlayingRef.current = false

    setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }))
    console.log('⏹️ [Tone.js] Stopped')
  }, [])

  const seek = useCallback((time: number) => {
    if (!bufferRef.current) return

    const wasPlaying = isPlayingRef.current
    const duration = bufferRef.current.duration

    // Stop current playback
    if (sourceRef.current) {
      sourceRef.current.stop()
      sourceRef.current.dispose()
      sourceRef.current = null
    }

    pauseTimeRef.current = Math.max(0, Math.min(time, duration))

    if (wasPlaying) {
      // Resume playing from new position
      const source = new Tone.BufferSource(bufferRef.current)
      source.playbackRate.value = playbackRateRef.current
      source.chain(pitchShiftRef.current!, volumeNodeRef.current!, Tone.Destination)
      source.start(0, pauseTimeRef.current)
      sourceRef.current = source
      startTimeRef.current = Tone.now()
    }

    setState(prev => ({ ...prev, currentTime: pauseTimeRef.current, isPlaying: wasPlaying }))
    console.log('⏩ [Tone.js] Seeked to', pauseTimeRef.current, 'seconds', wasPlaying ? '(continuing playback)' : '(paused)')
  }, [])

  const setSpeed = useCallback((speed: number) => {
    playbackRateRef.current = speed

    if (sourceRef.current && isPlayingRef.current) {
      // Update playback rate on active source
      sourceRef.current.playbackRate.value = speed
    }

    console.log('🎵 [Tone.js] Speed set to', speed, 'x')
  }, [])

  const setPitch = useCallback((semitones: number) => {
    if (pitchShiftRef.current) {
      pitchShiftRef.current.pitch = semitones
      console.log('🎵 [Tone.js] Pitch set to', semitones, 'semitones')
    }
  }, [])

  const setVolume = useCallback((volume: number) => {
    if (volumeNodeRef.current) {
      const db = volume === 0 ? -Infinity : Tone.gainToDb(volume)
      volumeNodeRef.current.volume.value = db
      console.log('🔊 [Tone.js] Volume set to', Math.round(volume * 100), '%')
    }
  }, [])

  const setLoopPoints = useCallback((start: number | null, end: number | null) => {
    loopStartRef.current = start
    loopEndRef.current = end
    console.log('🔄 [Tone.js] Loop points set:', start, '-', end)
  }, [])

  const reset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.stop()
        sourceRef.current.dispose()
      } catch (e) {}
      sourceRef.current = null
    }

    if (pitchShiftRef.current) {
      pitchShiftRef.current.dispose()
      pitchShiftRef.current = null
    }

    if (volumeNodeRef.current) {
      volumeNodeRef.current.dispose()
      volumeNodeRef.current = null
    }

    if (bufferRef.current) {
      bufferRef.current.dispose()
      bufferRef.current = null
    }

    loopStartRef.current = null
    loopEndRef.current = null
    pauseTimeRef.current = 0
    startTimeRef.current = 0
    playbackRateRef.current = 1
    isPlayingRef.current = false

    setState({
      isLoaded: false,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      error: null,
    })

    console.log('🔄 [Tone.js] Reset complete')
  }, [])

  const controls: TonePlayerControls = {
    loadAudio,
    play,
    pause,
    stop,
    seek,
    setSpeed,
    setPitch,
    setVolume,
    setLoopPoints,
    reset,
  }

  return { state, controls }
}
