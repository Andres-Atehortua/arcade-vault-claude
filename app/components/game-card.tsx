'use client';

import Link from 'next/link';
import { useRef } from 'react';
import type { MouseEvent } from 'react';
import type { Game } from '../data/games';

const accentClass = (color: Game['color']) => (color === 'magenta' ? ' magenta' : color === 'yellow' ? ' yellow' : '');

const GameCard = ({ game }: { game: Game }) => {
  const tiltRef = useRef<HTMLAnchorElement>(null);

  const onMove = (e: MouseEvent<HTMLAnchorElement>) => {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `translateY(-6px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg)`;
  };

  const onLeave = () => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.transform = '';
  };

  return (
    <Link ref={tiltRef} className="card" href={`/juegos/${game.id}`} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div className="cover">
        <div className={'cover-bg ' + game.cover} />
        <div className="label">{game.cat}</div>
      </div>
      <div className="meta">
        <div className="title">{game.title}</div>
        <div className="desc">{game.short}</div>
        <div className="row">
          <div className="score-badge">
            <span>MEJOR PUNTUACIÓN</span>
            <b>{game.best.toLocaleString('es-ES')}</b>
          </div>
          <span className={'btn' + accentClass(game.color)}>JUGAR</span>
        </div>
      </div>
    </Link>
  );
};

export default GameCard;
