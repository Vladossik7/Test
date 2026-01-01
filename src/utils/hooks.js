import { useState, useRef } from 'react'

export const useNoteDetection = (frequencyToNote) => {
  const [recordedEvents, setRecordedEvents] = useState([])

  const stateRef = useRef({
    lastActiveNote: null,
    stabilityCounter: 0,
    pendingNote: null,
    lastDetectedMidi: null,
    lastDetectionTime: 0,
    events: [],
  })

  const STABILITY_THRESHOLD = 1
  const DEBOUNCE_TIME = 0.4
  const MIN_FREQ = 75
  const MAX_FREQ = 450

  const processFrame = (frequency, elapsedTime) => {
    const s = stateRef.current

    if (!frequency || frequency > MAX_FREQ || frequency < MIN_FREQ) {
      closeLastNote(elapsedTime)
      return
    }

    const detected = frequencyToNote(frequency, elapsedTime)
    if (!detected) {
      closeLastNote(elapsedTime)
      return
    }

    if (detected.midi === s.lastDetectedMidi && elapsedTime - s.lastDetectionTime < DEBOUNCE_TIME) {
      return
    }

    const isSameAsCurrent =
      s.lastActiveNote && Math.abs(detected.midi - s.lastActiveNote.midi) <= 0.8

    if (isSameAsCurrent) {
      s.stabilityCounter = 0
      s.pendingNote = null
    } else {
      if (s.pendingNote && Math.abs(detected.midi - s.pendingNote.midi) <= 0.5) {
        s.stabilityCounter++
      } else {
        s.pendingNote = detected
        s.stabilityCounter = 1
      }

      if (s.stabilityCounter >= STABILITY_THRESHOLD) {
        closeLastNote(elapsedTime)
        s.lastActiveNote = { ...s.pendingNote, time: elapsedTime }
        s.lastDetectedMidi = s.pendingNote.midi
        s.lastDetectionTime = elapsedTime
        s.stabilityCounter = 0
        s.pendingNote = null
      }
    }
  }

  const closeLastNote = (elapsedTime) => {
    const s = stateRef.current
    if (s.lastActiveNote) {
      const duration = elapsedTime - s.lastActiveNote.time
      if (duration > 0.1) {
        s.events.push({ ...s.lastActiveNote, duration, type: 'note' })
        setRecordedEvents([...s.events])
      }
      s.lastActiveNote = null
    }
  }

  const resetDetection = () => {
    stateRef.current = {
      lastActiveNote: null,
      stabilityCounter: 0,
      pendingNote: null,
      lastDetectedMidi: null,
      lastDetectionTime: 0,
      events: [],
    }
    setRecordedEvents([])
  }

  return {
    processFrame,
    closeLastNote,
    recordedEvents,
    resetDetection,
    lastActiveNote: stateRef.current.lastActiveNote,
  }
}
