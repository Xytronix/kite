/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { autoLinkEntities } from '../autoLinkEntities.js';
import { autoLinkEntitiesAdvanced } from '../wikidataEntityLinker.js';

// Mock dependencies
vi.mock('$lib/stores/experimental.svelte.js', () => ({
  experimental: {
    showWikipediaTooltips: true,
    disableWikiTooltipsInHeadlines: false,
    entityLinkingMode: 'both'
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

// Mock fetch for advanced entity linker
global.fetch = vi.fn();

import { searchWikidataEntities } from '$lib/services/wikidataService.js';

describe('Entity Linking Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('should work with both simple and advanced approaches', async () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <p>I visited Paris last summer and it was amazing. The city has incredible architecture.</p>
      <p>Later I went to London and saw Big Ben. Both cities are in Europe.</p>
    `;
    document.body.appendChild(div);

    // Mock responses for both approaches
    (searchWikidataEntities as any).mockResolvedValue([
      { id: 'Q90', label: 'Paris', description: 'capital city of France' },
      { id: 'Q84', label: 'London', description: 'capital city of England' }
    ]);

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        wblinktitles: {
          entities: [
            { id: 'Q90', label: 'Paris', score: 0.9 },
            { id: 'Q84', label: 'London', score: 0.9 }
          ]
        }
      })
    });

    // Test simple approach
    await autoLinkEntities(div);
    let links = div.querySelectorAll('a[data-wiki-id]');
    expect(links.length).toBeGreaterThan(0);

    // Reset DOM
    div.innerHTML = `
      <p>I visited Paris last summer and it was amazing. The city has incredible architecture.</p>
      <p>Later I went to London and saw Big Ben. Both cities are in Europe.</p>
    `;

    // Test advanced approach
    await autoLinkEntitiesAdvanced(div);
    links = div.querySelectorAll('a[data-wiki-id]');
    expect(links.length).toBeGreaterThan(0);

    document.body.removeChild(div);
  });

  it('should handle mixed content gracefully', async () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <h2>Travel Blog</h2>
      <p>My trip to <strong>Paris</strong> was incredible.</p>
      <p>I also visited <em>London</em> and <span>Rome</span>.</p>
      <ul>
        <li>Paris - amazing food</li>
        <li>London - great museums</li>
        <li>Rome - historic sites</li>
      </ul>
    `;
    document.body.appendChild(div);

    (searchWikidataEntities as any).mockResolvedValue([
      { id: 'Q90', label: 'Paris', description: 'capital city of France' }
    ]);

    await autoLinkEntities(div);

    const links = div.querySelectorAll('a[data-wiki-id]');
    expect(links.length).toBeGreaterThanOrEqual(0);

    // Verify original structure is preserved
    expect(div.querySelector('h2')).toBeTruthy();
    expect(div.querySelector('ul')).toBeTruthy();
    expect(div.querySelector('strong')).toBeTruthy();

    document.body.removeChild(div);
  });

  it('should not break existing links', async () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <p>Check out <a href="https://example.com">this link</a> about Paris.</p>
      <p>Also visit <a href="#section">this section</a> for more info about London.</p>
    `;
    document.body.appendChild(div);

    (searchWikidataEntities as any).mockResolvedValue([
      { id: 'Q90', label: 'Paris', description: 'capital city of France' }
    ]);

    const originalLinks = div.querySelectorAll('a').length;
    
    await autoLinkEntities(div);

    const allLinks = div.querySelectorAll('a');
    const wikiLinks = div.querySelectorAll('a[data-wiki-id]');
    
    // Should have original links plus any new wiki links
    expect(allLinks.length).toBeGreaterThanOrEqual(originalLinks);
    
    // Original links should still exist
    expect(div.querySelector('a[href="https://example.com"]')).toBeTruthy();
    expect(div.querySelector('a[href="#section"]')).toBeTruthy();

    document.body.removeChild(div);
  });
});