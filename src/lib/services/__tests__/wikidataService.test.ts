import { describe, it, expect, vi } from 'vitest';
import { 
  searchWikidataEntities, 
  getWikidataEntity, 
  validateEntityType,
  searchAndValidateEntity,
  getWikipediaUrlFromQid
} from '../wikidataService.js';

// Mock fetch for testing
global.fetch = vi.fn();

describe('WikidataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchWikidataEntities', () => {
    it('should search for entities successfully', async () => {
      const mockResponse = {
        search: [
          {
            id: 'Q90',
            label: 'Paris',
            description: 'capital of France'
          }
        ]
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const results = await searchWikidataEntities('Paris', 'en');
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('Q90');
      expect(results[0].label).toBe('Paris');
      expect(results[0].description).toBe('capital of France');
    });

    it('should handle search failures gracefully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false
      });

      const results = await searchWikidataEntities('NonexistentEntity', 'en');
      expect(results).toHaveLength(0);
    });
  });

  describe('getWikidataEntity', () => {
    it('should fetch entity details successfully', async () => {
      const mockResponse = {
        entities: {
          Q90: {
            id: 'Q90',
            labels: {
              en: { value: 'Paris' }
            },
            descriptions: {
              en: { value: 'capital of France' }
            },
            claims: {
              P31: [{ mainsnak: { datavalue: { value: { id: 'Q515' } } } }] // instance of city
            },
            sitelinks: {
              enwiki: { site: 'enwiki', title: 'Paris' }
            }
          }
        }
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const entity = await getWikidataEntity('Q90', 'en');
      
      expect(entity).toBeTruthy();
      expect(entity?.id).toBe('Q90');
      expect(entity?.label).toBe('Paris');
      expect(entity?.description).toBe('capital of France');
    });
  });

  describe('validateEntityType', () => {
    it('should validate place entities correctly', async () => {
      const mockResponse = {
        entities: {
          Q90: {
            id: 'Q90',
            labels: { en: { value: 'Paris' } },
            descriptions: { en: { value: 'capital of France' } },
            claims: {
              P31: [{ mainsnak: { datavalue: { value: { id: 'Q515' } } } }] // city
            },
            sitelinks: {
              enwiki: { site: 'enwiki', title: 'Paris' }
            }
          }
        }
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const validation = await validateEntityType('Q90', 'place', 'en');
      
      expect(validation.isValid).toBe(true);
      expect(validation.entityType).toBe('place');
      expect(validation.confidence).toBeGreaterThan(0.8);
      expect(validation.wikipediaTitle).toBe('Paris');
    });

    it('should reject mismatched entity types', async () => {
      const mockResponse = {
        entities: {
          Q5: {
            id: 'Q5',
            labels: { en: { value: 'Human' } },
            descriptions: { en: { value: 'common name of Homo sapiens' } },
            claims: {
              P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }] // human
            }
          }
        }
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const validation = await validateEntityType('Q5', 'place', 'en');
      
      expect(validation.isValid).toBe(false);
      expect(validation.entityType).toBe('human');
    });
  });

  describe('searchAndValidateEntity', () => {
    it('should find and validate entities in one call', async () => {
      // Mock search response
      const searchResponse = {
        search: [{ id: 'Q90', label: 'Paris', description: 'capital of France' }]
      };

      // Mock entity details response
      const entityResponse = {
        entities: {
          Q90: {
            id: 'Q90',
            labels: { en: { value: 'Paris' } },
            descriptions: { en: { value: 'capital of France' } },
            claims: {
              P31: [{ mainsnak: { datavalue: { value: { id: 'Q515' } } } }]
            },
            sitelinks: {
              enwiki: { site: 'enwiki', title: 'Paris' }
            }
          }
        }
      };

      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(searchResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(entityResponse)
        });

      const result = await searchAndValidateEntity('Paris', 'place', 'en');
      
      expect(result).toBeTruthy();
      expect(result?.isValid).toBe(true);
      expect(result?.qid).toBe('Q90');
      expect(result?.wikipediaTitle).toBe('Paris');
    });
  });

  describe('getWikipediaUrlFromQid', () => {
    it('should resolve Q-ID to Wikipedia URL', async () => {
      const mockResponse = {
        entities: {
          Q90: {
            sitelinks: {
              enwiki: { site: 'enwiki', title: 'Paris' }
            }
          }
        }
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const url = await getWikipediaUrlFromQid('Q90', 'en');
      expect(url).toBe('https://en.wikipedia.org/wiki/Paris');
    });
  });
});