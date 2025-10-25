
import { useRef, useState, useEffect } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

export function useFFmpeg() {
  const ffmpegRef = useRef<FFmpeg | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadFFmpeg()
  }, [])

  const loadFFmpeg = async () => {
    if (ffmpegRef.current || loading) return

    try {
      setLoading(true)
      setError(null)

      console.log('Starting FFmpeg load...')
      const ffmpeg = new FFmpeg()

      // Enable logging for debugging
      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message)
      })

      ffmpegRef.current = ffmpeg

      // Load FFmpeg core - use single-threaded version (no SharedArrayBuffer needed)
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
      console.log('Loading FFmpeg from:', baseURL)

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })

      console.log('FFmpeg loaded successfully!')
      setLoaded(true)
      setLoading(false)
    } catch (err) {
      console.error('Failed to load FFmpeg:', err)
      setError('Failed to load FFmpeg. Please refresh the page.')
      setLoading(false)
    }
  }

  const exportAudio = async (
    audioFile: File,
    speed: number,
    outputFormat: string = 'mp3'
  ): Promise<Blob | null> => {
    if (!ffmpegRef.current || !loaded) {
      console.error('FFmpeg not loaded. Loaded:', loaded, 'Instance:', ffmpegRef.current)
      setError('FFmpeg not loaded yet')
      return null
    }

    try {
      console.log('Starting audio export...', { speed, outputFormat, fileName: audioFile.name })
      const ffmpeg = ffmpegRef.current

      // Calculate the audio filter for speed change
      // atempo filter supports values between 0.5 and 2.0
      // For speeds outside this range, we chain multiple atempo filters
      let audioFilter = ''
      let currentSpeed = speed

      if (speed === 1) {
        audioFilter = 'anull' // No change
      } else if (speed >= 0.5 && speed <= 2.0) {
        audioFilter = `atempo=${speed}`
      } else {
        // Chain multiple atempo filters for extreme speeds
        const filters: string[] = []
        while (currentSpeed > 2.0) {
          filters.push('atempo=2.0')
          currentSpeed /= 2.0
        }
        while (currentSpeed < 0.5) {
          filters.push('atempo=0.5')
          currentSpeed /= 0.5
        }
        if (currentSpeed !== 1.0) {
          filters.push(`atempo=${currentSpeed}`)
        }
        audioFilter = filters.join(',')
      }

      console.log('Audio filter:', audioFilter)

      // Get input file extension
      const inputExt = audioFile.name.split('.').pop() || 'mp3'
      const inputFileName = `input.${inputExt}`
      const outputFileName = `output.${outputFormat}`

      console.log('Writing input file to FFmpeg...')
      // Write input file to FFmpeg virtual file system
      await ffmpeg.writeFile(inputFileName, await fetchFile(audioFile))

      // Run FFmpeg command
      const args = ['-i', inputFileName]

      if (audioFilter !== 'anull') {
        args.push('-af', audioFilter)
      }

      args.push('-y', outputFileName)

      console.log('Running FFmpeg with args:', args)
      await ffmpeg.exec(args)

      console.log('Reading output file...')
      // Read output file
      const data = await ffmpeg.readFile(outputFileName)

      // Clean up
      console.log('Cleaning up temporary files...')
      await ffmpeg.deleteFile(inputFileName)
      await ffmpeg.deleteFile(outputFileName)

      // Convert to Blob
      const blob = new Blob([data], { type: `audio/${outputFormat}` })
      console.log('Export successful! Blob size:', blob.size, 'bytes')
      return blob
    } catch (err) {
      console.error('Export failed:', err)
      setError('Failed to export audio. Please try again.')
      return null
    }
  }

  return {
    loaded,
    loading,
    error,
    exportAudio,
  }
}
