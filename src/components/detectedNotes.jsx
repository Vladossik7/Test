import React from 'react'

export const DetectedNotes = ({ audioNotes, setAudioNotes, setNotes }) => {
  const clearRecording = () => {
    setAudioNotes([])
    setNotes([])
  }

  return (
    audioNotes.length > 0 && (
      <div className="audio-results">
        <h3>Записані ноти: {audioNotes.filter((n) => n.type === 'note').length}</h3>
        <div
          className="notes-list"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}
        >
          {audioNotes
            .filter((n) => n.type === 'note')
            .map((item, index) => (
              <div key={index} className="note-item">
                <strong>{item.fullName || '??'}</strong> ({item.frequency}Hz) -{' '}
                {item.duration.toFixed(2)}с
              </div>
            ))}
        </div>

        <button onClick={clearRecording} className="clear-button">
          Очистити
        </button>
      </div>
    )
  )
}
