# Marvin Ernst Consulting — Website

Statische Website ohne Build-Schritt, ausgeliefert über Cloudflare Workers
Static Assets. Ein kleiner Worker nimmt zusätzlich das Anfrageformular
entgegen und legt daraus einen Lead in Close CRM an.

---

## Lokal ansehen

```bash
python3 serve.py
```

Dann `http://localhost:4321` öffnen.

`serve.py` statt `http.server`, weil die internen Links ohne `.html`-Endung
geschrieben sind — so wie Cloudflare sie ausliefert. Der Skript-Server löst
`/impressum` genauso auf wie die Produktion.

Das Formular unter `/api/lead` läuft lokal **nicht** — dafür braucht es
Wrangler (siehe unten) oder ein Deployment.

---

## Struktur

```
public/                    alles, was öffentlich ausgeliefert wird
  index.html               Startseite
  impressum.html           Vorlage — Pflichtfelder ausfüllen
  datenschutz.html         Platzhalter — folgt, wenn alle Dienste feststehen
  erstinformation.html     Vorlage nach § 15 VersVermV / § 12 FinVermV
  _headers                 Security-Header und Cache-Regeln
  assets/css/style.css     Design-System: Farben, Typografie, Komponenten
  assets/js/main.js        Navigation, Reveal, FAQ, mehrstufiges Formular
  assets/fonts/            Inter + Inter Tight, lokal (kein Google-CDN)
  assets/img/logo.svg      Logo, aus dem Original vermessen und nachgebaut

serve.py                   lokaler Vorschau-Server, ahmt Cloudflare nach
src/index.js               Worker-Einstieg: Routing /api/* vs. Assets
src/lead.js                Formular → Close CRM + E-Mail-Kopie
wrangler.jsonc             Cloudflare-Konfiguration
```

Alles unter `public/` ist öffentlich erreichbar. Konfiguration, Worker-Code
und diese README liegen bewusst daneben und werden nicht ausgeliefert.

---

## Setup-Checkliste

### 1. Cloudflare-Projekt

Dashboard → **Workers & Pages** → **Create** → **Import a repository** →
`marvinernstconsulting/marvin-ernst-consulting`

| Feld | Wert |
|---|---|
| Project name | `marvin-ernst-consulting` |
| Build command | *leer lassen* |
| Deploy command | `npx wrangler deploy` |

Wrangler liest `wrangler.jsonc`, lädt `public/` in den Asset-Speicher und
veröffentlicht `src/index.js` als Worker. Ab dann ist jeder Push auf `main`
automatisch live.

### 2. Environment-Variablen (Settings → Variables and Secrets)

| Variable | Pflicht | Wofür |
|---|---|---|
| `CLOSE_API_KEY` | ja | Close → Settings → API Keys. Beginnt mit `api_`. **Als Secret anlegen, nicht als Text.** |
| `CLOSE_LEAD_STATUS_ID` | nein | Status-ID (`stat_…`), in den neue Leads laufen sollen. |
| `RESEND_API_KEY` | empfohlen | E-Mail-Kopie über [resend.com](https://resend.com), Gratis-Tarif reicht. |
| `LEAD_FROM_EMAIL` | mit Resend | Verifizierter Absender, z. B. `website@marvin-ernst-consulting.de` |
| `LEAD_TO_EMAIL` | mit Resend | Dein Posteingang. |

Was beim Absenden passiert:

1. Bestehenden Lead per E-Mail-Adresse suchen — verhindert Doppel-Leads
2. Falls keiner existiert: Lead mit Kontakt (Name, E-Mail, Telefon) anlegen
3. Notiz mit allen Formularantworten an den Lead hängen
4. Parallel E-Mail-Kopie an dich

Close und E-Mail laufen unabhängig. Fällt einer aus, greift der andere. Fallen
beide aus, bekommt der Besucher eine Fehlermeldung mit der E-Mail-Adresse —
statt eines stillen Datenverlusts.

Lead-Status-IDs auslesen:

```bash
curl https://api.close.com/api/v1/status/lead/ -u DEIN_CLOSE_API_KEY:
```

### 3. Externe Links

Alle drei stehen zentral oben in `public/assets/js/main.js`. Nur dort ändern,
nie im HTML — die Buttons ziehen über `data-calendly`, `data-instagram` und
`data-whatsapp` automatisch nach.

| Konstante | Status |
|---|---|
| `CALENDLY_URL` | Platzhalter |
| `INSTAGRAM_URL` | Platzhalter |
| `WHATSAPP_URL` | gesetzt |

Calendly wird bewusst **verlinkt statt eingebettet**: ein Embed würde Cookies
setzen und einen Consent-Banner nötig machen.

### 4. Domain

`marvin-ernst-consulting.de` bei INWX oder netcup registrieren, dann im
Cloudflare-Projekt unter **Domains & Routes** verbinden.

### 5. E-Mail und Close verbinden

Reihenfolge: **Domain → Postfach → alle Konten mit `kontakt@` anlegen.**
Nicht andersherum, sonst muss die Adresse später überall getauscht werden.

**Postfach.** mailbox.org Business, 4 €/Nutzer/Monat mit eigener Domain,
deutsche Server, Auftragsverarbeitungsvertrag abschließbar — den brauchst du,
sobald Kundendaten per Mail laufen. Cloudflare Email Routing wäre kostenlos,
kann aber nur empfangen, nicht unter `kontakt@` senden.

**Adressen.** `kontakt@` öffentlich für die Website. `noreply@` oder
`website@` rein technisch als Resend-Absender — braucht kein Postfach, nur
DNS-Einträge.

**Close ↔ Postfach.** In Close *Custom Email* wählen und eintragen:

| Feld | Wert |
|---|---|
| IMAP | `imap.mailbox.org` Port 993, SSL/TLS |
| SMTP | `smtp.mailbox.org` Port 465, SSL/TLS (alternativ 587 mit STARTTLS) |
| Benutzername | die volle E-Mail-Adresse |
| Passwort | bei aktiver 2FA ein **App-Passwort** |

App-Passwort bei mailbox.org unter *Einstellungen → Sicherheit → Mail
App-Passwörter*, dort IMAP und SMTP erlauben.

Danach landet jede Mail von und an einen Interessenten automatisch in dessen
Lead-Zeitleiste. Zusammen mit dem Formular: die Website erzeugt den Lead, ab
da hängt die weitere Korrespondenz von allein daran.

**Close ↔ Calendly.** Close hat eine native Calendly-Integration. Terminlinks
lassen sich per Klick in Mails einfügen, jede Buchung legt einen Kontakt an.

**Offener Punkt — Kalender.** Calendly und Close synchronisieren über Google,
Microsoft und iCloud. Ein reiner CalDAV-Kalender wie bei mailbox.org ist dort
üblicherweise nicht dabei. Vor dem Festlegen prüfen. Wahrscheinliches
Ergebnis: Mail bei mailbox.org, Kalender bei iCloud oder Google.

**Stolperstein SPF.** mailbox.org und Resend wollen beide einen SPF-Eintrag,
pro Domain darf es aber nur einen geben. Die beiden Einträge müssen
zusammengeführt werden, sonst landen entweder deine Mails oder die
Formular-Kopien im Spam.

---

## Formular lokal testen

```bash
npx wrangler dev
```

Setzt Node voraus (auf diesem Rechner derzeit nicht installiert).

---

## Was noch fehlt

- [ ] Instagram-Handle in `main.js`
- [ ] Calendly-Link in `main.js`
- [ ] Close- und Resend-Zugänge als Environment-Variablen
- [ ] Echte Texte für „Über mich"
- [ ] Portraitfoto statt `.portrait`-Platzhalter
- [ ] Drei echte Kundenstimmen
- [ ] Google- und Trustpilot-Profil, dann Bewertungsleiste scharf schalten
- [ ] Impressum: USt-IdNr, Berufshaftpflicht, § 34f Nr. 1/2/3
- [ ] Datenschutzerklärung vervollständigen
