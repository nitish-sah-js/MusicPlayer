import { useState, useEffect, useRef, useCallback } from 'react'
import { createRubberBandNode } from 'rubberband-web'

export interface RubberBandState {
  isLoaded: boolean
  isPlaying: boolean
  currentTime: number
  duration: number
  error: string | null
}

export interface RubberBandControls {
  loadAudio: (file: File) => Promise<void>
  play: () => void
  pause: () => void
  seek: (time: number) => void
  setSpeed: (speed: number) => void
  setPitch: (pitch: number) => void
  setVolume: (volume: number) => void
  setLoopPoints: (start: number | null, end: number | null) => void
  reset: () => void
}

export const useRubberBand = () => {
  const [state, setState] = useState<RubberBandState>({
    isLoaded: false,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    error: null,
  })

  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const rubberBandNodeRef = useRef<any>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const startTimeRef = useRef<number>(0)
  const pauseTimeRef = useRef<number>(0)
  const currentSpeedRef = useRef<number>(1)
  const currentPitchRef = useRef<number>(1.0)
  const currentVolumeRef = useRef<number>(1)
  const loopStartRef = useRef<number | null>(null)
  const loopEndRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop()
        } catch (e) {
          // Ignore if already stopped
        }
      }
      if (rubberBandNodeRef.current) {
        try {
          rubberBandNodeRef.current.close()
        } catch (e) {
          // Ignore
        }
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Update current time during playback
  const updatePlaybackTime = useCallback(() => {
    if (!audioContextRef.current) return

    const elapsed = audioContextRef.current.currentTime - startTimeRef.current
    const currentTime = pauseTimeRef.current + elapsed * currentSpeedRef.current

    // Check for loop
    if (loopStartRef.current !== null && loopEndRef.current !== null) {
      if (currentTime >= loopEndRef.current) {
        // Loop back to start - pause and seek
        if (sourceNodeRef.current) {
          try {
            sourceNodeRef.current.stop()
          } catch (e) {
            // Ignore
          }
          sourceNodeRef.current = null
        }
        pauseTimeRef.current = loopStartRef.current
        setState(prev => ({ ...prev, currentTime: loopStartRef.current, isPlaying: false }))
        // Restart playback from loop start
        setTimeout(() => {
          const sourceNode = audioContextRef.current!.createBufferSource()
          sourceNode.buffer = audioBufferRef.current
          // Connect ONLY source → rubberband (rest of chain already connected)
          sourceNode.connect(rubberBandNodeRef.current)
          rubberBandNodeRef.current.setTempo(currentSpeedRef.current)
          rubberBandNodeRef.current.setPitch(currentPitchRef.current)
          sourceNode.start(0, loopStartRef.current)
          sourceNodeRef.current = sourceNode
          startTimeRef.current = audioContextRef.current!.currentTime
          setState(prev => ({ ...prev, isPlaying: true }))
          console.log('🔄 Loop restarted at', loopStartRef.current, 'seconds')
        }, 10)
        return
      }
    }

    // Check if ended
    const duration = audioBufferRef.current?.duration || 0
    if (currentTime >= duration) {
      setState(prev => ({
        ...prev,
        isPlaying: false,
        currentTime: duration,
      }))
      return
    }

    setState(prev => ({
      ...prev,
      currentTime,
    }))

    animationFrameRef.current = requestAnimationFrame(updatePlaybackTime)
  }, [])

  useEffect(() => {
    if (state.isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updatePlaybackTime)
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [state.isPlaying, updatePlaybackTime])

  const loadAudio = useCallback(async (file: File) => {
    try {
      console.log('🔵 [RubberBand] loadAudio() called with file:', file.name, file.size, 'bytes')

      // Stop any existing playback first
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop()
        } catch (e) {
          // Ignore
        }
        sourceNodeRef.current = null
      }

      setState(prev => ({
        ...prev,
        error: null,
        isLoaded: false,
        isPlaying: false,
        currentTime: 0,
      }))

      // Initialize audio context ONCE
      if (!audioContextRef.current) {
        console.log('🔵 [RubberBand] Creating new AudioContext...')
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        console.log('✅ [RubberBand] AudioContext created - State:', audioContextRef.current.state, 'Sample Rate:', audioContextRef.current.sampleRate)
      } else {
        console.log('✅ [RubberBand] Using existing AudioContext - State:', audioContextRef.current.state)
      }

      // Resume AudioContext if suspended
      if (audioContextRef.current.state === 'suspended') {
        console.log('⚠️ [RubberBand] AudioContext is suspended, resuming...')
        await audioContextRef.current.resume()
        console.log('✅ [RubberBand] AudioContext resumed - State:', audioContextRef.current.state)
      }

      // Initialize Rubber Band node ONCE
      if (!rubberBandNodeRef.current) {
        console.log('🔵 [RubberBand] Creating Rubber Band node...')
        console.log('⏳ [RubberBand] This may take a few seconds...')

        rubberBandNodeRef.current = await createRubberBandNode(
          audioContextRef.current,
          '/rubberband-processor.js'
        )

        console.log('✅ [RubberBand] Rubber Band node created successfully')

        // Enable high quality mode
        rubberBandNodeRef.current.setHighQuality(true)
        console.log('✅ [RubberBand] High quality mode enabled')

        // Create gain node ONCE
        gainNodeRef.current = audioContextRef.current.createGain()
        gainNodeRef.current.gain.value = currentVolumeRef.current
        console.log('✅ [RubberBand] Gain node created with volume:', currentVolumeRef.current)

        // Connect the persistent audio processing chain ONCE: rubberband -> gain -> destination
        console.log('🔵 [RubberBand] Setting up persistent audio processing chain...')
        rubberBandNodeRef.current.connect(gainNodeRef.current)
        gainNodeRef.current.connect(audioContextRef.current.destination)
        console.log('✅ [RubberBand] Persistent audio processing chain established')
      } else {
        console.log('✅ [RubberBand] Using existing Rubber Band node and gain node')
      }

      // Read file as array buffer
      console.log('🔵 [RubberBand] Reading file as array buffer...')
      const arrayBuffer = await file.arrayBuffer()
      console.log('✅ [RubberBand] File read:', arrayBuffer.byteLength, 'bytes')

      // Decode audio data
      console.log('🔵 [RubberBand] Decoding audio data...')
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer)
      audioBufferRef.current = audioBuffer
      pauseTimeRef.current = 0 // Reset playback position
      console.log('✅ [RubberBand] Audio decoded:', audioBuffer.duration.toFixed(2), 'seconds,', audioBuffer.numberOfChannels, 'channels,', audioBuffer.sampleRate, 'Hz')

      setState(prev => ({
        ...prev,
        isLoaded: true,
        duration: audioBuffer.duration,
        currentTime: 0,
        isPlaying: false,
      }))

      console.log('🎉 [RubberBand] Audio loaded successfully! Ready to play.')
    } catch (error) {
      console.error('❌ [RubberBand] Failed to load audio:', error)
      console.error('❌ [RubberBand] Error stack:', (error as Error).stack)
      setState(prev => ({
        ...prev,
        error: 'Failed to load audio file. Please try a different file.',
      }))
    }
  }, [])

  const play = useCallback(() => {
    console.log('🔵 [RubberBand] play() called')
    console.log('📊 [RubberBand] State check:')
    console.log('   - audioContext:', audioContextRef.current ? `exists (state: ${audioContextRef.current.state})` : 'NULL')
    console.log('   - audioBuffer:', audioBufferRef.current ? `exists (${audioBufferRef.current.duration.toFixed(2)}s)` : 'NULL')
    console.log('   - rubberBandNode:', rubberBandNodeRef.current ? 'exists' : 'NULL')
    console.log('   - gainNode:', gainNodeRef.current ? `exists (volume: ${gainNodeRef.current.gain.value})` : 'NULL')

    if (!audioContextRef.current || !audioBufferRef.current || !rubberBandNodeRef.current) {
      console.error('❌ [RubberBand] Cannot play - missing required nodes!')
      return
    }

    try {
      // Resume AudioContext if suspended
      if (audioContextRef.current.state === 'suspended') {
        console.log('⚠️ [RubberBand] AudioContext suspended, resuming...')
        audioContextRef.current.resume()
      }

      // Stop previous source if exists
      if (sourceNodeRef.current) {
        console.log('🔵 [RubberBand] Stopping previous source node...')
        try {
          sourceNodeRef.current.stop()
        } catch (e) {
          console.log('⚠️ [RubberBand] Previous source already stopped')
        }
      }

      console.log('🔵 [RubberBand] Creating new AudioBufferSourceNode...')
      const sourceNode = audioContextRef.current.createBufferSource()
      sourceNode.buffer = audioBufferRef.current
      console.log('✅ [RubberBand] AudioBufferSourceNode created')

      // Connect ONLY the source to the rubberband node
      // The chain rubberband → gain → destination is already connected from loadAudio()
      console.log('🔵 [RubberBand] Connecting source to processing chain...')
      console.log('   Connecting: source → rubberband (rest of chain already connected)')
      sourceNode.connect(rubberBandNodeRef.current)
      console.log('✅ [RubberBand] Source connected to audio processing chain')

      // Set tempo (speed) and pitch
      console.log('🔵 [RubberBand] Setting tempo:', currentSpeedRef.current, 'x')
      rubberBandNodeRef.current.setTempo(currentSpeedRef.current)
      console.log('🔵 [RubberBand] Setting pitch:', currentPitchRef.current)
      rubberBandNodeRef.current.setPitch(currentPitchRef.current)
      console.log('✅ [RubberBand] Tempo and pitch configured')

      // Start from current position
      console.log('🔵 [RubberBand] Starting playback from:', pauseTimeRef.current, 'seconds')
      sourceNode.start(0, pauseTimeRef.current)
      sourceNodeRef.current = sourceNode

      startTimeRef.current = audioContextRef.current.currentTime
      setState(prev => ({ ...prev, isPlaying: true }))
      console.log('▶️ [RubberBand] PLAYBACK STARTED!')
      console.log('📊 [RubberBand] Settings: speed=' + currentSpeedRef.current + 'x, volume=' + currentVolumeRef.current + ', position=' + pauseTimeRef.current + 's')
    } catch (error) {
      console.error('❌ [RubberBand] Failed to play audio:', error)
      console.error('❌ [RubberBand] Error stack:', (error as Error).stack)
      setState(prev => ({
        ...prev,
        error: 'Failed to play audio',
      }))
    }
  }, [])

  const pause = useCallback(() => {
    console.log('🔵 [RubberBand] pause() called')

    if (sourceNodeRef.current) {
      try {
        console.log('🔵 [RubberBand] Stopping source node...')
        sourceNodeRef.current.stop()
        console.log('✅ [RubberBand] Source node stopped')
      } catch (e) {
        console.log('⚠️ [RubberBand] Source already stopped')
      }
      sourceNodeRef.current = null
    } else {
      console.log('⚠️ [RubberBand] No active source node to stop')
    }

    setState(prev => {
      pauseTimeRef.current = prev.currentTime
      console.log('⏸️ [RubberBand] PLAYBACK PAUSED at', prev.currentTime.toFixed(2), 'seconds')
      return { ...prev, isPlaying: false }
    })
  }, [])

  const seek = useCallback((time: number) => {
    setState(prev => {
      const wasPlaying = prev.isPlaying
      const duration = audioBufferRef.current?.duration || 0

      // Stop current playback
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop()
        } catch (e) {
          // Ignore
        }
        sourceNodeRef.current = null
      }

      pauseTimeRef.current = Math.max(0, Math.min(time, duration))

      // Resume if was playing
      if (wasPlaying && audioContextRef.current && audioBufferRef.current && rubberBandNodeRef.current && gainNodeRef.current) {
        setTimeout(() => {
          const sourceNode = audioContextRef.current!.createBufferSource()
          sourceNode.buffer = audioBufferRef.current
          // Connect ONLY source → rubberband (rest of chain already connected)
          sourceNode.connect(rubberBandNodeRef.current)
          rubberBandNodeRef.current.setTempo(currentSpeedRef.current)
          rubberBandNodeRef.current.setPitch(currentPitchRef.current)
          sourceNode.start(0, pauseTimeRef.current)
          sourceNodeRef.current = sourceNode
          startTimeRef.current = audioContextRef.current!.currentTime
          setState(prev => ({ ...prev, isPlaying: true }))
          console.log('⏩ Seeked to', pauseTimeRef.current, 'seconds')
        }, 10)
      }

      return {
        ...prev,
        currentTime: pauseTimeRef.current,
        isPlaying: false,
      }
    })
  }, [])

  const setSpeed = useCallback((speed: number) => {
    currentSpeedRef.current = speed
    console.log('🎵 Speed changing to', speed, 'x')

    // Always stop and restart to avoid buffer overrun issues
    setState(prev => {
      const wasPlaying = prev.isPlaying
      const currentTime = prev.currentTime

      // Stop current playback
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop()
        } catch (e) {
          // Ignore
        }
        sourceNodeRef.current = null
      }

      pauseTimeRef.current = currentTime

      // Restart with new speed if was playing
      if (wasPlaying) {
        setTimeout(() => {
          if (audioContextRef.current && audioBufferRef.current && rubberBandNodeRef.current && gainNodeRef.current) {
            const sourceNode = audioContextRef.current.createBufferSource()
            sourceNode.buffer = audioBufferRef.current
            sourceNode.connect(rubberBandNodeRef.current)
            rubberBandNodeRef.current.setTempo(currentSpeedRef.current)
            rubberBandNodeRef.current.setPitch(currentPitchRef.current)
            sourceNode.start(0, pauseTimeRef.current)
            sourceNodeRef.current = sourceNode
            startTimeRef.current = audioContextRef.current.currentTime
            setState(prev => ({ ...prev, isPlaying: true, currentTime: pauseTimeRef.current }))
            console.log('✅ Speed changed to', currentSpeedRef.current, 'x, restarted at', pauseTimeRef.current, 's')
          }
        }, 50) // Increased delay to prevent buffer issues
      }

      return { ...prev, isPlaying: false, currentTime }
    })
  }, [])

  const setPitch = useCallback((pitch: number) => {
    currentPitchRef.current = pitch
    console.log('🎵 Pitch changing to', pitch)

    // Always stop and restart to avoid buffer overrun issues
    setState(prev => {
      const wasPlaying = prev.isPlaying
      const currentTime = prev.currentTime

      // Stop current playback
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop()
        } catch (e) {
          // Ignore
        }
        sourceNodeRef.current = null
      }

      pauseTimeRef.current = currentTime

      // Restart with new pitch if was playing
      if (wasPlaying) {
        setTimeout(() => {
          if (audioContextRef.current && audioBufferRef.current && rubberBandNodeRef.current && gainNodeRef.current) {
            const sourceNode = audioContextRef.current.createBufferSource()
            sourceNode.buffer = audioBufferRef.current
            sourceNode.connect(rubberBandNodeRef.current)
            rubberBandNodeRef.current.setTempo(currentSpeedRef.current)
            rubberBandNodeRef.current.setPitch(currentPitchRef.current)
            sourceNode.start(0, pauseTimeRef.current)
            sourceNodeRef.current = sourceNode
            startTimeRef.current = audioContextRef.current.currentTime
            setState(prev => ({ ...prev, isPlaying: true, currentTime: pauseTimeRef.current }))
            console.log('✅ Pitch changed to', currentPitchRef.current, ', restarted at', pauseTimeRef.current, 's')
          }
        }, 50) // Increased delay to prevent buffer issues
      }

      return { ...prev, isPlaying: false, currentTime }
    })
  }, [])

  const setVolume = useCallback((volume: number) => {
    currentVolumeRef.current = volume
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume
    }
  }, [])

  const setLoopPoints = useCallback((start: number | null, end: number | null) => {
    loopStartRef.current = start
    loopEndRef.current = end
  }, [])

  const reset = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop()
      } catch (e) {
        // Ignore
      }
    }

    audioBufferRef.current = null
    pauseTimeRef.current = 0
    startTimeRef.current = 0
    loopStartRef.current = null
    loopEndRef.current = null

    setState({
      isLoaded: false,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      error: null,
    })
  }, [])

  const controls: RubberBandControls = {
    loadAudio,
    play,
    pause,
    seek,
    setSpeed,
    setPitch,
    setVolume,
    setLoopPoints,
    reset,
  }

  return { state, controls }
}
