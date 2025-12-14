import * as Tone from 'tone'


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

export const analyzeAudioWithTone = async (file, setAudioProgress) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Конвертуємо файл в URL
      const audioUrl = URL.createObjectURL(file)
      
      // Завантажуємо аудіо за допомогою Tone.Player
      const player = new Tone.Player({
        url: audioUrl,
        onload: async () => {
          try {
            console.log('Аудіо завантажено в Tone.js')
            
            // Отримуємо буфер з плеєра
            const audioBuffer = player.buffer
            
            if (!audioBuffer) {
              throw new Error('Не вдалося завантажити аудіо буфер')
            }
            
            // Аналізуємо аудіо
            const notes = await analyzeAudioBufferWithTone(audioBuffer, setAudioProgress)
            
            // Очищаємо URL
            URL.revokeObjectURL(audioUrl)
            player.dispose()
            
            resolve(notes)
            
          } catch (error) {
            URL.revokeObjectURL(audioUrl)
            player.dispose()
            reject(error)
          }
        },
        onerror: (error) => {
          URL.revokeObjectURL(audioUrl)
          player.dispose()
          reject(error)
        }
      })
      
    } catch (error) {
      reject(error)
    }
  })
}


// const detectNotesWithToneAnalysis = async (audioData, sampleRate, duration) => {
//   const notes = []
//   const segmentDuration = 0.1 // Аналізуємо кожні 100мс
//   const segmentSize = Math.floor(segmentDuration * sampleRate)
  
//   // Проходимо по аудіо сегментами
//   for (let i = 0; i < audioData.length - segmentSize; i += segmentSize) {
//     const progress = Math.floor((i / audioData.length) * 60) + 20
//     setAudioProgress(progress)
    
//     // Беремо сегмент аудіо
//     const segment = audioData.slice(i, i + segmentSize)
    
//     // Аналізуємо сегмент
//     const frequency = analyzeSegmentWithTone(segment, sampleRate)
    
//     if (frequency && frequency > 80 && frequency < 2000) {
//       const note = frequencyToNote(frequency)
//       const time = i / sampleRate
      
//       // Перевіряємо, чи це нова нота або продовження попередньої
//       if (notes.length === 0 || 
//           notes[notes.length - 1].number !== note.midiNumber ||
//           time - notes[notes.length - 1].time > 0.3) {
        
//         // Нова нота
//         notes.push({
//           note: note.note,
//           octave: note.octave,
//           number: note.midiNumber,
//           time: time,
//           duration: segmentDuration,
//           frequency: frequency
//         })
//       } else {
//         // Продовжуємо попередню ноту
//         notes[notes.length - 1].duration += segmentDuration
//       }
//     }
    
//     // Додаємо невелику затримку, щоб не блокувати UI
//     if (i % (segmentSize * 10) === 0) {
//       await new Promise(resolve => setTimeout(resolve, 1))
//     }
//   }
  
//   return notes
// }


const analyzeAudioBufferWithTone = async (audioBuffer, setAudioProgress) => {
  const notes = []
  
  try {
    // Отримуємо дані аудіо
    const duration = audioBuffer.duration
    const sampleRate = audioBuffer.sampleRate
    const channelData = audioBuffer.getChannelData(0) // беремо перший канал
    
    console.log(`Тривалість: ${duration}s, Частота: ${sampleRate}Hz`)
    
    // Налаштування аналізу
    const segmentDuration = 0.2 // Аналізуємо кожні 200мс
    const segmentSize = Math.floor(segmentDuration * sampleRate)
    const totalSegments = Math.floor(duration / segmentDuration)
    
    // Аналізуємо кожен сегмент
    for (let segmentIndex = 0; segmentIndex < totalSegments; segmentIndex++) {
      const progress = Math.floor((segmentIndex / totalSegments) * 80) + 20
      setAudioProgress(progress)
      
      const startSample = segmentIndex * segmentSize
      const endSample = Math.min(startSample + segmentSize, channelData.length)
      const segment = channelData.slice(startSample, endSample)
      
      // Аналізуємо сегмент
      const frequency = analyzeAudioSegment(segment, sampleRate)
      
      if (frequency && frequency > 80 && frequency < 2000) {
        const note = frequencyToNote(frequency)
        const time = segmentIndex * segmentDuration
        
        // Перевіряємо, чи це нова нота
        if (notes.length === 0 || 
            notes[notes.length - 1].number !== note.midiNumber ||
            time - notes[notes.length - 1].time > 0.5) {
          
          notes.push({
            note: note.note,
            octave: note.octave,
            number: note.midiNumber,
            time: time,
            duration: segmentDuration,
            frequency: frequency
          })
        } else {
          // Продовжуємо попередню ноту
          notes[notes.length - 1].duration += segmentDuration
        }
      }
      
      // Додаємо затримку для UI
      if (segmentIndex % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1))
      }
    }
    
    // Якщо нот не знайдено, створюємо приклад
    if (notes.length === 0) {
      console.log('Ноти не знайдені, створюємо приклад')
      // return createExampleNotes(duration)
    }
    
    return notes
    
  } catch (error) {
    console.error('Помилка аналізу буфера:', error)
    // Повертаємо приклад нот у разі помилки
    // return createExampleNotes(audioBuffer.duration || 10)
  }
}

const analyzeAudioSegment = (audioData, sampleRate) => {
  try {
    // Використовуємо простий алгоритм автокореляції для визначення частоти
    
    // Нормалізуємо дані
    const normalizedData = normalizeAudioData(audioData)
    
    if (!normalizedData) return null
    
    // Обчислюємо автокореляцію
    const correlation = computeAutocorrelation(normalizedData)
    
    // Знаходимо перший пік після першого мінімуму
    const frequency = findFundamentalFrequency(correlation, sampleRate)
    
    return frequency
    
  } catch (error) {
    console.warn('Помилка аналізу сегменту:', error)
    return null
  }
}

const normalizeAudioData = (data) => {
  // Знаходимо максимальне значення
  let max = 0
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > max) {
      max = Math.abs(data[i])
    }
  }
  
  // Якщо сигнал занадто слабкий, ігноруємо
  if (max < 0.01) return null
  
  // Нормалізуємо
  const normalized = new Float32Array(data.length)
  for (let i = 0; i < data.length; i++) {
    normalized[i] = data[i] / max
  }
  
  return normalized
}

const computeAutocorrelation = (data) => {
  const n = data.length
  const correlation = new Float32Array(n)
  
  for (let lag = 0; lag < n; lag++) {
    let sum = 0
    for (let i = 0; i < n - lag; i++) {
      sum += data[i] * data[i + lag]
    }
    correlation[lag] = sum / (n - lag)
  }
  
  return correlation
}

const findFundamentalFrequency = (correlation, sampleRate) => {
  // Шукаємо перший мінімум
  let minIndex = 0
  for (let i = 1; i < 50; i++) {
    if (correlation[i] < correlation[minIndex]) {
      minIndex = i
    }
  }
  
  // Шукаємо перший максимум після мінімуму
  let maxIndex = minIndex
  for (let i = minIndex + 1; i < correlation.length / 2; i++) {
    if (correlation[i] > correlation[maxIndex]) {
      maxIndex = i
    }
  }
  
  // Перевіряємо, чи пік досить сильний
  if (maxIndex === 0 || correlation[maxIndex] < 0.1) {
    return null
  }
  
  // Обчислюємо частоту
  const frequency = sampleRate / maxIndex
  
  // Фільтруємо нереальні значення
  if (frequency >= 80 && frequency <= 2000) {
    return frequency
  }
  
  return null
}



/* const createExampleNotes = (duration) => {
  const notes = []
  const noteDuration = 1 // секунда
  const availableNotes = [
    { note: 'C', octave: 4, frequency: 261.63 },
    { note: 'D', octave: 4, frequency: 293.66 },
    { note: 'E', octave: 4, frequency: 329.63 },
    { note: 'F', octave: 4, frequency: 349.23 },
    { note: 'G', octave: 4, frequency: 392.00 },
    { note: 'A', octave: 4, frequency: 440.00 },
    { note: 'B', octave: 4, frequency: 493.88 },
  ]
  
  let time = 0
  let noteIndex = 0
  
  while (time < duration && noteIndex < availableNotes.length) {
    const baseNote = availableNotes[noteIndex % availableNotes.length]
    
    // Додаємо випадкові варіації октав
    const octaveVariation = Math.floor(Math.random() * 3) - 1 // -1, 0, або +1
    const octave = Math.max(2, Math.min(6, baseNote.octave + octaveVariation))
    
    // Обчислюємо MIDI номер та частоту для нової октави
    const midiNumber = getMidiNumber(baseNote.note, octave)
    const frequency = baseNote.frequency * Math.pow(2, octaveVariation)
    
    notes.push({
      note: baseNote.note,
      octave: octave,
      number: midiNumber,
      time: time,
      duration: Math.min(noteDuration, duration - time),
      frequency: frequency
    })
    
    time += noteDuration
    noteIndex++
  }
  
  return notes
}
  */ 

const getMidiNumber = (noteName, octave) => {
  const noteMap = {
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 
    'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 
    'A#': 10, 'B': 11
  }
  
  const baseNumber = noteMap[noteName] || 0
  return baseNumber + (octave + 1) * 12
}


// const analyzeSegmentWithTone = (audioSegment, sampleRate) => {
//   try {
//     // Використовуємо FFT для аналізу частоти
//     const fftSize = 4096
//     const nyquist = sampleRate / 2
    
//     // Знаходимо пік у частотному спектрі
//     const fft = new FFT(fftSize, sampleRate)
//     fft.forward(audioSegment)
    
//     let maxIndex = 0
//     let maxValue = 0
    
//     // Шукаємо пік у діапазоні 80-2000 Hz
//     for (let i = 0; i < fftSize / 2; i++) {
//       const freq = (i * nyquist) / (fftSize / 2)
//       if (freq >= 80 && freq <= 2000) {
//         const magnitude = fft.spectrum[i]
//         if (magnitude > maxValue) {
//           maxValue = magnitude
//           maxIndex = i
//         }
//       }
//     }
    
//     if (maxValue > 0.01) { // Поріг для відсіювання шуму
//       const frequency = (maxIndex * nyquist) / (fftSize / 2)
//       return frequency
//     }
    
//   } catch (error) {
//     console.warn('Помилка аналізу сегменту:', error)
//   }
  
//   return null
// }



// // Простий FFT клас (якщо Tone.js не має вбудованого FFT)
// class FFT {
//   constructor(size, sampleRate) {
//     this.size = size
//     this.sampleRate = sampleRate
//     this.spectrum = new Float32Array(size / 2)
//   }
  
//   forward(input) {
//     // Проста імплементація FFT для демонстрації
//     // На практиці краще використовувати вбудовані можливості
//     const n = this.size
//     const real = new Float32Array(n)
//     const imag = new Float32Array(n)
    
//     // Копіюємо вхідні дані
//     for (let i = 0; i < Math.min(input.length, n); i++) {
//       real[i] = input[i]
//     }
    
//     // Застосовуємо вікно Ганна
//     for (let i = 0; i < n; i++) {
//       const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)))
//       real[i] *= window
//     }
    
//     // Простий DFT (для демонстрації)
//     for (let k = 0; k < n / 2; k++) {
//       let sumReal = 0
//       let sumImag = 0
      
//       for (let t = 0; t < n; t++) {
//         const angle = 2 * Math.PI * t * k / n
//         sumReal += real[t] * Math.cos(angle)
//         sumImag -= real[t] * Math.sin(angle)
//       }
      
//       this.spectrum[k] = Math.sqrt(sumReal * sumReal + sumImag * sumImag) / n
//     }
//   }
// }