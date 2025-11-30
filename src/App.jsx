import { useState, useRef } from "react";

import { simpleMidiParse } from "./utils/simpleMidiParser";
import { generateTablature } from "./utils/generateTablature";

import { TablatureView } from "./components/tablature";
import SheetMusic from "./components/sheetMusic";

import "./App.css";

function App() {
  const [notes, setNotes] = useState([]);
  const [tablature, setTablature] = useState([]);
  const [activeView, setActiveView] = useState("sheet");
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);


  const handleLoadMidi = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        console.log("MIDI файл завантажено:", file.name);

        const parsedNotes = simpleMidiParse(arrayBuffer);
        console.log("Розпарсені ноти:", parsedNotes);

        setNotes(parsedNotes);

        // Генеруємо табулатуру
        const generatedTab = generateTablature(parsedNotes);
        setTablature(generatedTab);

        // Рендеримо нотний стан
     //   setTimeout(() => {
         // renderSheetMusic(parsedNotes);
       // }, 100);
      } catch (error) {
        console.error("Помилка обробки MIDI:", error);
        alert("Помилка при обробці MIDI файлу: " + error.message);
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = (e) => {
      console.error("Помилка читання файлу:", e);
      setIsLoading(false);
      alert("Помилка читання файлу");
    };

    reader.readAsArrayBuffer(file);
  };

  const handleViewChange = (view) => {
    setActiveView(view);
  };

  const isSheetViewActive = activeView === 'sheet';
  const isTabsViewActive = activeView === 'tab';

  return (
    <div className="App">
      <header className="App-header">
        <div className="controls">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".mid,.midi"
            style={{ display: "none" }}
          />
          <button
            onClick={handleLoadMidi}
            disabled={isLoading}
            className="load-button"
          >
            {isLoading ? "🔄 Завантаження..." : "📁 Завантажити MIDI файл"}
          </button>

          {notes.length > 0 && (
            <div className="view-switcher">
              <button 
                className={isSheetViewActive ? "active" : ""}
                onClick={() => handleViewChange("sheet")}
              >
                🎼 Нотний стан
              </button>
              <button 
                className={isTabsViewActive ? "active" : ""}
                onClick={() => handleViewChange("tab")}
              >
                🎸 Табулатура
              </button>
            </div>
          )}
        </div>

        <div className="music-display">
          {isSheetViewActive &&
          (<SheetMusic notes={notes} />)
}
          {isTabsViewActive &&
          (<TablatureView tablature={tablature} />)  
          }
        </div>
        {notes.length === 0 && !isLoading && (
          <div className="instructions">
            <p style={{fontSize: '0.9rem', opacity: 0.8}}>
              Завантажте MIDI файл для перетворення в ноти та табулатуру
            </p>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;