import { getNoteName } from './general'
import { Midi } from '@tonejs/midi'

export const parseMidi = (file) => {
  try {
    // 1. Читаємо файл як ArrayBuffer
    // const arrayBuffer = await file.arrayBuffer()

    // 2. Парсимо бінарні дані
    const midi = new Midi(file)

    console.log('MIDI loaded successfully:', midi.name)

    // 3. Беремо перший трек з нотами
    const track = midi.tracks.find((t) => t.notes.length > 0)
    if (!track) {
      console.warn('No notes found in any track')
      return []
    }

    return track.notes.map((note) => ({
      midi: note.midi,
      time: note.time,
      duration: note.duration,
      velocity: note.velocity,
    }))
  } catch (error) {
    console.error('Помилка при читанні MIDI:', error)
    return []
  }
  // // Завантажуємо MIDI файл
  // const midi = await Midi.fromUrl(fileUrl)

  // // MIDI файл може мати кілька треків
  // midi.tracks.forEach((track) => {
  //   // Ноти вже мають поля: name, midi, time, duration, velocity
  //   const notes = track.notes

  //   console.log('Track Name:', track.name)
  //   console.log('Notes in this track:', notes)

  //   // Тепер ви можете передати ці ноти у ваш конвертер табулатур
  //   // (Важливо: у @tonejs/midi поле називається 'midi', а не 'number')
  // })
}

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
