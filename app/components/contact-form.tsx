'use client';

import { useState } from 'react';
import { enviarContacto } from '../actions/contacto';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
  name: string;
  email: string;
  message: string;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

const EMPTY_FORM: FormState = { name: '', email: '', message: '' };

const ContactForm = () => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [sentName, setSentName] = useState('');
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      triggerShake();
      return;
    }

    if (!EMAIL_REGEX.test(form.email)) {
      triggerShake();
      return;
    }

    const honeypot = (e.currentTarget.elements.namedItem('website') as HTMLInputElement).value;

    setStatus('loading');

    const result = await enviarContacto({
      name: form.name.trim(),
      email: form.email.trim(),
      message: form.message.trim(),
      honeypot,
    });

    if (result.ok) {
      setSentName(form.name.trim());
      setStatus('success');
    } else {
      setErrorMsg(result.error);
      setStatus('error');
    }
  };

  const retry = () => {
    setStatus('idle');
    setErrorMsg('');
  };

  const sendAnother = () => {
    setStatus('idle');
    setForm(EMPTY_FORM);
  };

  if (status === 'success') {
    return (
      <div className="terminal-success">
        <div className="term-bar">
          <span className="dot r" />
          <span className="dot y" />
          <span className="dot g" />
          <span className="term-title">VAULT-OS // TERMINAL</span>
        </div>
        <div className="term-body">
          <div className="line">
            <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
          </div>
          <div className="line dim">[OK] Conectando con servidor…</div>
          <div className="line dim">[OK] Validando contenido…</div>
          <div className="line dim">[OK] Transmitiendo paquete…</div>
          <div className="line success">
            &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {sentName.toUpperCase()}.<span className="caret">_</span>
          </div>
          <div style={{ marginTop: 18 }}>
            <button className="btn ghost" type="button" onClick={sendAnother}>
              ENVIAR OTRO MENSAJE
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="contact-error">
        <div className="contact-error-title pixel">▸ ENVÍO FALLIDO</div>
        <p className="contact-error-msg">{errorMsg}</p>
        <button className="btn ghost" type="button" onClick={retry}>
          REINTENTAR
        </button>
      </div>
    );
  }

  return (
    <form className={'contact-form' + (shake ? ' shake' : '')} onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="contact-name">NOMBRE</label>
        <input id="contact-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="px_kai" />
      </div>
      <div className="field">
        <label htmlFor="contact-email">CORREO ELECTRÓNICO</label>
        <input
          id="contact-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="jugador@vault.gg"
        />
      </div>
      <div className="field">
        <label htmlFor="contact-message">MENSAJE</label>
        <textarea
          id="contact-message"
          rows={5}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="Cuéntanos qué tienes en mente…"
        />
      </div>
      <input type="text" name="website" className="hp-field" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <button className="btn xl press" type="submit" style={{ width: '100%' }} disabled={status === 'loading'}>
        {status === 'loading' ? '▶  ENVIANDO…' : '▶  ENVIAR MENSAJE'}
      </button>
    </form>
  );
};

export default ContactForm;
