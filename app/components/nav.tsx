'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { signOut } from '../actions/auth';
import { useSessionProfile } from '../lib/auth/use-session-profile';

const Nav = () => {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { session, refresh } = useSessionProfile();

  const isHome = pathname === '/';
  // Game routes keep "Biblioteca" lit, matching the prototype.
  const isLibrary = pathname.startsWith('/biblioteca') || pathname.startsWith('/juegos');
  const isHall = pathname.startsWith('/salon');
  const isAbout = pathname.startsWith('/acerca-de');
  const isAuth = pathname.startsWith('/auth');

  const close = () => setOpen(false);

  const onSignOut = async () => {
    setSigningOut(true);
    const result = await signOut();
    setSigningOut(false);
    if (!result.ok) return;
    close();
    await refresh();
    router.push('/');
    router.refresh();
  };

  const signOutButton = (className: string) => (
    <button className={className} type="button" onClick={onSignOut} disabled={signingOut}>
      {signingOut ? 'SALIENDO…' : 'Salir'}
    </button>
  );

  // Users without a username (fresh OAuth accounts) get a way back to /auth/alias.
  const userTag = (onClick?: () => void) =>
    session.status === 'user' &&
    (session.username ? (
      <span className="nav-user neon-cyan" title="Tu usuario">
        {session.username}
      </span>
    ) : (
      <Link className="nav-user pending" href="/auth/alias" onClick={onClick}>
        Elige alias
      </Link>
    ));

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
        {session.status === 'loading' && (
          // Same footprint as the button, so the bar does not jump once the session resolves.
          <span className="btn auth-btn auth-placeholder" aria-hidden="true">
            Iniciar Sesión
          </span>
        )}
        {session.status === 'guest' && (
          <Link className="btn auth-btn" href="/auth">
            Iniciar Sesión
          </Link>
        )}
        {session.status === 'user' && (
          <div className="nav-session">
            {userTag()}
            {signOutButton('btn ghost auth-btn')}
          </div>
        )}
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
        {session.status === 'guest' && (
          <Link className={isAuth ? 'active' : ''} href="/auth" onClick={close}>
            Iniciar Sesión
          </Link>
        )}
        {session.status === 'user' && (
          <div className="panel-session">
            {userTag(close)}
            {signOutButton('btn ghost')}
          </div>
        )}
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
