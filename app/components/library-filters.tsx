'use client';

import { useMemo, useState } from 'react';
import { CATS, type Game } from '../data/games';
import GameCard from './game-card';

const LibraryFilters = ({ games }: { games: Game[] }) => {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<(typeof CATS)[number]>('TODOS');

  const filtered = useMemo(
    () => games.filter((game) => (cat === 'TODOS' || game.cat === cat) && game.title.toLowerCase().includes(query.toLowerCase())),
    [games, query, cat]
  );

  return (
    <>
      <div className="av-filters">
        <div className="av-search">
          <span className="ico">⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar un juego por nombre…" />
        </div>
        <div className="av-chips">
          {CATS.map((c) => (
            <button key={c} className={'chip' + (cat === c ? ' active' : '')} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="av-grid">
        {filtered.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
        {filtered.length === 0 && (
          <div className="av-empty">
            <div className="pixel">NO HAY RESULTADOS</div>
            <div>Intenta otra búsqueda o categoría.</div>
          </div>
        )}
      </div>
    </>
  );
};

export default LibraryFilters;
