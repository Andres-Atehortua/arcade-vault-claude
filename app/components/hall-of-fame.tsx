'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { GameRow } from '../lib/supabase/types';
import EmptyScores from './empty-scores';

/** A score row ready to paint: date already formatted on the server. */
export interface HallScore {
  id: string;
  alias: string;
  score: number;
  /** "DD/MM/YYYY" */
  date: string;
}

const podiumClass = (index: number) => (index === 0 ? ' top1' : index === 1 ? ' top2' : index === 2 ? ' top3' : '');

/** Silver sits left of gold and bronze right of it, so the DOM order is 2-1-3. */
const PODIUM_SLOTS = [
  { index: 1, medal: 'silver' },
  { index: 0, medal: 'gold' },
  { index: 2, medal: 'bronze' },
] as const;

const PodiumSlot = ({ medal, rank, row }: { medal: string; rank: number; row: HallScore }) => (
  <div className={'podium-slot ' + medal}>
    {medal === 'gold' && <div className="pixel champion">CAMPEÓN</div>}
    <div className={'rank-num' + (medal === 'gold' ? ' lead' : '')}>{String(rank).padStart(2, '0')}</div>
    <div className="name">{row.alias}</div>
    <div className={'score' + (medal === 'gold' ? ' lead' : '')}>{row.score.toLocaleString('es-ES')}</div>
    <div className="date">{row.date}</div>
  </div>
);

const HallOfFame = ({ games, scoresByGame }: { games: GameRow[]; scoresByGame: Record<string, HallScore[]> }) => {
  const [tab, setTab] = useState(games[0].id);
  const rows = scoresByGame[tab] ?? [];

  return (
    <>
      <div className="hall-tabs">
        {games.map((game) => (
          <button key={game.id} className={'chip' + (tab === game.id ? ' active' : '')} onClick={() => setTab(game.id)}>
            {game.title}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyScores />
      ) : (
        <>
          <div className="podium">
            {PODIUM_SLOTS.map(({ index, medal }) =>
              rows[index] ? <PodiumSlot key={medal} medal={medal} rank={index + 1} row={rows[index]} /> : null
            )}
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((row, i) => (
              <div key={row.id} className={'tr' + podiumClass(i)} style={{ animationDelay: `${i * 50}ms` }}>
                <div className="rk">#{String(i + 1).padStart(2, '0')}</div>
                <div className="pl">{row.alias}</div>
                <div className="sc">{row.score.toLocaleString('es-ES')}</div>
                <div className="dt">{row.date}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="hall-actions">
        <Link className="btn lg" href="/biblioteca">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </>
  );
};

export default HallOfFame;
