import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { frequencyToNote, detectFrequency, detectFrequencyFromBuffer } from './utils/general'
import { parseMidi } from './utils/simpleMidiParser'
import { useNoteDetection } from './utils/hooks'

import SheetMusic from './components/sheetMusic'
import { LoadExamples } from './components/loadExamples'

import './App.css'

const App = () => {
  const [audioNotes, setAudioNotes] = useState([])
  const [isRecording, setIsRecording] = useState(false)
  const [currentNote, setCurrentNote] = useState(null)

  const [notes, setNotes] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [timeSignature, setTimeSignature] = useState({ numerator: 4, denominator: 4 })
  const [title, setTitle] = useState('')
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false)
  const [audioProgress, setAudioProgress] = useState(0)
  const [currentAudioFile, setCurrentAudioFile] = useState(null)

  const audioPlayerRef = useRef(null)
  const fileInputRef = useRef(null)
  const analyserRef = useRef(null)
  const microphoneRef = useRef(null)
  const noteDetectionIntervalRef = useRef(null)

  const { processFrame, closeLastNote, recordedEvents, resetDetection } =
    useNoteDetection(frequencyToNote)

  const handleLoadMidi = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    const fileExtension = file.name.split('.').pop().toLowerCase()
    // Обробка MIDI файлів
    if (fileExtension === 'mid' || fileExtension === 'midi') {
      setIsLoading(true)

      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result

          const { notes: parsedNotes, timeSignature: sig, midiTitle } = parseMidi(arrayBuffer)
          setNotes(parsedNotes)
          setTimeSignature(sig)
          setTitle(midiTitle || file.name)
        } catch (error) {
          console.error('Помилка обробки MIDI:', error)
        } finally {
          setIsLoading(false)
        }
      }

      reader.onerror = (e) => {
        console.error('Помилка читання файлу:', e)
        setIsLoading(false)
      }

      reader.readAsArrayBuffer(file)
    } // Обробка аудіо файлів
    else if (fileExtension === 'mp3' || fileExtension === 'wav') {
      await handleAudioFile(file)
    } else {
      alert('Непідтримуваний формат файлу. Будь ласка, оберіть MIDI, MP3 або WAV файл.')
    }
  }

  const startRecording = async () => {
    resetDetection()
    setNotes([])
    setAudioNotes([])
    setTitle('Запис з мікрофона')

    try {
      await Tone.start()
      const mic = new Tone.UserMedia()
      await mic.open()

      const gain = new Tone.Gain(5)
      const analyser = new Tone.Analyser('waveform', 4096)
      mic.connect(gain)
      gain.connect(analyser)

      microphoneRef.current = mic
      setIsRecording(true)
      const startTimeOffset = Tone.now()

      noteDetectionIntervalRef.current = setInterval(() => {
        const elapsedTime = Tone.now() - startTimeOffset
        const frequency = detectFrequency(analyser)

        processFrame(frequency, elapsedTime)
      }, 70)
    } catch (error) {
      console.error('Recording Error:', error)
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    setIsRecording(false)
    setCurrentNote(null)

    if (noteDetectionIntervalRef.current) {
      clearInterval(noteDetectionIntervalRef.current)
      noteDetectionIntervalRef.current = null
    }

    cleanupAudio()

    if (audioNotes.length > 0) {
      const processed = audioNotes.map((n) => {
        let dur = n.duration
        if (dur > 0.6) dur = 1
        else if (dur > 0.3) dur = 0.5
        else dur = 0.25
        return { ...n, duration: dur }
      })

      setNotes(processed)
    }
  }

  const cleanupAudio = () => {
    if (noteDetectionIntervalRef.current) {
      clearInterval(noteDetectionIntervalRef.current)
      noteDetectionIntervalRef.current = null
    }

    if (microphoneRef.current) {
      if (microphoneRef.current.stream) {
        microphoneRef.current.stream.getTracks().forEach((track) => track.stop())
      }

      microphoneRef.current.dispose()
      microphoneRef.current = null
    }

    analyserRef.current = null
  }

  const clearRecording = () => {
    setAudioNotes([])
    setNotes([])
  }

  const playAudio = () => {
    if (audioPlayerRef.current && currentAudioFile) {
      audioPlayerRef.current.play()
    }
  }

  const pauseAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
    }
  }

  const handleAudioFile = async (file) => {
    const audioUrl = URL.createObjectURL(file)
    if (typeof setCurrentAudioFile === 'function') {
      setCurrentAudioFile(audioUrl)
    }

    setIsAnalyzingAudio(true)
    setAudioProgress(0)
    resetDetection()

    try {
      const arrayBuffer = await file.arrayBuffer()
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

      const channelData = audioBuffer.getChannelData(0)
      const sampleRate = audioBuffer.sampleRate
      const frameSize = 4096
      const step = 2048

      for (let i = 0; i < channelData.length - frameSize; i += step) {
        const slice = channelData.slice(i, i + frameSize)
        const elapsedTime = i / sampleRate

        const frequency = detectFrequencyFromBuffer(slice, sampleRate)
        processFrame(frequency, elapsedTime)

        if (i % (step * 50) === 0) {
          setAudioProgress(Math.round((i / channelData.length) * 100))
        }
      }

      closeLastNote(audioBuffer.duration)
      setAudioProgress(100)
    } catch (error) {
      console.error('Помилка аналізу файлу:', error)
    } finally {
      setIsAnalyzingAudio(false)
    }
  }

  useEffect(() => {
    return () => {
      if (currentAudioFile) {
        URL.revokeObjectURL(currentAudioFile)
      }
    }
  }, [currentAudioFile])

  useEffect(() => {
    setNotes(recordedEvents)
    setAudioNotes(recordedEvents)
  }, [recordedEvents])

  return (
    <div className="App">
      <header className="App-header">
        <div className="controls">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".mid,.midi,.mp3,.wav"
            style={{ display: 'none' }}
          />
          <button
            onClick={handleLoadMidi}
            disabled={isLoading || isAnalyzingAudio}
            className="load-button"
          >
            {isLoading
              ? 'Завантаження MIDI...'
              : isAnalyzingAudio
              ? `Аналіз аудіо... ${audioProgress}%`
              : 'Завантажити файл (MIDI/MP3/WAV)'}
          </button>

          <div className="audio-controls">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`record-button ${isRecording ? 'recording' : ''}`}
              disabled={isLoading || isAnalyzingAudio}
            >
              {isRecording ? 'Зупинити запис' : 'Записати з мікрофона'}
            </button>

            {currentAudioFile && (
              <div className="audio-player-controls">
                <button onClick={playAudio} className="play-button">
                  ▶ Відтворити аудіо
                </button>
                <button onClick={pauseAudio} className="pause-button">
                  ⏸ Пауза
                </button>
              </div>
            )}

            {isAnalyzingAudio && (
              <div className="analyzing-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${audioProgress}%` }}></div>
                </div>
                <p>Аналіз аудіофайлу... {audioProgress}%</p>
              </div>
            )}

            {isRecording && (
              <div className="recording-status">
                <div className="pulse-dot"></div>
                <span>Запис...</span>
                <div className="current-note">{currentNote || '...'}</div>
              </div>
            )}
          </div>

          {audioNotes.length > 0 && (
            <div className="audio-results">
              <h3>Записані ноти: {audioNotes.filter((n) => n.type === 'note').length}</h3>
              <div
                className="notes-list"
                style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}
              >
                {audioNotes
                  .filter((n) => n.type === 'note')
                  .map((item, index) => (
                    <div key={index} className="note-item">
                      <strong>{item.fullName || '??'}</strong> ({item.frequency}Hz) -{' '}
                      {item.duration.toFixed(2)}с
                    </div>
                  ))}
              </div>

              <button onClick={clearRecording} className="clear-button">
                Очистити
              </button>
            </div>
          )}
          <LoadExamples
            setNotes={setNotes}
            setTimeSignature={setTimeSignature}
            setTitle={setTitle}
            handleAudioFile={handleAudioFile}
          />
        </div>
        <div className="music-display">
          <h2>{title}</h2>
          <SheetMusic notes={notes} timeSignature={timeSignature} title={title} />
        </div>

        <audio
          ref={audioPlayerRef}
          src={currentAudioFile || undefined}
          style={{ display: 'none' }}
          controls
        />
      </header>
    </div>
  )
}

export default App
