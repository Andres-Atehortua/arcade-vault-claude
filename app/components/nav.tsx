'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const Nav = () => {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isHome = pathname === '/';
  // Game routes keep "Biblioteca" lit, matching the prototype.
  const isLibrary = pathname.startsWith('/biblioteca') || pathname.startsWith('/juegos');
  const isHall = pathname.startsWith('/salon');
  const isAbout = pathname.startsWith('/acerca-de');
  const isAuth = pathname.startsWith('/auth');

  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link className="logo" href="/" onClick={close}>
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link className={isHome ? 'active' : ''} href="/">
            Inicio
          </Link>
          <Link className={isLibrary ? 'active' : ''} href="/biblioteca">
            Biblioteca
          </Link>
          <Link className={isHall ? 'active' : ''} href="/salon">
            Salón de la Fama
          </Link>
          <Link className={isAbout ? 'active' : ''} href="/acerca-de">
            Acerca de
          </Link>
        </div>
        <div className="spacer" />
        <div className="coin-counter">
          <span className="coin" />
          <span>CRÉDITOS · 03</span>
        </div>
        <Link className="btn auth-btn" href="/auth">
          Iniciar Sesión
        </Link>
        <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">
          ≡
        </button>
      </nav>

      <div className={'av-mobile-backdrop' + (open ? ' open' : '')} onClick={close} />
      <aside className={'av-mobile-panel' + (open ? ' open' : '')}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <Link className={isHome ? 'active' : ''} href="/" onClick={close}>
          Inicio
        </Link>
        <Link className={isLibrary ? 'active' : ''} href="/biblioteca" onClick={close}>
          Biblioteca
        </Link>
        <Link className={isHall ? 'active' : ''} href="/salon" onClick={close}>
          Salón de la Fama
        </Link>
        <Link className={isAbout ? 'active' : ''} href="/acerca-de" onClick={close}>
          Acerca de
        </Link>
        <Link className={isAuth ? 'active' : ''} href="/auth" onClick={close}>
          Iniciar Sesión
        </Link>
        <div style={{ flex: 1 }} />
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: 'var(--ink-faint)',
            letterSpacing: '0.16em',
          }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
};

export default Nav;
