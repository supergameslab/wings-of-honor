import { one } from './db.js';
import { fillTemplate } from './util.js';

const FROM_EMAIL = 'we.care@supergameslab.com';
const FROM_NAME = 'Wings of Honor';

export async function sendMail(env, { to, subject, text, html, slug }) {
  const from = env.MAIL_FROM || `${FROM_NAME} <${FROM_EMAIL}>`;
  try {
    if (env.EMAIL) {
      await env.EMAIL.send({
        to,
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject,
        text,
        html: html || `<pre>${text || ''}</pre>`,
      });
      return { ok: true };
    }
    if (env.RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to, subject, text, html: html || `<pre>${text}</pre>` }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.warn('mail failed', err);
        return { ok: false, error: err };
      }
      return { ok: true };
    }
    return { ok: true, skipped: true };
  } catch (err) {
    console.warn('mail failed', err);
    return { ok: false, error: String(err?.message || err) };
  }
}

export async function sendTemplate(env, slug, to, vars = {}, fallback) {
  let tpl = null;
  try {
    tpl = await one(env, 'SELECT * FROM comms_templates WHERE slug = ?', slug);
  } catch {
    tpl = null;
  }
  if (!tpl && fallback) return sendMail(env, { to, slug, ...fallback });
  if (!tpl) return sendMail(env, { to, slug, subject: slug, text: JSON.stringify(vars) });
  return sendMail(env, {
    to,
    slug,
    subject: fillTemplate(tpl.subject, vars),
    text: fillTemplate(tpl.text, vars),
    html: fillTemplate(tpl.html, vars, true),
  });
}

export function magicMail(origin, tok) {
  const link = `${origin}/wings-of-honor/?token=${tok}`;
  return {
    subject: 'Your Wings of Honor flying link',
    text: `Tap to hop into Wings of Honor. This link works once, for a little while:\n${link}\n\nIf you didn't ask for this, you can ignore it.`,
  };
}

export function inviteMail(origin, tok, fromName) {
  const link = `${origin}/wings-of-honor/?token=${tok}`;
  return {
    subject: `${fromName} wants you in the sky`,
    text: `${fromName} invited you to fly in Wings of Honor.\nHop in here (this link lasts a week):\n${link}`,
  };
}
