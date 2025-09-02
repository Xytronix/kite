import { describe, it, expect, vi, beforeEach } from 'vitest';
import { autoLinkEntitiesAdvanced, clearLinkingCache } from '../wikidataEntityLinker.js';

// Mock the experimental store
vi.mock('$lib/stores/experimental.svelte.js', () => ({
  experimental: {
    showWikipediaTooltips: true,
    disableWikiTooltipsInHeadlines: false
  }
}));

// Mock the linking utils
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
  PerformanceMonitor: vi.fn(() => ({
    start: vi.fn(),
    mark: vi.fn(),
    log: vi.fn()
  }))
}));

// Mock fetch for Wikidata API
global.fetch = vi.fn();

describe('WikidataEntityLinker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLinkingCache();
    document.body.innerHTML = '';
  });

  it('should extract clean text from DOM element', async () => {
    const div = document.createElement('div');
    div.innerHTML = 'This is a longer text about <a href="#">Paris</a> and London that should be processed by the advanced entity linker.';
    document.body.appendChild(div);

    // Mock successful Wikidata response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        wblinktitles: {
          entities: [
            {
              id: 'Q84',
              label: 'London',
              description: 'capital city of England and the United Kingdom',
              score: 0.9
            }
          ]
        }
      })
    });

    await autoLinkEntitiesAdvanced(div);

    // Should have processed the text and found London
    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.wikidata.org/w/api.php',
      expect.objectContaining({
        method: 'POST'
      })
    );
  });

  it('should handle Wikidata API errors gracefully', async () => {
    const div = document.createElement('div');
    div.textContent = 'This is about Paris and London.';
    document.body.appendChild(div);

    // Mock API error
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    // Should not throw
    await expect(autoLinkEntitiesAdvanced(div)).resolves.toBeUndefined();
  });

  it('should use fallback entity extraction when API fails', async () => {
    const div = document.createElement('div');
    div.textContent = 'This is a longer text about Paris and bitcoin that should trigger fallback processing.';
    document.body.appendChild(div);

    // Mock API failure, then successful searches for entities
    (global.fetch as any)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          search: [
            {
              id: 'Q90',
              label: 'Paris',
              description: 'capital city of France'
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          search: [
            {
              id: 'Q131723',
              label: 'Bitcoin',
              description: 'decentralized cryptocurrency'
            }
          ]
        })
      });

    await autoLinkEntitiesAdvanced(div);

    // Should have made multiple calls: 1 failed main API call + fallback searches
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should skip OnThisDay content', async () => {
    const { hasOnThisDayContent } = await import('../linkingUtils.js');
    (hasOnThisDayContent as any).mockReturnValueOnce(true);

    const div = document.createElement('div');
    div.textContent = 'This is about Paris.';
    document.body.appendChild(div);

    await autoLinkEntitiesAdvanced(div);

    // Should not have made any API calls
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should detect lowercase entities like bitcoin', async () => {
    const div = document.createElement('div');
    div.textContent = 'This is a longer text about bitcoin and ethereum that should be detected by the entity linker.';
    document.body.appendChild(div);

    // Mock API failure to trigger fallback, then successful searches
    (global.fetch as any)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          search: [
            {
              id: 'Q131723',
              label: 'Bitcoin',
              description: 'decentralized cryptocurrency'
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          search: [
            {
              id: 'Q18216',
              label: 'Ethereum',
              description: 'blockchain platform'
            }
          ]
        })
      });

    await autoLinkEntitiesAdvanced(div);

    // Should have detected both bitcoin and ethereum
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should detect mixed-case entities like iPhone', async () => {
    const div = document.createElement('div');
    div.textContent = 'This is a longer text about iPhone and ChatGPT that should be detected by the entity linker.';
    document.body.appendChild(div);

    // Mock API failure to trigger fallback, then successful searches
    (global.fetch as any)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          search: [
            {
              id: 'Q2766',
              label: 'iPhone',
              description: 'smartphone made by Apple'
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          search: [
            {
              id: 'Q115658286',
              label: 'ChatGPT',
              description: 'AI chatbot by OpenAI'
            }
          ]
        })
      });

    await autoLinkEntitiesAdvanced(div);

    // Should have detected both iPhone and ChatGPT
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should filter out common words', async () => {
    const div = document.createElement('div');
    div.textContent = 'The quick brown fox jumps over the lazy dog in a very long sentence that meets the minimum length requirement.';
    document.body.appendChild(div);

    // Mock API response with no entities
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        wblinktitles: {
          entities: []
        }
      })
    });

    await autoLinkEntitiesAdvanced(div);

    // Should have made API call but found no entities
    expect(global.fetch).toHaveBeenCalled();
  });
});