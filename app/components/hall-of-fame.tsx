'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { GAMES } from '../data/games';
import { seededScores } from '../data/scores';

const podiumClass = (index: number) => (index === 0 ? ' top1' : index === 1 ? ' top2' : index === 2 ? ' top3' : '');

const HallOfFame = () => {
  const [tab, setTab] = useState(GAMES[0].id);
  const rows = useMemo(() => seededScores(tab.length * 23 + 7, 12), [tab]);

  return (
    <>
      <div className="hall-tabs">
        {GAMES.map((game) => (
          <button key={game.id} className={'chip' + (tab === game.id ? ' active' : '')} onClick={() => setTab(game.id)}>
            {game.title}
          </button>
        ))}
      </div>

      <div className="podium">
        <div className="podium-slot silver">
          <div className="rank-num">02</div>
          <div className="name">{rows[1].name}</div>
          <div className="score">{rows[1].score.toLocaleString('es-ES')}</div>
          <div className="date">{rows[1].date}</div>
        </div>
        <div className="podium-slot gold">
          <div className="pixel champion">CAMPEÓN</div>
          <div className="rank-num lead">01</div>
          <div className="name">{rows[0].name}</div>
          <div className="score lead">{rows[0].score.toLocaleString('es-ES')}</div>
          <div className="date">{rows[0].date}</div>
        </div>
        <div className="podium-slot bronze">
          <div className="rank-num">03</div>
          <div className="name">{rows[2].name}</div>
          <div className="score">{rows[2].score.toLocaleString('es-ES')}</div>
          <div className="date">{rows[2].date}</div>
        </div>
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {rows.map((row, i) => (
          <div key={row.name + i} className={'tr' + podiumClass(i)} style={{ animationDelay: `${i * 50}ms` }}>
            <div className="rk">#{String(row.rank).padStart(2, '0')}</div>
            <div className="pl">{row.name}</div>
            <div className="sc">{row.score.toLocaleString('es-ES')}</div>
            <div className="dt">{row.date}</div>
          </div>
        ))}
      </div>

      <div className="hall-actions">
        <Link className="btn lg" href="/biblioteca">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </>
  );
};

export default HallOfFame;
