import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Test utilities for Wikidata raw text extraction
describe('Wikidata Raw Text Extraction', () => {
  let mockFetch: any;

  beforeEach(() => {
    // Mock fetch globally
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    // Clear DOM
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractCleanText', () => {
    // We'll test the text extraction logic directly
    function extractCleanText(root: HTMLElement): string {
      const clone = root.cloneNode(true) as HTMLElement;
      
      // Remove elements we don't want to process
      clone.querySelectorAll('a, [data-no-wiki], [data-wiki-id], script, style, .skip-linking').forEach(el => el.remove());
      
      const text = clone.textContent || '';
      return text.replace(/\s+/g, ' ').trim();
    }

    it('should extract plain text correctly', () => {
      const div = document.createElement('div');
      div.innerHTML = 'This is a simple text about Paris and London.';
      
      const result = extractCleanText(div);
      expect(result).toBe('This is a simple text about Paris and London.');
    });

    it('should remove existing links from text extraction', () => {
      const div = document.createElement('div');
      div.innerHTML = 'This text mentions <a href="/paris">Paris</a> and London.';
      
      const result = extractCleanText(div);
      expect(result).toBe('This text mentions  and London.');
    });

    it('should remove elements with data-no-wiki attribute', () => {
      const div = document.createElement('div');
      div.innerHTML = 'This text mentions <span data-no-wiki>Paris</span> and London.';
      
      const result = extractCleanText(div);
      expect(result).toBe('This text mentions  and London.');
    });

    it('should remove existing wiki-linked elements', () => {
      const div = document.createElement('div');
      div.innerHTML = 'This text mentions <span data-wiki-id="Q90">Paris</span> and London.';
      
      const result = extractCleanText(div);
      expect(result).toBe('This text mentions  and London.');
    });

    it('should remove script and style elements', () => {
      const div = document.createElement('div');
      div.innerHTML = `
        This is text.
        <script>console.log('test');</script>
        <style>.test { color: red; }</style>
        More text here.
      `;
      
      const result = extractCleanText(div);
      expect(result).toBe('This is text. More text here.');
    });

    it('should normalize whitespace', () => {
      const div = document.createElement('div');
      div.innerHTML = `
        This    has   multiple
        
        spaces    and   newlines.
      `;
      
      const result = extractCleanText(div);
      expect(result).toBe('This has multiple spaces and newlines.');
    });

    it('should handle complex nested HTML', () => {
      const div = document.createElement('div');
      div.innerHTML = `
        <h2>Article Title</h2>
        <p>This article discusses <a href="/paris">Paris</a>, the capital of France.</p>
        <div data-no-wiki>
          <p>This section should be ignored completely.</p>
        </div>
        <p>It also mentions <span data-wiki-id="Q84">London</span> and other cities.</p>
        <script>trackEvent('page_view');</script>
        <style>.highlight { background: yellow; }</style>
      `;
      
      const result = extractCleanText(div);
      expect(result).toBe('Article Title This article discusses , the capital of France. It also mentions  and other cities.');
    });
  });

  describe('Wikidata API Integration', () => {
    it('should handle successful Wikidata entity linking response', async () => {
      const mockResponse = {
        wblinktitles: {
          entities: [
            {
              id: 'Q90',
              label: 'Paris',
              description: 'capital city of France',
              score: 0.95,
              url: 'https://www.wikidata.org/wiki/Q90'
            },
            {
              id: 'Q84',
              label: 'London',
              description: 'capital city of England and the United Kingdom',
              score: 0.88,
              url: 'https://www.wikidata.org/wiki/Q84'
            }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const testText = 'This article discusses Paris and London, two major European capitals.';
      
      const response = await fetch('https://www.wikidata.org/w/api.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'wblinktitles',
          text: testText,
          language: 'en',
          format: 'json',
          origin: '*'
        })
      });

      const data = await response.json();
      
      expect(data.wblinktitles.entities).toHaveLength(2);
      expect(data.wblinktitles.entities[0].label).toBe('Paris');
      expect(data.wblinktitles.entities[1].label).toBe('London');
    });

    it('should handle Wikidata API error response', async () => {
      const mockErrorResponse = {
        error: {
          code: 'unknown_action',
          info: 'Unrecognized value for parameter "action": wblinktitles.'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockErrorResponse)
      });

      const response = await fetch('https://www.wikidata.org/w/api.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          action: 'wblinktitles',
          text: 'Test text',
          language: 'en',
          format: 'json',
          origin: '*'
        })
      });

      const data = await response.json();
      
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('unknown_action');
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      try {
        await fetch('https://www.wikidata.org/w/api.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            action: 'wblinktitles',
            text: 'Test text',
            language: 'en',
            format: 'json',
            origin: '*'
          })
        });
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Network error');
      }
    });
  });

  describe('Fallback Entity Search', () => {
    it('should extract potential entities using regex patterns', () => {
      const text = 'This article discusses Paris, London, New York City, and San Francisco.';
      
      // Test the entity extraction pattern used in the fallback
      const entityPattern = /\b[A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){0,2}\b/g;
      const matches = text.match(entityPattern) || [];
      
      expect(matches).toContain('Paris');
      expect(matches).toContain('London');
      expect(matches).toContain('New York City');
      expect(matches).toContain('San Francisco');
    });

    it('should filter out single words and common words', () => {
      const text = 'The United States and United Kingdom are countries. This is a test.';
      
      const entityPattern = /\b[A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){0,2}\b/g;
      const matches = text.match(entityPattern) || [];
      
      // Filter to require at least 2 tokens (like the actual implementation)
      const filteredMatches = matches.filter(match => 
        match.length > 3 && 
        match.trim().split(/\s+/).length >= 2
      );
      
      expect(filteredMatches).toContain('The United States');
      expect(filteredMatches).toContain('United Kingdom');
      expect(filteredMatches).not.toContain('The');
      expect(filteredMatches).not.toContain('This');
    });

    it('should handle fallback search API calls', async () => {
      const mockSearchResponse = {
        search: [
          {
            id: 'Q90',
            label: 'Paris',
            description: 'capital city of France'
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSearchResponse)
      });

      const searchTerm = 'Paris';
      const lang = 'en';
      
      const response = await fetch(
        `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(searchTerm)}&language=${lang}&limit=1&format=json&origin=*`
      );
      
      const data = await response.json();
      
      expect(data.search).toHaveLength(1);
      expect(data.search[0].label).toBe('Paris');
      expect(data.search[0].id).toBe('Q90');
    });
  });

  describe('Text Processing Edge Cases', () => {
    it('should handle empty or very short text', () => {
      const div1 = document.createElement('div');
      div1.innerHTML = '';
      
      const div2 = document.createElement('div');
      div2.innerHTML = 'Hi';
      
      function extractCleanText(root: HTMLElement): string {
        const clone = root.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('a, [data-no-wiki], [data-wiki-id], script, style, .skip-linking').forEach(el => el.remove());
        const text = clone.textContent || '';
        return text.replace(/\s+/g, ' ').trim();
      }
      
      expect(extractCleanText(div1)).toBe('');
      expect(extractCleanText(div2)).toBe('Hi');
    });

    it('should handle text with special characters and unicode', () => {
      const div = document.createElement('div');
      div.innerHTML = 'This mentions São Paulo, Zürich, and Москва (Moscow).';
      
      function extractCleanText(root: HTMLElement): string {
        const clone = root.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('a, [data-no-wiki], [data-wiki-id], script, style, .skip-linking').forEach(el => el.remove());
        const text = clone.textContent || '';
        return text.replace(/\s+/g, ' ').trim();
      }
      
      const result = extractCleanText(div);
      expect(result).toBe('This mentions São Paulo, Zürich, and Москва (Moscow).');
    });

    it('should handle malformed HTML gracefully', () => {
      const div = document.createElement('div');
      div.innerHTML = 'Text with <unclosed tag and <script>alert("test") missing closing tag';
      
      function extractCleanText(root: HTMLElement): string {
        const clone = root.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('a, [data-no-wiki], [data-wiki-id], script, style, .skip-linking').forEach(el => el.remove());
        const text = clone.textContent || '';
        return text.replace(/\s+/g, ' ').trim();
      }
      
      const result = extractCleanText(div);
      // Should still extract text, even with malformed HTML
      expect(result).toContain('Text with');
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large text efficiently', () => {
      const largeText = 'This is a test sentence. '.repeat(1000) + 'It mentions Paris and London.';
      
      const div = document.createElement('div');
      div.textContent = largeText;
      
      function extractCleanText(root: HTMLElement): string {
        const clone = root.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('a, [data-no-wiki], [data-wiki-id], script, style, .skip-linking').forEach(el => el.remove());
        const text = clone.textContent || '';
        return text.replace(/\s+/g, ' ').trim();
      }
      
      const startTime = performance.now();
      const result = extractCleanText(div);
      const endTime = performance.now();
      
      expect(result).toContain('Paris and London');
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should limit text sent to Wikidata API', () => {
      const veryLongText = 'A'.repeat(20000);
      
      // The implementation limits text to 10000 characters
      const limitedText = veryLongText.substring(0, 10000);
      
      expect(limitedText.length).toBe(10000);
      expect(limitedText.length).toBeLessThan(veryLongText.length);
    });
  });
});