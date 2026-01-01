import * as Tone from 'tone'

const notesArray = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const A4 = 440

export const detectFrequency = (toneAnalyser) => {
  if (!toneAnalyser) return null

  const buffer = toneAnalyser.getValue()
  const sampleRate = Tone.context.sampleRate

  return detectFrequencyFromBuffer(buffer, sampleRate)
}

export const detectFrequencyFromBuffer = (samples, sampleRate) => {
  // 1. RMS (Гучність)
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  const rms = Math.sqrt(sum / samples.length)
  if (rms < 0.005) return 0 // Наш поріг чутливості

  // 2. Автокореляція
  let bestOffset = -1
  const minSamples = Math.floor(sampleRate / 450) // MAX_FREQ
  const maxSamples = Math.floor(sampleRate / 75) // MIN_FREQ

  let bestCorrelation = 1e9 // Шукаємо мінімальну різницю

  for (let offset = minSamples; offset < maxSamples; offset++) {
    let correlation = 0
    for (let i = 0; i < samples.length - offset; i++) {
      correlation += Math.abs(samples[i] - samples[i + offset])
    }
    if (correlation < bestCorrelation) {
      bestCorrelation = correlation
      bestOffset = offset
    }
  }

  const freq = sampleRate / bestOffset
  return freq
}

export const frequencyToNote = (frequency, startTime = 0, defaultDuration = 0.5) => {
  if (!frequency || frequency <= 0) return null

  try {
    const freqObj = Tone.Frequency(frequency, 'hz')
    const midiNumber = freqObj.toMidi()
    // КОРИГУВАННЯ ДЛЯ ГІТАРИ:
    // Додаємо 12 напівтонів (1 октаву), щоб ноти піднялися на стані
    const displayMidi = midiNumber + 12

    // Валідація діапазону
    if (midiNumber < 12 || midiNumber > 127) return null

    // const fullName = freqObj.toNote()
    const fullName = Tone.Frequency(displayMidi, 'midi').toNote()
    const octave = parseInt(fullName.slice(-1))
    const noteNameOnly = fullName.slice(0, -1)

    // ПОВЕРТАЄМО СТРУКТУРУ ЯК У MIDI ПАРСЕРА
    return {
      midi: displayMidi, // Основне поле для конвертера
      time: startTime,
      duration: defaultDuration,
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

export const getTabPosition = (midi) => {
  // 1. Опускаємо на октаву, якщо нота занадто висока для "першої позиції"
  // MIDI 75 (D#5) стане 63 (Eb4), що ідеально лягає на 2-гу або 3-тю струну.
  const correctedMidi = midi > 70 ? midi - 12 : midi

  // 2. MIDI відкритих струн: E4(64), B3(59), G3(55), D3(50), A2(45), E2(40)
  const tuning = [64, 59, 55, 50, 45, 40]

  // 3. Шукаємо струну, де лад буде від 0 до 12
  for (let i = 0; i < tuning.length; i++) {
    const fret = correctedMidi - tuning[i]
    if (fret >= 0 && fret <= 12) {
      return { str: i + 1, fret: fret }
    }
  }

  // 4. Якщо нота все ще занадто висока (наприклад, соло),
  // дозволяємо вищі лади, але тільки на 1-й струні
  if (correctedMidi > 76) {
    return { str: 1, fret: correctedMidi - 64 }
  }

  // 5. Крайній випадок (дуже низька нота) - 6-та струна
  return { str: 6, fret: Math.max(0, correctedMidi - 40) }
}

export const midiToNoteName = (midi) => {
  const octave = Math.floor(midi / 12)
  const noteIndex = midi % 12
  return {
    name: notesArray[noteIndex],
    octave: octave,
  }
}

export const getVexDuration = (duration) => {
  const d = duration * 2 || 0

  if (d > 0.8) return 'h'
  if (d > 0.5) return 'q'
  if (d > 0.3) return '8'
  return '8'
}

const getDurationValue = (dur) => {
  const values = {
    h: 0.5,
    q: 0.25,
    8: 0.125,
    16: 0.0625,
  }
  return values[dur] || 0.25
}

export const groupNotesIntoMeasures = (notes, numerator, denominator) => {
  const measureLimit = numerator / denominator
  const measures = []
  let currentMeasure = []
  let currentSum = 0

  notes.forEach((n) => {
    const dur = getVexDuration(n.duration)
    const val = getDurationValue(dur)

    // Якщо додання ноти перевищить ліміт такту (1.0), закриваємо поточний такт
    if (currentSum + val > measureLimit + 0.01) {
      measures.push(currentMeasure)
      currentMeasure = []
      currentSum = 0
    }

    currentMeasure.push(n)
    currentSum += val
  })

  if (currentMeasure.length > 0) {
    measures.push(currentMeasure)
  }
  return measures
}
