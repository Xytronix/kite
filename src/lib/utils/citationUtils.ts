/**
 * Citation parsing and formatting utilities
 */

import { mediaService } from '$lib/services/mediaService';

// Cache for media data to avoid repeated API calls
let mediaDataCache: any[] | null = null;
let mediaDataPromise: Promise<any[]> | null = null;

// Cache for favicon URLs and iconify icons to avoid repeated loads
interface FaviconCacheEntry {
  urls: string[];
  iconifyIcon: string | null;
  timestamp: number;
}

const faviconCache = new Map<string, FaviconCacheEntry>();
const faviconPreloadPromises = new Map<string, Promise<FaviconCacheEntry>>();

// Cache duration: 5 minutes for favicon data
const FAVICON_CACHE_DURATION = 5 * 60 * 1000;

/**
 * Load media data with caching
 */
async function getMediaData(): Promise<any[]> {
  if (mediaDataCache) {
    return mediaDataCache;
  }
  
  if (mediaDataPromise) {
    return mediaDataPromise;
  }
  
  mediaDataPromise = mediaService.loadMediaData('en').then(data => {
    mediaDataCache = data;
    return data;
  }).catch(err => {
    console.warn('Failed to load media data:', err);
    return [];
  });
  
  return mediaDataPromise;
}

/**
 * Get media info for a specific domain
 */
async function getMediaInfoForDomain(domain: string): Promise<any | null> {
  try {
    const mediaData = await getMediaData();
    return mediaData.find(media => 
      media.domains && media.domains.some(d => d === domain || d.endsWith(`.${domain}`) || domain.endsWith(`.${d}`))
    ) || null;
  } catch (error) {
    console.warn('Error getting media info for domain:', domain, error);
    return null;
  }
}

/**
 * Get high-quality favicon/logo URL for a domain (logo.dev first, then best quality from media_data.json)
 */
export async function getFaviconUrl(domain: string, size: number = 32): Promise<string> {
  // First, try logo.dev API (primary external source)
  const logoDevUrl = getLogoDevUrl(domain, size, { format: 'png', retina: true });
  
  // Check if we have higher quality options from media_data.json
  const mediaInfo = await getMediaInfoForDomain(domain);
  
  if (mediaInfo) {
    // Prefer iconify icon (vector) over logo.dev
    if (mediaInfo.iconify_icon) {
      return `https://api.iconify.design/${mediaInfo.iconify_icon.replace(':', '/')}.svg`;
    }
    
    // Prefer SVG logo URL over logo.dev
    if (mediaInfo.logo_url && mediaInfo.logo_url.toLowerCase().includes('.svg')) {
      return mediaInfo.logo_url;
    }
    
    // Prefer WebP logo URL over logo.dev (modern efficient raster)
    if (mediaInfo.logo_url && mediaInfo.logo_url.toLowerCase().includes('.webp')) {
      return mediaInfo.logo_url;
    }
  }
  
  // Fall back to logo.dev (better than PNG/ICO)
  return logoDevUrl;
}

/**
 * Get synchronous favicon URL (for backward compatibility)
 * This uses logo.dev as preferred fallback
 */
export function getFaviconUrlSync(domain: string, size: number = 32): string {
  // Use logo.dev as preferred synchronous fallback
  return getLogoDevUrl(domain, size, { format: 'png', retina: true });
}

/**
 * Get Google's favicon service URL (legacy function, kept for compatibility)
 */
export function getGoogleFaviconUrl(domain: string, size: number = 16): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

/**
 * Get logo.dev logo URL for a domain (uses :public_token by default, or .env token)
 */
export function getLogoDevUrl(domain: string, size: number = 32, options: {
  format?: 'jpg' | 'png';
  theme?: 'auto' | 'light' | 'dark';
  greyscale?: boolean;
  retina?: boolean;
  fallback?: 'monogram' | '404';
} = {}): string {
  // Get token from environment if available, otherwise use :public_token
  const token = typeof window !== 'undefined' 
    ? import.meta.env.PUBLIC_LOGO_DEV_API_TOKEN 
    : process.env.PUBLIC_LOGO_DEV_API_TOKEN;
  
  // Check if token exists and is not empty/whitespace
  const finalToken = (token && token.trim()) || ':public_token';
  
  // Build URL with parameters
  const params = new URLSearchParams({
    size: size.toString(),
    token: finalToken
  });
  
  // Add optional parameters
  if (options.format) params.set('format', options.format);
  if (options.theme && options.theme !== 'auto') params.set('theme', options.theme);
  if (options.greyscale) params.set('greyscale', 'true');
  if (options.retina) params.set('retina', 'true');
  if (options.fallback && options.fallback !== 'monogram') params.set('fallback', options.fallback);
  
  return `https://img.logo.dev/${domain}?${params.toString()}`;
}

/**
 * Get logo.dev ticker URL for a domain (uses :public_token by default, or .env token)
 */
export function getLogoDevTickerUrl(domain: string): string {
  // Get token from environment if available, otherwise use :public_token
  const token = typeof window !== 'undefined' 
    ? import.meta.env.PUBLIC_LOGO_DEV_API_TOKEN 
    : process.env.PUBLIC_LOGO_DEV_API_TOKEN;
  
  // Check if token exists and is not empty/whitespace
  const finalToken = (token && token.trim()) || ':public_token';
  return `https://img.logo.dev/ticker/${domain}?token=${finalToken}`;
}

/**
 * Get iconify icon name for a domain (from cache or media_data.json)
 */
export async function getIconifyIcon(domain: string): Promise<string | null> {
  try {
    const cacheEntry = await getCachedFaviconData(domain);
    return cacheEntry.iconifyIcon;
  } catch (error) {
    console.warn('Failed to get iconify icon from cache, falling back to direct lookup:', error);
    const mediaInfo = await getMediaInfoForDomain(domain);
    return mediaInfo?.iconify_icon || null;
  }
}

/**
 * Get multiple favicon URL options for a domain, ordered by preference/quality (cached)
 */
export async function getFaviconUrls(domain: string, size: number = 32): Promise<string[]> {
  try {
    const cacheEntry = await getCachedFaviconData(domain);
    
    // If the cached URLs were for size 32 and we need a different size, 
    // adjust logo.dev URLs on the fly
    if (size !== 32) {
      return cacheEntry.urls.map(url => {
        if (url.includes('img.logo.dev')) {
          return url.replace(/size=\d+/, `size=${size}`);
        }
        if (url.includes('google.com/s2/favicons')) {
          return url.replace(/sz=\d+/, `sz=${size}`);
        }
        return url;
      });
    }
    
    return cacheEntry.urls;
  } catch (error) {
    console.warn('Failed to get favicon URLs from cache, falling back to direct generation:', error);
    
    const urls: string[] = [];
    
    // Get media data once for all checks
    const mediaInfo = await getMediaInfoForDomain(domain);
    
    // 0. Iconify handled separately in SmartImage (experimental setting)
    
    // 1. Logo.dev and logo.dev ticker
    urls.push(getLogoDevUrl(domain, size, { format: 'png', retina: true }));
    urls.push(getLogoDevTickerUrl(domain));
    
    // 2. Media data SVG / WebP (high quality vector/modern formats)
    if (mediaInfo) {
      if (mediaInfo.logo_url && mediaInfo.logo_url.toLowerCase().includes('.svg')) {
        urls.push(mediaInfo.logo_url);
      }
      if (mediaInfo.logo_url && mediaInfo.logo_url.toLowerCase().includes('.webp')) {
        urls.push(mediaInfo.logo_url);
      }
    }
    
    // 3. Site's own SVG / WebP (high quality from direct site)
    const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
    urls.push(`https://${cleanDomain}/favicon.svg`);
    urls.push(`https://${cleanDomain}/favicon.webp`);
    
    // 4. Media data all other formats (PNG/ICO/JPG)
    if (mediaInfo && mediaInfo.logo_url && 
        (mediaInfo.logo_url.toLowerCase().includes('.png') || 
         mediaInfo.logo_url.toLowerCase().includes('.ico') ||
         mediaInfo.logo_url.toLowerCase().includes('.jpg') ||
         mediaInfo.logo_url.toLowerCase().includes('.jpeg'))) {
      urls.push(mediaInfo.logo_url);
    }
    
    // 5. Google Favicons (reliable service)
    urls.push(getGoogleFaviconUrl(domain, size));
    
    // 6. Site's own all types of formats (comprehensive fallback)
    urls.push(...getDirectSiteFaviconUrls(domain, size));
    
    // Remove duplicates and return
    return [...new Set(urls)];
  }
}

/**
 * Get direct site favicon URLs using common favicon paths
 */
export function getDirectSiteFaviconUrls(domain: string, size: number = 32): string[] {
  // Clean domain (remove protocols, paths, etc.)
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
  const baseUrl = `https://${cleanDomain}`;
  
  const urls: string[] = [];
  
  // Modern scalable formats first
  urls.push(`${baseUrl}/favicon.svg`);
  
  // Modern high-efficiency raster formats (WebP)
  urls.push(`${baseUrl}/favicon.webp`);
  if (size >= 192) {
    urls.push(`${baseUrl}/android-chrome-192x192.webp`);
    urls.push(`${baseUrl}/android-chrome-512x512.webp`);
  }
  if (size >= 180) {
    urls.push(`${baseUrl}/apple-touch-icon.webp`);
    urls.push(`${baseUrl}/apple-touch-icon-180x180.webp`);
  }
  
  // High-quality raster formats (PNG)
  if (size >= 192) {
    urls.push(`${baseUrl}/android-chrome-192x192.png`);
    urls.push(`${baseUrl}/android-chrome-512x512.png`);
  }
  
  if (size >= 180) {
    urls.push(`${baseUrl}/apple-touch-icon.png`);
    urls.push(`${baseUrl}/apple-touch-icon-180x180.png`);
  }
  
  // Standard favicon paths
  urls.push(`${baseUrl}/favicon.png`);
  urls.push(`${baseUrl}/favicon.ico`);
  
  // Alternative paths some sites use
  urls.push(`${baseUrl}/assets/favicon.svg`);
  urls.push(`${baseUrl}/static/favicon.svg`);
  urls.push(`${baseUrl}/images/favicon.svg`);
  urls.push(`${baseUrl}/img/favicon.svg`);
  
  // Alternative WebP paths
  urls.push(`${baseUrl}/assets/favicon.webp`);
  urls.push(`${baseUrl}/static/favicon.webp`);
  urls.push(`${baseUrl}/images/favicon.webp`);
  urls.push(`${baseUrl}/img/favicon.webp`);
  
  return urls;
}

/**
 * Extract domains from loaded story data for dynamic preloading
 */
function extractDomainsFromStories(allCategoryStories: Record<string, any[]>, enabledCategories: string[]): string[] {
  const domains = new Set<string>();
  
  // Only process enabled categories
  for (const categoryId of enabledCategories) {
    const stories = allCategoryStories[categoryId] || [];
    
    for (const story of stories) {
      // Extract domains from articles
      if (story.articles && Array.isArray(story.articles)) {
        for (const article of story.articles) {
          if (article.domain && typeof article.domain === 'string') {
            domains.add(article.domain);
          }
        }
      }
      
      // Extract domains from domains array (if exists)
      if (story.domains && Array.isArray(story.domains)) {
        for (const domain of story.domains) {
          if (domain.name && typeof domain.name === 'string') {
            domains.add(domain.name);
          }
        }
      }
    }
  }
  
  return Array.from(domains);
}

/**
 * Preload favicon data for domains from enabled categories (call during splash screen)
 */
export async function preloadCommonFavicons(allCategoryStories?: Record<string, any[]>, enabledCategories?: string[]): Promise<void> {
  // If no story data provided, skip preloading (will be called again later)
  if (!allCategoryStories || !enabledCategories || enabledCategories.length === 0) {
    console.log('⏭️  Skipping favicon preloading - no story data or enabled categories provided');
    return;
  }
  
  const domains = extractDomainsFromStories(allCategoryStories, enabledCategories);
  console.log('🚀 Preloading favicons for', domains.length, 'domains from enabled categories...');
  
  // Start all preloads in parallel
  const preloadPromises = domains.map(domain => {
    if (!faviconCache.has(domain) && !faviconPreloadPromises.has(domain)) {
      const promise = loadFaviconDataForDomain(domain);
      faviconPreloadPromises.set(domain, promise);
      return promise;
    }
    return Promise.resolve(faviconCache.get(domain)!);
  });
  
  // Wait for all to complete, but don't fail if some fail
  const results = await Promise.allSettled(preloadPromises);
  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  console.log(`✅ Preloaded ${succeeded}/${domains.length} favicon entries from enabled categories`);
}

/**
 * Load favicon data for a single domain and cache it
 */
async function loadFaviconDataForDomain(domain: string): Promise<FaviconCacheEntry> {
  try {
    const urls: string[] = [];
    
    // Get media info for all checks
    const mediaInfo = await getMediaInfoForDomain(domain);
    let iconifyIcon: string | null = null;
    
    if (mediaInfo) {
      iconifyIcon = mediaInfo.iconify_icon || null;
    }
    
    // 0. Iconify handled separately in SmartImage (experimental setting)
    
    // 1. Logo.dev and logo.dev ticker
    urls.push(getLogoDevUrl(domain, 32, { format: 'png', retina: true }));
    urls.push(getLogoDevTickerUrl(domain));
    
    // 2. Media data SVG / WebP (high quality vector/modern formats)
    if (mediaInfo) {
      if (mediaInfo.logo_url && mediaInfo.logo_url.toLowerCase().includes('.svg')) {
        urls.push(mediaInfo.logo_url);
      }
      if (mediaInfo.logo_url && mediaInfo.logo_url.toLowerCase().includes('.webp')) {
        urls.push(mediaInfo.logo_url);
      }
    }
    
    // 3. Site's own SVG / WebP (high quality from direct site)
    const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
    urls.push(`https://${cleanDomain}/favicon.svg`);
    urls.push(`https://${cleanDomain}/favicon.webp`);
    
    // 4. Media data all other formats (PNG/ICO/JPG)
    if (mediaInfo && mediaInfo.logo_url && 
        (mediaInfo.logo_url.toLowerCase().includes('.png') || 
         mediaInfo.logo_url.toLowerCase().includes('.ico') ||
         mediaInfo.logo_url.toLowerCase().includes('.jpg') ||
         mediaInfo.logo_url.toLowerCase().includes('.jpeg'))) {
      urls.push(mediaInfo.logo_url);
    }
    
    // 5. Google Favicons (reliable service)
    urls.push(getGoogleFaviconUrl(domain, 32));
    
    // 6. Site's own all types of formats (comprehensive fallback)
    urls.push(...getDirectSiteFaviconUrls(domain, 32));
    
    const cacheEntry: FaviconCacheEntry = {
      urls: [...new Set(urls)], // Remove duplicates
      iconifyIcon,
      timestamp: Date.now()
    };
    
    faviconCache.set(domain, cacheEntry);
    faviconPreloadPromises.delete(domain);
    
    return cacheEntry;
    
  } catch (error) {
    console.warn(`Failed to load favicon data for ${domain}:`, error);
    faviconPreloadPromises.delete(domain);
    
    // Return minimal fallback entry
    const fallbackEntry: FaviconCacheEntry = {
      urls: [
        getLogoDevUrl(domain, 32, { format: 'png', retina: true }),
        getGoogleFaviconUrl(domain, 32),
        `https://api.iconify.design/mdi/newspaper.svg`
      ],
      iconifyIcon: null,
      timestamp: Date.now()
    };
    
    faviconCache.set(domain, fallbackEntry);
    return fallbackEntry;
  }
}

/**
 * Get cached favicon data for a domain, loading if not cached
 */
async function getCachedFaviconData(domain: string): Promise<FaviconCacheEntry> {
  // Check cache first
  const cached = faviconCache.get(domain);
  if (cached && (Date.now() - cached.timestamp) < FAVICON_CACHE_DURATION) {
    return cached;
  }
  
  // Check if already loading
  const existingPromise = faviconPreloadPromises.get(domain);
  if (existingPromise) {
    return existingPromise;
  }
  
  // Load and cache
  const promise = loadFaviconDataForDomain(domain);
  faviconPreloadPromises.set(domain, promise);
  return promise;
}

/**
 * Synchronously get cached favicon data if available (for instant access)
 */
function getCachedFaviconDataSync(domain: string): FaviconCacheEntry | null {
  const cached = faviconCache.get(domain);
  if (cached && (Date.now() - cached.timestamp) < FAVICON_CACHE_DURATION) {
    return cached;
  }
  return null;
}

/**
 * Synchronously get cached iconify icon if available (for instant access)
 */
export function getIconifyIconSync(domain: string): string | null {
  const cached = getCachedFaviconDataSync(domain);
  return cached?.iconifyIcon || null;
}

/**
 * Synchronously get cached favicon URLs if available (for instant access)
 */
export function getFaviconUrlsSync(domain: string, size: number = 32): string[] | null {
  const cached = getCachedFaviconDataSync(domain);
  if (!cached) return null;
  
  // Adjust URLs for different sizes if needed
  if (size !== 32) {
    return cached.urls.map(url => {
      if (url.includes('img.logo.dev')) {
        return url.replace(/size=\d+/, `size=${size}`);
      }
      if (url.includes('google.com/s2/favicons')) {
        return url.replace(/sz=\d+/, `sz=${size}`);
      }
      return url;
    });
  }
  
  return cached.urls;
}

export interface Citation {
  id: string;
  domain: string;
  articleId: string;
  fullText: string;
  number?: number; // For numbered citations like [1], [2], etc.
}

export interface ParsedTextSegment {
  type: 'text' | 'citation';
  content: string;
  citation?: Citation;
}

/**
 * Parse text and extract citations in format [domain#position]
 */
export function parseTextWithCitations(text: string): ParsedTextSegment[] {
  if (!text) return [];
  
  // Pattern to match citations like [reuters#1], [nytimes#2], [common], etc.
  const citationPattern = /\[([^\]]+)\]/g;
  
  const segments: ParsedTextSegment[] = [];
  let lastIndex = 0;
  let match;
  
  while ((match = citationPattern.exec(text)) !== null) {
    // Add text before citation
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }
    
    // Parse citation
    const fullText = match[0];
    const citationContent = match[1];
    
    // Check if it's a domain#position format
    const domainMatch = citationContent.match(/^([^#]+)#(\d+)$/);
    if (domainMatch) {
      segments.push({
        type: 'citation',
        content: citationContent,
        citation: {
          id: citationContent,
          domain: domainMatch[1],
          articleId: domainMatch[2], // This is now the position within domain
          fullText
        }
      });
    } else {
      // Handle special cases like [common]
      segments.push({
        type: 'citation',
        content: citationContent,
        citation: {
          id: citationContent,
          domain: citationContent,
          articleId: '',
          fullText
        }
      });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }
  
  return segments;
}

/**
 * Format citations as numbered references [1], [2], etc.
 */
export function formatCitationsAsNumbers(segments: ParsedTextSegment[]): {
  formattedSegments: ParsedTextSegment[];
  citations: Citation[];
} {
  const citations: Citation[] = [];
  const citationMap = new Map<string, number>();
  
  const formattedSegments = segments.map(segment => {
    if (segment.type === 'citation' && segment.citation) {
      const citationId = segment.citation.id;
      
      // Check if we've seen this citation before
      if (!citationMap.has(citationId)) {
        citations.push(segment.citation);
        citationMap.set(citationId, citations.length);
      }
      
      const citationNumber = citationMap.get(citationId)!;
      
      return {
        ...segment,
        content: `[${citationNumber}]`
      };
    }
    return segment;
  });
  
  return { formattedSegments, citations };
}

/**
 * Extract unique domains from citations
 */
export function extractDomainsFromCitations(citations: Citation[]): string[] {
  const domains = new Set<string>();
  
  citations.forEach(citation => {
    if (citation.domain && citation.domain !== 'common') {
      domains.add(citation.domain);
    }
  });
  
  return Array.from(domains);
}

/**
 * Remove all citations from text
 */
export function stripCitations(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  // Pattern to match citations like [domain#position], [common], [*], [1], [2], etc.
  const citationPattern = /\[([^\]]+)\]/g;
  
  // Remove citations and clean up extra spaces
  let cleaned = text.replace(citationPattern, '').trim();
  cleaned = cleaned.replace(/\s+/g, ' '); // Replace multiple spaces with single space
  cleaned = cleaned.replace(/\s+([.,;:!?])/g, '$1'); // Fix space before punctuation
  
  return cleaned;
}
