import { useEffect, useState } from 'react'

import { DetectedNotes } from './detectedNotes'
import { LoadFromFile } from './loadFromFile'

import { frequencyToNote } from '../utils/general'
import { useNoteDetection } from '../utils/hooks'
import { RecordHandling } from './recordHandling'

export const AudioHandling = ({ setNotes, setTimeSignature, setTitle }) => {
  const [audioNotes, setAudioNotes] = useState([])
  const [currentAudioFile, setCurrentAudioFile] = useState(null)

  const [isLoading, setIsLoading] = useState(false)
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false)
  const [audioProgress, setAudioProgress] = useState(0)

  const { processFrame, closeLastNote, recordedEvents, resetDetection } =
    useNoteDetection(frequencyToNote)

  useEffect(() => {
    setNotes(recordedEvents)
    setAudioNotes(recordedEvents)
  }, [setNotes, recordedEvents])

  useEffect(() => {
    return () => {
      if (currentAudioFile) {
        URL.revokeObjectURL(currentAudioFile)
      }
    }
  }, [currentAudioFile])

  return (
    <>
      <div className="app-section">
        <LoadFromFile
          setIsLoading={setIsLoading}
          isLoading={isLoading}
          isAnalyzingAudio={isAnalyzingAudio}
          setIsAnalyzingAudio={setIsAnalyzingAudio}
          audioProgress={audioProgress}
          setTimeSignature={setTimeSignature}
          setTitle={setTitle}
          setNotes={setNotes}
          setCurrentAudioFile={setCurrentAudioFile}
          setAudioProgress={setAudioProgress}
          resetDetection={resetDetection}
          processFrame={processFrame}
          closeLastNote={closeLastNote}
        />
      </div>

      <div className="app-section">
        <RecordHandling
          resetDetection={resetDetection}
          processFrame={processFrame}
          isLoading={isLoading}
          audioProgress={audioProgress}
          isAnalyzingAudio={isAnalyzingAudio}
          currentAudioFile={currentAudioFile}
          setTitle={setTitle}
          audioNotes={audioNotes}
          setAudioNotes={setAudioNotes}
          setNotes={setNotes}
        />
        <DetectedNotes audioNotes={audioNotes} setNotes={setNotes} setAudioNotes={setAudioNotes} />
      </div>
    </>
  )
}
