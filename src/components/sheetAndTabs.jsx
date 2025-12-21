import React, { useEffect, useRef } from 'react'
// import $ from 'jquery'
import { jsPDF } from 'jspdf'

// 2. Глобальне призначення
/* if (typeof window !== 'undefined') {
  window.$ = window.jQuery = $
} */
// import { Vextab, Artist, Renderer } from 'vextab/releases/vextab-div'

const GuitarTabRenderer = ({ notes }) => {
  const containerRef = useRef(null)

  // --- ЛОГІКА ТРАНСФОРМАЦІЇ (як раніше) ---
  // const convertToVexTab = (notesData) => {
  //   if (!notesData || notesData.length === 0) return ''

  //   // 1. Ініціалізуємо акумулятор часу
  //   let currentTimeAccumulator = 0

  //   // 2. Створюємо копію даних з розрахованим полем start
  //   const notesWithStart = notesData.map((note) => {
  //     const start = currentTimeAccumulator
  //     const duration = parseInt(note.time) || 480 // беремо тривалість ноти
  //     currentTimeAccumulator += duration // додаємо її до загального часу
  //     return { ...note, start }
  //   })

  //   const STRINGS = [
  //     { num: 1, open: 64 },
  //     { num: 2, open: 59 },
  //     { num: 3, open: 55 },
  //     { num: 4, open: 50 },
  //     { num: 5, open: 45 },
  //     { num: 6, open: 40 },
  //   ]

  //   const findFretAndString = (noteObj, usedStrings) => {
  //     let midiNumber = parseInt(noteObj.number ?? noteObj.midi ?? noteObj.pitch ?? 0)
  //     if (isNaN(midiNumber) || midiNumber === 0) return null

  //     while (midiNumber > 88) midiNumber -= 12
  //     while (midiNumber < 40) midiNumber += 12

  //     for (let s of STRINGS) {
  //       if (usedStrings.has(s.num)) continue
  //       let fret = midiNumber - s.open
  //       if (fret >= 0 && fret <= 22) return { fret, string: s.num }
  //     }
  //     return { fret: Math.max(0, midiNumber - 64), string: 1 }
  //   }

  //   const getVexDurations = (ticks) => {
  //     if (ticks >= 960) return [':h']
  //     if (ticks >= 480) return [':q']
  //     return [':8']
  //   }

  //   // Групуємо ноти за нашим новим полем 'start'
  //   const groups = notesWithStart.reduce((acc, note) => {
  //     const t = note.start
  //     if (!acc[t]) acc[t] = []
  //     acc[t].push(note)
  //     return acc
  //   }, {})

  //   const sortedStarts = Object.keys(groups)
  //     .map(Number)
  //     .sort((a, b) => a - b)

  //   let resultLines = []
  //   let currentLineNotes = ''
  //   let notesInCurrentStave = 0

  //   sortedStarts.forEach((start) => {
  //     // Рядок стає занадто довгим -> новий tabstave
  //     if (notesInCurrentStave >= 10) {
  //       resultLines.push(`tabstave notation=true tablature=true\nnotes ${currentLineNotes.trim()}`)
  //       currentLineNotes = ''
  //       notesInCurrentStave = 0
  //     }

  //     const chordNotes = groups[start]
  //     const durationTicks = parseInt(chordNotes[0].time) || 480
  //     const durationCode = getVexDurations(durationTicks)[0]

  //     let usedStrings = new Set()
  //     let chordParts = []

  //     chordNotes.forEach((n) => {
  //       const res = findFretAndString(n, usedStrings)
  //       if (res) {
  //         chordParts.push(`${res.fret}/${res.string}`)
  //         usedStrings.add(res.string)
  //       }
  //     })

  //     if (chordParts.length > 0) {
  //       const part = chordParts.length > 1 ? `(${chordParts.join(' ')})` : chordParts[0]
  //       currentLineNotes += ` ${durationCode} ${part} `
  //       notesInCurrentStave++
  //     }
  //   })

  //   if (currentLineNotes) {
  //     resultLines.push(`tabstave notation=true tablature=true\nnotes ${currentLineNotes.trim()}`)
  //   }

  //   return resultLines.join('\n')
  // }

  // const convertToVexTab = (notesData) => {
  //   if (!notesData || notesData.length === 0) return ''

  //   const STRINGS = [
  //     { num: 1, open: 64 },
  //     { num: 2, open: 59 },
  //     { num: 3, open: 55 },
  //     { num: 4, open: 50 },
  //     { num: 5, open: 45 },
  //     { num: 6, open: 40 },
  //   ]

  //   // Конвертація секунд у коди VexTab
  //   const getVexDuration = (seconds) => {
  //     if (seconds >= 1.5) return ':w'
  //     if (seconds >= 0.75) return ':h'
  //     if (seconds >= 0.35) return ':q'
  //     if (seconds >= 0.18) return ':8'
  //     return ':16'
  //   }

  //   const findFretAndString = (midi, usedStrings) => {
  //     let m = midi
  //     while (m > 88) m -= 12
  //     while (m < 40) m += 12

  //     for (let s of STRINGS) {
  //       if (usedStrings.has(s.num)) continue
  //       let fret = m - s.open
  //       if (fret >= 0 && fret <= 22) return { fret, string: s.num }
  //     }
  //     return { fret: Math.max(0, m - 64), string: 1 }
  //   }

  //   // Групування нот, які звучать одночасно (акорди)
  //   // У MIDI час може відрізнятися на мілісекунди, тому округлюємо
  //   const groups = notesData.reduce((acc, note) => {
  //     const t = Math.round(note.time * 100) / 100
  //     if (!acc[t]) acc[t] = []
  //     acc[t].push(note)
  //     return acc
  //   }, {})

  //   const sortedStarts = Object.keys(groups)
  //     .map(Number)
  //     .sort((a, b) => a - b)
  //   let resultLines = []
  //   let currentLineNotes = ''
  //   let notesInLine = 0
  //   let lastEndTime = 0

  //   sortedStarts.forEach((start) => {
  //     if (notesInLine >= 8) {
  //       resultLines.push(`tabstave notation=true tablature=true\nnotes ${currentLineNotes}`)
  //       currentLineNotes = ''
  //       notesInLine = 0
  //     }

  //     // Додавання пауз, якщо є розрив між нотами
  //     if (start > lastEndTime + 0.1) {
  //       currentLineNotes += ' :q ## '
  //     }

  //     const chord = groups[start]
  //     const durCode = getVexDuration(chord[0].duration)
  //     let usedStrings = new Set()
  //     let parts = []

  //     chord.forEach((n) => {
  //       const res = findFretAndString(n.midi, usedStrings)
  //       if (res && parts.length < 6) {
  //         parts.push(`${res.fret}/${res.string}`)
  //         usedStrings.add(res.string)
  //       }
  //     })

  //     if (parts.length > 0) {
  //       currentLineNotes += ` ${durCode} ${parts.length > 1 ? `(${parts.join(' ')})` : parts[0]} `
  //       notesInLine++
  //     }
  //     lastEndTime = start + chord[0].duration
  //   })

  //   if (currentLineNotes) {
  //     resultLines.push(`tabstave notation=true tablature=true\nnotes ${currentLineNotes}`)
  //   }

  //   return resultLines.join('\n')
  // }

  const convertToVexTab = (notesData) => {
    if (!notesData || notesData.length === 0) return ''

    const STRINGS = [
      { num: 1, open: 64 },
      { num: 2, open: 59 },
      { num: 3, open: 55 },
      { num: 4, open: 50 },
      { num: 5, open: 45 },
      { num: 6, open: 40 },
    ]

    const findFretAndString = (midi, usedStrings) => {
      let m = parseInt(midi)
      if (isNaN(m) || m === null) return null
      while (m > 88) m -= 12
      while (m < 40 && m > 0) m += 12

      for (let s of STRINGS) {
        if (usedStrings.has(s.num)) continue
        let fret = m - s.open
        if (fret >= 0 && fret <= 22) return { fret, string: s.num }
      }
      return null
    }

    const getVexDuration = (seconds) => {
      if (seconds >= 1.5) return ':w'
      if (seconds >= 0.75) return ':h'
      if (seconds >= 0.35) return ':q'
      if (seconds >= 0.18) return ':8'
      return ':16'
    }

    // 1. Більш точне групування (50 кадрів на секунду), щоб уникнути помилкових акордів
    const groups = notesData.reduce((acc, note) => {
      const t = Math.round(note.time * 50) / 50
      if (!acc[t]) acc[t] = []
      acc[t].push(note)
      return acc
    }, {})

    const sortedStarts = Object.keys(groups)
      .map(Number)
      .sort((a, b) => a - b)

    let resultLines = []
    let currentLineNotes = ''
    let notesInLine = 0
    let lastEndTime = 0

    sortedStarts.forEach((start) => {
      // 2. Рідше розбиваємо на рядки для складної музики
      if (notesInLine >= 12) {
        resultLines.push(
          `tabstave notation=true tablature=true \n notes ${currentLineNotes.trim()}`
        )
        currentLineNotes = ''
        notesInLine = 0
      }

      // 3. Розумні паузи (тільки якщо розрив дійсно відчутний)
      if (start > lastEndTime + 0.15) {
        currentLineNotes += ' :q ## '
      }

      const chord = groups[start]
      const durCode = getVexDuration(chord[0].duration || 0.4)

      let usedStringsInChord = new Set()
      let parts = []

      // Сортуємо ноти: високі MIDI спочатку
      chord
        .sort((a, b) => b.midi - a.midi)
        .forEach((n) => {
          const res = findFretAndString(n.midi, usedStringsInChord)
          if (res) {
            // Гарантуємо формат "лад/струна"
            parts.push(`${res.fret}/${res.string}`)
            usedStringsInChord.add(res.string)
          }
        })

      if (parts.length > 0) {
        // 4. ГАРАНТІЯ синтаксису: видаляємо будь-які можливі дублікати струн
        const uniqueParts = [...new Set(parts)]

        let noteString = ''
        if (uniqueParts.length > 1) {
          // Додаємо пробіли всередині дужок для кращого парсингу
          noteString = '(' + uniqueParts.join(' ') + ')'
        } else {
          noteString = uniqueParts[0]
        }

        currentLineNotes += ` ${durCode} ${noteString} `
        notesInLine++
        lastEndTime = start + (chord[0].duration || 0.4)
      }
    })

    // if (currentLineNotes) {
    if (currentLineNotes.trim().length < 5) return ''
    else {
      resultLines.push(`tabstave notation=true tablature=true \n notes ${currentLineNotes.trim()}`)
    }

    return resultLines.join('\n')
  }

  useEffect(() => {
    const { VexTab, Artist, Vex } = window
    const Renderer = Vex?.Flow?.Renderer

    if (VexTab && Artist && Renderer && containerRef.current && notes.length > 0) {
      containerRef.current.innerHTML = ''

      try {
        const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG)
        const artist = new Artist(10, 10, 750, { scale: 1.0 })
        const tab = new VexTab(artist)
        console.log('Рендеримо табулатуру з нотами:', notes)
        const vextabCode = convertToVexTab(notes)

        // Важливо: викликаємо parse один раз для всього коду
        // Це дозволяє VexTab побачити зв'язок між tabstave та notes
        tab.parse(vextabCode)

        artist.render(renderer)
      } catch (err) {
        console.error('VexTab Parse Error:', err)
      }
    }
  }, [notes])

  // --- ЕКСПОРТ У PNG ---
  const exportToPNG = () => {
    const svgElement = containerRef.current.querySelector('svg')
    if (!svgElement) return

    const svgData = new XMLSerializer().serializeToString(svgElement)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
      canvas.width = img.width * 2 // Підвищуємо чіткість
      canvas.height = img.height * 2
      ctx.scale(2, 2)
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)

      const pngUrl = canvas.toDataURL('image/png')
      const downloadLink = document.createElement('a')
      downloadLink.href = pngUrl
      downloadLink.download = 'guitar-tab.png'
      downloadLink.click()
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  // --- ЕКСПОРТ У PDF ---
  const exportToPDF = () => {
    const svgElement = containerRef.current.querySelector('svg')
    if (!svgElement) return

    const svgData = new XMLSerializer().serializeToString(svgElement)
    const canvas = document.createElement('canvas')
    const img = new Image()
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)

      const imgData = canvas.toDataURL('image/jpeg', 1.0)
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width + 40, canvas.height + 40],
      })

      pdf.addImage(imgData, 'JPEG', 20, 20)
      pdf.save('guitar-tab.pdf')
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  return (
    <div style={{ padding: '20px', background: '#f5f5f5', borderRadius: '12px' }}>
      <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
        <button onClick={exportToPNG} style={btnStyle}>
          Завантажити PNG
        </button>
        <button onClick={exportToPDF} style={btnStyle}>
          Завантажити PDF
        </button>
      </div>

      <div style={{ background: '#fff', padding: '20px', overflowX: 'auto' }}>
        <div ref={containerRef} />
      </div>
    </div>
  )
}

const btnStyle = {
  padding: '8px 16px',
  cursor: 'pointer',
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  fontWeight: 'bold',
}

export default GuitarTabRenderer
