/**
 * Cloudflare Pages Function — POST /api/lead
 *
 * Nimmt die Anfrage vom mehrstufigen Formular entgegen und leitet sie weiter:
 *   1. an den CRM-Webhook (CRM_WEBHOOK_URL) — der eigentliche Zielweg
 *   2. zusätzlich als E-Mail an dich (RESEND_API_KEY + LEAD_TO_EMAIL) — Sicherheitsnetz
 *
 * Environment-Variablen im Cloudflare-Dashboard setzen
 * (Workers & Pages → Projekt → Settings → Environment variables):
 *
 *   CRM_WEBHOOK_URL   Ziel-Webhook deines CRM / von Zapier / Make.
 *   CRM_AUTH_HEADER   Optional, wird als "Authorization"-Header mitgeschickt.
 *   RESEND_API_KEY    Optional, für die E-Mail-Kopie (resend.com, Gratis-Tarif reicht).
 *   LEAD_FROM_EMAIL   Absender, bei Resend verifiziert. z. B. website@deine-domain.de
 *   LEAD_TO_EMAIL     Dein Posteingang.
 *
 * Mindestens einer der beiden Wege muss konfiguriert sein, sonst antwortet die
 * Funktion mit 500 — damit keine Anfrage still verloren geht.
 */

const FELDER = ['themen', 'status', 'name', 'email', 'telefon', 'nachricht'];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function saeubern(wert, maxLaenge) {
  return String(wert ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ') // Steuerzeichen entfernen
    .trim()
    .slice(0, maxLaenge);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

export async function onRequestPost({ request, env }) {
  let roh;
  try {
    roh = await request.json();
  } catch {
    return json({ ok: false, error: 'Ungültiges Format.' }, 400);
  }

  // Honeypot: Bots füllen versteckte Felder aus. Wir tun so, als sei alles gut.
  if (saeubern(roh.website, 100)) return json({ ok: true });

  const daten = {};
  for (const feld of FELDER) {
    daten[feld] = saeubern(roh[feld], feld === 'nachricht' ? 4000 : 300);
  }

  if (!daten.name) return json({ ok: false, error: 'Name fehlt.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(daten.email)) {
    return json({ ok: false, error: 'E-Mail ungültig.' }, 400);
  }

  const lead = {
    ...daten,
    quelle: 'Website — Anfrageformular',
    eingegangen: new Date().toISOString(),
    land: request.headers.get('CF-IPCountry') || null
  };

  const zustellungen = [];

  if (env.CRM_WEBHOOK_URL) {
    zustellungen.push(
      fetch(env.CRM_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(env.CRM_AUTH_HEADER ? { Authorization: env.CRM_AUTH_HEADER } : {})
        },
        body: JSON.stringify(lead)
      })
    );
  }

  if (env.RESEND_API_KEY && env.LEAD_TO_EMAIL) {
    const zeilen = Object.entries(lead)
      .filter(([, v]) => v)
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 14px 6px 0;color:#8e8e95">${escapeHtml(k)}</td>` +
          `<td style="padding:6px 0">${escapeHtml(String(v))}</td></tr>`
      )
      .join('');

    zustellungen.push(
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: env.LEAD_FROM_EMAIL,
          to: env.LEAD_TO_EMAIL,
          reply_to: lead.email,
          subject: `Neue Anfrage: ${lead.name}${lead.themen ? ' — ' + lead.themen : ''}`,
          html:
            '<h2 style="font-family:Helvetica,Arial,sans-serif">Neue Anfrage über die Website</h2>' +
            `<table style="font-family:Helvetica,Arial,sans-serif;font-size:14px">${zeilen}</table>`
        })
      })
    );
  }

  if (zustellungen.length === 0) {
    console.error('Kein Zustellweg konfiguriert — Lead ginge verloren.', lead);
    return json({ ok: false, error: 'Formular ist noch nicht konfiguriert.' }, 500);
  }

  const ergebnisse = await Promise.allSettled(zustellungen);
  const erfolg = ergebnisse.some((r) => r.status === 'fulfilled' && r.value.ok);

  if (!erfolg) {
    console.error('Alle Zustellwege fehlgeschlagen', JSON.stringify(ergebnisse), lead);
    return json({ ok: false, error: 'Zustellung fehlgeschlagen.' }, 502);
  }

  return json({ ok: true });
}

export async function onRequestGet() {
  return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}
