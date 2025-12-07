  import { useRef } from "react";
 
 // Компонент для відображення табулатури
  export const TablatureView = ({ tablature }) => {
    
    const tabDivRef = useRef(null);
    
    if (!tablature.length) {
      return (
        <div className="tablature-container empty">
          <p>Завантажте MIDI файл для генерації табулатури</p>
        </div>
      );
    }

    return (
<div 
            style={{
              width: '100%'
            }}
          >
<div ref={tabDivRef} className="tablature-container">
        <h3>Гітарна табулатура</h3>
        <div className="tablature-notation">
          {tablature.map((position, posIndex) => (
            <div key={posIndex} className="tab-position">
              <div className="position-header">
                Позиція {position.position} 
                {position.startFret > 1 && ` (з ${position.startFret} ладу)`}
              </div>
              
              <div className="tab-staff">
                {[6, 5, 4, 3, 2, 1].map(stringNumber => {
                  const notesOnString = position.tabData.filter(tab => tab.string === stringNumber);
                  
                  return (
                    <div key={stringNumber} className="tab-string">
                      <span className="string-name">
                        {stringNumber} | 
                      </span>
                      <div className="frets-container">
                        {Array.from({ length: 16 }, (_, fretIndex) => {
                          const displayFret = fretIndex + position.startFret;
                          const noteOnFret = notesOnString.find(note => note.fret === displayFret);
                          
                          return (
                            <div key={fretIndex} className="fret-slot">
                              {noteOnFret ? (
                                <span className="fret-number">{noteOnFret.fret}</span>
                              ) : (
                                <span className="fret-empty">-</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="position-info">
                <div className="notes-list">
                  <small>Ноти: {position.notes.map(n => `${n.note}${n.octave}`).join(', ')}</small>
                </div>
                <div className="tab-data">
                  <small>
                    Розміщення: {position.tabData.map(tab => 
                      `${tab.string}стр/${tab.fret}лад`
                    ).join(', ')}
                  </small>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    );
  };
