/**
 * Debug utilities for controlling console output
 * 
 * To enable debugging for specific components, set the corresponding flag to true:
 * - SMART_IMAGE: SmartImage component icon/image loading
 * - WIKIPEDIA_TOOLTIP: Wikipedia tooltip processing
 * - FAVICON_PRELOADING: Favicon preloading operations
 * - WIKI_RESOLVER: Wiki entity resolution
 * - LOCATION_SEARCH: Location-based Wikipedia searches
 * - ENTITY_LINKING: Wikidata entity linking
 * - CITATION_TEXT: Citation text processing
 */

// Debug flags - set to true to enable specific debug categories
export const DEBUG_FLAGS = {
  SMART_IMAGE: false,
  WIKIPEDIA_TOOLTIP: false,
  FAVICON_PRELOADING: false,
  WIKI_RESOLVER: false,
  LOCATION_SEARCH: false,
  ENTITY_LINKING: false,
  CITATION_TEXT: false
} as const;

// Helper function to check if debugging is enabled for a category
export function isDebugEnabled(category: keyof typeof DEBUG_FLAGS): boolean {
  return import.meta.env.DEV && DEBUG_FLAGS[category];
}

// Helper function to conditionally log debug messages
export function debugLog(category: keyof typeof DEBUG_FLAGS, message: string, ...args: any[]): void {
  if (isDebugEnabled(category)) {
    console.debug(`[${category}] ${message}`, ...args);
  }
}

// Helper function to conditionally log regular messages
export function debugInfo(category: keyof typeof DEBUG_FLAGS, message: string, ...args: any[]): void {
  if (isDebugEnabled(category)) {
    console.log(`[${category}] ${message}`, ...args);
  }
}