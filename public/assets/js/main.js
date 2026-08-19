/* Marvin Ernst Consulting — Interaktion
   ------------------------------------------------------------------
   Zentrale Konfiguration. Nur hier anpassen, nicht im HTML.
   ------------------------------------------------------------------ */

/* Cloudflare Pages Function — nimmt das Formular entgegen und leitet
   es an CRM-Webhook und/oder E-Mail weiter. Siehe functions/api/lead.js */
const FORM_ENDPOINT = '/api/lead';

/* Externe Links. Werden auf alle Elemente mit dem jeweiligen data-Attribut
   gesetzt — nur hier ändern, nie im HTML.
   TODO: alle drei durch die echten Werte ersetzen. */
const CALENDLY_URL  = 'https://calendly.com/DEIN-LINK/erstgespraech';
const INSTAGRAM_URL = 'https://instagram.com/marvinernst03';
const WHATSAPP_URL  = 'https://wa.me/4915168530886';

/* --- Jahr im Footer ------------------------------------------------ */
document.getElementById('year').textContent = new Date().getFullYear();

/* --- Externe Links zentral setzen ----------------------------------- */
const LINKS = {
  '[data-calendly]': CALENDLY_URL,
  '[data-instagram]': INSTAGRAM_URL,
  '[data-whatsapp]': WHATSAPP_URL
};

Object.entries(LINKS).forEach(([selektor, url]) => {
  document.querySelectorAll(selektor).forEach((el) => {
    el.href = url;
  });
});

/* --- Sticky CTA ausblenden, wenn die Anfrage-Sektion im Bild ist ----- */
const stickyCta = document.getElementById('stickyCta');
const anfrage = document.getElementById('anfrage');

if (stickyCta && anfrage && 'IntersectionObserver' in window) {
  new IntersectionObserver(
    ([eintrag]) => stickyCta.classList.toggle('is-hidden', eintrag.isIntersecting),
    { threshold: 0.18 }
  ).observe(anfrage);
}

/* --- Mobile Navigation --------------------------------------------- */
const navToggle = document.getElementById('navToggle');
const nav = document.getElementById('nav');

navToggle.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.textContent = open ? 'Schließen' : 'Menü';
});

nav.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') {
    nav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.textContent = 'Menü';
  }
});

/* --- Reveal beim Scrollen ------------------------------------------ */
const reveals = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add('is-in'));
}

/* --- FAQ: immer nur eine Antwort offen ------------------------------ */
const faqItems = document.querySelectorAll('.faq details');
faqItems.forEach((item) => {
  item.addEventListener('toggle', () => {
    if (!item.open) return;
    faqItems.forEach((other) => { if (other !== item) other.open = false; });
  });
});

/* --- Mehrstufiges Formular ------------------------------------------ */
const form = document.getElementById('leadForm');
const steps = [...document.querySelectorAll('.form-step')];
const bars = [...document.querySelectorAll('.form-progress span')];
const errorBox = document.getElementById('formError');
const success = document.getElementById('formSuccess');
let current = 0;

function showStep(index) {
  current = Math.max(0, Math.min(index, steps.length - 1));
  steps.forEach((step, i) => step.classList.toggle('is-active', i === current));
  bars.forEach((bar, i) => bar.classList.toggle('is-active', i <= current));
  errorBox.style.display = 'none';
}

function validateStep(index) {
  if (index === 0) {
    const picked = form.querySelectorAll('input[name="thema"]:checked').length;
    return picked > 0 ? null : 'Bitte wähle mindestens ein Thema aus.';
  }
  if (index === 1) {
    return form.querySelector('input[name="status"]:checked')
      ? null
      : 'Bitte wähle aus, was auf dich zutrifft.';
  }
  return null;
}

function fail(message) {
  errorBox.textContent = message;
  errorBox.style.display = 'block';
}

form.addEventListener('click', (e) => {
  const next = e.target.closest('[data-next]');
  const prev = e.target.closest('[data-prev]');

  if (next) {
    const problem = validateStep(current);
    if (problem) {
      // Fehler im aktuellen Schritt anzeigen
      let inline = steps[current].querySelector('.step-error');
      if (!inline) {
        inline = document.createElement('p');
        inline.className = 'step-error';
        inline.style.cssText = 'color:#c0392b;font-size:14px;margin:0 0 14px';
        steps[current].querySelector('.form-nav').before(inline);
      }
      inline.textContent = problem;
      return;
    }
    const stale = steps[current].querySelector('.step-error');
    if (stale) stale.remove();
    showStep(current + 1);
  }

  if (prev) showStep(current - 1);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.style.display = 'none';

  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const consent = form.datenschutz.checked;

  if (!name) return fail('Bitte gib deinen Namen an.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Bitte gib eine gültige E-Mail-Adresse an.');
  if (!consent) return fail('Bitte stimme der Datenschutzerklärung zu.');

  const data = {
    themen: [...form.querySelectorAll('input[name="thema"]:checked')].map((i) => i.value).join(', '),
    status: form.querySelector('input[name="status"]:checked')?.value || '',
    name,
    email,
    telefon: form.telefon.value.trim(),
    nachricht: form.nachricht.value.trim(),
    website: form.website.value // Honeypot — muss leer bleiben
  };

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Wird gesendet …';

  try {
    const res = await fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Request failed');

    form.style.display = 'none';
    document.querySelector('.form-progress').style.display = 'none';
    success.classList.add('is-active');
  } catch (err) {
    fail('Das hat leider nicht geklappt. Schreib mir bitte direkt an kontakt@marvin-ernst-consulting.de.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Anfrage senden';
  }
});
