/**
 * Worker-Einstiegspunkt.
 *
 * Statische Dateien beantwortet Cloudflare direkt aus public/, ohne diesen
 * Worker aufzurufen — konfiguriert über "run_worker_first" in wrangler.jsonc.
 * Hier landet also nur /api/*.
 */

import { behandleLead } from './lead.js';

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/lead') {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', {
          status: 405,
          headers: { Allow: 'POST' }
        });
      }
      return behandleLead(request, env);
    }

    // Alles andere an den Asset-Speicher weiterreichen.
    return env.ASSETS.fetch(request);
  }
};
