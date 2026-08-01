import Link from 'next/link';
import { notFound } from 'next/navigation';
import EmptyScores from '../../components/empty-scores';
import { formatScoreDate } from '../../lib/format';
import { getGameById, getGames, getScoresByGame } from '../../lib/supabase/queries';

export const revalidate = 60;

export const generateStaticParams = async () => {
  const games = await getGames();

  return games.map((game) => ({ id: game.id }));
};

const podiumClass = (index: number) => (index === 0 ? ' top1' : index === 1 ? ' top2' : index === 2 ? ' top3' : '');

const GameDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const game = await getGameById(id);

  if (!game) notFound();

  const scores = await getScoresByGame(id, 10);

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={'cover-bg ' + game.cover} />
        </div>
        <div className="detail-info" style={{ marginTop: 20 }}>
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{game.plays}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div className="v magenta">{game.best.toLocaleString('es-ES')}</div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div className="v yellow">★ ★ ★ ☆ ☆</div>
            </div>
          </div>
          <div className="detail-actions">
            <Link className="btn xl pulse" href={`/juegos/${game.id}/jugar`}>
              ▶ JUGAR AHORA
            </Link>
            <Link className="btn ghost lg" href="/biblioteca">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {scores.length === 0 && <EmptyScores />}
          {scores.map((row, i) => (
            <div key={row.id} className={'lb-row' + podiumClass(i)}>
              <div className="rk">#{String(i + 1).padStart(2, '0')}</div>
              <div className="pl">
                {row.alias}
                <div className="dt">{formatScoreDate(row.created_at)}</div>
              </div>
              <div className="sc">{row.score.toLocaleString('es-ES')}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
};

export default GameDetailPage;
