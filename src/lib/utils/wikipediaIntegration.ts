/**
 * Wikipedia Integration
 * Main entry point for Wikipedia tooltip and auto-linking functionality
 */

import { wikipediaTooltipManager } from './wikipediaTooltipManager.js';
import autoLinkEntities from './autoLinkEntities.js';
import { attachWikipediaTooltips, refreshWikipediaTooltips } from './linkingUtils.js';
import { experimental } from '$lib/stores/experimental.svelte.js';

export interface WikipediaIntegrationOptions {
  enableAutoLinking?: boolean;
  enableTooltips?: boolean;
  autoLinkOnMount?: boolean;
}

/**
 * Initialize Wikipedia integration for a component
 */
export function initializeWikipediaIntegration(
  tooltipInstance: any,
  handlers: { handleWikipediaInteraction: (event: Event) => Promise<void>; handleWikipediaLeave: (event: Event) => void },
  options: WikipediaIntegrationOptions = {}
) {
  const {
    enableAutoLinking = true,
    enableTooltips = true,
    autoLinkOnMount = true
  } = options;

  // Initialize tooltip manager
  if (enableTooltips) {
    wikipediaTooltipManager.initialize(tooltipInstance, handlers);
  }

  return {
    /**
     * Process content for Wikipedia links and tooltips
     */
    async processContent(container: HTMLElement) {
      if (!experimental.showWikipediaTooltips) return;

      try {
        // Auto-link entities if enabled
        if (enableAutoLinking) {
          await autoLinkEntities(container);
        }

        // Attach tooltips to existing Wikipedia links
        if (enableTooltips) {
          attachWikipediaTooltips(container);
        }
      } catch (error) {
        console.error('Wikipedia integration failed:', error);
      }
    },

    /**
     * Refresh tooltips after content changes
     */
    refreshTooltips(container: HTMLElement) {
      if (enableTooltips && experimental.showWikipediaTooltips) {
        refreshWikipediaTooltips(container);
      }
    },

    /**
     * Attach tooltips to existing Wikipedia links (without auto-linking)
     */
    attachTooltips(container: HTMLElement) {
      if (enableTooltips && experimental.showWikipediaTooltips) {
        attachWikipediaTooltips(container);
      }
    },

    /**
     * Clean up integration
     */
    cleanup() {
      wikipediaTooltipManager.cleanup();
    }
  };
}

/**
 * Quick setup for components that just need tooltip functionality
 */
export function setupWikipediaTooltips(
  tooltipInstance: any,
  handlers: { handleWikipediaInteraction: (event: Event) => Promise<void>; handleWikipediaLeave: (event: Event) => void }
) {
  return initializeWikipediaIntegration(tooltipInstance, handlers, {
    enableAutoLinking: false,
    enableTooltips: true,
    autoLinkOnMount: false
  });
}

/**
 * Process a container for Wikipedia auto-linking (standalone function)
 */
export async function processWikipediaAutoLinking(container: HTMLElement) {
  if (!experimental.showWikipediaTooltips) return;
  
  try {
    await autoLinkEntities(container);
  } catch (error) {
    console.error('Wikipedia auto-linking failed:', error);
  }
}

// Re-export key utilities
export { wikipediaTooltipManager } from './wikipediaTooltipManager.js';
export { attachWikipediaTooltips, refreshWikipediaTooltips } from './linkingUtils.js';