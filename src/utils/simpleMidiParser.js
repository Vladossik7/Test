import { Midi } from '@tonejs/midi'

export const parseMidi = (file) => {
  try {
    const midi = new Midi(file)

    // 1. Отримуємо розмір такту (беремо перший знайдений або 4/4 за дефолтом)
    const timeSignature = midi.header.timeSignatures[0]?.timeSignature
      ? {
          numerator: midi.header.timeSignatures[0]?.timeSignature[0],
          denominator: midi.header.timeSignatures[0]?.timeSignature[1],
        }
      : { numerator: 4, denominator: [4] }

    console.log('MIDI loaded successfully:', midi.name, timeSignature, midi)
    // 3. Беремо перший трек з нотами назвою, що відповідає гітарі чи ведучій партії
    const guitarTrack = midi.tracks.find(
      ({ name, notes }) =>
        (name.toLowerCase().includes('guitar') || name.toLowerCase().includes('lead')) &&
        notes.length > 0
    )
    const firstTrackWithNotes = midi.tracks.find(({ notes }) => notes.length > 0)
    const track = guitarTrack || firstTrackWithNotes

    if (!track) {
      console.warn('No notes found in any track')
      return []
    }

    const notes = track.notes.map((note) => ({
      midi: note.midi,
      time: note.time,
      duration: note.duration,
      velocity: note.velocity,
    }))

    return { notes, timeSignature, midiTitle: midi.name }
  } catch (error) {
    console.error('Помилка при читанні MIDI:', error)
    return { notes: [], timeSignature: { numerator: 4, denominator: 4 }, midiTitle: '' }
  }
}
