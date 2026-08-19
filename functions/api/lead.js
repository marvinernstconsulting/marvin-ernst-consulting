/**
 * Cloudflare Pages Function — POST /api/lead
 *
 * Nimmt die Anfrage aus dem mehrstufigen Formular entgegen und legt sie in
 * Close CRM an:
 *   1. Lead anlegen (oder bestehenden Lead per E-Mail wiederfinden)
 *   2. Notiz mit allen Formularantworten an den Lead hängen
 *   3. Optional zusätzlich eine E-Mail-Kopie an dich — als Sicherheitsnetz,
 *      falls die Close-API mal nicht erreichbar ist
 *
 * Environment-Variablen im Cloudflare-Dashboard setzen
 * (Workers & Pages → Projekt → Settings → Environment variables).
 * CLOSE_API_KEY unbedingt als "Encrypted" anlegen, nicht als Plaintext:
 *
 *   CLOSE_API_KEY         Pflicht. Close → Settings → API Keys. Beginnt mit "api_".
 *   CLOSE_LEAD_STATUS_ID  Optional. Status-ID ("stat_…"), in den neue Leads laufen.
 *   RESEND_API_KEY        Optional. E-Mail-Kopie über resend.com.
 *   LEAD_FROM_EMAIL       Bei Resend: verifizierter Absender.
 *   LEAD_TO_EMAIL         Bei Resend: dein Posteingang.
 *
 * Close-API: Basic Auth, API-Key als Benutzername, Passwort leer.
 * Docs: https://developer.close.com/api/resources/leads/create.md
 */

const CLOSE_API = 'https://api.close.com/api/v1';
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
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function closeHeaders(apiKey) {
  return {
    Authorization: 'Basic ' + btoa(`${apiKey}:`),
    'Content-Type': 'application/json'
  };
}

/**
 * Sucht einen bestehenden Lead über die E-Mail-Adresse, damit wiederkehrende
 * Interessenten keinen Doppel-Lead erzeugen. Schlägt die Suche fehl, legen wir
 * einfach neu an — ein Duplikat ist besser als ein verlorener Lead.
 */
async function findeLead(apiKey, email) {
  try {
    const url = `${CLOSE_API}/lead/?query=${encodeURIComponent(`email:"${email}"`)}&_fields=id`;
    const res = await fetch(url, { headers: closeHeaders(apiKey) });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function legeLeadAn(apiKey, statusId, lead) {
  const body = {
    name: lead.name,
    description: `Website-Anfrage vom ${new Date(lead.eingegangen).toLocaleDateString('de-DE')}`,
    contacts: [
      {
        name: lead.name,
        emails: [{ email: lead.email, type: 'office' }],
        ...(lead.telefon ? { phones: [{ phone: lead.telefon, type: 'mobile' }] } : {})
      }
    ],
    ...(statusId ? { status_id: statusId } : {})
  };

  const res = await fetch(`${CLOSE_API}/lead/`, {
    method: 'POST',
    headers: closeHeaders(apiKey),
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`Close lead ${res.status}: ${await res.text()}`);
  }
  return (await res.json()).id;
}

async function haengeNotizAn(apiKey, leadId, lead) {
  const zeilen = [
    ['Themen', lead.themen],
    ['Situation', lead.status],
    ['Telefon', lead.telefon],
    ['Nachricht', lead.nachricht],
    ['Eingegangen', new Date(lead.eingegangen).toLocaleString('de-DE')]
  ].filter(([, v]) => v);

  const res = await fetch(`${CLOSE_API}/activity/note/`, {
    method: 'POST',
    headers: closeHeaders(apiKey),
    body: JSON.stringify({
      lead_id: leadId,
      note: zeilen.map(([k, v]) => `${k}: ${v}`).join('\n'),
      note_html:
        '<body><p><strong>Anfrage über die Website</strong></p><ul>' +
        zeilen.map(([k, v]) => `<li><strong>${k}:</strong> ${escapeHtml(v)}</li>`).join('') +
        '</ul></body>'
    })
  });

  if (!res.ok) throw new Error(`Close note ${res.status}: ${await res.text()}`);
}

async function sendeKopie(env, lead) {
  const zeilen = Object.entries(lead)
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 14px 6px 0;color:#8e8e95">${escapeHtml(k)}</td>` +
        `<td style="padding:6px 0">${escapeHtml(v)}</td></tr>`
    )
    .join('');

  const res = await fetch('https://api.resend.com/emails', {
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
  });

  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
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

  const lead = { ...daten, eingegangen: new Date().toISOString() };

  const wegeKonfiguriert = Boolean(env.CLOSE_API_KEY) || Boolean(env.RESEND_API_KEY && env.LEAD_TO_EMAIL);
  if (!wegeKonfiguriert) {
    console.error('Weder Close noch Resend konfiguriert — Lead ginge verloren.', lead);
    return json({ ok: false, error: 'Formular ist noch nicht konfiguriert.' }, 500);
  }

  let closeOk = false;
  let mailOk = false;

  if (env.CLOSE_API_KEY) {
    try {
      const vorhanden = await findeLead(env.CLOSE_API_KEY, lead.email);
      const leadId = vorhanden ?? (await legeLeadAn(env.CLOSE_API_KEY, env.CLOSE_LEAD_STATUS_ID, lead));
      await haengeNotizAn(env.CLOSE_API_KEY, leadId, lead);
      closeOk = true;
    } catch (err) {
      console.error('Close CRM fehlgeschlagen:', err.message, JSON.stringify(lead));
    }
  }

  if (env.RESEND_API_KEY && env.LEAD_TO_EMAIL) {
    try {
      await sendeKopie(env, lead);
      mailOk = true;
    } catch (err) {
      console.error('E-Mail-Kopie fehlgeschlagen:', err.message);
    }
  }

  if (!closeOk && !mailOk) {
    return json({ ok: false, error: 'Zustellung fehlgeschlagen.' }, 502);
  }

  return json({ ok: true });
}

export async function onRequestGet() {
  return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}
