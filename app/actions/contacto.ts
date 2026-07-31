'use server';

import { Resend } from 'resend';

export interface ContactoPayload {
  name: string;
  email: string;
  message: string;
  honeypot: string;
}

export type ContactoResult = { ok: true } | { ok: false; error: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DESTINATARIO = 'andres.lopez.ate@gmail.com';
const REMITENTE = 'onboarding@resend.dev';

export const enviarContacto = async (
  payload: ContactoPayload
): Promise<ContactoResult> => {
  const { name, email, message, honeypot } = payload;

  if (honeypot) {
    return { ok: true };
  }

  if (!name.trim() || !email.trim() || !message.trim()) {
    return { ok: false, error: 'Todos los campos son obligatorios.' };
  }

  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, error: 'El correo electrónico no tiene un formato válido.' };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'El servicio de correo no está configurado.' };
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: REMITENTE,
    to: DESTINATARIO,
    subject: `Nuevo mensaje de contacto de ${name}`,
    text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${message}`,
  });

  if (error) {
    return { ok: false, error: 'No se pudo enviar el mensaje. Intenta nuevamente.' };
  }

  return { ok: true };
};
