import type { Article } from '$lib/types';
import { getOrganizationName } from './domainUtils';

/**
 * Enhanced article key generation that considers both domain and content
 * This should preserve articles from different domains even if they have the same link
 */
export function getEnhancedArticleKey(article: Article): string {
  // Include domain in the key to differentiate sources even with same link
  // This ensures that The Hindu and ABC News with the same link are treated as different sources
  const normalizedLink = article.link && article.link.trim() 
    ? article.link.toLowerCase().replace(/^https?:\/\/(www\.)?/, '')
    : '';
  
  // Always include domain to differentiate sources
  return `${article.domain}::${normalizedLink}::${article.title}::${article.date}`;
}

/**
 * Generate a display name for an article that differentiates it from others with same domain
 */
export async function generateSourceDisplayName(article: Article, allArticles: Article[]): Promise<string> {
  const sameDomainArticles = allArticles.filter(a => a.domain === article.domain);
  
  if (sameDomainArticles.length === 1) {
    // Only one article from this domain, use organization name
    try {
      return await getOrganizationName(article.domain);
    } catch {
      return article.domain;
    }
  }
  
  // Multiple articles from same domain, need to differentiate
  try {
    const orgName = await getOrganizationName(article.domain);
    
    // Try to extract a meaningful differentiator from the title
    const titleWords = article.title.toLowerCase().split(/\s+/);
    const meaningfulWords = titleWords.filter(word => 
      word.length > 3 && 
      !['the', 'and', 'for', 'with', 'from', 'that', 'this', 'will', 'have', 'been', 'said', 'says', 'news', 'report', 'article'].includes(word)
    );
    
    if (meaningfulWords.length > 0) {
      const differentiator = meaningfulWords[0];
      const capitalizedDiff = differentiator.charAt(0).toUpperCase() + differentiator.slice(1);
      return `${orgName} (${capitalizedDiff})`;
    }
    
    // Fallback to using part of the link path
    try {
      const url = new URL(article.link);
      const pathParts = url.pathname.split('/').filter(p => p.length > 0);
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        const cleanPart = lastPart.replace(/[-_]/g, ' ').replace(/\.(html?|php|aspx?)$/i, '');
        if (cleanPart.length > 0 && cleanPart.length < 20) {
          const capitalizedPart = cleanPart.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          return `${orgName} (${capitalizedPart})`;
        }
      }
    } catch {
      // URL parsing failed, continue to fallback
    }
    
    // Final fallback: use organization name with index
    const articleIndex = sameDomainArticles.findIndex(a => getEnhancedArticleKey(a) === getEnhancedArticleKey(article));
    return articleIndex === 0 ? orgName : `${orgName} ${articleIndex + 1}`;
    
  } catch {
    // Organization name lookup failed, use domain with differentiator
    const articleIndex = sameDomainArticles.findIndex(a => getEnhancedArticleKey(a) === getEnhancedArticleKey(article));
    return articleIndex === 0 ? article.domain : `${article.domain} ${articleIndex + 1}`;
  }
}

/**
 * Deduplicate articles by enhanced key and prefer different domains when possible
 */
export function deduplicateArticles(articles: Article[]): Article[] {
  const seen = new Set<string>();
  const result: Article[] = [];
  
  articles.forEach(article => {
    const key = getEnhancedArticleKey(article);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(article);
    }
  });
  
  return result;
}

/**
 * Smart deduplication that preserves multiple articles from same domain if they're truly different
 */
export function smartDeduplicateArticles(articles: Article[]): Article[] {
  const result: Article[] = [];
  const seenLinks = new Set<string>();
  const domainTitleSeen = new Set<string>();
  
  // Debug logging for The Hindu articles
  const hinduArticles = articles.filter(a => a.domain.toLowerCase().includes('hindu'));
  if (hinduArticles.length > 1) {
    console.log(`Smart deduplication: Found ${hinduArticles.length} Hindu articles:`, 
      hinduArticles.map(a => ({ title: a.title, link: a.link, date: a.date })));
  }
  
  for (const article of articles) {
    // First check: if we have a unique link, always include it
    if (article.link && article.link.trim()) {
      const normalizedLink = article.link.toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
      if (!seenLinks.has(normalizedLink)) {
        seenLinks.add(normalizedLink);
        result.push(article);
        
        // Debug logging for The Hindu
        if (article.domain.toLowerCase().includes('hindu')) {
          console.log(`Smart dedup: Including Hindu article by unique link: "${article.title}"`);
        }
        continue;
      } else if (article.domain.toLowerCase().includes('hindu')) {
        console.log(`Smart dedup: Skipping Hindu article due to duplicate link: "${article.title}" (${normalizedLink})`);
      }
    }
    
    // Second check: if no link or duplicate link, check domain+title+date combination
    const domainTitleKey = `${article.domain}::${article.title}::${article.date}`;
    if (!domainTitleSeen.has(domainTitleKey)) {
      domainTitleSeen.add(domainTitleKey);
      result.push(article);
      
      // Debug logging for The Hindu
      if (article.domain.toLowerCase().includes('hindu')) {
        console.log(`Smart dedup: Including Hindu article by unique domain+title+date: "${article.title}"`);
      }
    } else if (article.domain.toLowerCase().includes('hindu')) {
      console.log(`Smart dedup: Skipping Hindu article due to duplicate domain+title+date: "${article.title}"`);
    }
  }
  
  // Final debug log
  const resultHinduArticles = result.filter(a => a.domain.toLowerCase().includes('hindu'));
  if (hinduArticles.length > 1) {
    console.log(`Smart deduplication result: ${resultHinduArticles.length} Hindu articles kept out of ${hinduArticles.length} original`);
  }
  
  return result;
}

/**
 * Get display names for multiple articles, handling duplicates intelligently
 */
export async function getSourceDisplayNames(articles: Article[]): Promise<Map<Article, string>> {
  const displayNames = new Map<Article, string>();
  const deduplicatedArticles = deduplicateArticles(articles);
  
  // Generate display names for all articles
  for (const article of deduplicatedArticles) {
    try {
      const displayName = await generateSourceDisplayName(article, deduplicatedArticles);
      displayNames.set(article, displayName);
    } catch (error) {
      console.warn(`Failed to generate display name for article:`, error);
      displayNames.set(article, article.domain);
    }
  }
  
  return displayNames;
}