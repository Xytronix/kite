// Centralized entity patterns and validation logic for auto-linking

export type EntityType = 'place' | 'organization' | 'person';

export interface EntityMatch {
  text: string;
  type: EntityType;
  startIndex: number;
  endIndex: number;
  confidence: number;
  priority: number; // Higher = more important
}

// Common words that should never trigger entity linking
const GENERIC_WORDS = new Set([
  // Geographic terms
  'city', 'state', 'country', 'province', 'district', 'region', 'county', 'village',
  'town', 'road', 'street', 'bridge', 'river', 'lake', 'mountain',
  
  // Month names (multiple languages)
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'januar', 'februar', 'märz', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember',
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  
  // Weekday names
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag',
  
  // Cardinal directions
  'north', 'south', 'east', 'west', 'nord', 'süd', 'ost', 'west',
  
  // Generic organizational terms
  'government', 'ministry', 'minister', 'agency', 'committee', 'commission',
  'university', 'college', 'council', 'assembly', 'department', 'court', 'bank',
  'company', 'corporation', 'inc', 'organisation', 'organization',
  
  // Common articles
  'die', 'der', 'das', 'the', 'and', 'or'
]);

// UN-recognized country names for place validation
const COUNTRY_NAMES = new Set([
  'afghanistan', 'albania', 'algeria', 'andorra', 'angola', 'argentina', 'armenia', 'australia',
  'austria', 'azerbaijan', 'bahamas', 'bahrain', 'bangladesh', 'barbados', 'belarus', 'belgium',
  'belize', 'benin', 'bhutan', 'bolivia', 'botswana', 'brazil', 'brunei', 'bulgaria', 'cambodia',
  'cameroon', 'canada', 'chile', 'china', 'colombia', 'croatia', 'cuba', 'cyprus', 'czechia',
  'denmark', 'ecuador', 'egypt', 'estonia', 'ethiopia', 'fiji', 'finland', 'france', 'gabon',
  'georgia', 'germany', 'ghana', 'greece', 'guatemala', 'hungary', 'iceland', 'india', 'indonesia',
  'iran', 'iraq', 'ireland', 'israel', 'italy', 'jamaica', 'japan', 'jordan', 'kazakhstan',
  'kenya', 'latvia', 'lebanon', 'lithuania', 'luxembourg', 'malaysia', 'malta', 'mexico',
  'moldova', 'monaco', 'mongolia', 'morocco', 'myanmar', 'nepal', 'netherlands', 'nicaragua',
  'nigeria', 'norway', 'pakistan', 'panama', 'peru', 'philippines', 'poland', 'portugal',
  'qatar', 'romania', 'russia', 'serbia', 'singapore', 'slovakia', 'slovenia', 'somalia',
  'spain', 'sudan', 'sweden', 'switzerland', 'syria', 'thailand', 'tunisia', 'turkey',
  'ukraine', 'uruguay', 'venezuela', 'vietnam', 'yemen', 'zambia', 'zimbabwe'
  // Abbreviated list for performance - add more as needed
]);

/**
 * Entity pattern definitions with priority and validation
 */
export const ENTITY_PATTERNS = {
  // Places (Priority 3 - Highest)
  place: {
    priority: 3,
    patterns: [
      // Optional preposition + capitalized location (1-4 words)
      /\b(?:in|at|from|near|over|across|around|into)?\s*([A-Z][\p{L}\p{N}'-]+(?:\s+[A-Z][\p{L}\p{N}'-]+){0,3})\b/gu
    ],
    validate: (text: string): boolean => {
      const lower = text.toLowerCase();
      const wordCount = text.split(' ').length;
      
      // Skip generic words
      if (GENERIC_WORDS.has(lower)) return false;
      
      // Skip very short single words unless they're countries
      if (wordCount === 1 && text.length <= 3 && !COUNTRY_NAMES.has(lower)) return false;
      
      // Skip symbol-only matches
      if (/^['-]+$/.test(text)) return false;
      
      // Single words must be recognized countries
      if (wordCount === 1 && !COUNTRY_NAMES.has(lower)) return false;
      
      return true;
    }
  },

  // Organizations (Priority 2 - Medium)
  organization: {
    priority: 2,
    patterns: [
      // Organizations with suffixes
      /\b(?:The\s+)?([A-Z][\p{L}\p{N}'&-]+(?:\s+[A-Z&][\p{L}\p{N}'&-]*){0,3}\s+(?:Inc|Corp|Corporation|Ltd|LLC|University|College|Bank|Agency|Committee|Organization|Organisation|Institute|Association|Company)\.?)\b/gu,
      // Multi-word capitalized phrases (2-4 words)
      /\b([A-Z][\p{L}\p{N}'&-]+(?:\s+[A-Z&][\p{L}\p{N}'&-]*){1,3})\b/gu
    ],
    validate: (text: string): boolean => {
      const lower = text.toLowerCase();
      
      // Skip generic terms
      if (GENERIC_WORDS.has(lower)) return false;
      
      // Skip very short or symbol-heavy matches
      if (text.length < 3 || /^[&'-]+$/.test(text)) return false;
      
      // Must have at least 2 words for non-suffix matches
      const wordCount = text.split(' ').length;
      const hasSuffix = /\b(?:Inc|Corp|Corporation|Ltd|LLC|University|College|Bank|Agency|Committee|Organization|Organisation|Institute|Association|Company)\.?$/i.test(text);
      
      if (!hasSuffix && wordCount < 2) return false;
      
      return true;
    }
  },

  // Persons (Priority 1 - Lowest)
  person: {
    priority: 1,
    patterns: [
      // First Last, First M. Last, O'Connor, Jean-Claude, etc.
      /\b([A-Z][\p{L}'-]+(?:\s+[A-Z]\.)?\s+[A-Z][\p{L}'-]+)\b/gu,
      // Standalone surnames for well-known leaders (e.g., Trump, Zelenskyy)
      /\b(Trump|Zelenskyy|Zelensky|Biden|Putin|Netanyahu|Modi|Scholz|Sunak|Macron|Merz)\b/g
    ],
    validate: (text: string): boolean => {
      // Allow either full names (2-3 words with optional middle initial) or approved surnames list
      if (/^['-]+$/.test(text)) return false;

      const approvedSurnames = new Set([
        'Trump','Zelenskyy','Zelensky','Biden','Putin','Netanyahu','Modi','Scholz','Sunak','Macron','Merz'
      ]);

      const words = text.split(/\s+/);
      if (words.length === 1) {
        // Standalone surname case: must be in approved list
        return approvedSurnames.has(text);
      }

      if (text.length < 4) return false;
      if (words.length < 2 || words.length > 3) return false;
      if (words.length === 3 && !/^[A-Z]\.$/.test(words[1])) return false;
      return true;
    }
  }
} as const;

/**
 * Extract all potential entity matches from text
 */
export function extractEntityMatches(text: string): EntityMatch[] {
  const matches: EntityMatch[] = [];
  
  for (const [entityType, config] of Object.entries(ENTITY_PATTERNS)) {
    for (const pattern of config.patterns) {
      pattern.lastIndex = 0; // Reset regex
      let match: RegExpExecArray | null;
      
      while ((match = pattern.exec(text)) !== null) {
        const matchText = match[1] || match[0];
        const startIndex = match.index + (match[0].length - matchText.length);
        
        // Validate the match
        if (!config.validate(matchText)) continue;
        
        matches.push({
          text: matchText,
          type: entityType as EntityType,
          startIndex,
          endIndex: startIndex + matchText.length,
          confidence: calculateConfidence(matchText, entityType as EntityType),
          priority: config.priority
        });
      }
    }
  }
  
  return matches;
}

/**
 * Resolve conflicts between overlapping matches
 */
export function resolveConflicts(matches: EntityMatch[]): EntityMatch[] {
  if (matches.length <= 1) return matches;
  
  // Sort by start position
  matches.sort((a, b) => a.startIndex - b.startIndex);
  
  const resolved: EntityMatch[] = [];
  
  for (const match of matches) {
    const hasOverlap = resolved.some(existing => 
      (match.startIndex < existing.endIndex && match.endIndex > existing.startIndex)
    );
    
    if (!hasOverlap) {
      resolved.push(match);
    } else {
      // Find overlapping matches
      const overlapping = resolved.filter(existing =>
        match.startIndex < existing.endIndex && match.endIndex > existing.startIndex
      );
      
      // Keep the best match (by priority, then confidence, then length)
      const allCandidates = [...overlapping, match];
      const best = allCandidates.reduce((best, current) => {
        if (current.priority !== best.priority) {
          return current.priority > best.priority ? current : best;
        }
        if (Math.abs(current.confidence - best.confidence) > 0.1) {
          return current.confidence > best.confidence ? current : best;
        }
        return current.text.length > best.text.length ? current : best;
      });
      
      // Remove overlapping matches and add the best one
      overlapping.forEach(overlap => {
        const index = resolved.indexOf(overlap);
        if (index > -1) resolved.splice(index, 1);
      });
      
      resolved.push(best);
    }
  }
  
  return resolved.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Calculate confidence score for a match
 */
function calculateConfidence(text: string, type: EntityType): number {
  let confidence = 0.5; // Base confidence
  
  const wordCount = text.split(' ').length;
  const hasCapitalization = /^[A-Z]/.test(text);
  const hasSpecialChars = /['-]/.test(text);
  
  // Boost for proper capitalization
  if (hasCapitalization) confidence += 0.2;
  
  // Type-specific boosts
  switch (type) {
    case 'place':
      if (COUNTRY_NAMES.has(text.toLowerCase())) confidence += 0.3;
      if (wordCount >= 2) confidence += 0.1;
      break;
      
    case 'organization':
      if (/\b(?:Inc|Corp|Ltd|LLC|University|Bank|Agency)\.?$/i.test(text)) confidence += 0.3;
      if (wordCount >= 2) confidence += 0.1;
      if (hasSpecialChars) confidence += 0.1; // & in company names
      break;
      
    case 'person':
      if (wordCount === 2) confidence += 0.2;
      if (/\s[A-Z]\.\s/.test(text)) confidence += 0.1; // Middle initial
      if (hasSpecialChars) confidence += 0.1; // O'Connor, Jean-Claude
      break;
  }
  
  return Math.min(confidence, 1.0);
}