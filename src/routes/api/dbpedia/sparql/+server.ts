import type { RequestHandler } from '@sveltejs/kit';

const DBPEDIA_SPARQL_ENDPOINT = 'https://dbpedia.org/sparql';

export const GET: RequestHandler = async ({ url, setHeaders }) => {
  const q = url.searchParams.get('q') || '';
  if (!q) {
    return new Response(JSON.stringify({ error: 'Missing query' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const body = new URLSearchParams({
      query: q,
      format: 'application/sparql-results+json',
      'default-graph-uri': 'http://dbpedia.org'
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20s server timeout
    const resp = await fetch(DBPEDIA_SPARQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'kite-public/1.0 (DBpedia integration)'
      },
      body,
      signal: controller.signal
    });
    clearTimeout(timeout);
    // Propagate useful Virtuoso headers for diagnostics
    const resultHeaders = new Headers({ 'Content-Type': 'application/sparql-results+json' });
    const copyHeaders = ['X-SPARQL-default-graph', 'X-SPARQL-MaxRows', 'X-SQL-State', 'X-SQL-Message', 'X-Exec-Milliseconds', 'X-Exec-DB-Activity'];
    for (const h of copyHeaders) {
      const v = resp.headers.get(h);
      if (v) resultHeaders.set(h, v);
    }
    setHeaders(Object.fromEntries(resultHeaders.entries()));
    const json = await resp.text();
    return new Response(json, { status: resp.status, headers: resultHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'DBpedia proxy failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};


