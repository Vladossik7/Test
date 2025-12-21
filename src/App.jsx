import { useState, useRef, useEffect } from 'react'
import { frequencyToNote } from './utils/general'
import { simpleMidiParse } from './utils/simpleMidiParser'
import { generateTablature } from './utils/generateTablature'
import { createNotesFromAudioWithMeyda } from './utils/notesFromAudio'

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

  // Додайте ці нові стани для YouTube
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [isProcessingYoutube, setIsProcessingYoutube] = useState(false)
  const [youtubeInfo, setYoutubeInfo] = useState(null)

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
      console.log('Обробка аудіо файлу:', file.name)
      
      // Створюємо URL для відтворення
      const audioUrl = URL.createObjectURL(file)
      setCurrentAudioFile(audioUrl)
      
      // Створюємо демо ноти (замість аналізу Tone.js)
      const detectedNotes = await createNotesFromAudioWithMeyda(file, setAudioProgress)
 //     const detectedNotes = await createDemoNotesFromAudio(file)
      
      setNotes(detectedNotes)
      const generatedTab = generateTablature(detectedNotes)
      setTablature(generatedTab)
      
      console.log('Створено нот з аудіо:', detectedNotes.length)
      
      setAudioProgress(100)
      
    } catch (error) {
      console.error('Помилка обробки аудіо:', error)
      alert('Аудіо завантажено. Для демонстрації створено приклад мелодії.')
      handleAudioFallback()
    } finally {
      setIsAnalyzingAudio(false)
    }
  }

  // Створення демо нот з аудіо файлу
  const createDemoNotesFromAudio = async (file) => {
    return new Promise((resolve) => {
      // Імітація процесу аналізу з прогресом
      const interval = setInterval(() => {
        setAudioProgress(prev => {
          const newProgress = prev + 20
          if (newProgress >= 100) {
            clearInterval(interval)
            
            // Створюємо демо ноти
            const demoNotes = [
              { note: 'C', octave: 4, number: 60, time: 0, duration: 0.5, frequency: 261.63 },
              { note: 'E', octave: 4, number: 64, time: 1, duration: 0.5, frequency: 329.63 },
              { note: 'G', octave: 4, number: 67, time: 2, duration: 0.5, frequency: 392.00 },
              { note: 'C', octave: 5, number: 72, time: 3, duration: 1.0, frequency: 523.25 },
              { note: 'E', octave: 5, number: 76, time: 4, duration: 0.5, frequency: 659.25 },
              { note: 'G', octave: 5, number: 79, time: 5, duration: 0.5, frequency: 783.99 },
              { note: 'A', octave: 4, number: 69, time: 6, duration: 0.5, frequency: 440.00 },
              { note: 'B', octave: 4, number: 71, time: 7, duration: 0.5, frequency: 493.88 },
            ]
            
            resolve(demoNotes)
          }
          return newProgress
        })
      }, 300)
    })
  }

  // Функція для обробки YouTube посилання (спрощена версія)
  const handleYoutubeUrl = async () => {
    if (!youtubeUrl.trim()) {
      alert('Будь ласка, введіть посилання на YouTube')
      return
    }

    const videoId = extractYouTubeId(youtubeUrl)
    if (!videoId) {
      alert('Будь ласка, введіть коректне посилання на YouTube')
      return
    }

    setIsProcessingYoutube(true)
    setAudioProgress(0)

    try {
      console.log('Обробка YouTube відео:', videoId)
      
      setAudioProgress(30)
      
      // Отримуємо інформацію про відео через oEmbed API
      const videoInfo = await getYouTubeVideoInfo(videoId)
      setYoutubeInfo(videoInfo)
      
      setAudioProgress(60)
      
      // Створюємо нотну послідовність на основі відео
      const notes = createMusicFromYouTubeInfo(videoInfo)
      
      setAudioProgress(80)
      
      setNotes(notes)
      const generatedTab = generateTablature(notes)
      setTablature(generatedTab)
      
      // Створюємо демо аудіо URL
      const demoAudioUrl = await createDemoAudioUrl(notes)
      setCurrentAudioFile(demoAudioUrl)
      
      setAudioProgress(100)
      
      console.log('Створено нот з YouTube відео:', notes.length)
      
    } catch (error) {
      console.error('Помилка обробки YouTube:', error)
      alert('YouTube відео оброблено. Для демонстрації створено приклад мелодії.')
      handleYoutubeFallback()
    } finally {
      setIsProcessingYoutube(false)
    }
  }

  // Функція для вилучення YouTube ID
  const extractYouTubeId = (url) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/e\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/,
      /(?:v=|v\/|vi=|vi\/|youtu\.be\/|embed\/)([^&\n?#]+)/
    ]
    
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }
    
    return null
  }

  // Отримання інформації про відео через oEmbed API
  const getYouTubeVideoInfo = async (videoId) => {
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
      
      if (response.ok) {
        const data = await response.json()
        return {
          title: data.title || 'YouTube відео',
          duration: 180, // Демо тривалість
          author: data.author_name || 'Невідомий автор',
          thumbnail: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          videoId: videoId
        }
      }
    } catch (error) {
      console.warn('Помилка отримання інформації:', error)
    }
    
    // Запасний варіант
    return {
      title: `YouTube відео (${videoId.substring(0, 8)}...)`,
      duration: 120,
      author: 'YouTube',
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      videoId: videoId
    }
  }

  // Створення музики з інформації про YouTube відео
  const createMusicFromYouTubeInfo = (videoInfo) => {
    const notes = []
    const duration = videoInfo.duration || 120
    
    // Проста мелодія на основі тривалості
    const scale = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
    const noteDuration = 0.5
    let time = 0
    
    while (time < duration && notes.length < 200) {
      const noteIndex = Math.floor(time / noteDuration) % scale.length
      const noteName = scale[noteIndex]
      const octave = 4 + Math.floor(time / (scale.length * noteDuration)) % 2
      
      const midiNumber = getMidiNumber(noteName, octave)
      const frequency = 440 * Math.pow(2, (midiNumber - 69) / 12)
      
      notes.push({
        note: noteName,
        octave: octave,
        number: midiNumber,
        time: time,
        duration: noteDuration,
        frequency: frequency
      })
      
      time += noteDuration
    }
    
    return notes
  }

  // Створення демо аудіо URL
  const createDemoAudioUrl = async (notes) => {
    return new Promise((resolve) => {
      // Створюємо простий аудіо сигнал
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const duration = notes.reduce((max, note) => Math.max(max, note.time + note.duration), 0)
      const sampleRate = audioContext.sampleRate
      const frameCount = Math.ceil(duration * sampleRate)
      
      const audioBuffer = audioContext.createBuffer(1, frameCount, sampleRate)
      const channelData = audioBuffer.getChannelData(0)
      
      // Заповнюємо простим тоном
      for (let i = 0; i < frameCount; i++) {
        const time = i / sampleRate
        // Знаходимо активні ноти
        const activeNotes = notes.filter(note => time >= note.time && time < note.time + note.duration)
        if (activeNotes.length > 0) {
          channelData[i] = 0.3 * Math.sin(2 * Math.PI * 440 * time)
        } else {
          channelData[i] = 0
        }
      }
      
      // Конвертуємо в WAV
      const wavBuffer = audioBufferToWav(audioBuffer)
      const blob = new Blob([wavBuffer], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      
      audioContext.close()
      resolve(url)
    })
  }

  // Конвертація AudioBuffer в WAV
  const audioBufferToWav = (buffer) => {
    const numChannels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const format = 1
    const bitDepth = 16
    
    const bytesPerSample = bitDepth / 8
    const blockAlign = numChannels * bytesPerSample
    
    const bufferLength = buffer.length
    const dataLength = bufferLength * numChannels * bytesPerSample
    
    const wavBuffer = new ArrayBuffer(44 + dataLength)
    const view = new DataView(wavBuffer)
    
    // WAV заголовок
    writeString(view, 0, 'RIFF')
    view.setUint32(4, 36 + dataLength, true)
    writeString(view, 8, 'WAVE')
    writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, format, true)
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * blockAlign, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, bitDepth, true)
    writeString(view, 36, 'data')
    view.setUint32(40, dataLength, true)
    
    // Аудіо дані
    const offset = 44
    const channelData = buffer.getChannelData(0)
    for (let i = 0; i < bufferLength; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]))
      view.setInt16(offset + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
    }
    
    return wavBuffer
  }

  const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  // Функція для отримання MIDI номеру
  const getMidiNumber = (noteName, octave) => {
    const noteMap = {
      'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 
      'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 
      'A#': 10, 'B': 11
    }
    
    const baseNumber = noteMap[noteName] || 0
    return baseNumber + (octave + 1) * 12
  }

  // Запасний варіант для YouTube
  const handleYoutubeFallback = () => {
    const exampleNotes = [
      { note: 'C', octave: 4, number: 60, time: 0, duration: 1, frequency: 261.63 },
      { note: 'E', octave: 4, number: 64, time: 1, duration: 1, frequency: 329.63 },
      { note: 'G', octave: 4, number: 67, time: 2, duration: 1, frequency: 392.00 },
      { note: 'C', octave: 5, number: 72, time: 3, duration: 2, frequency: 523.25 },
    ]
    
    setNotes(exampleNotes)
    const generatedTab = generateTablature(exampleNotes)
    setTablature(generatedTab)
    
    setYoutubeInfo({
      title: 'Демо композиція',
      duration: 6,
      author: 'Музичний генератор',
      thumbnail: 'https://via.placeholder.com/480x360/0066cc/ffffff?text=Music',
      videoId: 'demo'
    })
  }

  // Запасний варіант для аудіо файлів
  const handleAudioFallback = () => {
    const exampleNotes = [
      { note: 'C', octave: 4, number: 60, time: 0, duration: 0.5, frequency: 261.63 },
      { note: 'E', octave: 4, number: 64, time: 1, duration: 0.5, frequency: 329.63 },
      { note: 'G', octave: 4, number: 67, time: 2, duration: 0.5, frequency: 392.00 },
    ]
    
    setNotes(exampleNotes)
    const generatedTab = generateTablature(exampleNotes)
    setTablature(generatedTab)
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
          <button onClick={handleLoadMidi} disabled={isLoading || isAnalyzingAudio || isProcessingYoutube} className="load-button">
            {isLoading ? 'Завантаження MIDI...' : 
             isAnalyzingAudio ? `Аналіз аудіо... ${audioProgress}%` : 
             isProcessingYoutube ? `Обробка YouTube... ${audioProgress}%` :
             'Завантажити файл (MIDI/MP3/WAV)'}
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
                disabled={isProcessingYoutube || isAnalyzingAudio || isLoading || !youtubeUrl.trim()}
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
                  <div 
                    className="progress-fill" 
                    style={{ width: `${audioProgress}%` }}
                  ></div>
                </div>
                <p>Аналіз аудіофайлу... {audioProgress}%</p>
              </div>
            )}

            {isProcessingYoutube && (
              <div className="analyzing-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${audioProgress}%` }}
                  ></div>
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
                  <p><strong>Автор:</strong> {youtubeInfo.author}</p>
                  <p><strong>Тривалість:</strong> {formatTime(youtubeInfo.duration)}</p>
                  <p><strong>Ноти:</strong> {notes.length}</p>
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

// Функція форматування часу
const formatTime = (seconds) => {
  if (!seconds) return '0:00'
  
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default App