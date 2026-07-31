'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';

type AuthTab = 'in' | 'up';

const AuthPage = () => {
  const router = useRouter();
  const [tab, setTab] = useState<AuthTab>('in');
  const [user, setUser] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push('/biblioteca');
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div className="mono auth-sub">ACCESO AL SISTEMA · v2.6</div>
        </div>

        <div className="auth-tabs">
          <button className={tab === 'in' ? 'on' : ''} onClick={() => setTab('in')}>
            INICIAR SESIÓN
          </button>
          <button className={tab === 'up' ? 'on' : ''} onClick={() => setTab('up')}>
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="auth-user">Usuario</label>
            <input id="auth-user" value={user} onChange={(e) => setUser(e.target.value)} placeholder="px_kai" />
          </div>
          {tab === 'up' && (
            <div className="field slide-in">
              <label htmlFor="auth-email">Correo electrónico</label>
              <input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jugador@vault.gg" />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-pass">Contraseña</label>
            <input id="auth-pass" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" />
          </div>

          <button className="btn lg auth-submit" type="submit">
            {tab === 'in' ? 'ENTRAR AL VAULT' : 'CREAR Y JUGAR'}
          </button>
        </form>

        <button className="btn ghost auth-guest" type="button" onClick={() => router.push('/biblioteca')}>
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button className="btn ghost" type="button">
            ◆ GOOGLE
          </button>
          <button className="btn ghost" type="button">
            ▣ GITHUB
          </button>
        </div>

        <div className="auth-terms">AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE</div>
      </div>
    </div>
  );
};

export default AuthPage;
