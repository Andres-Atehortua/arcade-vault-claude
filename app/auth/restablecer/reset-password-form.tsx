'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { updatePassword, type AuthField } from '../../actions/auth';
import { DEFAULT_NEXT, isStrongPassword } from '../../lib/auth/validation';
import PasswordChecklist from '../password-checklist';

type FieldErrors = Partial<Record<AuthField, string>>;

const ResetPasswordForm = () => {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const fail = (error: string, field?: AuthField) => {
    if (field) setFieldErrors({ [field]: error });
    else setFormError(error);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    if (!isStrongPassword(password)) return fail('La contraseña no cumple todos los requisitos.', 'password');
    if (password !== confirm) return fail('Las contraseñas no coinciden.', 'confirm');

    setPending(true);
    try {
      const result = await updatePassword({ password, confirm });
      if (!result.ok) return fail(result.error, result.field);
      router.replace(DEFAULT_NEXT);
      router.refresh();
    } catch {
      setFormError('Algo falló al conectar con el Vault. Inténtalo de nuevo.');
    } finally {
      setPending(false);
    }
  };

  const fieldProps = (field: AuthField) => ({
    'aria-invalid': fieldErrors[field] ? true : undefined,
    'aria-describedby': fieldErrors[field] ? `reset-${field}-error` : undefined,
  });

  const fieldError = (field: AuthField) =>
    fieldErrors[field] && (
      <p className="field-error" id={`reset-${field}-error`} role="alert">
        {fieldErrors[field]}
      </p>
    );

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">NUEVA CONTRASEÑA</h2>
          <div className="mono auth-sub">ELIGE UNA CONTRASEÑA PARA VOLVER AL VAULT</div>
        </div>

        {formError && (
          <p className="auth-alert" role="alert">
            {formError}
          </p>
        )}

        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="reset-password">Nueva contraseña</label>
            <input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              {...fieldProps('password')}
            />
            {fieldError('password')}
            <PasswordChecklist password={password} id="reset-password-rules" />
          </div>

          <div className="field">
            <label htmlFor="reset-confirm">Confirmar contraseña</label>
            <input
              id="reset-confirm"
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

          <button className="btn lg auth-submit" type="submit" disabled={pending}>
            {pending ? 'GUARDANDO…' : 'GUARDAR CONTRASEÑA'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordForm;
