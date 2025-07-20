/**
 * URL generation utility for shareable links
 */

interface ShareableState {
  batchId?: string | null;
  categoryId?: string | null;
  storyIndex?: number | null;
  dataLang?: string | null;
  topicId?: string | null;
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

  const parts = [] as string[];
  if (state.batchId) parts.push(state.batchId);
  if (state.categoryId) parts.push(state.categoryId);
  if (state.storyIndex !== null && state.storyIndex !== undefined) {
    parts.push(state.storyIndex.toString());
  }

  let url = baseUrl + '/' + parts.join('/');

  // Add language as query parameter if not English
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