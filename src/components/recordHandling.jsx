import React, { useRef, useState } from 'react'
import * as Tone from 'tone'

import { detectFrequency } from '../utils/general'

export const RecordHandling = ({
  resetDetection,
  processFrame,
  isLoading,
  audioProgress,
  isAnalyzingAudio,
  currentAudioFile,
  setTitle,
  audioNotes,
  setAudioNotes,
  setNotes,
}) => {
  const audioPlayerRef = useRef(null)
  const analyserRef = useRef(null)
  const microphoneRef = useRef(null)
  const noteDetectionIntervalRef = useRef(null)
  const [isRecording, setIsRecording] = useState(false)
  const [currentNote, setCurrentNote] = useState(null)

  const startRecording = async () => {
    resetDetection()
    setNotes([])
    setAudioNotes([])
    setTitle('Запис з мікрофона')
    // if (currentAudioFile) {
    //   URL.revokeObjectURL(currentAudioFile)
    // }

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
  return (
    <div className="audio-controls">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={isRecording ? 'recording' : ''}
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

      <audio
        ref={audioPlayerRef}
        src={currentAudioFile || undefined}
        style={{ display: 'none' }}
        controls
      />
    </div>
  )
}
