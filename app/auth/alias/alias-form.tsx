'use client';

import { useState, type FormEvent } from 'react';
import { setUsername } from '../../actions/auth';
import { USERNAME_REGEX, normalizeUsername } from '../../lib/auth/validation';

const AliasForm = ({ next }: { next: string | null }) => {
  const [username, setValue] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldError(null);
    setFormError(null);

    if (!USERNAME_REGEX.test(normalizeUsername(username))) {
      setFieldError('El usuario debe tener de 3 a 12 caracteres: letras, números o guion bajo.');
      return;
    }

    setPending(true);
    try {
      // On success the action redirects, so only failures come back here.
      const result = await setUsername(username, next);
      if (!result.ok) {
        if (result.field) setFieldError(result.error);
        else setFormError(result.error);
      }
    } catch {
      setFormError('Algo falló al conectar con el Vault. Inténtalo de nuevo.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ELIGE TU ALIAS</h2>
          <div className="mono auth-sub">ASÍ TE VERÁN EN EL VAULT. NO PODRÁS CAMBIARLO DESPUÉS</div>
        </div>

        {formError && (
          <p className="auth-alert" role="alert">
            {formError}
          </p>
        )}

        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="alias-username">Usuario</label>
            <input
              id="alias-username"
              value={username}
              onChange={(e) => setValue(e.target.value.toUpperCase())}
              placeholder="PX_KAI"
              maxLength={12}
              autoComplete="username"
              spellCheck={false}
              required
              autoFocus
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? 'alias-username-error' : 'alias-username-hint'}
            />
            {fieldError ? (
              <p className="field-error" id="alias-username-error" role="alert">
                {fieldError}
              </p>
            ) : (
              <p className="field-hint" id="alias-username-hint">
                3 a 12 caracteres: letras, números o guion bajo.
              </p>
            )}
          </div>

          <button className="btn lg auth-submit" type="submit" disabled={pending}>
            {pending ? 'GUARDANDO…' : 'GUARDAR ALIAS'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AliasForm;
