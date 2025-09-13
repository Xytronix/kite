// Favicon helpers and cache service (client-friendly)

export function getLogoDevUrl(domain: string): string | null {
  if (!domain) return null;
  const host = domain.toLowerCase().trim();
  return `https://logo.dev/${host}.svg`;
}

export function getFaviconeUrl(domain: string): string {
  return `https://favicone.com/${domain}?s=256`;
}

export function getGoogleFaviconUrl(domain: string, size = 128): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

// --- Cache ---
const FAVICON_CACHE_INDEX_KEY = "__FAVICON_CACHE_V1_INDEX__";
const FAVICON_CACHE_PREFIX = "__FAVICON_CACHE_V1__:";
const FAVICON_CACHE_MAX_ENTRIES = 600;

const inMemoryFaviconCache = new Map<string, string[]>();

function persistFaviconUrls(domain: string, urls: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const key = FAVICON_CACHE_PREFIX + domain;
    window.localStorage.setItem(key, JSON.stringify(urls));

    const idxRaw = window.localStorage.getItem(FAVICON_CACHE_INDEX_KEY);
    let index: string[] = [];
    if (idxRaw) {
      try { index = JSON.parse(idxRaw) as string[]; } catch { index = []; }
    }
    index = index.filter((d) => d !== domain);
    index.push(domain);
    while (index.length > FAVICON_CACHE_MAX_ENTRIES) {
      const evict = index.shift();
      if (evict) {
        try { window.localStorage.removeItem(FAVICON_CACHE_PREFIX + evict); } catch {}
      }
    }
    window.localStorage.setItem(FAVICON_CACHE_INDEX_KEY, JSON.stringify(index));
  } catch {}
}

function readPersistedFaviconUrls(domain: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FAVICON_CACHE_PREFIX + domain);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as string[];
  } catch {}
  return null;
}

export function getFaviconUrlsSync(domain: string, size?: number): string[] {
  if (!domain) return [];
  const key = domain.toLowerCase().trim();
  const mem = inMemoryFaviconCache.get(key);
  const urls = mem ?? readPersistedFaviconUrls(key);
  if (!urls || urls.length === 0) return [];
  if (size && Number.isFinite(size)) {
    const sized = urls.map((u) => {
      if (/https?:\/\/www\.google\.com\/s2\/favicons/i.test(u)) {
        const urlObj = new URL(u);
        urlObj.searchParams.set("sz", String(size));
        return urlObj.toString();
      }
      return u;
    });
    return sized;
  }
  return urls;
}

export async function preloadCommonFavicons(
  buckets: Record<string, { articles?: Array<{ domain?: string }> }>,
  keys: string[]
): Promise<void> {
  if (!buckets || !keys || keys.length === 0) return;
  const domains = new Set<string>();
  for (const key of keys) {
    const list = buckets[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const articles: Array<{ domain?: string }> = item?.articles || [];
      for (const a of articles) {
        if (a?.domain) domains.add(String(a.domain).toLowerCase());
      }
    }
  }
  if (domains.size === 0) return;
  for (const host of domains) {
    const logo = getLogoDevUrl(host);
    const fav = getFaviconeUrl(host);
    const g2 = getGoogleFaviconUrl(host, 128);
    const ordered = [logo, fav, g2].filter(Boolean) as string[];
    if (ordered.length > 0) {
      inMemoryFaviconCache.set(host, ordered);
      persistFaviconUrls(host, ordered);
    }
  }
}


// Prefetch favicons for a list of domains (compat with old hook)
export async function prefetchFavicons(domains: string[]): Promise<void> {
  if (!domains || domains.length === 0) return;
  try {
    const unique = Array.from(new Set(domains.map((d) => String(d).toLowerCase().trim()).filter(Boolean)));
    for (const host of unique) {
      const logo = getLogoDevUrl(host);
      const fav = getFaviconeUrl(host);
      const g2 = getGoogleFaviconUrl(host, 128);
      const ordered = [logo, fav, g2].filter(Boolean) as string[];
      if (ordered.length > 0) {
        inMemoryFaviconCache.set(host, ordered);
        persistFaviconUrls(host, ordered);
      }
    }
  } catch {
    // Best-effort prefetch; ignore failures
  }
}

