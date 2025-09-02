/**
 * Wikipedia Tooltip Manager
 * Manages the integration between auto-linked Wikipedia elements and the tooltip system
 */

import { experimental } from '$lib/stores/experimental.svelte.js';

// Type for the WikipediaTooltip component instance
type WikipediaTooltipInstance = any;

interface TooltipHandlers {
  handleWikipediaInteraction: (event: Event) => Promise<void>;
  handleWikipediaLeave: (event: Event) => void;
}

class WikipediaTooltipManager {
  private tooltipInstance: WikipediaTooltipInstance | null = null;
  private handlers: TooltipHandlers | null = null;
  private attachedElements = new WeakSet<Element>();

  /**
   * Initialize the tooltip manager with a tooltip instance
   */
  initialize(tooltipInstance: WikipediaTooltipInstance, handlers: TooltipHandlers) {
    this.tooltipInstance = tooltipInstance;
    this.handlers = handlers;
  }

  /**
   * Attach tooltip event handlers to all Wikipedia elements in a container
   */
  attachTooltipsToContainer(container: HTMLElement) {
    if (!this.handlers) {
      console.debug('WikipediaTooltipManager not initialized');
      return;
    }

    const wikiElements = container.querySelectorAll('[data-wiki-id]');

    wikiElements.forEach(element => {
      const el = element as HTMLElement;
      // Skip elements that live under data-no-wiki regions to avoid duplicate handlers
      const canUseClosest = typeof (el as any).closest === 'function';
      if (canUseClosest && (el as any).closest('[data-no-wiki]')) return;
      this.attachTooltipToElement(el);
    });

    // Also attach to plain Wikipedia anchors by deriving data-wiki-id from href
    try {
      const headingSelector = 'h1,h2,h3,h4,h5,h6,[role="heading"],.question-title,.question-heading';
      const anchors = container.querySelectorAll('a[href*="wikipedia.org/wiki/"]:not([data-wiki-id])');
      anchors.forEach((element) => {
        const el = element as HTMLAnchorElement;
        const canUseClosest = typeof (el as any).closest === 'function';
        // Respect no-wiki regions
        if (canUseClosest && (el as any).closest('[data-no-wiki]')) return;
        // Optionally respect headline disabling
        if (experimental.disableWikiTooltipsInHeadlines && canUseClosest && (el as any).closest(headingSelector)) return;

        const href = el.getAttribute('href') || '';
        const match = href.match(/^https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/([^?#]+)/i);
        if (!match) return;

        // Derive a sensible wiki identifier from the URL path
        try {
          const pageTitle = decodeURIComponent(match[2]).replace(/_/g, ' ');
          if (!pageTitle) return;
          el.setAttribute('data-wiki-id', pageTitle);
          // Ensure we attach handlers now that the attribute is present
          this.attachTooltipToElement(el);
        } catch {}
      });
    } catch {}
  }

  /**
   * Attach tooltip event handlers to a specific element
   */
  attachTooltipToElement(element: HTMLElement) {
    if (!this.handlers || this.attachedElements.has(element)) {
      return;
    }

    // Detect if this is a mobile/touch-first device while preferring hover-capable environments
    const canHover = typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover)').matches;
    const hasFinePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
    const touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    // Treat as mobile only when we cannot hover and device is primarily touch or very small viewport
    const isMobile = (!canHover && !hasFinePointer && touchCapable) || (!canHover && window.innerWidth < 768);

    if (isMobile) {
      // Mobile: use click/tap events
      element.addEventListener('click', this.handlers.handleWikipediaInteraction);
    } else {
      // Desktop: use hover events
      element.addEventListener('mouseover', this.handlers.handleWikipediaInteraction);
      element.addEventListener('mouseleave', this.handlers.handleWikipediaLeave);
    }

    // Mark as attached to avoid duplicate handlers
    this.attachedElements.add(element);
  }

  /**
   * Remove tooltip event handlers from an element
   */
  detachTooltipFromElement(element: HTMLElement) {
    if (!this.handlers || !this.attachedElements.has(element)) {
      return;
    }

    const canHover = typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover)').matches;
    const hasFinePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
    const touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isMobile = (!canHover && !hasFinePointer && touchCapable) || (!canHover && window.innerWidth < 768);

    if (isMobile) {
      element.removeEventListener('click', this.handlers.handleWikipediaInteraction);
    } else {
      element.removeEventListener('mouseover', this.handlers.handleWikipediaInteraction);
      element.removeEventListener('mouseleave', this.handlers.handleWikipediaLeave);
    }

    this.attachedElements.delete(element);
  }

  /**
   * Refresh tooltips for a container (useful after content updates)
   */
  refreshTooltips(container: HTMLElement) {
    // Remove handlers from elements that no longer have data-wiki-id
    const allElements = container.querySelectorAll('*');
    allElements.forEach(element => {
      if (!this.attachedElements.has(element)) return;
      const el = element as HTMLElement;
      const missingAttr = !el.hasAttribute('data-wiki-id');
      const canUseClosest = typeof (el as any).closest === 'function';
      const insideNoWiki = canUseClosest ? !!(el as any).closest('[data-no-wiki]') : false;
      if (missingAttr || insideNoWiki) this.detachTooltipFromElement(el);
    });

    // Attach handlers to new Wikipedia elements
    this.attachTooltipsToContainer(container);
  }

  /**
   * Clean up all event handlers
   */
  cleanup() {
    this.tooltipInstance = null;
    this.handlers = null;
    // Note: WeakSet will automatically clean up when elements are garbage collected
  }
}

// Export a singleton instance
export const wikipediaTooltipManager = new WikipediaTooltipManager();

// Export the class for testing
export { WikipediaTooltipManager };