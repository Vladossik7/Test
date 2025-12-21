import { useState, useRef } from 'react'
import * as Tone from 'tone'

import { frequencyToNote } from './utils/general'
import { parseMidi } from './utils/simpleMidiParser'
import { generateTablature } from './utils/generateTablature'

import { TablatureView } from './components/tablature'
import SheetMusic from './components/sheetMusic'
import GuitarTabRenderer from './components/sheetAndTabs'

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
  const [activeView, setActiveView] = useState('both')
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef(null)

  // const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const microphoneRef = useRef(null)
  const recordingStartTimeRef = useRef(null)
  const noteDetectionIntervalRef = useRef(null)

  // --- MIDI FILE LOGIC ---
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
        const parsedNotes = parseMidi(arrayBuffer)
        setNotes(parsedNotes)
        const generatedTab = generateTablature(parsedNotes)
        setTablature(generatedTab)
      } catch (error) {
        console.error('Помилка обробки MIDI:', error)
        alert('Помилка при обробці MIDI файлу: ' + error.message)
      } finally {
        setIsLoading(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleViewChange = (view) => {
    setActiveView(view)
  }

  // --- AUDIO DETECTION LOGIC ---
  const detectFrequency = (toneAnalyser) => {
    if (!toneAnalyser) return null

    const buffer = toneAnalyser.getValue()
    const sampleRate = Tone.context.sampleRate

    let rms = 0
    for (let i = 0; i < buffer.length; i++) {
      rms += buffer[i] * buffer[i]
    }
    rms = Math.sqrt(rms / buffer.length)

    if (rms < 0.005) return null

    let bestOffset = -1
    let lastCorrelation = 1
    let bestCorrelation = 0

    for (let offset = 40; offset < 600; offset++) {
      let correlation = 0
      for (let i = 0; i < buffer.length / 2; i++) {
        correlation += Math.abs(buffer[i] - buffer[i + offset])
      }
      correlation = 1 - correlation / (buffer.length / 2)

      if (correlation > lastCorrelation && correlation > bestCorrelation) {
        bestCorrelation = correlation
        bestOffset = offset
      }
      lastCorrelation = correlation
    }

    if (bestCorrelation > 0.85 && bestOffset !== -1) {
      const frequency = sampleRate / bestOffset
      return frequency > 70 && frequency < 1200 ? frequency : null
    }

    return null
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

        // Update stats
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
  // const startRecording = async () => {
  //   setNotes([])
  //   setAudioNotes([])
  //   try {
  //     await Tone.start()
  //     const mic = new Tone.UserMedia()
  //     await mic.open()

  //     const gain = new Tone.Gain(7)
  //     const analyser = new Tone.Analyser('waveform', 4096)

  //     mic.connect(gain)
  //     gain.connect(analyser)

  //     analyserRef.current = analyser
  //     microphoneRef.current = mic

  //     setIsRecording(true)
  //     setCurrentNote(null)

  //     const startTimeOffset = Tone.now()
  //     recordingStartTimeRef.current = startTimeOffset

  //     let lastActiveNote = null
  //     const recordedEvents = []

  //     let stabilityCounter = 0
  //     const STABILITY_THRESHOLD = 1
  //     let pendingNote = null
  //     let lastDetectedMidi = null
  //     let lastDetectionTime = 0
  //     const DEBOUNCE_TIME = 0.35 // 350 мс ігноруємо ту саму ноту (налаштуй під свій темп)

  //     noteDetectionIntervalRef.current = setInterval(() => {
  //       const globalTime = Tone.now()
  //       const elapsedTime = globalTime - startTimeOffset

  //       const frequency = detectFrequency(analyserRef.current)
  //       const detected = frequency ? frequencyToNote(frequency, elapsedTime) : null

  //       if (detected) {
  //         setCurrentNote(detected.fullName)

  //         // 1. ПЕРЕВІРКА НА ДЕБАУНС:
  //         // Якщо це та сама нота, що була щойно записана, і пройшло мало часу - ігноруємо "перезапуск"
  //         const isDebounced =
  //           detected.midi === lastDetectedMidi && elapsedTime - lastDetectionTime < DEBOUNCE_TIME

  //         if (isDebounced) {
  //           // Просто оновлюємо час останньої активності, щоб нота не закрилася
  //           return
  //         }

  //         const isSameAsCurrent =
  //           lastActiveNote &&
  //           (detected.midi === lastActiveNote.midi ||
  //             Math.abs(detected.midi - lastActiveNote.midi) <= 0.8)

  //         if (isSameAsCurrent) {
  //           stabilityCounter = 0
  //           pendingNote = null
  //         } else {
  //           // 2. Логіка нової ноти
  //           if (pendingNote && Math.abs(detected.midi - pendingNote.midi) <= 0.5) {
  //             stabilityCounter++
  //           } else {
  //             pendingNote = detected
  //             stabilityCounter = 1
  //           }

  //           if (stabilityCounter >= STABILITY_THRESHOLD) {
  //             if (lastActiveNote) {
  //               const duration = elapsedTime - lastActiveNote.time
  //               if (duration > 0.1) {
  //                 recordedEvents.push({ ...lastActiveNote, duration, type: 'note' })
  //               }
  //             }
  //             lastActiveNote = { ...pendingNote, time: elapsedTime }

  //             // ОНОВЛЮЄМО дані останньої успішно початої ноти
  //             lastDetectedMidi = pendingNote.midi
  //             lastDetectionTime = elapsedTime

  //             stabilityCounter = 0
  //             pendingNote = null
  //           }
  //         }
  //       } else {
  //         // 3. Логіка тиші
  //         stabilityCounter = 0
  //         pendingNote = null

  //         if (lastActiveNote) {
  //           const duration = elapsedTime - lastActiveNote.time
  //           // Трішки збільшимо поріг для відкритої струни, щоб вона не переривалася мікро-тишею
  //           if (duration > 0.15) {
  //             recordedEvents.push({ ...lastActiveNote, duration, type: 'note' })
  //           }
  //           lastActiveNote = null
  //           lastDetectedMidi = null // Скидаємо після реальної тиші
  //         }
  //         setCurrentNote(null)
  //       }

  //       setAudioNotes([...recordedEvents])

  //       // Update stats
  //       const notesOnly = recordedEvents.filter((n) => n.type === 'note')
  //       if (notesOnly.length > 0) {
  //         const avgFreq = notesOnly.reduce((sum, n) => sum + n.frequency, 0) / notesOnly.length
  //         setRecordingStats({
  //           totalNotes: notesOnly.length,
  //           totalDuration: elapsedTime,
  //           avgFrequency: Math.round(avgFreq),
  //         })
  //       }
  //     }, 70)
  //   } catch (error) {
  //     console.error('Recording Error:', error)
  //     setIsRecording(false)
  //   }
  // }

  const stopRecording = () => {
    setIsRecording(false)
    setCurrentNote(null)

    if (noteDetectionIntervalRef.current) {
      clearInterval(noteDetectionIntervalRef.current)
      noteDetectionIntervalRef.current = null
    }

    if (audioNotes.length > 0) {
      const processed = audioNotes.map((n) => {
        let dur = n.duration
        // Більш гнучке квантування для коротких нот
        if (dur > 0.6) dur = 1 // Половинна/Ціла
        else if (dur > 0.3) dur = 0.5 // Чверть
        else dur = 0.25 // Восьма
        return { ...n, duration: dur }
      })

      // Важливо: прибираємо автоматичне злиття однакових нот,
      // якщо ви хочете бачити саме 3 окремі короткі ноти Соль (G2).
      setNotes(processed)
      setTablature(generateTablature(processed))
    }
    cleanupAudio()
  }

  const cleanupAudio = () => {
    if (noteDetectionIntervalRef.current) {
      clearInterval(noteDetectionIntervalRef.current)
    }
    if (microphoneRef.current) {
      microphoneRef.current.getTracks().forEach((track) => track.stop())
      microphoneRef.current.close()
      microphoneRef.current = null
    }
    analyserRef.current = null
  }

  const clearRecording = () => {
    setAudioNotes([])
    setNotes([])
    setRecordingStats({ totalNotes: 0, totalDuration: 0, avgFrequency: 0 })
  }

  const isSheetViewActive = activeView === 'sheet'
  const isTabsViewActive = activeView === 'tab'
  const isBothViewActive = activeView === 'both'

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
              <button
                className={isBothViewActive ? 'active' : ''}
                onClick={() => handleViewChange('both')}
              >
                Разом
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

        <div className="music-display">
          {isSheetViewActive && <SheetMusic notes={notes} />}
          {isTabsViewActive && <TablatureView tablature={tablature} />}
          {isBothViewActive && <GuitarTabRenderer notes={notes} />}
        </div>
      </header>
    </div>
  )
}

export default App

// import { useState, useRef } from 'react'
// import * as Tone from 'tone'

// import { frequencyToNote } from './utils/general'
// import {
//   parseMidi,
//   // simpleMidiParse
// } from './utils/simpleMidiParser'
// import { generateTablature } from './utils/generateTablature'

// import { TablatureView } from './components/tablature'
// import SheetMusic from './components/sheetMusic'
// import GuitarTabRenderer from './components/sheetAndTabs'

// import './App.css'

// function App() {
//   const [audioNotes, setAudioNotes] = useState([])
//   const [isRecording, setIsRecording] = useState(false)
//   const [currentNote, setCurrentNote] = useState(null)
//   const [recordingStats, setRecordingStats] = useState({
//     totalNotes: 0,
//     totalDuration: 0,
//     avgFrequency: 0,
//   })

//   const [notes, setNotes] = useState([])
//   const [tablature, setTablature] = useState([])
//   const [activeView, setActiveView] = useState('both')
//   const [isLoading, setIsLoading] = useState(false)
//   const fileInputRef = useRef(null)

//   const audioContextRef = useRef(null)
//   const analyserRef = useRef(null)
//   const microphoneRef = useRef(null)
//   const recordingStartTimeRef = useRef(null)
//   const noteDetectionIntervalRef = useRef(null)
//   const lastNotesRef = useRef([])

//   const handleLoadMidi = () => {
//     fileInputRef.current?.click()
//   }

//   const handleFileChange = async (event) => {
//     const file = event.target.files[0]
//     if (!file) return

//     setIsLoading(true)

//     const reader = new FileReader()
//     reader.onload = async (e) => {
//       try {
//         const arrayBuffer = e.target.result
//         console.log('MIDI файл завантажено:', file.name)

//         const parsedNotes = parseMidi(arrayBuffer)
//         // const parsedNotes = simpleMidiParse(arrayBuffer)
//         console.log('Розпарсені ноти:', parsedNotes)

//         setNotes(parsedNotes)

//         // Генеруємо табулатуру
//         const generatedTab = generateTablature(parsedNotes)
//         setTablature(generatedTab)

//         // Рендеримо нотний стан
//         //   setTimeout(() => {
//         // renderSheetMusic(parsedNotes);
//         // }, 100);
//       } catch (error) {
//         console.error('Помилка обробки MIDI:', error)
//         alert('Помилка при обробці MIDI файлу: ' + error.message)
//       } finally {
//         setIsLoading(false)
//       }
//     }

//     reader.onerror = (e) => {
//       console.error('Помилка читання файлу:', e)
//       setIsLoading(false)
//       alert('Помилка читання файлу')
//     }

//     reader.readAsArrayBuffer(file)
//   }

//   const handleViewChange = (view) => {
//     setActiveView(view)
//   }

//   // const detectFrequency = () => {
//   //   if (!analyserRef.current) return null

//   //   const bufferLength = analyserRef.current.frequencyBinCount
//   //   const dataArray = new Float32Array(bufferLength)
//   //   analyserRef.current.getFloatFrequencyData(dataArray)

//   //   let maxIndex = 0
//   //   let maxValue = -Infinity

//   //   for (let i = 0; i < bufferLength; i++) {
//   //     if (dataArray[i] > maxValue && dataArray[i] > -60) {
//   //       maxValue = dataArray[i]
//   //       maxIndex = i
//   //     }
//   //   }

//   //   if (maxValue === -Infinity) return null

//   //   const nyquist = audioContextRef.current.sampleRate / 2
//   //   const frequency = (maxIndex * nyquist) / bufferLength

//   //   return frequency > 80 && frequency < 2000 ? frequency : null
//   // }

//   // const startRecording = async () => {
//   //   try {
//   //     const AudioContext = window.AudioContext || window.webkitAudioContext
//   //     audioContextRef.current = new AudioContext()

//   //     const stream = await navigator.mediaDevices.getUserMedia({
//   //       audio: {
//   //         echoCancellation: true,
//   //         noiseSuppression: true,
//   //         sampleRate: 44100,
//   //       },
//   //     })

//   //     microphoneRef.current = stream
//   //     const source = audioContextRef.current.createMediaStreamSource(stream)
//   //     analyserRef.current = audioContextRef.current.createAnalyser()

//   //     analyserRef.current.fftSize = 4096
//   //     analyserRef.current.smoothingTimeConstant = 0.8
//   //     source.connect(analyserRef.current)

//   //     setIsRecording(true)
//   //     setAudioNotes([])
//   //     setCurrentNote(null)
//   //     lastNotesRef.current = []
//   //     recordingStartTimeRef.current = Date.now()

//   //     let lastNote = null
//   //     let noteStartTime = null
//   //     let silenceStartTime = null
//   //     const recordedNotes = []

//   //     noteDetectionIntervalRef.current = setInterval(() => {
//   //       const currentTime = Date.now()
//   //       const elapsedTime = (currentTime - recordingStartTimeRef.current) / 1000
//   //       const frequency = detectFrequency()
//   //       const detectedNote = frequency ? frequencyToNote(frequency) : null

//   //       if (detectedNote) {
//   //         setCurrentNote(detectedNote.fullName)
//   //         lastNotesRef.current.push(detectedNote)
//   //         if (lastNotesRef.current.length > 5) lastNotesRef.current.shift()
//   //       } else {
//   //         setCurrentNote(null)
//   //       }

//   //       if (detectedNote) {
//   //         if (silenceStartTime !== null) {
//   //           const silenceDuration = (currentTime - silenceStartTime) / 1000
//   //           if (silenceDuration > 0.2) {
//   //             recordedNotes.push({
//   //               type: 'silence',
//   //               duration: silenceDuration,
//   //               startTime: (silenceStartTime - recordingStartTimeRef.current) / 1000,
//   //             })
//   //           }
//   //           silenceStartTime = null
//   //         }

//   //         if (!lastNote || detectedNote.midiNumber !== lastNote.midiNumber) {
//   //           if (lastNote && noteStartTime !== null) {
//   //             const noteDuration = (currentTime - noteStartTime) / 1000
//   //             recordedNotes.push({
//   //               ...lastNote,
//   //               type: 'note',
//   //               duration: noteDuration,
//   //               startTime: (noteStartTime - recordingStartTimeRef.current) / 1000,
//   //             })
//   //           }
//   //           lastNote = detectedNote
//   //           noteStartTime = currentTime
//   //         }
//   //       } else {
//   //         if (lastNote && noteStartTime !== null) {
//   //           const noteDuration = (currentTime - noteStartTime) / 1000
//   //           recordedNotes.push({
//   //             ...lastNote,
//   //             type: 'note',
//   //             duration: noteDuration,
//   //             startTime: (noteStartTime - recordingStartTimeRef.current) / 1000,
//   //           })
//   //           lastNote = null
//   //           noteStartTime = null
//   //         }

//   //         if (silenceStartTime === null) {
//   //           silenceStartTime = currentTime
//   //         }
//   //       }

//   //       setAudioNotes([...recordedNotes])

//   //       const notesOnly = recordedNotes.filter((n) => n.type === 'note')
//   //       if (notesOnly.length > 0) {
//   //         const avgFreq =
//   //           notesOnly.reduce((sum, note) => sum + note.frequency, 0) / notesOnly.length
//   //         setRecordingStats({
//   //           totalNotes: notesOnly.length,
//   //           totalDuration: elapsedTime,
//   //           avgFrequency: Math.round(avgFreq),
//   //         })
//   //       }
//   //     }, 150)
//   //   } catch (error) {
//   //     console.error('Помилка при записі:', error)
//   //     setIsRecording(false)
//   //     cleanupAudio()
//   //   }
//   // }

//   const detectFrequency = (toneAnalyser) => {
//     if (!toneAnalyser) return null

//     // 1. Отримуємо дані (waveform)
//     const buffer = toneAnalyser.getValue()
//     const sampleRate = Tone.context.sampleRate

//     // 2. Обчислюємо RMS (гучність)
//     let rms = 0
//     for (let i = 0; i < buffer.length; i++) {
//       rms += buffer[i] * buffer[i]
//     }
//     rms = Math.sqrt(rms / buffer.length)

//     // ДІАГНОСТИКА: Якщо в консолі RMS дуже маленький (напр. 0.001),
//     // значить мікрофон не отримує сигнал або поріг занадто високий.
//     // console.log("Current RMS:", rms);

//     if (rms < 0.005) return null // Знизили поріг тиші

//     // 3. Алгоритм автокореляції (трохи спрощений для чутливості)
//     let bestOffset = -1
//     let lastCorrelation = 1
//     let bestCorrelation = 0

//     // Шукаємо перший пік кореляції
//     for (let offset = 40; offset < 600; offset++) {
//       let correlation = 0
//       for (let i = 0; i < buffer.length / 2; i++) {
//         correlation += Math.abs(buffer[i] - buffer[i + offset])
//       }
//       correlation = 1 - correlation / (buffer.length / 2)

//       // Шукаємо саме локальний максимум
//       if (correlation > lastCorrelation && correlation > bestCorrelation) {
//         bestCorrelation = correlation
//         bestOffset = offset
//       }
//       lastCorrelation = correlation
//     }

//     // Знизили поріг впевненості до 0.85 для стабільності
//     if (bestCorrelation > 0.85 && bestOffset !== -1) {
//       const frequency = sampleRate / bestOffset
//       return frequency > 70 && frequency < 1200 ? frequency : null
//     }

//     return null
//   }

//   const startRecording = async () => {
//     setNotes([]) // Очистити старі ноти перед новим записом
//     setAudioNotes([])
//     try {
//       await Tone.start()

//       const mic = new Tone.UserMedia()
//       await mic.open()

//       // Створюємо ланцюжок: Mic -> Gain (посилення) -> Analyser
//       // ПРИБИРАЄМО .toDestination(), щоб не було свисту з колонок
//       const gain = new Tone.Gain(7)
//       const analyser = new Tone.Analyser('waveform', 4096)

//       // ПРАВИЛЬНЕ ПІДКЛЮЧЕННЯ (ланцюжком)
//       mic.connect(gain)
//       gain.connect(analyser)

//       analyserRef.current = analyser
//       microphoneRef.current = mic // Зберігаємо для майбутнього cleanup

//       setIsRecording(true)
//       setAudioNotes([])
//       setCurrentNote(null)

//       const startTimeOffset = Tone.now()
//       recordingStartTimeRef.current = startTimeOffset

//       let lastActiveNote = null
//       const recordedNotes = []

//       // Зовні setInterval ініціалізуємо змінні
//       let stabilityCounter = 0
//       const STABILITY_THRESHOLD = 3 // Скільки циклів (по 100мс) нота має бути стабільною
//       let pendingNote = null // Нота, яка претендує на зміну

//       noteDetectionIntervalRef.current = setInterval(() => {
//         const globalTime = Tone.now()
//         const elapsedTime = globalTime - startTimeOffset

//         const frequency = detectFrequency(analyserRef.current)
//         const detected = frequency ? frequencyToNote(frequency, elapsedTime) : null

//         if (detected) {
//           setCurrentNote(detected.fullName)

//           // 1. Перевіряємо, чи це та сама нота, що вже грає (Hysteresis)
//           const isSameAsCurrent =
//             lastActiveNote &&
//             (detected.midi === lastActiveNote.midi ||
//               Math.abs(detected.midi - lastActiveNote.midi) <= 0.8)

//           if (isSameAsCurrent) {
//             // Стабільно грає та сама нота, скидаємо лічильник змін
//             stabilityCounter = 0
//             pendingNote = null
//           } else {
//             // 2. З'явилася НОВА частота. Перевіряємо, чи вона стабільна.
//             if (pendingNote && Math.abs(detected.midi - pendingNote.midi) <= 0.5) {
//               stabilityCounter++
//             } else {
//               pendingNote = detected
//               stabilityCounter = 1
//             }

//             // 3. Якщо нова нота протрималася достатньо довго — перемикаємось
//             if (stabilityCounter >= STABILITY_THRESHOLD) {
//               if (lastActiveNote) {
//                 const duration = elapsedTime - lastActiveNote.time
//                 if (duration > 0.15) {
//                   recordedNotes.push({ ...lastActiveNote, duration })
//                 }
//               }
//               lastActiveNote = { ...pendingNote, time: elapsedTime }
//               stabilityCounter = 0
//               pendingNote = null
//             }
//           }
//         } else {
//           // 4. ТИША (теж потребує невеликої затримки, щоб не було дірок)
//           stabilityCounter = 0
//           pendingNote = null

//           if (lastActiveNote) {
//             const finishedNote = {
//               ...lastActiveNote, // Копіюємо fullName, frequency та інше
//               type: 'note',
//               duration: Math.max(0.1, elapsedTime - lastActiveNote.time),
//             }
//             recordedNotes.push(finishedNote)
//           }
//           setCurrentNote(null)
//         }

//         setAudioNotes([...recordedNotes])
//       }, 100)
//       // noteDetectionIntervalRef.current = setInterval(() => {
//       //   const globalTime = Tone.now()
//       //   const elapsedTime = globalTime - startTimeOffset

//       //   const frequency = detectFrequency(analyserRef.current)
//       //   const detected = frequency ? frequencyToNote(frequency, elapsedTime) : null

//       //   if (detected) {
//       //     setCurrentNote(detected.fullName)

//       //     if (!lastActiveNote || detected.midi !== lastActiveNote.midi) {
//       //       if (lastActiveNote) {
//       //         const finishedNote = {
//       //           ...lastActiveNote,
//       //           duration: Math.max(0.1, elapsedTime - lastActiveNote.time),
//       //         }
//       //         recordedNotes.push(finishedNote)
//       //       }
//       //       lastActiveNote = { ...detected, time: elapsedTime }
//       //     }
//       //   } else {
//       //     if (lastActiveNote) {
//       //       const finishedNote = {
//       //         ...lastActiveNote,
//       //         duration: Math.max(0.1, elapsedTime - lastActiveNote.time),
//       //       }
//       //       recordedNotes.push(finishedNote)
//       //       lastActiveNote = null
//       //     }
//       //     setCurrentNote(null)
//       //   }

//       //   // Використовуємо копію масиву для React
//       //   if (recordedNotes.length !== audioNotes.length) {
//       //     setAudioNotes([...recordedNotes])
//       //   }
//       // }, 100)
//     } catch (error) {
//       console.error('Recording Error:', error)
//       setIsRecording(false)
//     }
//   }

//   const stopRecording = () => {
//     setIsRecording(false)
//     setCurrentNote(null)

//     if (noteDetectionIntervalRef.current) {
//       clearInterval(noteDetectionIntervalRef.current)
//       noteDetectionIntervalRef.current = null
//     }

//     if (audioNotes.length > 0) {
//       const processed = audioNotes.map((n) => {
//         let dur = n.duration

//         // Квантування тривалості до найближчого музичного значення
//         // Припускаємо темп ~120 BPM (0.5с = чверть)
//         if (dur > 1.5) dur = 2 // Ціла
//         else if (dur > 0.75) dur = 1 // Половинна
//         else if (dur > 0.35) dur = 0.5 // Чверть
//         else dur = 0.25 // Восьма

//         return { ...n, duration: dur }
//       })

//       // Об'єднуємо однакові ноти, що йдуть підряд (Double Check)
//       const mergedNotes = []
//       processed.forEach((n) => {
//         let last = mergedNotes[mergedNotes.length - 1]
//         if (last && last.midi === n.midi) {
//           last.duration += n.duration
//         } else {
//           mergedNotes.push(n)
//         }
//       })

//       setNotes(mergedNotes)
//       const generatedTab = generateTablature(mergedNotes)
//       setTablature(generatedTab)
//     }
//     cleanupAudio()
//   }
//   // const stopRecording = () => {
//   //   setIsRecording(false)
//   //   setCurrentNote(null)

//   //   if (noteDetectionIntervalRef.current) {
//   //     clearInterval(noteDetectionIntervalRef.current)
//   //     noteDetectionIntervalRef.current = null
//   //   }

//   //   if (audioNotes.length > 0) {
//   //     const finalNotes = [...audioNotes]
//   //     setAudioNotes(finalNotes)

//   //     const vexFlowNotes = finalNotes
//   //       .filter((item) => item.type === 'note')
//   //       .map((note, index) => ({
//   //         note: note.note,
//   //         octave: note.octave,
//   //         number: note.midiNumber,
//   //         time: index,
//   //         duration: Math.max(0.25, Math.min(2, note.duration)),
//   //       }))

//   //     if (vexFlowNotes.length > 0) {
//   //       setNotes(vexFlowNotes)
//   //       const generatedTab = generateTablature(vexFlowNotes)
//   //       setTablature(generatedTab)
//   //       // setTimeout(() => renderSheetMusic(vexFlowNotes), 100);
//   //     }
//   //   }

//   //   cleanupAudio()
//   // }

//   const cleanupAudio = () => {
//     if (noteDetectionIntervalRef.current) {
//       clearInterval(noteDetectionIntervalRef.current)
//       noteDetectionIntervalRef.current = null
//     }

//     if (microphoneRef.current) {
//       microphoneRef.current.getTracks().forEach((track) => track.stop())
//       microphoneRef.current = null
//     }

//     if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
//       audioContextRef.current.close()
//       audioContextRef.current = null
//     }

//     analyserRef.current = null
//   }

//   const clearRecording = () => {
//     setAudioNotes([])
//     setRecordingStats({ totalNotes: 0, totalDuration: 0, avgFrequency: 0 })
//   }

//   const isSheetViewActive = activeView === 'sheet'
//   const isTabsViewActive = activeView === 'tab'
//   const isBothViewActive = activeView === 'both'

//   return (
//     <div className="App">
//       <header className="App-header">
//         <div className="controls">
//           <input
//             type="file"
//             ref={fileInputRef}
//             onChange={handleFileChange}
//             accept=".mid,.midi"
//             style={{ display: 'none' }}
//           />
//           <button onClick={handleLoadMidi} disabled={isLoading} className="load-button">
//             {isLoading ? 'Завантаження...' : 'Завантажити MIDI файл'}
//           </button>

//           <div className="audio-controls">
//             <button
//               onClick={isRecording ? stopRecording : startRecording}
//               className={`record-button ${isRecording ? 'recording' : ''}`}
//               disabled={isLoading}
//             >
//               {isRecording ? 'Зупинити запис' : 'Записати з мікрофона'}
//             </button>

//             {isRecording && (
//               <div className="recording-status">
//                 <div className="pulse-dot"></div>
//                 <span>Запис...</span>
//                 <div className="current-note">{currentNote || '...'}</div>
//               </div>
//             )}
//           </div>

//           {notes.length > 0 && (
//             <div className="view-switcher">
//               <button
//                 className={isSheetViewActive ? 'active' : ''}
//                 onClick={() => handleViewChange('sheet')}
//               >
//                 Нотний стан
//               </button>
//               <button
//                 className={isTabsViewActive ? 'active' : ''}
//                 onClick={() => handleViewChange('tab')}
//               >
//                 Табулатура
//               </button>
//               <button
//                 className={isBothViewActive ? 'active' : ''}
//                 onClick={() => handleViewChange('both')}
//               >
//                 Разом
//               </button>
//             </div>
//           )}
//         </div>

//         {/* === НОВИЙ БЛОК ВІДОБРАЖЕННЯ РЕЗУЛЬТАТІВ МІКРОФОНА === */}
//         {audioNotes.length > 0 && (
//           <div className="audio-results">
//             <h3>Записані ноти: {audioNotes.filter((n) => n.type === 'note').length}</h3>
//             <div className="notes-list">
//               {audioNotes.map((item, index) => (
//                 <div key={index} className={`note-item ${item.type}`}>
//                   {item.type === 'note'
//                     ? `${item.fullName || item.note || '???'} (${
//                         item.frequency
//                       }Hz) - ${item.duration.toFixed(2)}с`
//                     : `Пауза - ${item.duration.toFixed(2)}с`}
//                 </div>
//               ))}
//             </div>

//             <div className="recording-stats">
//               <div className="stat-box">
//                 <div className="stat-value">Кількість нот: {recordingStats.totalNotes}</div>
//               </div>
//               <div className="stat-box">
//                 <div className="stat-value">
//                   Тривалість: {recordingStats.totalDuration.toFixed(1)}с
//                 </div>
//               </div>
//               <div className="stat-box">
//                 <div className="stat-value">Середня частота: {recordingStats.avgFrequency}Hz</div>
//               </div>
//             </div>

//             <button onClick={clearRecording} className="clear-button">
//               Очистити запис
//             </button>
//           </div>
//         )}

//         <div className="music-display">
//           {isSheetViewActive && <SheetMusic notes={notes} />}
//           {isTabsViewActive && <TablatureView tablature={tablature} />}
//           {isBothViewActive && <GuitarTabRenderer notes={notes} />}
//         </div>
//       </header>
//     </div>
//   )
// }

// export default App
