import { getNoteName } from './general'

export const simpleMidiParse = (arrayBuffer) => {
  const parsedNotes = []
  try {
    const data = new Uint8Array(arrayBuffer)
    for (let i = 0; i < data.length - 2; i++) {
      if ((data[i] & 0xf0) === 0x90 && data[i + 2] > 0) {
        const noteNumber = data[i + 1]
        const noteName = getNoteName(noteNumber)
        const octave = Math.floor(noteNumber / 12) - 1

        parsedNotes.push({
          note: noteName,
          octave: octave,
          number: noteNumber,
          time: i,
        })
      }
    }
  } catch (error) {
    console.error('Помилка простого парсингу MIDI:', error)
  }

  return parsedNotes
}
