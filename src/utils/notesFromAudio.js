export const createNotesFromAudioWithMeyda = async (file, setAudioProgress) => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Початок аналізу аудіофайлу...')
      const notes = []
      
      const updateProgress = (value) => {
        if (setAudioProgress) setAudioProgress(value)
        console.log(`Прогрес: ${value}%`)
      }
      
      updateProgress(5)
      
      // Завантажуємо аудіофайл
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const arrayBuffer = await file.arrayBuffer()
      updateProgress(20)
      
      // Декодуємо аудіо
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      updateProgress(35)
      
      console.log(`Аудіо завантажено: ${audioBuffer.duration.toFixed(2)} сек, ${audioBuffer.sampleRate}Hz`)
      
      // Простий аналіз через FFT
      const sampleRate = audioBuffer.sampleRate
      const channelData = audioBuffer.getChannelData(0) // беремо перший канал
      const frameSize = 4096 // розмір вікна для аналізу
      const hopSize = 2048   // крок аналізу
      
      updateProgress(45)
      
      // Функція для визначення основної частоти через FFT
      const detectFrequency = (samples) => {
        if (samples.length < frameSize) return 0
        
        // Обчислюємо RMS (гучність)
        let sum = 0
        for (let i = 0; i < samples.length; i++) {
          sum += samples[i] * samples[i]
        }
        const rms = Math.sqrt(sum / samples.length)
        
        // Перевіряємо чи достатньо гучний сигнал
        if (rms < 0.01) return 0
        
        // Простий FFT (використовуємо вбудовану функцію)
        try {
          // Створюємо аналізатор для FFT
          const analyser = audioContext.createAnalyser()
          analyser.fftSize = 2048
          
          // Створюємо буфер для даних
          const tempBuffer = audioContext.createBuffer(1, frameSize, sampleRate)
          tempBuffer.copyToChannel(new Float32Array(samples), 0)
          
          const source = audioContext.createBufferSource()
          source.buffer = tempBuffer
          source.connect(analyser)
          
          // Отримуємо частотні дані
          const frequencyData = new Uint8Array(analyser.frequencyBinCount)
          analyser.getByteFrequencyData(frequencyData)
          
          // Знаходимо пікову частоту
          let maxIndex = 0
          let maxValue = 0
          for (let i = 0; i < frequencyData.length; i++) {
            if (frequencyData[i] > maxValue) {
              maxValue = frequencyData[i]
              maxIndex = i
            }
          }
          
          // Конвертуємо індекс в частоту
          const frequency = maxIndex * sampleRate / analyser.fftSize
          
          // Фільтруємо нереальні частоти
          return frequency > 80 && frequency < 1200 ? frequency : 0
          
        } catch (e) {
          console.warn('Помилка FFT:', e)
          return 0
        }
      }
      
      // Конвертуємо частоту в ноту
      const frequencyToNote = (frequency) => {
        if (frequency < 80 || frequency > 1200) return null
        
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        const A4 = 440
        const noteNum = 12 * Math.log2(frequency / A4) + 69
        const midiNumber = Math.round(noteNum)
        
        if (midiNumber < 48 || midiNumber > 84) return null // C3 - C6
        
        const noteName = noteNames[midiNumber % 12]
        const octave = Math.floor(midiNumber / 12) - 1
        
        return {
          note: noteName,
          octave: octave,
          number: midiNumber,
          frequency: frequency
        }
      }
      
      updateProgress(55)
      
      // Аналізуємо аудіо сегментами
      let currentNote = null
      let noteStartTime = 0
      let noteStartIndex = 0
      
      console.log('Початок аналізу сегментів...')
      
      for (let i = 0; i < channelData.length - frameSize; i += hopSize) {
        // Оновлюємо прогрес
        if (i % (hopSize * 500) === 0) {
          const percent = 55 + Math.floor((i / channelData.length) * 40)
          updateProgress(percent)
        }
        
        const time = i / sampleRate
        const segment = channelData.slice(i, i + frameSize)
        
        // Виявляємо частоту
        const frequency = detectFrequency(segment)
        
        if (frequency > 0) {
          const detectedNote = frequencyToNote(frequency)
          
          if (detectedNote) {
            if (!currentNote || 
                currentNote.number !== detectedNote.number ||
                time - noteStartTime > 0.5) {
              
              // Зберігаємо попередню ноту
              if (currentNote && (time - noteStartTime) > 0.05) {
                notes.push({
                  ...currentNote,
                  time: noteStartTime,
                  duration: time - noteStartTime
                })
              }
              
              // Починаємо нову ноту
              currentNote = detectedNote
              noteStartTime = time
              noteStartIndex = i
            }
          } else if (currentNote) {
            // Кінець ноти
            const noteDuration = time - noteStartTime
            if (noteDuration > 0.05) {
              notes.push({
                ...currentNote,
                time: noteStartTime,
                duration: noteDuration
              })
            }
            currentNote = null
          }
        } else if (currentNote) {
          // Кінець ноти (немає звуку)
          const noteDuration = time - noteStartTime
          if (noteDuration > 0.05) {
            notes.push({
              ...currentNote,
              time: noteStartTime,
              duration: noteDuration
            })
          }
          currentNote = null
        }
      }
      
      // Додаємо останню ноту
      if (currentNote) {
        const finalTime = channelData.length / sampleRate
        const noteDuration = finalTime - noteStartTime
        if (noteDuration > 0.05) {
          notes.push({
            ...currentNote,
            time: noteStartTime,
            duration: noteDuration
          })
        }
      }
      
      updateProgress(95)
      
      // Фільтруємо та обробляємо результати
      const processedNotes = processNotes(notes)
      
      console.log(`Аналіз завершено. Знайдено ${processedNotes.length} нот`)
      updateProgress(100)
      
      resolve(processedNotes)
      
    } catch (error) {
      console.error('Помилка аналізу аудіо:', error)
      reject(error)
    }
  })
}

// Допоміжна функція для обробки знайдених нот
const processNotes = (rawNotes) => {
  if (rawNotes.length === 0) return []
  
  const processed = []
  let lastNote = rawNotes[0]
  
  for (let i = 1; i < rawNotes.length; i++) {
    const currentNote = rawNotes[i]
    const timeGap = currentNote.time - (lastNote.time + lastNote.duration)
    
    // Якщо ноти однакові та час між ними маленький - об'єднуємо
    if (lastNote.number === currentNote.number && timeGap < 0.1) {
      lastNote.duration = currentNote.time + currentNote.duration - lastNote.time
    } else {
      // Зберігаємо попередню ноту
      if (lastNote.duration > 0.05) {
        processed.push({...lastNote})
      }
      lastNote = currentNote
    }
  }
  
  // Зберігаємо останню ноту
  if (lastNote.duration > 0.05) {
    processed.push({...lastNote})
  }
  
  return processed
}
