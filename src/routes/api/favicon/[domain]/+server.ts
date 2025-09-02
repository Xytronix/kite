import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Simple in-memory cache for favicon URLs (could be moved to Redis/DB later)
const faviconCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Attempts to fetch favicon from common site locations
 * Returns the first successful favicon URL or null
 */
async function fetchSiteFavicon(domain: string): Promise<string | null> {
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
  
  // Common favicon locations (ordered by likelihood)
  const faviconUrls = [
    `https://${cleanDomain}/favicon.svg`,
    `https://${cleanDomain}/favicon.ico`,
    `https://${cleanDomain}/favicon.png`,
    `https://${cleanDomain}/apple-touch-icon.png`,
    `https://${cleanDomain}/apple-touch-icon-180x180.png`,
    `https://${cleanDomain}/icon.svg`,
    `https://${cleanDomain}/icon.png`
  ];

  for (const url of faviconUrls) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(url, {
        method: 'HEAD', // Only check headers, don't download content
        signal: controller.signal,
        headers: {
          'User-Agent': 'Kite-Favicon-Fetcher/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        // Verify it's actually an image
        if (contentType && (
          contentType.includes('image/') || 
          contentType.includes('application/octet-stream') // Some ICO files
        )) {
          return url;
        }
      }
    } catch (error) {
      // Continue to next URL on any error
      continue;
    }
  }
  
  return null;
}

export const GET: RequestHandler = async ({ params, url }) => {
  const domain = params.domain;
  const size = url.searchParams.get('size') || '32';

  if (!domain) {
    return json({ error: 'Domain parameter is required' }, { status: 400 });
  }

  try {
    // Check cache first
    const cached = faviconCache.get(domain);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return json({ 
        url: cached.url,
        cached: true,
        domain: domain,
        size: parseInt(size)
      });
    }

    // Fetch favicon from site
    const faviconUrl = await fetchSiteFavicon(domain);
    
    if (faviconUrl) {
      // Cache the successful result
      faviconCache.set(domain, {
        url: faviconUrl,
        timestamp: Date.now()
      });
      
      return json({
        url: faviconUrl,
        cached: false,
        domain: domain,
        size: parseInt(size)
      });
    } else {
      // Cache the failure to avoid repeated requests
      faviconCache.set(domain, {
        url: '', // Empty string indicates no favicon found
        timestamp: Date.now()
      });
      
      return json({ 
        error: 'No favicon found',
        domain: domain 
      }, { status: 404 });
    }

  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`Favicon fetch error for ${domain}:`, error);
    }
    return json({ 
      error: 'Failed to fetch favicon',
      domain: domain 
    }, { status: 500 });
  }
};
