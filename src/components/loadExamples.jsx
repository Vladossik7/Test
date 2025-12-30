import React, { useState, useEffect } from 'react'
import { parseMidi } from '../utils/simpleMidiParser'

export const LoadExamples = ({ setNotes, setTimeSignature, setTitle }) => {
  const [fileList, setFileList] = useState([])
  const [status, setStatus] = useState('Скан папки...')
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    // 1. Vite автоматично знайде всі файли .mid у папці public/samples
    // eager: true дозволяє отримати дані одразу
    const midiModules = import.meta.glob('/public/samples/*.*', { eager: false })

    // 2. Витягуємо чисті імена файлів для інтерфейсу
    const names = Object.keys(midiModules).map((path) => {
      return path.split('/').pop() // Отримуємо тільки "filename.mid"
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

    try {
      // Завантажуємо файл через fetch (оскільки він у public)
      const response = await fetch(`/samples/${fileName}`)
      const arrayBuffer = await response.arrayBuffer()
      const { notes: parsedNotes, timeSignature: sig, midiTitle } = parseMidi(arrayBuffer)
      setNotes(parsedNotes)
      setTimeSignature(sig)
      setTitle(midiTitle || fileName)
      setStatus('Готово')
    } catch (error) {
      console.error('Помилка:', error)
      setStatus('Помилка завантаження')
    }
  }

  return (
    <div>
      <div onClick={handleExpand}>
        <p>
          {isExpanded ? <>🔽 </> : <>▶️ </>}
          Бібліотека зразків MIDI файлів ({fileList.length})
        </p>
        <p>{status !== 'Готово' && status}</p>
      </div>

      {isExpanded && (
        <div>
          {fileList.map((fileName) => (
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
