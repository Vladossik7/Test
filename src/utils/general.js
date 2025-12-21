import * as Tone from 'tone'

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const A4 = 440

export const getNoteName = (noteNumber) => noteNames[noteNumber % 12]

export const frequencyToNote = (frequency, startTime = 0, defaultDuration = 0.5) => {
  if (!frequency || frequency <= 0) return null

  try {
    const freqObj = Tone.Frequency(frequency, 'hz')
    const midiNumber = freqObj.toMidi()

    // Валідація діапазону
    if (midiNumber < 12 || midiNumber > 127) return null

    const fullName = freqObj.toNote()
    const octave = parseInt(fullName.slice(-1))
    const noteNameOnly = fullName.slice(0, -1)

    // ПОВЕРТАЄМО СТРУКТУРУ ЯК У MIDI ПАРСЕРА
    return {
      midi: midiNumber, // Основне поле для конвертера
      time: startTime, // Час початку
      duration: defaultDuration, // Тривалість
      // Додаткові поля (можуть бути корисні для відладки)
      frequency: Math.round(frequency * 10) / 10,
      fullName,
      note: noteNameOnly,
      octave: octave,
      velocity: 0.7, // Дефолтна сила натискання
    }
  } catch (e) {
    console.error('Помилка конвертації частоти:', e)
    return null
  }
}

// export const frequencyToNote = (frequency) => {
//   if (!frequency || frequency <= 0) return null

//   // Використовуємо Tone.Frequency для обчислень
//   const freqObj = Tone.Frequency(frequency, 'hz')

//   // Отримуємо назву ноти з октавою (напр. "C4", "G#2")
//   const fullName = freqObj.toNote()

//   // Отримуємо MIDI номер (напр. 60, 69)
//   const midiNumber = freqObj.toMidi()

//   // Перевірка на адекватність діапазону (Piano range: A0=21, C8=108)
//   // Для гітари це зазвичай 40 - 88+, але залишимо ширший для універсальності
//   if (midiNumber < 12 || midiNumber > 127) return null

//   // Визначаємо октаву та назву окремо
//   // В Tone.js назва ноти йде першою, остання цифра — октава
//   const octave = parseInt(fullName.slice(-1))
//   const noteNameOnly = fullName.slice(0, -1)

//   return {
//     frequency: Math.round(frequency * 10) / 10,
//     note: noteNameOnly,
//     octave: octave,
//     midiNumber: midiNumber,
//     fullName: fullName, // Tone.js повертає коректний формат "C#4"
//   }
// }

/* export const frequencyToNote = (frequency) => {
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
*/
