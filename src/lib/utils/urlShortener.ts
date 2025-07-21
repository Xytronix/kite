/**
 * URL generation utility for shareable links
 */

interface ShareableState {
  batchId?: string | null;
  categoryId?: string | null;
  storyIndex?: number | null;
  dataLang?: string | null;
  topicId?: string | null;
  /** Optional slug (URL-friendly version of the story title) */
  slug?: string | null;
}

/**
 * Create a URL-friendly slug from a string.
 * – lower-cases
 * – replaces spaces and consecutive non-alphanumerics with '-'
 * – trims leading/trailing hyphens
 */
export function slugify(text: string): string {
  // Normalize diacritics: Südkorea -> Sudkorea (ASCII)
  const ascii = text
    // Normalize to decomposed form and strip diacritic marks
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // German sharp s -> ss, others left as is (already decomposed)
    .replace(/ß/g, 'ss');

  return ascii
    .toLowerCase()
    .trim()
    // Replace apostrophes & similar marks first to avoid extra hyphens
    .replace(/[’'"`]/g, '')
    // Replace non-alphanumerics with hyphen
    .replace(/[^a-z0-9]+/g, '-')
    // Collapse multiple hyphens
    .replace(/-{2,}/g, '-')
    // Trim leftover hyphens
    .replace(/^-+|-+$/g, '')
    // Limit length to reasonable 80 chars
    .slice(0, 80) ||
    // Fallback: keep original characters (including non-Latin) but hyphenate spaces
    text
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[\u2000-\u206F]/g, '') // remove direction & spacing marks
      .slice(0, 80);
}

/**
 * Generate a share URL for the current state
 */
export function generateShareUrl(
  baseUrl: string,
  state: ShareableState
): string {
  // Special handling for topic feeds
  if (state.categoryId === 'topics' && state.topicId) {
    let url = `${baseUrl}/topics?topic=${state.topicId}`;
    if (state.dataLang && state.dataLang !== 'en') {
      url += `&data_lang=${state.dataLang}`;
    }
    return url;
  }

  const parts: string[] = [];
  if (state.batchId) parts.push(state.batchId);
  if (state.categoryId) parts.push(state.categoryId);

  // Preferred format: include index+slug when both available for clarity & backward compatibility
  if (state.storyIndex !== null && state.storyIndex !== undefined) {
    const segment = state.slug ? `${state.storyIndex}-${state.slug}` : state.storyIndex.toString();
    parts.push(segment);
  } else if (state.slug) {
    // Edge case: slug without index
    parts.push(state.slug);
  }

  let url = baseUrl + '/' + parts.join('/');

  // Append data language if necessary
  if (state.dataLang && state.dataLang !== 'en') {
    url += `?data_lang=${state.dataLang}`;
  }

  return url;
}

/**
 * Look up a shortened URL code and return the original URL.
 *
 * NOTE: The real implementation should query your persistence layer. This
 * stub simply returns null to indicate that a short-link could not be found.
 */
export async function getShortUrl(code: string): Promise<string | null> {
  // TODO: replace with real lookup logic (e.g. database query)
  console.warn('getShortUrl stub called — implement real lookup', code);
  return null;
}