/** Shown wherever a leaderboard has no rows yet: game detail and hall of fame. */
const EmptyScores = () => (
  <div className="score-empty">
    <div className="pixel">
      AÚN NO HAY PUNTAJES — SÉ EL PRIMERO <span className="blink">_</span>
    </div>
    <p>Termina una partida y firma con tu alias.</p>
  </div>
);

export default EmptyScores;
