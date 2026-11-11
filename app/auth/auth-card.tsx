'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { requestPasswordReset, signIn, signInWithOAuth, signUp, type AuthField, type OAuthProvider } from '../actions/auth';
import { USERNAME_REGEX, isStrongPassword, normalizeUsername, safeNext } from '../lib/auth/validation';
import PasswordChecklist from './password-checklist';

type AuthTab = 'in' | 'up';
type Sent = { kind: 'signup' | 'reset'; email: string };
type FieldErrors = Partial<Record<AuthField, string>>;

const LINK_ERRORS: Record<string, string> = {
  enlace: 'El enlace no es válido o ya caducó. Pide uno nuevo.',
  oauth: 'No se pudo completar el acceso con el proveedor. Inténtalo de nuevo.',
};

const AuthCard = ({ next, linkError }: { next: string | null; linkError: string | null }) => {
  const router = useRouter();
  const [tab, setTab] = useState<AuthTab>('in');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState(linkError ? (LINK_ERRORS[linkError] ?? null) : null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [forgot, setForgot] = useState(false);

  const clearErrors = () => {
    setFieldErrors({});
    setFormError(null);
  };

  const switchTab = (value: AuthTab) => {
    setTab(value);
    setPassword('');
    setConfirm('');
    clearErrors();
  };

  const fail = (error: string, field?: AuthField) => {
    if (field) setFieldErrors({ [field]: error });
    else setFormError(error);
  };

  const submitSignIn = async () => {
    const result = await signIn({ email, password });
    if (!result.ok) return fail(result.error, result.field);
    router.replace(safeNext(next));
    router.refresh();
  };

  const submitSignUp = async () => {
    // Client-side gate: nothing reaches Supabase until every local rule passes.
    if (!USERNAME_REGEX.test(normalizeUsername(username))) {
      return fail('El usuario debe tener de 3 a 12 caracteres: letras, números o guion bajo.', 'username');
    }
    if (!isStrongPassword(password)) return fail('La contraseña no cumple todos los requisitos.', 'password');
    if (password !== confirm) return fail('Las contraseñas no coinciden.', 'confirm');

    const result = await signUp({ username, email, password, confirm });
    if (!result.ok) return fail(result.error, result.field);
    setSent({ kind: 'signup', email: email.trim() });
  };

  const submitReset = async () => {
    const result = await requestPasswordReset(email);
    if (!result.ok) return fail(result.error, result.field);
    setSent({ kind: 'reset', email: email.trim() });
  };

  const startOAuth = async (provider: OAuthProvider) => {
    clearErrors();
    setPending(true);
    try {
      const result = await signInWithOAuth(provider, next);
      if (!result.ok) {
        setFormError(result.error);
        setPending(false);
        return;
      }
      // Full navigation: the provider lives on another origin. Stay pending until the page unloads.
      window.location.assign(result.url);
    } catch {
      setFormError('Algo falló al conectar con el Vault. Inténtalo de nuevo.');
      setPending(false);
    }
  };

  const backToSignIn = () => {
    setSent(null);
    setForgot(false);
    switchTab('in');
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearErrors();
    setPending(true);
    try {
      await (forgot ? submitReset() : tab === 'in' ? submitSignIn() : submitSignUp());
    } catch {
      setFormError('Algo falló al conectar con el Vault. Inténtalo de nuevo.');
    } finally {
      setPending(false);
    }
  };

  const fieldProps = (field: AuthField) => ({
    'aria-invalid': fieldErrors[field] ? true : undefined,
    'aria-describedby': fieldErrors[field] ? `auth-${field}-error` : undefined,
  });

  const fieldError = (field: AuthField) =>
    fieldErrors[field] && (
      <p className="field-error" id={`auth-${field}-error`} role="alert">
        {fieldErrors[field]}
      </p>
    );

  if (sent) {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card auth-sent">
          <div className="auth-header">
            <div className="mail-mark" aria-hidden="true" />
            <h2 className="neon-cyan">REVISA TU CORREO</h2>
          </div>
          {sent.kind === 'signup' ? (
            <p className="auth-copy">
              Te enviamos un enlace de confirmación a <strong>{sent.email}</strong>. Ábrelo para activar tu cuenta y entrar al Vault.
            </p>
          ) : (
            <p className="auth-copy">
              Si existe una cuenta con <strong>{sent.email}</strong>, te enviamos un enlace para crear una contraseña nueva.
            </p>
          )}
          <p className="auth-copy dim">Si no lo ves en unos minutos, busca en spam o promociones.</p>
          <button className="btn ghost auth-guest" type="button" onClick={backToSignIn}>
            VOLVER A INICIAR SESIÓN
          </button>
        </div>
      </div>
    );
  }

  if (forgot) {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">
          <div className="auth-header">
            <div className="mark" />
            <h2 className="neon-cyan">RECUPERAR ACCESO</h2>
            <div className="mono auth-sub">TE ENVIAREMOS UN ENLACE PARA CREAR UNA CONTRASEÑA NUEVA</div>
          </div>

          {formError && (
            <p className="auth-alert" role="alert">
              {formError}
            </p>
          )}

          <form onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="auth-email">Correo electrónico</label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
                autoComplete="email"
                required
                {...fieldProps('email')}
              />
              {fieldError('email')}
            </div>
            <button className="btn lg auth-submit" type="submit" disabled={pending}>
              {pending ? 'ENVIANDO…' : 'ENVIAR ENLACE'}
            </button>
          </form>

          <button className="btn ghost auth-guest" type="button" onClick={backToSignIn}>
            VOLVER A INICIAR SESIÓN
          </button>
        </div>
      </div>
    );
  }

  const submitLabel = tab === 'in' ? 'ENTRAR AL VAULT' : 'CREAR CUENTA';

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div className="mono auth-sub">ACCESO AL SISTEMA · v2.6</div>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'in'}
            className={tab === 'in' ? 'on' : ''}
            onClick={() => switchTab('in')}
          >
            INICIAR SESIÓN
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'up'}
            className={tab === 'up' ? 'on' : ''}
            onClick={() => switchTab('up')}
          >
            CREAR CUENTA
          </button>
        </div>

        {formError && (
          <p className="auth-alert" role="alert">
            {formError}
          </p>
        )}

        <form onSubmit={onSubmit} noValidate>
          {tab === 'up' && (
            <div className="field slide-in">
              <label htmlFor="auth-username">Usuario</label>
              <input
                id="auth-username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toUpperCase())}
                placeholder="PX_KAI"
                maxLength={12}
                autoComplete="username"
                spellCheck={false}
                required
                {...fieldProps('username')}
              />
              {fieldError('username')}
            </div>
          )}

          <div className="field">
            <label htmlFor="auth-email">Correo electrónico</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
              autoComplete="email"
              required
              {...fieldProps('email')}
            />
            {fieldError('email')}
          </div>

          <div className="field">
            <label htmlFor="auth-password">Contraseña</label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={tab === 'in' ? 'current-password' : 'new-password'}
              required
              {...fieldProps('password')}
            />
            {fieldError('password')}
            {tab === 'up' && <PasswordChecklist password={password} id="auth-password-rules" />}
            {tab === 'in' && (
              <button
                className="auth-link"
                type="button"
                onClick={() => {
                  clearErrors();
                  setForgot(true);
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </div>

          {tab === 'up' && (
            <div className="field slide-in">
              <label htmlFor="auth-confirm">Confirmar contraseña</label>
              <input
                id="auth-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                {...fieldProps('confirm')}
              />
              {fieldError('confirm')}
            </div>
          )}

          <button className="btn lg auth-submit" type="submit" disabled={pending}>
            {pending ? 'CONECTANDO…' : submitLabel}
          </button>
        </form>

        <button className="btn ghost auth-guest" type="button" onClick={() => router.push('/biblioteca')}>
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button className="btn ghost" type="button" onClick={() => startOAuth('google')} disabled={pending}>
            ◆ GOOGLE
          </button>
          <button className="btn ghost" type="button" onClick={() => startOAuth('github')} disabled={pending}>
            ▣ GITHUB
          </button>
        </div>

        <div className="auth-terms">AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE</div>
      </div>
    </div>
  );
};

export default AuthCard;
