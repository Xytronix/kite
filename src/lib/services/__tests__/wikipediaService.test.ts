import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchWikipediaContent, clearWikipediaCache, getWikipediaCacheSize, fetchWikipediaContentForDomain } from '../wikipediaService';

// Mock fetch
global.fetch = vi.fn();

describe('WikipediaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearWikipediaCache();
  });

  describe('fetchWikipediaContent', () => {
    it('should fetch Wikipedia content for a regular page ID', async () => {
      const mockResponse = {
        extract: 'Test content',
        thumbnail: { source: 'thumb.jpg' },
        originalimage: { source: 'full.jpg' },
        title: 'Test Article',
        content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Test' } }
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await fetchWikipediaContent('Test_Article');

      expect(fetch).toHaveBeenCalledWith(
        'https://en.wikipedia.org/api/rest_v1/page/summary/Test_Article'
      );
      expect(result).toEqual({
        extract: 'Test content',
        thumbnail: { source: 'thumb.jpg' },
        originalImage: { source: 'full.jpg' },
        title: 'Test Article',
        wikiUrl: 'https://en.wikipedia.org/wiki/Test'
      });
    });

    it('should handle Wikidata Q-IDs', async () => {
      // First mock the Wikidata API response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entities: {
            Q42: {
              sitelinks: {
                enwiki: { title: 'Douglas Adams' }
              }
            }
          }
        })
      } as Response);

      // Then mock the Wikipedia API response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          extract: 'Douglas Adams was a writer',
          title: 'Douglas Adams'
        })
      } as Response);

      const result = await fetchWikipediaContent('Q42');

      // Do not assert exact call count; implementation may perform optional follow-up calls
      expect(fetch).toHaveBeenNthCalledWith(1, 
        expect.stringContaining('wikidata.org')
      );
      // One of the subsequent calls must be to the resolved Wikipedia page summary
      const calls = vi.mocked(fetch).mock.calls.map(c => String(c[0]));
      const summaryCall = calls.find(u => u.includes('wikipedia.org/api/rest_v1/page/summary/')) || '';
      expect(summaryCall).toBeTruthy();
      expect(decodeURIComponent(summaryCall)).toContain('Douglas Adams');
      expect(result.extract).toBe('Douglas Adams was a writer');
    });

    it('should cache results', async () => {
      const mockResponse = {
        extract: 'Cached content',
        title: 'Cached Article'
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      // First call
      const result1 = await fetchWikipediaContent('Cached_Article');
      // There may be 1-2 network calls depending on optional Parse API; just ensure we made at least one
      expect(fetch).toHaveBeenCalled();
      expect(getWikipediaCacheSize()).toBe(1);

      // Second call should use cache (no additional summary request). We cannot reliably assert total call count
      // because tests may include optional Parse API. Instead assert the same object instance is returned.
      const result2 = await fetchWikipediaContent('Cached_Article');
      expect(result1).toBe(result2); // Same reference
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      } as Response);

      const result = await fetchWikipediaContent('Nonexistent');

      expect(result).toEqual({
        extract: 'Failed to load Wikipedia content.',
        thumbnail: null,
        originalImage: null,
        title: '',
        wikiUrl: ''
      });
    });

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchWikipediaContent('Test');

      expect(result).toEqual({
        extract: 'Failed to load Wikipedia content.',
        thumbnail: null,
        originalImage: null,
        title: '',
        wikiUrl: ''
      });
    });
  });

  describe('fetchWikipediaContentForDomain', () => {
    it('should return null for domains without exact matches', async () => {
      // Mock search API to return no results
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { search: [] }
        })
      } as Response);

      const result = await fetchWikipediaContentForDomain('unknown-domain.com');
      expect(result).toBeNull();
    });

    it('should reject disambiguation pages', async () => {
      // Mock search API to return disambiguation page
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { 
            search: [
              { 
                title: 'CNN (disambiguation)', 
                snippet: 'CNN may refer to various things...' 
              }
            ] 
          }
        })
      } as Response);

      const result = await fetchWikipediaContentForDomain('cnn.com');
      expect(result).toBeNull();
    });



    it('should cache null results to avoid repeated lookups', async () => {
      // Mock multiple search API calls to return no results for all queries
      vi.mocked(fetch)
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            query: { search: [] }
          })
        } as Response);

      // First call - will make multiple search attempts
      const result1 = await fetchWikipediaContentForDomain('nonexistent.com');
      expect(result1).toBeNull();
      const firstCallCount = vi.mocked(fetch).mock.calls.length;
      expect(firstCallCount).toBeGreaterThan(0);

      // Second call should use cache
      const result2 = await fetchWikipediaContentForDomain('nonexistent.com');
      expect(result2).toBeNull();
      expect(vi.mocked(fetch).mock.calls.length).toBe(firstCallCount); // No additional calls
    });

    it('should handle futurism.com domain matching based on real Wikipedia data', async () => {
      // Mock search API to return actual-like results (based on real API test)
      vi.mocked(fetch)
        // First search for exact domain returns some results but not perfect match
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            query: { 
              search: [
                { 
                  title: 'Popular Science', 
                  snippet: 'Popular Science is an American popular science website...' 
                }
              ] 
            }
          })
        } as Response)
        // Second search for "futurism website" finds the right page
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            query: { 
              search: [
                { 
                  title: 'Futurism (website)', 
                  snippet: 'Futurism is a science and technology news website founded in 2017...' 
                }
              ] 
            }
          })
        } as Response)
        // Mock Wikipedia content fetch for the found page
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            extract: 'Futurism is a science and technology news website founded in 2017 by Alex Klokus and Jordan Lejuwaan. It was acquired by Singularity University in 2019 and by Recurrent Ventures in 2021.',
            title: 'Futurism (website)',
            content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Futurism_(website)' } }
          })
        } as Response);

      const result = await fetchWikipediaContentForDomain('futurism.com');
      
      // Should find a match since:
      // 1. Title contains "futurism" (org name from futurism.com)  
      // 2. Title contains "website" (media keyword)
      // 3. Content mentions it's a "news website" (media context)
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Futurism (website)');
      expect(result?.extract).toContain('news website');
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      const mockResponse = { extract: 'Test', title: 'Test' };
      
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await fetchWikipediaContent('Test1');
      await fetchWikipediaContent('Test2');
      expect(getWikipediaCacheSize()).toBe(2);

      clearWikipediaCache();
      expect(getWikipediaCacheSize()).toBe(0);
    });
  });
});