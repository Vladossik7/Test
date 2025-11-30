import { useRef, useEffect } from "react";
import {
  Renderer,
  Stave,
  StaveNote,
  Accidental,
  Formatter,
  Voice,
} from "vexflow";

const SheetMusic = ({notes}) => {
  const scoreDivRef = useRef(null);

  useEffect(() => {
    if (notes.length > 0) {
      renderSheetMusic(notes);
    }
  }, [notes]);

  const renderSheetMusic = (notes) => {
    console.log("Рендеримо ноти:", notes);
    if (!scoreDivRef.current || notes.length === 0) return;

    scoreDivRef.current.innerHTML = "";

    try {
      // Динамічно розраховуємо висоту залежно від кількості нот
      const baseHeight = 200;
      const additionalHeight = Math.ceil(notes.length / 8) * 80;
      const totalHeight = baseHeight + additionalHeight;

      const renderer = new Renderer(scoreDivRef.current, Renderer.Backends.SVG);
      renderer.resize(800, totalHeight);
      const context = renderer.getContext();

      // Створюємо кілька стайвів залежно від кількості нот
      const notesPerStave = 8;
      const staveCount = Math.ceil(notes.length / notesPerStave);

      let currentNoteIndex = 0;

      for (let staveIndex = 0; staveIndex < staveCount; staveIndex++) {
        const staveNotes = notes.slice(currentNoteIndex, currentNoteIndex + notesPerStave);
        currentNoteIndex += notesPerStave;

        const staveY = 40 + (staveIndex * 120);

        const stave = new Stave(10, staveY, 780);
        stave.addClef("treble").addTimeSignature("4/4");
        stave.setContext(context).draw();

        const vexFlowNotes = staveNotes.map((note) => {
          const duration = "q";
          const vexFlowNote = `${note.note.toLowerCase()}/${note.octave}`;

          const staveNote = new StaveNote({
            keys: [vexFlowNote],
            duration: duration,
            auto_stem: true,
          });

          if (note.note.includes("#")) {
            staveNote.addModifier(new Accidental("#"), 0);
          } else if (note.note.includes("b")) {
            staveNote.addModifier(new Accidental("b"), 0);
          }

          return staveNote;
        });

        if (vexFlowNotes.length > 0) {
          const voice = new Voice({
            num_beats: Math.max(vexFlowNotes.length, 4),
            beat_value: 4,
          });

          voice.setMode(Voice.Mode.SOFT);
          voice.addTickables(vexFlowNotes);

          new Formatter().joinVoices([voice]).format([voice], 600);
          voice.draw(context, stave);
        }
      }
    } catch (error) {
      console.error("Помилка рендерингу нотного стану:", error);
      scoreDivRef.current.innerHTML = `
        <div style="color: red; text-align: center; padding: 20px;">
          <p>Помилка при відображенні нотного стану</p>
          <small>${error.message}</small>
        </div>
      `;
    }
  };

  return(
          <div 
            style={{
              width: '100%'
            }}
          >
            <h3>🎼 Нотний стан</h3>
            <div ref={scoreDivRef} className="sheet-music" />
          </div>
          
  );
}

export default SheetMusic;