const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const A4 = 440

export const getNoteName = (noteNumber) => noteNames[noteNumber % 12]

export const frequencyToNote = (frequency) => {
  if (!frequency) return null

  const halfStepsFromA4 = Math.round(12 * Math.log2(frequency / A4))
  const midiNumber = 69 + halfStepsFromA4

  if (midiNumber < 21 || midiNumber > 108) return null

  const noteIndex = (midiNumber + 9) % 12
  const octave = Math.floor((midiNumber - 12) / 12)

  return {
    frequency: Math.round(frequency * 10) / 10,
    note: noteNames[noteIndex],
    octave: octave,
    midiNumber: midiNumber,
    fullName: `${noteNames[noteIndex]}${octave}`,
  }
}
