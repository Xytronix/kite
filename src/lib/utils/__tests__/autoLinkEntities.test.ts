import { describe, it, expect, vi, beforeEach } from 'vitest';
import { autoLinkEntities, clearEntityCache } from '../autoLinkEntities.js';

// Mock dependencies
vi.mock('$lib/stores/experimental.svelte.js', () => ({
  experimental: { 
    showWikipediaTooltips: true,
    disableWikiTooltipsInHeadlines: false
  }
}));

vi.mock('$lib/services/wikidataService.js', () => ({
  searchWikidataEntities: vi.fn()
}));

vi.mock('../linkingUtils.js', () => ({
  getCurrentLanguage: vi.fn(() => 'en'),
  createWikipediaLink: vi.fn((text, id) => {
    const link = document.createElement('a');
    link.textContent = text;
    link.setAttribute('data-wiki-id', id);
    link.href = `https://en.wikipedia.org/wiki/${id}`;
    return Promise.resolve(link);
  }),
  hasOnThisDayContent: vi.fn(() => false),
  shouldSkipNode: vi.fn(() => false),
  PerformanceMonitor: vi.fn(() => ({
    start: vi.fn(),
    mark: vi.fn(),
    log: vi.fn()
  }))
}));

import { searchWikidataEntities } from '$lib/services/wikidataService.js';
import { hasOnThisDayContent } from '../linkingUtils.js';

describe('AutoLinkEntities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearEntityCache();
    document.body.innerHTML = '';
    
    // Setup default mocks
    (searchWikidataEntities as any).mockResolvedValue([
      {
        id: 'Q123',
        label: 'Test Entity',
        description: 'A test entity'
      }
    ]);
  });

  describe('autoLinkEntities', () => {
    it('should process a simple DOM element', async () => {
      const div = document.createElement('div');
      div.textContent = 'I visited Paris last year and it was amazing.';
      document.body.appendChild(div);

      // Mock Wikidata search to return Paris
      (searchWikidataEntities as any).mockResolvedValueOnce([
        {
          id: 'Q90',
          label: 'Paris',
          description: 'capital city of France'
        }
      ]);

      await autoLinkEntities(div);

      const links = div.querySelectorAll('a[data-wiki-id]');
      expect(links).toHaveLength(1);
      expect(links[0].textContent).toBe('Paris');
      expect(links[0].getAttribute('data-wiki-id')).toBe('Q90');

      document.body.removeChild(div);
    });

    it('should skip OnThisDay content', async () => {
      (hasOnThisDayContent as any).mockReturnValueOnce(true);

      const div = document.createElement('div');
      div.textContent = 'I visited Paris last year.';
      document.body.appendChild(div);

      await autoLinkEntities(div);

      const links = div.querySelectorAll('a[data-wiki-id]');
      expect(links).toHaveLength(0);
      expect(searchWikidataEntities).not.toHaveBeenCalled();

      document.body.removeChild(div);
    });

    it('should skip elements with data-no-wiki', async () => {
      const div = document.createElement('div');
      div.setAttribute('data-no-wiki', '');
      div.textContent = 'I visited Paris last year.';
      document.body.appendChild(div);

      await autoLinkEntities(div);

      const links = div.querySelectorAll('a[data-wiki-id]');
      expect(links).toHaveLength(0);

      document.body.removeChild(div);
    });

    it('should handle insufficient text gracefully', async () => {
      const div = document.createElement('div');
      div.textContent = 'Hi';
      document.body.appendChild(div);

      await autoLinkEntities(div);

      expect(searchWikidataEntities).not.toHaveBeenCalled();

      document.body.removeChild(div);
    });

    it('should handle API errors gracefully', async () => {
      const div = document.createElement('div');
      div.textContent = 'I visited Paris and London last year.';
      document.body.appendChild(div);

      (searchWikidataEntities as any).mockRejectedValueOnce(new Error('API Error'));

      // Should not throw
      await expect(autoLinkEntities(div)).resolves.toBeUndefined();

      document.body.removeChild(div);
    });

    it('should use cache for repeated content', async () => {
      const div1 = document.createElement('div');
      div1.textContent = 'I visited Paris last year and it was amazing.';
      document.body.appendChild(div1);

      const div2 = document.createElement('div');
      div2.textContent = 'I visited Paris last year and it was amazing.';
      document.body.appendChild(div2);

      (searchWikidataEntities as any).mockResolvedValue([
        {
          id: 'Q90',
          label: 'Paris',
          description: 'capital city of France'
        }
      ]);

      await autoLinkEntities(div1);
      await autoLinkEntities(div2);

      // Should only call the API once due to caching
      expect(searchWikidataEntities).toHaveBeenCalledTimes(1);

      document.body.removeChild(div1);
      document.body.removeChild(div2);
    });
  });
});