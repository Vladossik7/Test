// Логіка для генерації табулатури

const findOptimalPosition = (notes, tuning) => {
  const tabData = []

  const sortedNotes = [...notes].sort((a, b) => a.number - b.number)

  sortedNotes.forEach((note) => {
    const midiNote = note.number
    let bestString = -1
    let bestFret = -1
    let minFretDistance = Infinity

    for (let stringIndex = 0; stringIndex < tuning.length; stringIndex++) {
      const openStringNote = tuning[stringIndex]
      const fret = midiNote - openStringNote

      if (fret >= 0 && fret <= 18) {
        const isFretOccupied = tabData.some(
          (tab) => tab.fret === fret + 1 && tab.string === stringIndex + 1
        )
        const fretDistance = Math.abs(fret - 7)

        if (!isFretOccupied && fretDistance < minFretDistance) {
          bestString = stringIndex
          bestFret = fret
          minFretDistance = fretDistance
        }
      }
    }

    if (bestString !== -1) {
      tabData.push({
        string: bestString + 1,
        fret: bestFret + 1,
        note: midiNote,
        noteName: `${note.note}${note.octave}`,
        time: note.time,
      })
    }
  })

  return tabData
}

const findStartingFret = (tabData) => {
  if (tabData.length === 0) return 1

  const usedFrets = tabData.map((tab) => tab.fret)
  const minFret = Math.min(...usedFrets)

  return Math.max(1, minFret - 1)
}

export const generateTablature = (notes) => {
  if (!notes.length) return []

  const guitarTuning = [40, 45, 50, 55, 59, 64]

  const positions = []
  const notesPerPosition = 6

  for (let i = 0; i < notes.length; i += notesPerPosition) {
    const positionNotes = notes.slice(i, i + notesPerPosition)
    positions.push(positionNotes)
  }

  return positions.map((positionNotes, positionIndex) => {
    const tabData = findOptimalPosition(positionNotes, guitarTuning)
    return {
      position: positionIndex + 1,
      notes: positionNotes,
      tabData: tabData,
      startFret: findStartingFret(tabData),
    }
  })
}
