import { useRef, useEffect, useState } from 'react'
import {
  Renderer,
  Stave,
  StaveNote,
  Voice,
  Formatter,
  Accidental,
  TabStave,
  TabNote,
  StaveConnector,
  Beam,
} from 'vexflow'

import {
  getTabPosition,
  midiToNoteName,
  getVexDuration,
  groupNotesIntoMeasures,
} from '../utils/general'
import { exportToPDF, exportToPNG } from '../utils/exporting'

const SheetMusic = ({ notes, timeSignature, title }) => {
  const [showNotes, setShowNotes] = useState(false)
  const scoreDivRef = useRef(null)
  const { numerator, denominator } = timeSignature

  useEffect(() => {
    if (notes && notes.length > 0) {
      renderSheetMusic(notes)
      setShowNotes(true)
    }
  }, [notes])

  const renderSheetMusic = (musicNotes) => {
    if (!scoreDivRef.current || musicNotes.length === 0) return
    scoreDivRef.current.innerHTML = ''

    try {
      const totalWidth = 800
      const measuresPerRow = 2

      // 1. Отримуємо масив тактів
      const measures = groupNotesIntoMeasures(musicNotes, numerator, denominator)

      if (measures.length === 0) return

      const rowsCount = Math.ceil(measures.length / measuresPerRow)
      const totalHeight = Math.max(280, rowsCount * 280)

      const renderer = new Renderer(scoreDivRef.current, Renderer.Backends.CANVAS)
      // const renderer = new Renderer(scoreDivRef.current, Renderer.Backends.SVG)
      renderer.resize(totalWidth, totalHeight)
      const context = renderer.getContext()
      // context.setFont('Bravura')

      const measureWidth = (totalWidth - 80) / measuresPerRow

      // 2. Ітеруємося по масиву тактів (measures)
      for (let m = 0; m < measures.length; m++) {
        const rowIndex = Math.floor(m / measuresPerRow)
        const colIndex = m % measuresPerRow

        const x = 50 + colIndex * measureWidth
        const y = 50 + rowIndex * 250

        const stave = new Stave(x, y, measureWidth)
        const tabStave = new TabStave(x, y + 80, measureWidth)

        if (colIndex === 0) {
          stave.addClef('treble').addTimeSignature(`${numerator}/${denominator}`)
          tabStave.addTabGlyph().addTimeSignature(`${numerator}/${denominator}`)

          new StaveConnector(stave, tabStave)
            .setType(StaveConnector.type.BRACKET)
            .setContext(context)
            .draw()
          new StaveConnector(stave, tabStave)
            .setType(StaveConnector.type.SINGLE_LEFT)
            .setContext(context)
            .draw()
        }

        stave.setContext(context).draw()
        tabStave.setContext(context).draw()

        // 3. ПРАВИЛЬНО: отримуємо ноти для поточного такту
        const subset = measures[m] // Просто беремо готовий такт
        const vexNotes = []
        const vexTabNotes = []

        subset.forEach((n) => {
          const { name, octave } = midiToNoteName(n.midi)
          const { str, fret } = getTabPosition(n.midi)
          const dur = getVexDuration(n.duration)
          const sn = new StaveNote({
            keys: [`${name?.toLowerCase()}/${octave}`],
            duration: dur,
            auto_stem: true,
          })
          if (name.includes('#')) sn.addModifier(new Accidental('#'), 0)
          vexNotes.push(sn)

          vexTabNotes.push(new TabNote({ positions: [{ str, fret }], duration: dur }))
        })

        if (vexNotes.length > 0) {
          const voice = new Voice({ num_beats: numerator, beat_value: denominator }).setMode(
            Voice.Mode.SOFT
          )
          const tabVoice = new Voice({ num_beats: numerator, beat_value: denominator }).setMode(
            Voice.Mode.SOFT
          )
          voice.addTickables(vexNotes)
          tabVoice.addTickables(vexTabNotes)

          // Додаємо Beams (з'єднання вісімок), щоб виглядало професійно
          const beams = Beam.generateBeams(vexNotes)

          const startX = colIndex === 0 ? 80 : 10
          stave.setNoteStartX(x + startX)
          tabStave.setNoteStartX(x + startX)

          new Formatter()
            .joinVoices([voice, tabVoice])
            .format([voice, tabVoice], measureWidth - (colIndex === 0 ? 100 : 20))

          voice.draw(context, stave)
          tabVoice.draw(context, tabStave)

          beams.forEach((b) => b.setContext(context).draw())
        }

        new StaveConnector(stave, tabStave)
          .setType(StaveConnector.type.SINGLE_RIGHT)
          .setContext(context)
          .draw()
      }
    } catch (e) {
      console.error('VexFlow Error:', e)
    }
  }

  return (
    <>
      <h2>{title}</h2>
      {showNotes ? (
        <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
          <button onClick={() => exportToPNG(scoreDivRef, title)}>Завантажити PNG</button>
          <button onClick={() => exportToPDF(scoreDivRef, title)}>Завантажити PDF</button>
        </div>
      ) : null}
      <canvas ref={scoreDivRef} style={{ background: 'white', padding: '10px' }} />
    </>
  )
}

export default SheetMusic
