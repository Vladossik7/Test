import { useState, useRef } from 'react'
import * as Tone from 'tone'

import { frequencyToNote, detectFrequency } from './utils/general'
import { parseMidi } from './utils/simpleMidiParser'

import SheetMusic from './components/sheetMusic'
import { LoadExamples } from './components/loadExamples'

import './App.css'

function App() {
  const [audioNotes, setAudioNotes] = useState([])
  const [isRecording, setIsRecording] = useState(false)
  const [currentNote, setCurrentNote] = useState(null)
  const [recordingStats, setRecordingStats] = useState({
    totalNotes: 0,
    totalDuration: 0,
    avgFrequency: 0,
  })

  const [notes, setNotes] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [timeSignature, setTimeSignature] = useState({ numerator: 4, denominator: 4 })
  const [title, setTitle] = useState('')

  const fileInputRef = useRef(null)
  const analyserRef = useRef(null)
  const microphoneRef = useRef(null)
  const recordingStartTimeRef = useRef(null)
  const noteDetectionIntervalRef = useRef(null)

  const handleLoadMidi = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event) => {
    const file = event.target.files[0]
    if (!file) return

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
    reader.readAsArrayBuffer(file)
  }

  const startRecording = async () => {
    setNotes([])
    setAudioNotes([])
    try {
      await Tone.start()
      const mic = new Tone.UserMedia()
      await mic.open()

      const gain = new Tone.Gain(5) // Трохи зменшили посилення, щоб не ловити шум
      const analyser = new Tone.Analyser('waveform', 4096)

      mic.connect(gain)
      gain.connect(analyser)

      analyserRef.current = analyser
      microphoneRef.current = mic

      setIsRecording(true)
      setCurrentNote(null)

      const startTimeOffset = Tone.now()
      recordingStartTimeRef.current = startTimeOffset

      let lastActiveNote = null
      const recordedEvents = []

      let stabilityCounter = 0
      const STABILITY_THRESHOLD = 1
      let pendingNote = null

      // ЗМІННІ ДЛЯ ФІЛЬТРАЦІЇ ЗАЙВОГО
      let lastDetectedMidi = null
      let lastDetectionTime = 0
      const DEBOUNCE_TIME = 0.4 // 400 мс ігноруємо ту саму ноту (щоб не було дублів струни)

      noteDetectionIntervalRef.current = setInterval(() => {
        const globalTime = Tone.now()
        const elapsedTime = globalTime - startTimeOffset

        const frequency = detectFrequency(analyserRef.current)

        // 1. ЧАСТОТНИЙ ФІЛЬТР: Гітара (особливо відкриті струни) лежить в межах 80-400Hz
        // Це миттєво прибере "сміття" типу D6 (1170Hz)
        if (frequency > 450 || frequency < 75) {
          return
        }

        const detected = frequency ? frequencyToNote(frequency, elapsedTime) : null

        if (detected) {
          setCurrentNote(detected.fullName)

          // 2. DEBOUNCE: Якщо це та сама нота, що була менше 0.4с тому - ігноруємо
          const isDebounced =
            detected.midi === lastDetectedMidi && elapsedTime - lastDetectionTime < DEBOUNCE_TIME

          if (isDebounced) return

          const isSameAsCurrent =
            lastActiveNote &&
            (detected.midi === lastActiveNote.midi ||
              Math.abs(detected.midi - lastActiveNote.midi) <= 0.8)

          if (isSameAsCurrent) {
            stabilityCounter = 0
            pendingNote = null
          } else {
            if (pendingNote && Math.abs(detected.midi - pendingNote.midi) <= 0.5) {
              stabilityCounter++
            } else {
              pendingNote = detected
              stabilityCounter = 1
            }

            if (stabilityCounter >= STABILITY_THRESHOLD) {
              if (lastActiveNote) {
                const duration = elapsedTime - lastActiveNote.time
                if (duration > 0.1) {
                  recordedEvents.push({ ...lastActiveNote, duration, type: 'note' })
                }
              }
              lastActiveNote = { ...pendingNote, time: elapsedTime }

              // Запам'ятовуємо останню чисту ноту
              lastDetectedMidi = pendingNote.midi
              lastDetectionTime = elapsedTime

              stabilityCounter = 0
              pendingNote = null
            }
          }
        } else {
          stabilityCounter = 0
          pendingNote = null

          if (lastActiveNote) {
            const duration = elapsedTime - lastActiveNote.time
            if (duration > 0.1) {
              recordedEvents.push({ ...lastActiveNote, duration, type: 'note' })
            }
            lastActiveNote = null
          }
          setCurrentNote(null)
        }

        setAudioNotes([...recordedEvents])

        const notesOnly = recordedEvents.filter((n) => n.type === 'note')
        if (notesOnly.length > 0) {
          const avgFreq = notesOnly.reduce((sum, n) => sum + n.frequency, 0) / notesOnly.length
          setRecordingStats({
            totalNotes: notesOnly.length,
            totalDuration: elapsedTime,
            avgFrequency: Math.round(avgFreq),
          })
        }
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
        // Більш гнучке квантування для коротких нот
        if (dur > 0.6) dur = 1 // Половинна/Ціла
        else if (dur > 0.3) dur = 0.5 // Чверть
        else dur = 0.25 // Восьма
        return { ...n, duration: dur }
      })

      setNotes(processed)
    }
  }

  const cleanupAudio = () => {
    // 1. Очищаємо інтервал детекції
    if (noteDetectionIntervalRef.current) {
      clearInterval(noteDetectionIntervalRef.current)
      noteDetectionIntervalRef.current = null
    }

    // 2. Робота з Tone.UserMedia
    if (microphoneRef.current) {
      // У Tone.UserMedia за закриття потоку відповідає метод .close()
      // Але щоб вимкнути лампочку мікрофона, треба також зупинити треки всередині
      if (microphoneRef.current.stream) {
        microphoneRef.current.stream.getTracks().forEach((track) => track.stop())
      }

      microphoneRef.current.dispose() // Повністю видаляємо об'єкт і звільняємо пам'ять
      microphoneRef.current = null
    }

    analyserRef.current = null
  }

  const clearRecording = () => {
    setAudioNotes([])
    setNotes([])
    setRecordingStats({ totalNotes: 0, totalDuration: 0, avgFrequency: 0 })
  }

  return (
    <div className="App">
      <header className="App-header">
        <div className="controls">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".mid,.midi"
            style={{ display: 'none' }}
          />
          <button onClick={handleLoadMidi} disabled={isLoading} className="load-button">
            {isLoading ? 'Завантаження...' : 'Завантажити MIDI файл'}
          </button>

          <div className="audio-controls">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`record-button ${isRecording ? 'recording' : ''}`}
            >
              {isRecording ? 'Зупинити запис' : 'Записати з мікрофона'}
            </button>

            {isRecording && (
              <div className="recording-status">
                <div className="pulse-dot"></div>
                <span>Запис...</span>
                <div className="current-note">{currentNote || '...'}</div>
              </div>
            )}
          </div>
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

            <div className="recording-stats">
              <span>Кількість: {recordingStats.totalNotes} | </span>
              <span>Час: {recordingStats.totalDuration.toFixed(1)}с | </span>
              <span>Сер. частота: {recordingStats.avgFrequency}Hz</span>
            </div>
            <button onClick={clearRecording} className="clear-button">
              Очистити
            </button>
          </div>
        )}
        <LoadExamples setNotes={setNotes} setTimeSignature={setTimeSignature} setTitle={setTitle} />
        <h2>{title}</h2>
        <div className="music-display">
          <SheetMusic notes={notes} timeSignature={timeSignature} title={title} />
        </div>
      </header>
    </div>
  )
}

export default App
