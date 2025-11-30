
export const getNoteName = (noteNumber) => {
    const noteNames = [
      "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
    ];
    return noteNames[noteNumber % 12];
  };