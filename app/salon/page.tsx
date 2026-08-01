import HallOfFame, { type HallScore } from '../components/hall-of-fame';
import { formatScoreDate } from '../lib/format';
import { getAllScores, getGames } from '../lib/supabase/queries';

const HallPage = async () => {
  const [games, scores] = await Promise.all([getGames(), getAllScores(12)]);

  // Dates are formatted here, on the server: doing it in the browser with the
  // local timezone would produce markup the server never rendered.
  const scoresByGame: Record<string, HallScore[]> = {};
  for (const game of games) {
    scoresByGame[game.id] = (scores[game.id] ?? []).map((row) => ({
      id: row.id,
      alias: row.alias,
      score: row.score,
      date: formatScoreDate(row.created_at),
    }));
  }

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel">LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA</p>
      </div>

      <HallOfFame games={games} scoresByGame={scoresByGame} />
    </div>
  );
};

export default HallPage;
