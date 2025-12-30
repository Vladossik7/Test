import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { frequencyToNote, detectFrequency } from './utils/general'
import { parseMidi } from './utils/simpleMidiParser'
import { createNotesFromAudioWithMeyda } from './utils/notesFromAudio'

import SheetMusic from './components/sheetMusic'
import { LoadExamples } from './components/loadExamples'

import './App.css'

const App = () => {
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

  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false)
  const [audioProgress, setAudioProgress] = useState(0)
  const [currentAudioFile, setCurrentAudioFile] = useState(null)
  const audioPlayerRef = useRef(null)

  // Додайте ці нові стани для YouTube
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [isProcessingYoutube, setIsProcessingYoutube] = useState(false)
  const [youtubeInfo, setYoutubeInfo] = useState(null)
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
        console.log('MIDI файл завантажено:', file.name)

        const parsedNotes = simpleMidiParse(arrayBuffer)
        console.log('Розпарсені ноти:', parsedNotes)

        setNotes(parsedNotes)

        // Генеруємо табулатуру
        const generatedTab = generateTablature(parsedNotes)
        setTablature(generatedTab)

        // Рендеримо нотний стан
        //   setTimeout(() => {
        // renderSheetMusic(parsedNotes);
        // }, 100);
      } catch (error) {
        console.error('Помилка обробки MIDI:', error)
        alert('Помилка при обробці MIDI файлу: ' + error.message)
      } finally {
        setIsLoading(false)
      }
    }

    reader.onerror = (e) => {
      console.error('Помилка читання файлу:', e)
      setIsLoading(false)
      alert('Помилка читання файлу')
    }

    reader.readAsArrayBuffer(file)
  }

  const handleViewChange = (view) => {
    setActiveView(view)
  }

  const detectFrequency = () => {
    if (!analyserRef.current) return null

    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Float32Array(bufferLength)
    analyserRef.current.getFloatFrequencyData(dataArray)

    let maxIndex = 0
    let maxValue = -Infinity

    for (let i = 0; i < bufferLength; i++) {
      if (dataArray[i] > maxValue && dataArray[i] > -60) {
        maxValue = dataArray[i]
        maxIndex = i
      }
    }

    if (maxValue === -Infinity) return null

    const nyquist = audioContextRef.current.sampleRate / 2
    const frequency = (maxIndex * nyquist) / bufferLength

    return frequency > 80 && frequency < 2000 ? frequency : null
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

  // Очистка аудіо URL при розмонтуванні
  useEffect(() => {
    return () => {
      if (currentAudioFile) {
        URL.revokeObjectURL(currentAudioFile)
      }
    }
  }, [currentAudioFile])

  const isSheetViewActive = activeView === 'sheet'
  const isTabsViewActive = activeView === 'tab'

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
            disabled={isLoading || isAnalyzingAudio || isProcessingYoutube}
            className="load-button"
          >
            {isLoading
              ? 'Завантаження MIDI...'
              : isAnalyzingAudio
              ? `Аналіз аудіо... ${audioProgress}%`
              : isProcessingYoutube
              ? `Обробка YouTube... ${audioProgress}%`
              : 'Завантажити файл (MIDI/MP3/WAV)'}
          </button>

          <div className="youtube-section">
            <h3>Конвертер YouTube</h3>
            <div className="youtube-input-group">
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="Вставте посилання на YouTube відео..."
                className="youtube-input"
                disabled={isProcessingYoutube || isAnalyzingAudio || isLoading}
              />
              <button
                onClick={handleYoutubeUrl}
                disabled={
                  isProcessingYoutube || isAnalyzingAudio || isLoading || !youtubeUrl.trim()
                }
                className="youtube-button"
              >
                {isProcessingYoutube ? `Обробка... ${audioProgress}%` : 'Конвертувати в ноти'}
              </button>
            </div>
          </div>

          <div className="audio-controls">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`record-button ${isRecording ? 'recording' : ''}`}
              disabled={isLoading || isAnalyzingAudio || isProcessingYoutube}
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

            {isProcessingYoutube && (
              <div className="analyzing-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${audioProgress}%` }}></div>
                </div>
                <p>Обробка YouTube відео... {audioProgress}%</p>
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

          {youtubeInfo && (
            <div className="youtube-info">
              <div className="video-card">
                <img
                  src={youtubeInfo.thumbnail}
                  alt="YouTube thumbnail"
                  className="video-thumbnail"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/480x360/ff0000/ffffff?text=YouTube'
                  }}
                />
                <div className="video-details">
                  <h4>{youtubeInfo.title}</h4>
                  <p>
                    <strong>Автор:</strong> {youtubeInfo.author}
                  </p>
                  <p>
                    <strong>Тривалість:</strong> {formatTime(youtubeInfo.duration)}
                  </p>
                  <p>
                    <strong>Ноти:</strong> {notes.length}
                  </p>
                </div>
              </div>
            </div>
          )}

          {notes.length > 0 && (
            <div className="view-switcher">
              <button
                className={isSheetViewActive ? 'active' : ''}
                onClick={() => handleViewChange('sheet')}
              >
                Нотний стан
              </button>
              <button
                className={isTabsViewActive ? 'active' : ''}
                onClick={() => handleViewChange('tab')}
              >
                Табулатура
              </button>
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

        <audio
          ref={audioPlayerRef}
          src={currentAudioFile || ''}
          style={{ display: 'none' }}
          controls
        />
      </header>
    </div>
  )
}

// Функція форматування часу
const formatTime = (seconds) => {
  if (!seconds) return '0:00'

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default App
