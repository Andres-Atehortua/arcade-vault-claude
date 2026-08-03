import Link from 'next/link';
import { notFound } from 'next/navigation';
import AsteroidesPlayer from '../../../lib/games/asteroides/player';
import TetrisPlayer from '../../../lib/games/tetris/player';
import { getGameById, getGames } from '../../../lib/supabase/queries';
import type { GameRow } from '../../../lib/supabase/types';

export const revalidate = 60;

/**
 * Games that ship with a real engine. Anything missing here falls through to the
 * "SIN CARTUCHO" cabinet below. No `next/dynamic` yet: neither engine is heavy
 * enough to justify a separate chunk.
 */
const PLAYERS: Record<string, (props: { game: GameRow }) => React.ReactElement> = {
  asteroides: AsteroidesPlayer,
  tetris: TetrisPlayer,
};

export const generateStaticParams = async () => {
  const games = await getGames();

  return games.map((game) => ({ id: game.id }));
};

const GamePlayerPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const game = await getGameById(id);

  if (!game) notFound();

  const Player = PLAYERS[game.id];
  if (Player) return <Player game={game} />;

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div className="hud-stats">
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v plain">INVITADO</div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">0</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">♥ ♥ ♥</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">01</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" disabled>
            PAUSA
          </button>
          <button className="btn magenta" disabled>
            FIN
          </button>
          <Link className="btn ghost" href={`/juegos/${game.id}`}>
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <div className="game-arena">
            <div className="grid-floor" />
            <div className="enemy e1" />
            <div className="enemy e2" />
            <div className="enemy e3" />
            <div className="player-ship" />
          </div>
          <div className="crt-content crt-attract">
            <div>
              <div className="pixel neon-cyan">Modo atracción</div>
              <div className="mono note">Esta máquina todavía no tiene motor. El Vault está montando {game.title}.</div>
            </div>
          </div>
        </div>
        <div className="crt-bottom">
          <span className="led warn">SIN CARTUCHO</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 0 MB</span>
        </div>
      </div>
    </div>
  );
};

export default GamePlayerPage;
