import { useState, useEffect } from 'react'
import { parseMidi } from '../utils/simpleMidiParser'

export const LoadExamples = ({ setNotes, setTimeSignature, setTitle, handleAudioFile }) => {
  const [fileList, setFileList] = useState([])
  const [status, setStatus] = useState('Скан папки...')
  const [isExpanded, setIsExpanded] = useState(false)
  const [sortedFilesList, setSortedFilesList] = useState({})

  useEffect(() => {
    const midiModules = import.meta.glob('/public/samples/*.*', { eager: false })

    const names = Object.keys(midiModules).map((path) => {
      return path.split('/').pop()
    })

    setFileList(names)
    if (names.length === 0) setStatus('Файлів не знайдено')
    else setStatus('Оберіть мелодію')
  }, [])

  const handleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  const handleFileChange = async (fileName) => {
    if (!fileName) return
    setStatus('Завантаження...')
    const fileExtension = fileName.split('.').pop().toLowerCase()
    try {
      // Завантажуємо файл через fetch (оскільки він у public)
      const response = await fetch(`/samples/${fileName}`)
      if (fileExtension === 'mid' || fileExtension === 'midi') {
        const arrayBuffer = await response.arrayBuffer()
        const { notes: parsedNotes, timeSignature: sig, midiTitle } = parseMidi(arrayBuffer)
        setNotes(parsedNotes)
        setTimeSignature(sig)
        setTitle(midiTitle || fileName)
      } else if (fileExtension === 'mp3' || fileExtension === 'wav') {
        const blob = await response.blob()
        handleAudioFile(blob)
        setTitle(fileName)
      }
      setStatus('Готово')
    } catch (error) {
      console.error('Помилка:', error)
      setStatus('Помилка завантаження')
    }
  }

  useEffect(() => {
    if (fileList && fileList.length) {
      setSortedFilesList(
        fileList.reduce(
          (acc, item) => {
            const fileExtension = item.split('.').pop().toLowerCase()
            if (fileExtension === 'mid' || fileExtension === 'midi') {
              acc.midi.push(item)
              return acc
            } else {
              acc.audio.push(item)
              return acc
            }
          },
          { midi: [], audio: [] }
        )
      )
    }
  }, [fileList])

  return (
    <div>
      <div onClick={handleExpand}>
        <p>
          {isExpanded ? <>🔽 </> : <>▶️ </>}
          Бібліотека зразків MIDI файлів ({fileList.length}) | {status !== 'Готово' && status}
        </p>
      </div>

      {isExpanded && (
        <div>
          {sortedFilesList.midi.map((fileName) => (
            <button key={fileName} onClick={() => handleFileChange(fileName)}>
              🎵 {fileName.replace(/_/g, ' ').replace(/-/g, ' ')}
            </button>
          ))}
          <div>-----------------</div>
          {sortedFilesList.audio.map((fileName) => (
            <button key={fileName} onClick={() => handleFileChange(fileName)}>
              🎵 {fileName.replace(/_/g, ' ').replace(/-/g, ' ')}
            </button>
          ))}
          {fileList.length === 0 && <p>Додайте .mid файли в /public/samples/</p>}
        </div>
      )}
    </div>
  )
}
