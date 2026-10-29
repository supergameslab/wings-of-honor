export async function sendMail(env, { to, subject, text, html }) {
  if (!env.RESEND_API_KEY) {
    return { ok: true, skipped: true };
  }
  const from = env.MAIL_FROM || 'Wings of Honor <noreply@localhost>';
  if (!env.MAIL_FROM) console.warn('MAIL_FROM unset — magic links will not land until Resend SPF/DKIM is set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, text, html: html || `<pre>${text}</pre>` }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.warn('mail failed', err);
    return { ok: false, error: err };
  }
  return { ok: true };
}

export function magicMail(origin, token) {
  const link = `${origin}/wings-of-honor/?token=${token}`;
  return {
    subject: 'Your Wings of Honor flying link',
    text: `Tap to hop into Wings of Honor. This link works once, for a little while:\n${link}\n\nIf you didn't ask for this, you can ignore it.`,
  };
}

export function inviteMail(origin, token, fromName, kind) {
  const link = `${origin}/wings-of-honor/?token=${token}`;
  return {
    subject: `${fromName} wants you in the sky`,
    text: `${fromName} invited you to fly in Wings of Honor.\nHop in here (this link lasts a week):\n${link}`,
  };
}
