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
  const parts: string[] = [];
  if (state.batchId) {
    // For now, use the batch ID as-is (could be UUID or date)
    // In the future, we could convert UUIDs to dates for prettier URLs
    parts.push(state.batchId);
  }
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
 * Resolve a date-based batch identifier to an actual batch UUID
 * @param batchIdentifier - Either a date string (YYYY-MM-DD) or UUID
 * @returns Promise<string | null> - The actual batch UUID, or null if not found
 */
export async function resolveBatchId(batchIdentifier: string): Promise<string | null> {
  // If it's already a UUID, return as-is
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(batchIdentifier)) {
    return batchIdentifier;
  }

  // If it's a date format, try to resolve it
  if (/^\d{4}-\d{2}-\d{2}$/.test(batchIdentifier)) {
    try {
      // Fetch batches for that date range
      const targetDate = new Date(batchIdentifier);
      const startDate = new Date(targetDate);
      const endDate = new Date(targetDate);
      endDate.setDate(endDate.getDate() + 1); // Next day

      const response = await fetch(
        `/api/batches?from=${startDate.toISOString()}&to=${endDate.toISOString()}`
      );

      if (response.ok) {
        const data = await response.json();
        const batches = data.batches || [];

        // Find all batches created on the target date
        const batchesForDate = batches.filter((batch: any) => {
          const batchDate = new Date(batch.createdAt);
          const batchDateKey = batchDate.toISOString().split('T')[0];
          return batchDateKey === batchIdentifier;
        });

        if (batchesForDate.length > 0) {
          // If multiple batches exist for the same date, use the latest one (most recent createdAt)
          const latestBatch = batchesForDate.reduce((latest: any, current: any) => {
            return new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest;
          });

          console.log(`✅ Resolved date ${batchIdentifier} to batch ${latestBatch.id} (${batchesForDate.length} batches found for this date)`);
          return latestBatch.id;
        } else {
          console.warn(`⚠️ No batch found for date ${batchIdentifier}`);
          return null;
        }
      } else {
        console.error(`❌ Failed to fetch batches for date resolution: ${response.status}`);
        return null;
      }
    } catch (error) {
      console.error('Error resolving batch date:', error);
      return null;
    }
  }

  // Unknown format
  console.warn(`⚠️ Unknown batch identifier format: ${batchIdentifier}`);
  return null;
}

/**
 * Parse a URL to extract navigation parameters for state restoration
 */
export function parseShareUrl(url: string): ShareableState | null {
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);

    // Handle topics URLs
    if (pathSegments[0] === 'topics') {
      const topicId = urlObj.searchParams.get('topic');
      const dataLang = urlObj.searchParams.get('data_lang');
      return {
        categoryId: 'topics',
        topicId,
        dataLang
      };
    }



    const state: ShareableState = {};

    // Extract data language from query params
    const dataLang = urlObj.searchParams.get('data_lang');
    if (dataLang) {
      state.dataLang = dataLang;
    }

    if (pathSegments.length === 0) {
      return state; // Root URL
    }

    // Check if first segment is a batch ID (date or UUID pattern)
    const isBatchId = /^\d{4}-\d{2}-\d{2}/.test(pathSegments[0]) ||
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(pathSegments[0]);

    if (isBatchId) {
      // Store the batch identifier (could be date or UUID)
      // The navigation system will resolve dates to actual batch UUIDs
      state.batchId = pathSegments[0];
      state.categoryId = pathSegments[1] || null;

      // Parse story segment (index-slug or just slug)
      if (pathSegments[2]) {
        const storySegment = pathSegments[2];
        const match = storySegment.match(/^(\d+)(?:-(.*))?$/);
        if (match) {
          state.storyIndex = parseInt(match[1]);
          if (match[2]) {
            state.slug = match[2];
          }
        } else {
          // Pure slug without index
          state.slug = storySegment;
        }
      }
    } else {
      // No batch ID - latest batch
      state.batchId = null;
      state.categoryId = pathSegments[0];

      // Parse story segment
      if (pathSegments[1]) {
        const storySegment = pathSegments[1];
        const match = storySegment.match(/^(\d+)(?:-(.*))?$/);
        if (match) {
          state.storyIndex = parseInt(match[1]);
          if (match[2]) {
            state.slug = match[2];
          }
        } else {
          // Pure slug without index
          state.slug = storySegment;
        }
      }
    }

    return state;
  } catch (error) {
    console.error('Error parsing share URL:', error);
    return null;
  }
}

