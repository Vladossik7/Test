import { useRef } from 'react'
import { parseMidi } from '../utils/simpleMidiParser'
import { detectFrequencyFromBuffer } from '../utils/general'
import { LoadExamples } from './loadExamples'

export const LoadFromFile = ({
  isLoading,
  setIsLoading,
  setNotes,
  isAnalyzingAudio,
  setIsAnalyzingAudio,
  audioProgress,
  setTimeSignature,
  setTitle,
  setCurrentAudioFile,
  setAudioProgress,
  resetDetection,
  processFrame,
  closeLastNote,
}) => {
  const fileInputRef = useRef(null)
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

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".mid,.midi,.mp3,.wav"
        style={{ display: 'none' }}
      />
      <button onClick={handleLoadMidi} disabled={isLoading || isAnalyzingAudio}>
        {isLoading
          ? 'Завантаження MIDI...'
          : isAnalyzingAudio
          ? `Аналіз аудіо... ${audioProgress}%`
          : 'Завантажити файл (MIDI/MP3/WAV)'}
      </button>

      <LoadExamples
        setNotes={setNotes}
        setTimeSignature={setTimeSignature}
        setTitle={setTitle}
        handleAudioFile={handleAudioFile}
      />
    </>
  )
}
