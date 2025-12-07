import { useState, useRef, useEffect } from "react";
import {
  Factory,
  Renderer,
  Stave,
  StaveNote,
  Accidental,
  Formatter,
  Voice,
} from "vexflow";
import * as Tone from "tone";

import { simpleMidiParse } from "./utils/simpleMidiParser";
import { generateTablature } from "./utils/generateTablature";

import { TablatureView } from "./components/tablature";
import SheetMusic from "./components/sheetMusic";

import "./App.css";




function App() {
  const [audioNotes, setAudioNotes] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentNote, setCurrentNote] = useState(null);
  const [recordingStats, setRecordingStats] = useState({
    totalNotes: 0,
    totalDuration: 0,
    avgFrequency: 0,
  });

  const [notes, setNotes] = useState([]);
  const [tablature, setTablature] = useState([]);
  const [activeView, setActiveView] = useState("sheet");
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const recordingStartTimeRef = useRef(null);
  const noteDetectionIntervalRef = useRef(null);
  const lastNotesRef = useRef([]);

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

  const detectFrequency = () => {
    if (!analyserRef.current) return null;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyserRef.current.getFloatFrequencyData(dataArray);

    let maxIndex = 0;
    let maxValue = -Infinity;

    for (let i = 0; i < bufferLength; i++) {
      if (dataArray[i] > maxValue && dataArray[i] > -60) {
        maxValue = dataArray[i];
        maxIndex = i;
      }
    }

    if (maxValue === -Infinity) return null;

    const nyquist = audioContextRef.current.sampleRate / 2;
    const frequency = (maxIndex * nyquist) / bufferLength;

    return frequency > 80 && frequency < 2000 ? frequency : null;
  };

  const frequencyToNote = (frequency) => {
    if (!frequency) return null;

    const A4 = 440;
    const noteNames = [
      "C",
      "C#",
      "D",
      "D#",
      "E",
      "F",
      "F#",
      "G",
      "G#",
      "A",
      "A#",
      "B",
    ];

    const halfStepsFromA4 = Math.round(12 * Math.log2(frequency / A4));
    const midiNumber = 69 + halfStepsFromA4;

    if (midiNumber < 21 || midiNumber > 108) return null;

    const noteIndex = (midiNumber + 9) % 12;
    const octave = Math.floor((midiNumber - 12) / 12);

    return {
      frequency: Math.round(frequency * 10) / 10,
      note: noteNames[noteIndex],
      octave: octave,
      midiNumber: midiNumber,
      fullName: `${noteNames[noteIndex]}${octave}`,
    };
  };

  const startRecording = async () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      microphoneRef.current = stream;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();

      analyserRef.current.fftSize = 4096;
      analyserRef.current.smoothingTimeConstant = 0.8;
      source.connect(analyserRef.current);

      setIsRecording(true);
      setAudioNotes([]);
      setCurrentNote(null);
      lastNotesRef.current = [];
      recordingStartTimeRef.current = Date.now();

      let lastNote = null;
      let noteStartTime = null;
      let silenceStartTime = null;
      const recordedNotes = [];

      noteDetectionIntervalRef.current = setInterval(() => {
        const currentTime = Date.now();
        const elapsedTime =
          (currentTime - recordingStartTimeRef.current) / 1000;
        const frequency = detectFrequency();
        const detectedNote = frequency ? frequencyToNote(frequency) : null;

        if (detectedNote) {
          setCurrentNote(detectedNote.fullName);
          lastNotesRef.current.push(detectedNote);
          if (lastNotesRef.current.length > 5) lastNotesRef.current.shift();
        } else {
          setCurrentNote(null);
        }

        if (detectedNote) {
          if (silenceStartTime !== null) {
            const silenceDuration = (currentTime - silenceStartTime) / 1000;
            if (silenceDuration > 0.2) {
              recordedNotes.push({
                type: "silence",
                duration: silenceDuration,
                startTime:
                  (silenceStartTime - recordingStartTimeRef.current) / 1000,
              });
            }
            silenceStartTime = null;
          }

          if (!lastNote || detectedNote.midiNumber !== lastNote.midiNumber) {
            if (lastNote && noteStartTime !== null) {
              const noteDuration = (currentTime - noteStartTime) / 1000;
              recordedNotes.push({
                ...lastNote,
                type: "note",
                duration: noteDuration,
                startTime:
                  (noteStartTime - recordingStartTimeRef.current) / 1000,
              });
            }
            lastNote = detectedNote;
            noteStartTime = currentTime;
          }
        } else {
          if (lastNote && noteStartTime !== null) {
            const noteDuration = (currentTime - noteStartTime) / 1000;
            recordedNotes.push({
              ...lastNote,
              type: "note",
              duration: noteDuration,
              startTime: (noteStartTime - recordingStartTimeRef.current) / 1000,
            });
            lastNote = null;
            noteStartTime = null;
          }

          if (silenceStartTime === null) {
            silenceStartTime = currentTime;
          }
        }

        setAudioNotes([...recordedNotes]);

        const notesOnly = recordedNotes.filter((n) => n.type === "note");
        if (notesOnly.length > 0) {
          const avgFreq =
            notesOnly.reduce((sum, note) => sum + note.frequency, 0) /
            notesOnly.length;
          setRecordingStats({
            totalNotes: notesOnly.length,
            totalDuration: elapsedTime,
            avgFrequency: Math.round(avgFreq),
          });
        }
      }, 150);
    } catch (error) {
      console.error("Помилка при записі:", error);
      setIsRecording(false);
      cleanupAudio();
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    setCurrentNote(null);

    if (noteDetectionIntervalRef.current) {
      clearInterval(noteDetectionIntervalRef.current);
      noteDetectionIntervalRef.current = null;
    }

    if (audioNotes.length > 0) {
      const finalNotes = [...audioNotes];
      setAudioNotes(finalNotes);

      const vexFlowNotes = finalNotes
        .filter((item) => item.type === "note")
        .map((note, index) => ({
          note: note.note,
          octave: note.octave,
          number: note.midiNumber,
          time: index,
          duration: Math.max(0.25, Math.min(2, note.duration)),
        }));

      if (vexFlowNotes.length > 0) {
        setNotes(vexFlowNotes);
        setTimeout(() => renderSheetMusic(vexFlowNotes), 100);
      }
    }

    cleanupAudio();
  };

  const cleanupAudio = () => {
    if (noteDetectionIntervalRef.current) {
      clearInterval(noteDetectionIntervalRef.current);
      noteDetectionIntervalRef.current = null;
    }

    if (microphoneRef.current) {
      microphoneRef.current.getTracks().forEach((track) => track.stop());
      microphoneRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
  };

  const clearRecording = () => {
    setAudioNotes([]);
    setRecordingStats({ totalNotes: 0, totalDuration: 0, avgFrequency: 0 });
  };

  const isSheetViewActive = activeView === "sheet";
  const isTabsViewActive = activeView === "tab";

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
            {isLoading ? "Завантаження..." : "Завантажити MIDI файл"}
          </button>

          <div className="audio-controls">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`record-button ${isRecording ? "recording" : ""}`}
              disabled={isLoading}
            >
              {isRecording ? "Зупинити запис" : "Записати з мікрофона"}
            </button>

            {isRecording && (
              <div className="recording-status">
                <div className="pulse-dot"></div>
                <span>Запис...</span>
                <div className="current-note">{currentNote || "..."}</div>
              </div>
            )}
          </div>





          {notes.length > 0 && (
            <div className="view-switcher">
              <button
                className={isSheetViewActive ? "active" : ""}
                onClick={() => handleViewChange("sheet")}
              >
                Нотний стан
              </button>
              <button
                className={isTabsViewActive ? "active" : ""}
                onClick={() => handleViewChange("tab")}
              >
                Табулатура
              </button>
            </div>
          )}
        </div>

        {/* === НОВИЙ БЛОК ВІДОБРАЖЕННЯ РЕЗУЛЬТАТІВ МІКРОФОНА === */}
        {audioNotes.length > 0 && (
          <div className="audio-results">
            <h3>
              Записані ноти:{" "}
              {audioNotes.filter((n) => n.type === "note").length}
            </h3>
            <div className="notes-list">
              {audioNotes.slice(-10).map((item, index) => (
                <div key={index} className={`note-item ${item.type}`}>
                  {item.type === "note"
                    ? `${item.fullName} (${
                        item.frequency
                      }Hz) - ${item.duration.toFixed(2)}с`
                    : `Пауза - ${item.duration.toFixed(2)}с`}
                </div>
              ))}
            </div>

            <div className="recording-stats">
              <div className="stat-box">
                <div className="stat-value">{recordingStats.totalNotes}</div>
                <div className="stat-label">Нот</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">
                  {recordingStats.totalDuration.toFixed(1)}с
                </div>
                <div className="stat-label">Тривалість</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">
                  {recordingStats.avgFrequency}Hz
                </div>
                <div className="stat-label">Середня частота</div>
              </div>
            </div>

            <button onClick={clearRecording} className="clear-button">
              Очистити запис
            </button>
          </div>
        )}



        <div className="music-display">
          {isSheetViewActive && <SheetMusic notes={notes} />}
          {isTabsViewActive && <TablatureView tablature={tablature} />}
        </div>
      </header>
    </div>
  );
}

export default App;
