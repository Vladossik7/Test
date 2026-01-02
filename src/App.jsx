import { useState } from 'react'

import SheetMusic from './components/sheetMusic'
import { AudioHandling } from './components/audioHandling'

import './App.css'

const App = () => {
  const [notes, setNotes] = useState([])
  const [timeSignature, setTimeSignature] = useState({ numerator: 4, denominator: 4 })
  const [title, setTitle] = useState('')

  return (
    <div className="App">
      <header className="App-header">
        <h1>ТАБУЛАТУРА</h1>
      </header>
      <AudioHandling setNotes={setNotes} setTimeSignature={setTimeSignature} setTitle={setTitle} />
      <div className="app-section">
        <SheetMusic notes={notes} timeSignature={timeSignature} title={title} />
      </div>
    </div>
  )
}

export default App
