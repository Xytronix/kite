import { describe, it, expect, vi } from 'vitest';
import { resolveWikiTitleWithContext } from '../wikiResolver.js';

// Mock the wikidataService
vi.mock('$lib/services/wikidataService.js', () => ({
  searchAndValidateEntity: vi.fn()
}));

import { searchAndValidateEntity } from '$lib/services/wikidataService.js';

describe('WikiResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve valid entities successfully', async () => {
    const mockValidation = {
      isValid: true,
      entityType: 'place' as const,
      confidence: 0.9,
      qid: 'Q90',
      label: 'Paris',
      description: 'capital of France',
      wikipediaTitle: 'Paris'
    };

    (searchAndValidateEntity as any).mockResolvedValue(mockValidation);

    const result = await resolveWikiTitleWithContext('Paris', 'place');
    
    expect(result).toBeTruthy();
    expect(result?.title).toBe('Paris');
    expect(result?.qid).toBe('Q90');
    expect(searchAndValidateEntity).toHaveBeenCalledWith('Paris', 'place', 'en');
  });

  it('should return null for invalid entities', async () => {
    const mockValidation = {
      isValid: false,
      entityType: 'generic' as const,
      confidence: 0.3,
      qid: undefined,
      label: 'Unknown',
      description: undefined,
      wikipediaTitle: undefined
    };

    (searchAndValidateEntity as any).mockResolvedValue(mockValidation);

    const result = await resolveWikiTitleWithContext('NonexistentPlace', 'place');
    
    expect(result).toBeNull();
  });

  it('should handle low confidence entities', async () => {
    const mockValidation = {
      isValid: true,
      entityType: 'place' as const,
      confidence: 0.5, // Below threshold
      qid: 'Q123',
      label: 'Ambiguous Place',
      description: 'unclear location',
      wikipediaTitle: 'Ambiguous_Place'
    };

    (searchAndValidateEntity as any).mockResolvedValue(mockValidation);

    const result = await resolveWikiTitleWithContext('Ambiguous Place', 'place');
    
    expect(result).toBeNull(); // Should reject due to low confidence
  });

  it('should handle URL-encoded phrases', async () => {
    const mockValidation = {
      isValid: true,
      entityType: 'place' as const,
      confidence: 0.9,
      qid: 'Q123456',
      label: 'Battle of Crécy',
      description: 'medieval battle',
      wikipediaTitle: 'Battle_of_Crécy'
    };

    (searchAndValidateEntity as any).mockResolvedValue(mockValidation);

    const result = await resolveWikiTitleWithContext('Battle%20of%20Cr%C3%A9cy', 'place');
    
    expect(result).toBeTruthy();
    expect(result?.title).toBe('Battle_of_Crécy');
    expect(searchAndValidateEntity).toHaveBeenCalledWith('Battle of Crécy', 'place', 'en');
  });
});