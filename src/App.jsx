import { useState, useRef, useEffect } from 'react'  // Додав useEffect
import * as Tone from 'tone'


import { frequencyToNote, analyzeAudioWithTone } from './utils/general'
import { simpleMidiParse } from './utils/simpleMidiParser'
import { generateTablature } from './utils/generateTablature'

import { TablatureView } from './components/tablature'
import SheetMusic from './components/sheetMusic'

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
  const [tablature, setTablature] = useState([])
  const [activeView, setActiveView] = useState('sheet')
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef(null)

  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false)
  const [audioProgress, setAudioProgress] = useState(0)
  const [currentAudioFile, setCurrentAudioFile] = useState(null)
  const audioPlayerRef = useRef(null)

  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const microphoneRef = useRef(null)
  const recordingStartTimeRef = useRef(null)
  const noteDetectionIntervalRef = useRef(null)
  const lastNotesRef = useRef([])

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
          console.log('MIDI файл завантажено:', file.name)

          const parsedNotes = simpleMidiParse(arrayBuffer)
          console.log('Розпарсені ноти:', parsedNotes)

          setNotes(parsedNotes)

          // Генеруємо табулатуру
          const generatedTab = generateTablature(parsedNotes)
          setTablature(generatedTab)

          // Очищаємо поточне аудіо
          setCurrentAudioFile(null)
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
    // Обробка аудіо файлів
    else if (fileExtension === 'mp3' || fileExtension === 'wav') {
      await handleAudioFile(file)
    }
    else {
      alert('Непідтримуваний формат файлу. Будь ласка, оберіть MIDI, MP3 або WAV файл.')
    }
  }

  const handleAudioFile = async (file) => {
  setIsAnalyzingAudio(true)
  setAudioProgress(0)
  
  try {
    console.log('Обробка аудіо файлу з Tone.js:', file.name)
    
    // Створюємо URL для відтворення
    const audioUrl = URL.createObjectURL(file)
    setCurrentAudioFile(audioUrl)
    
    setAudioProgress(20)
    
    // Використовуємо Tone.js для аналізу аудіо
    const detectedNotes = await analyzeAudioWithTone(file, setAudioProgress)
    
    setAudioProgress(80)
    
    setNotes(detectedNotes)
    const generatedTab = generateTablature(detectedNotes)
    setTablature(generatedTab)
    
    console.log('Виявлені ноти з аудіо:', detectedNotes)
    
    setAudioProgress(100)
    
  } catch (error) {
    console.error('Помилка обробки аудіо з Tone.js:', error)
  
  } finally {
    setIsAnalyzingAudio(false)
  }
}

  // Допоміжна функція для симуляції аналізу аудіо (тимчасово)
  const simulateAudioAnalysis = async (file) => {
    return new Promise((resolve) => {
      // Імітація процесу аналізу з прогресом
      const interval = setInterval(() => {
        setAudioProgress(prev => {
          const newProgress = prev + 10
          if (newProgress >= 100) {
            clearInterval(interval)
            
            // Створюємо тестові ноти (на практиці тут буде реальний аналіз)
            const testNotes = [
              { note: 'C', octave: 4, number: 60, time: 0, duration: 0.5, frequency: 261.63 },
              { note: 'E', octave: 4, number: 64, time: 1, duration: 0.5, frequency: 329.63 },
              { note: 'G', octave: 4, number: 67, time: 2, duration: 0.5, frequency: 392.00 },
              { note: 'C', octave: 5, number: 72, time: 3, duration: 1.0, frequency: 523.25 },
              { note: 'E', octave: 5, number: 76, time: 4, duration: 0.5, frequency: 659.25 },
              { note: 'G', octave: 5, number: 79, time: 5, duration: 0.5, frequency: 783.99 },
            ]
            
            resolve(testNotes)
          }
          return newProgress
        })
      }, 200)
    })
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
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      audioContextRef.current = new AudioContext()

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      })

      microphoneRef.current = stream
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()

      analyserRef.current.fftSize = 4096
      analyserRef.current.smoothingTimeConstant = 0.8
      source.connect(analyserRef.current)

      setIsRecording(true)
      setAudioNotes([])
      setCurrentNote(null)
      lastNotesRef.current = []
      recordingStartTimeRef.current = Date.now()

      let lastNote = null
      let noteStartTime = null
      let silenceStartTime = null
      const recordedNotes = []

      noteDetectionIntervalRef.current = setInterval(() => {
        const currentTime = Date.now()
        const elapsedTime = (currentTime - recordingStartTimeRef.current) / 1000
        const frequency = detectFrequency()
        const detectedNote = frequency ? frequencyToNote(frequency) : null

        if (detectedNote) {
          setCurrentNote(detectedNote.fullName)
          lastNotesRef.current.push(detectedNote)
          if (lastNotesRef.current.length > 5) lastNotesRef.current.shift()
        } else {
          setCurrentNote(null)
        }

        if (detectedNote) {
          if (silenceStartTime !== null) {
            const silenceDuration = (currentTime - silenceStartTime) / 1000
            if (silenceDuration > 0.2) {
              recordedNotes.push({
                type: 'silence',
                duration: silenceDuration,
                startTime: (silenceStartTime - recordingStartTimeRef.current) / 1000,
              })
            }
            silenceStartTime = null
          }

          if (!lastNote || detectedNote.midiNumber !== lastNote.midiNumber) {
            if (lastNote && noteStartTime !== null) {
              const noteDuration = (currentTime - noteStartTime) / 1000
              recordedNotes.push({
                ...lastNote,
                type: 'note',
                duration: noteDuration,
                startTime: (noteStartTime - recordingStartTimeRef.current) / 1000,
              })
            }
            lastNote = detectedNote
            noteStartTime = currentTime
          }
        } else {
          if (lastNote && noteStartTime !== null) {
            const noteDuration = (currentTime - noteStartTime) / 1000
            recordedNotes.push({
              ...lastNote,
              type: 'note',
              duration: noteDuration,
              startTime: (noteStartTime - recordingStartTimeRef.current) / 1000,
            })
            lastNote = null
            noteStartTime = null
          }

          if (silenceStartTime === null) {
            silenceStartTime = currentTime
          }
        }

        setAudioNotes([...recordedNotes])

        const notesOnly = recordedNotes.filter((n) => n.type === 'note')
        if (notesOnly.length > 0) {
          const avgFreq =
            notesOnly.reduce((sum, note) => sum + note.frequency, 0) / notesOnly.length
          setRecordingStats({
            totalNotes: notesOnly.length,
            totalDuration: elapsedTime,
            avgFrequency: Math.round(avgFreq),
          })
        }
      }, 150)
    } catch (error) {
      console.error('Помилка при записі:', error)
      setIsRecording(false)
      cleanupAudio()
    }
  }

  const stopRecording = () => {
    setIsRecording(false)
    setCurrentNote(null)

    if (noteDetectionIntervalRef.current) {
      clearInterval(noteDetectionIntervalRef.current)
      noteDetectionIntervalRef.current = null
    }

    if (audioNotes.length > 0) {
      const finalNotes = [...audioNotes]
      setAudioNotes(finalNotes)

      const vexFlowNotes = finalNotes
        .filter((item) => item.type === 'note')
        .map((note, index) => ({
          note: note.note,
          octave: note.octave,
          number: note.midiNumber,
          time: index,
          duration: Math.max(0.25, Math.min(2, note.duration)),
        }))

      if (vexFlowNotes.length > 0) {
        setNotes(vexFlowNotes)
        const generatedTab = generateTablature(vexFlowNotes)
        setTablature(generatedTab)
      }
    }

    cleanupAudio()
  }

  const cleanupAudio = () => {
    if (noteDetectionIntervalRef.current) {
      clearInterval(noteDetectionIntervalRef.current)
      noteDetectionIntervalRef.current = null
    }

    if (microphoneRef.current) {
      microphoneRef.current.getTracks().forEach((track) => track.stop())
      microphoneRef.current = null
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    analyserRef.current = null
  }

  const clearRecording = () => {
    setAudioNotes([])
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
          <button onClick={handleLoadMidi} disabled={isLoading || isAnalyzingAudio} className="load-button">
            {isLoading ? 'Завантаження MIDI...' : 
             isAnalyzingAudio ? `Аналіз аудіо... ${audioProgress}%` : 
             'Завантажити файл (MIDI/MP3/WAV)'}
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
                  <div 
                    className="progress-fill" 
                    style={{ width: `${audioProgress}%` }}
                  ></div>
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

        {/* === НОВИЙ БЛОК ВІДОБРАЖЕННЯ РЕЗУЛЬТАТІВ МІКРОФОНА === */}
        {audioNotes.length > 0 && (
          <div className="audio-results">
            <h3>Записані ноти: {audioNotes.filter((n) => n.type === 'note').length}</h3>
            <div className="notes-list">
              {audioNotes.map((item, index) => (
                <div key={index} className={`note-item ${item.type}`}>
                  {item.type === 'note'
                    ? `${item.fullName} (${item.frequency}Hz) - ${item.duration.toFixed(2)}с`
                    : `Пауза - ${item.duration.toFixed(2)}с`}
                </div>
              ))}
            </div>

            <div className="recording-stats">
              <div className="stat-box">
                <div className="stat-value">Кількість нот: {recordingStats.totalNotes}</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">
                  Тривалість: {recordingStats.totalDuration.toFixed(1)}с
                </div>
              </div>
              <div className="stat-box">
                <div className="stat-value">Середня частота: {recordingStats.avgFrequency}Hz</div>
              </div>
            </div>

            <button onClick={clearRecording} className="clear-button">
              Очистити запис
            </button>
          </div>
        )}

        <div className="music-display">
          {isSheetViewActive && <SheetMusic notes={notes} />}
          {isTabsViewActive && <TablatureView tablature={tablature} />}
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

export default App