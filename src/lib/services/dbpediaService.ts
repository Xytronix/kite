import { browser } from '$app/environment';
import { language } from '$lib/stores/language.svelte.js';

// Lightweight DBpedia integration used as a secondary source to Wikidata
// SPARQL endpoint per docs: https://www.dbpedia.org/resources/sparql/

const DBPEDIA_SPARQL_ENDPOINT = 'https://dbpedia.org/sparql';

// Common SPARQL prefixes required by DBpedia
const SPARQL_PREFIXES = `
  PREFIX dbo: <http://dbpedia.org/ontology/>
  PREFIX dbr: <http://dbpedia.org/resource/>
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  PREFIX owl: <http://www.w3.org/2002/07/owl#>
  PREFIX foaf: <http://xmlns.com/foaf/0.1/>
`;

// Simple caches to avoid repeated remote requests
const dbpediaCache = new Map<string, any>();
const dbpediaFailedCache = new Set<string>();

// Failure backoff to avoid spamming upstream SPARQL endpoint when it's unhealthy
let failureWindowStart = 0;
let failureCount = 0;
const FAILURE_WINDOW_MS = 60_000; // 60s window
const FAILURE_THRESHOLD = 4; // after 4 failures in window, start throttling

function recordFailure() {
  const now = Date.now();
  if (now - failureWindowStart > FAILURE_WINDOW_MS) {
    failureWindowStart = now;
    failureCount = 0;
  }
  failureCount++;
}
function recordSuccess() {
  const now = Date.now();
  // decay failures when time passes
  if (now - failureWindowStart > FAILURE_WINDOW_MS / 2) {
    failureWindowStart = now;
    failureCount = Math.max(0, failureCount - 1);
  }
}
function shouldThrottle(): boolean {
  const now = Date.now();
  if (now - failureWindowStart > FAILURE_WINDOW_MS) {
    failureWindowStart = now;
    failureCount = 0;
    return false;
  }
  return failureCount >= FAILURE_THRESHOLD;
}

export interface DbpediaEntityHit {
  resource: string;           // DBpedia resource URI
  label: string;              // localized label
  abstract?: string;          // localized abstract snippet
  qid?: string;               // mapped Wikidata QID when available
  wikipediaUrl?: string;      // foaf:isPrimaryTopicOf when available
}

function normalizeWikiLang(lang: string | undefined): string {
  if (!lang) return 'en';
  const lower = lang.toLowerCase();
  const overrides: Record<string, string> = {
    'pt-br': 'pt',
    'zh-hans': 'zh',
    'zh-hant': 'zh',
    'nb': 'no'
  };
  if (overrides[lower]) return overrides[lower];
  return lower.split('-')[0] || 'en';
}

function getPreferredLanguage(lang?: string): string {
  let targetLang = lang;
  if (!targetLang) {
    targetLang = (browser ? (language.data || language.ui) : 'en') || 'en';
  }
  if (targetLang === 'default') {
    if (browser) {
      const browserLang = navigator.language.split('-')[0];
      targetLang = browserLang || 'en';
    } else {
      targetLang = 'en';
    }
  }
  return normalizeWikiLang(targetLang);
}

async function runSparql(query: string): Promise<any | null> {
  try {
    // Global backoff: if upstream is failing repeatedly, temporarily stop hitting it
    if (shouldThrottle()) {
      if (typeof console !== 'undefined' && (console as any).debug) {
        console.debug('DBpedia SPARQL throttled due to recent failures');
      }
      return null;
    }

    if (browser) {
      // Use server-side proxy in browser to avoid CORS and 400s
      const proxyUrl = `/api/dbpedia/sparql?q=${encodeURIComponent(query)}`;
      const resp = await fetch(proxyUrl, { headers: { 'Accept': 'application/sparql-results+json' } });
      if (!resp || !('ok' in resp) || !resp.ok) {
        recordFailure();
        return null;
      }
      try {
        const json = await resp.json();
        recordSuccess();
        return json;
      } catch {
        recordFailure();
        return null;
      }
    }

    // Server-side: use POST with form-encoding per Virtuoso protocol
    const body = new URLSearchParams({
      query,
      format: 'application/sparql-results+json',
      'default-graph-uri': 'http://dbpedia.org'
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch(DBPEDIA_SPARQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body,
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!resp || !resp.ok) {
      recordFailure();
      return null;
    }
    try {
      const json = await resp.json();
      recordSuccess();
      return json;
    } catch {
      recordFailure();
      return null;
    }
  } catch {
    recordFailure();
    return null;
  }
}

/**
 * Search DBpedia by exact label match (case-insensitive) in the given language.
 * Returns results mapped to Wikidata QIDs via owl:sameAs when available.
 */
export async function searchDbpediaEntities(query: string, lang?: string, limit: number = 5): Promise<DbpediaEntityHit[]> {
  const wikiLang = getPreferredLanguage(lang);
  const cacheKey = `search:${wikiLang}:${query}:${limit}`;
  if (dbpediaCache.has(cacheKey)) return dbpediaCache.get(cacheKey);
  if (dbpediaFailedCache.has(cacheKey)) return [];

  // Basic sanitization:
  // 1) Pick the last non-empty line (handles inputs like "Technical details\n\nShanghai")
  // 2) Drop trailing qualifiers after comma/parentheses (e.g., "Tianjin, China" -> "Tianjin")
  // 3) Normalize whitespace and escape characters for SPARQL string literal
  const trimmed = (query || '').trim();
  const lastLine = trimmed.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).pop() || trimmed;
  const simplified = lastLine.replace(/\s*[,(].*$/, '');
  const normalized = simplified.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length < 2) return [];
  const safeQuery = normalized.replace(/\\/g, '\\\\').replace(/\"/g, '\\"');

  // Exact label match in requested language; gather optional abstract, QID and wiki link
  const sparql = `
    ${SPARQL_PREFIXES}
    SELECT ?resource ?label ?abstract ?sameQ ?wiki WHERE {
      ?resource rdfs:label ?label .
      FILTER (LANGMATCHES(LANG(?label), "${wikiLang}"))
      FILTER (LCASE(STR(?label)) = LCASE("${safeQuery}"))
      OPTIONAL { ?resource dbo:abstract ?abstract . FILTER (LANGMATCHES(LANG(?abstract), "${wikiLang}")) }
      OPTIONAL { ?resource owl:sameAs ?sameQ . FILTER(STRSTARTS(STR(?sameQ), "http://www.wikidata.org/entity/")) }
      OPTIONAL { ?resource foaf:isPrimaryTopicOf ?wiki }
    }
    LIMIT ${Math.max(1, Math.min(3, limit))}
  `;

  try {
    const data = await runSparql(sparql);
    const bindings = data?.results?.bindings || [];
    const hits: DbpediaEntityHit[] = bindings.map((b: any) => {
      const resource = b.resource?.value as string | undefined;
      const label = b.label?.value as string | undefined;
      const abstract = b.abstract?.value as string | undefined;
      const sameQ = b.sameQ?.value as string | undefined;
      const wiki = b.wiki?.value as string | undefined;
      const qid = sameQ ? sameQ.split('/').pop() : undefined;
      return {
        resource: resource || '',
        label: label || query,
        abstract,
        qid,
        wikipediaUrl: wiki
      };
    }).filter((h: DbpediaEntityHit) => !!h.resource);

    dbpediaCache.set(cacheKey, hits);
    return hits;
  } catch {
    dbpediaFailedCache.add(cacheKey);
    return [];
  }
}

/**
 * Resolve a Wikipedia URL for a given Wikidata QID via DBpedia using foaf:isPrimaryTopicOf.
 * Returns English Wikipedia if localized not available.
 */
export async function getWikipediaUrlFromQidDbpedia(qid: string): Promise<string | null> {
  const cacheKey = `qid2wiki:${qid}`;
  if (dbpediaCache.has(cacheKey)) return dbpediaCache.get(cacheKey);
  if (dbpediaFailedCache.has(cacheKey)) return null;

  const sparql = `
    ${SPARQL_PREFIXES}
    SELECT ?wiki WHERE {
      ?resource owl:sameAs <http://www.wikidata.org/entity/${qid}> .
      OPTIONAL { ?resource foaf:isPrimaryTopicOf ?wiki }
    }
    LIMIT 1
  `;

  try {
    const data = await runSparql(sparql);
    const wiki = data?.results?.bindings?.[0]?.wiki?.value as string | undefined;
    if (wiki) {
      dbpediaCache.set(cacheKey, wiki);
      return wiki;
    }
    dbpediaFailedCache.add(cacheKey);
    return null;
  } catch {
    dbpediaFailedCache.add(cacheKey);
    return null;
  }
}

export function clearDbpediaCaches(): void {
  dbpediaCache.clear();
  dbpediaFailedCache.clear();
}

export function getDbpediaCacheStats(): { cacheSize: number; failedCacheSize: number } {
  return { cacheSize: dbpediaCache.size, failedCacheSize: dbpediaFailedCache.size };
}


