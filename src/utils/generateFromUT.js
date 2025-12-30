// Функція для аналізу звуку з YouTube відео
export const analyzeYouTubeAudio = async (videoElement) => {
  const notes = [];
  
  // Створюємо аудіоконтекст
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  // Створюємо джерело звуку з відео елемента
  const source = audioContext.createMediaElementSource(videoElement);
  
  // Створюємо аналізатор для частот
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  
  // Створюємо компресор для кращого аналізу
  const compressor = audioContext.createDynamicsCompressor();
  
  // Підключаємо ланцюжок
  source.connect(compressor);
  compressor.connect(analyser);
  analyser.connect(audioContext.destination);
  
  // Отримуємо дані частот
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  // Частоти MIDI нот
  const noteFrequencies = [];
  for (let i = 0; i < 88; i++) {
    noteFrequencies.push(440 * Math.pow(2, (i - 69) / 12));
  }
  
  // Назви нот
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  // Функція для аналізу частоти
  function detectPitch(frequencies) {
    let maxVolume = -Infinity;
    let maxIndex = 0;
    
    // Знаходимо найгучнішу частоту
    for (let i = 0; i < bufferLength; i++) {
      if (frequencies[i] > maxVolume) {
        maxVolume = frequencies[i];
        maxIndex = i;
      }
    }
    
    // Перетворюємо індекс в частоту
    const frequency = maxIndex * audioContext.sampleRate / analyser.fftSize;
    
    // Знаходимо найближчу ноту
    let closestNoteIndex = 0;
    let minDifference = Infinity;
    
    for (let i = 0; i < noteFrequencies.length; i++) {
      const difference = Math.abs(noteFrequencies[i] - frequency);
      if (difference < minDifference) {
        minDifference = difference;
        closestNoteIndex = i;
      }
    }
    
    return {
      frequency: frequency,
      noteIndex: closestNoteIndex,
      noteName: noteNames[closestNoteIndex % 12],
      octave: Math.floor(closestNoteIndex / 12) - 1,
      volume: maxVolume
    };
  }
  
  // Функція для постійного аналізу
  let lastNoteTime = 0;
  let currentNote = null;
  
  function analyze() {
    analyser.getByteFrequencyData(dataArray);
    
    const now = audioContext.currentTime;
    const detected = detectPitch(dataArray);
    
    // Якщо нота досить гучна
    if (detected.volume > 50) {
      if (!currentNote) {
        // Початок нової ноти
        currentNote = {
          note: detected.noteName,
          octave: detected.octave,
          number: detected.noteIndex + 21, // MIDI номер (A0 = 21)
          time: now,
          frequency: detected.frequency,
          volume: detected.volume
        };
      } else if (currentNote.note !== detected.noteName) {
        // Кінець попередньої ноти, початок нової
        currentNote.duration = now - currentNote.time;
        notes.push(currentNote);
        
        currentNote = {
          note: detected.noteName,
          octave: detected.octave,
          number: detected.noteIndex + 21,
          time: now,
          frequency: detected.frequency,
          volume: detected.volume
        };
      }
    } else if (currentNote) {
      // Кінець ноти
      currentNote.duration = now - currentNote.time;
      notes.push(currentNote);
      currentNote = null;
    }
    
    lastNoteTime = now;
    
    // Продовжуємо аналіз
    requestAnimationFrame(analyze);
  }
  
  // Починаємо аналіз
  analyze();
  
  return {
    notes: notes,
    stop: () => {
      source.disconnect();
    }
  };
}

// Приклад використання з YouTube iframe
async function setupYouTubeAudioAnalysis(videoId) {
  // Завантажуємо YouTube IFrame API
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  
  // Створюємо плеєр
  let player;
  window.onYouTubeIframeAPIReady = function() {
    player = new YT.Player('youtube-player', {
      videoId: videoId,
      events: {
        'onReady': (event) => {
          const videoElement = event.target.getIframe()
            .contentDocument.querySelector('video');
          
          // Починаємо аналіз
          const analyzer = analyzeYouTubeAudio(videoElement);
          
          // Приклад: зберігаємо ноти при зупинці
          player.addEventListener('onStateChange', (e) => {
            if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
              console.log('Виявлені ноти:', analyzer.notes);
              analyzer.stop();
            }
          });
        }
      }
    });
  };
}

// Спрощений варіант з HTML5 audio (для аудіофайлів)
async function analyzeAudioFromURL(audioUrl) {
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Створюємо джерело з аудіобуферу
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  
  // Продовжуємо як у першому прикладі...
  const analyser = audioContext.createAnalyser();
  source.connect(analyser);
  analyser.connect(audioContext.destination);
  
  // Аналогічний аналіз частот...
}

// Демонстраційна функція для візуалізації
function visualizeNotes(notes) {
  const canvas = document.getElementById('visualization');
  const ctx = canvas.getContext('2d');
  
  // Очищаємо canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Малюємо ноти
  notes.forEach(note => {
    const x = (note.time / 60) * canvas.width; // Припускаємо, що time в секундах
    const y = canvas.height - (note.number * 5); // Масштабуємо висоту
    const width = (note.duration / 60) * canvas.width;
    const height = 20;
    
    ctx.fillStyle = `rgba(255, ${note.volume}, 0, 0.7)`;
    ctx.fillRect(x, y, width, height);
    
    // Підпис ноти
    ctx.fillStyle = 'white';
    ctx.fillText(`${note.note}${note.octave}`, x + 5, y + 15);
  });
}