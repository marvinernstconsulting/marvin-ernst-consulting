# Marvin Ernst Consulting — Website

Statische Website, kein Build-Schritt. Einfach die Dateien deployen.

**Stack:** HTML/CSS/JS · Cloudflare Pages · Cloudflare Pages Function für das Formular · Calendly für Termine

---

## Lokal ansehen

```bash
python3 -m http.server 4321
```

Dann `http://localhost:4321` öffnen. Achtung: die Formular-Funktion unter `/api/lead`
läuft so **nicht** — dafür braucht es Wrangler (siehe unten) oder ein Deployment.

---

## Struktur

```
index.html               Startseite (alle Sektionen)
impressum.html           Vorlage — Pflichtfelder ausfüllen
datenschutz.html         Platzhalter — folgt, wenn alle Dienste feststehen
erstinformation.html     Vorlage nach § 15 VersVermV / § 12 FinVermV
assets/css/style.css     Komplettes Design-System (Farben, Typo, Komponenten)
assets/js/main.js        Navigation, Reveal, FAQ, mehrstufiges Formular
assets/fonts/            Inter + Inter Tight, lokal gehostet (kein Google-CDN)
functions/api/lead.js    Cloudflare Pages Function: Formular → CRM + E-Mail
_headers                 Security-Header und Cache-Regeln
```

---

## Setup-Checkliste

### 1. GitHub

```bash
git remote add origin git@github.com:DEIN-USER/marvin-ernst-consulting.git
git push -u origin main
```

### 2. Cloudflare Pages

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Repository auswählen
3. Build-Einstellungen:
   - Framework preset: **None**
   - Build command: *leer lassen*
   - Build output directory: `/`
4. **Save and Deploy**

Ab jetzt gilt: jeder Push auf `main` ist automatisch live.

### 3. Environment-Variablen (Settings → Environment variables)

| Variable | Pflicht | Wofür |
|---|---|---|
| `CRM_WEBHOOK_URL` | ja | Webhook-URL deines CRM. Dorthin geht jede Anfrage. |
| `CRM_AUTH_HEADER` | nein | Falls dein CRM einen Auth-Header braucht. |
| `RESEND_API_KEY` | empfohlen | E-Mail-Kopie über [resend.com](https://resend.com) (Gratis-Tarif reicht). |
| `LEAD_FROM_EMAIL` | mit Resend | Verifizierter Absender, z. B. `website@deine-domain.de` |
| `LEAD_TO_EMAIL` | mit Resend | Dein Posteingang. |

Mindestens einer der beiden Wege muss gesetzt sein — sonst antwortet das
Formular bewusst mit einem Fehler, statt Anfragen still zu verschlucken.

### 4. Calendly

Termin-Typ „Kostenloses Erstgespräch, 30 Min" anlegen, Link kopieren und in
`assets/js/main.js` bei `CALENDLY_URL` eintragen. Alle Buttons mit
`data-calendly` übernehmen ihn automatisch.

Bewusst **verlinkt statt eingebettet**: ein Calendly-Embed würde Cookies setzen
und einen Consent-Banner nötig machen.

### 5. Domain

Domain bei Cloudflare Registrar oder INWX registrieren, dann in Pages unter
**Custom domains** verbinden. Danach `DEINE-DOMAIN.de` ersetzen in:

- `robots.txt`
- `sitemap.xml`
- `index.html` (Canonical-Tag, OG-Tags, alle E-Mail-Adressen)

---

## Formular lokal testen

```bash
npx wrangler pages dev .
```

Setzt Node voraus (aktuell nicht auf dem Rechner installiert).

---

## Was noch fehlt

- [ ] Echte Texte für „Über mich" (aktuell Platzhalter im HTML markiert)
- [ ] Portrait-Foto → ersetzt `.portrait` in `index.html`
- [ ] Drei echte Kundenstimmen
- [ ] IHK-Registernummer und Anschrift in allen Rechtsseiten
- [ ] Datenschutzerklärung vervollständigen
- [ ] Statistik-Zahlen in der Stats-Sektion verifizieren
- [ ] ProvenExpert-Profil anlegen und Widget einbinden
