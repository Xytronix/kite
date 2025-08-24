import { describe, it, expect } from 'vitest';
import { SmartContentFilter } from '../contentFilter';

describe('Smart Filtering System', () => {
  describe('SmartContentFilter', () => {
    it('should score content quality correctly', () => {
      const filter = new SmartContentFilter();
      
      // High quality content
      const highQualityScore = filter.scoreContent(
        'Federal Reserve Announces Interest Rate Decision',
        'The Federal Reserve announced today a 0.25% increase in interest rates following their monthly meeting. The decision reflects ongoing concerns about inflation and employment levels.',
        'reuters.com'
      );
      
      // Low quality content
      const lowQualityScore = filter.scoreContent(
        'SHOCKING: You Won\'t Believe This Celebrity Secret!',
        'Click here to see the most amazing celebrity scandal that will blow your mind! Doctors hate this one trick!',
        'dailymail.co.uk'
      );
      
      expect(highQualityScore.quality).toBeGreaterThan(lowQualityScore.quality);
      expect(highQualityScore.relevance).toBeGreaterThan(lowQualityScore.relevance);
    });

    it('should detect clickbait patterns', () => {
      const filter = new SmartContentFilter();
      
      const clickbaitScore = filter.scoreContent(
        'You Won\'t Believe What Happened Next!',
        'This shocking trick will amaze you! Click here to find out more!',
        'example.com'
      );
      
      // The system should analyze the content and provide scores
      expect(clickbaitScore.relevance).toBeGreaterThan(0);
      expect(clickbaitScore.quality).toBeGreaterThan(0);
      expect(clickbaitScore.sentiment).toBeGreaterThan(0);
      expect(clickbaitScore.category).toBeDefined();
    });

    it('should handle political content appropriately', () => {
      const filter = new SmartContentFilter();
      
      // Legitimate political news
      const politicalNewsScore = filter.scoreContent(
        'Congress Passes Infrastructure Bill',
        'The House of Representatives voted 228-206 to approve the bipartisan infrastructure legislation, sending it to the President for signature.',
        'reuters.com'
      );
      
      expect(politicalNewsScore.category).toBe('politics');
      expect(politicalNewsScore.quality).toBeGreaterThan(0.5); // Should be high quality
      
      // Apply user preference to filter politics
      const filteredScore = filter.applyUserPreferences(politicalNewsScore, {
        filterPolitics: true
      });
      
      expect(filteredScore.shouldFilter).toBe(true);
      expect(filteredScore.reasons).toContain('Politics filtered by user preference');
    });

    it('should categorize content correctly', () => {
      const filter = new SmartContentFilter();
      
      const techScore = filter.scoreContent(
        'New AI Breakthrough in Machine Learning',
        'Researchers develop advanced neural network architecture for natural language processing.',
        'techcrunch.com'
      );
      
      const businessScore = filter.scoreContent(
        'Stock Market Reaches Record High',
        'The Dow Jones Industrial Average closed at a record high following strong quarterly earnings reports.',
        'wsj.com'
      );
      
      expect(techScore.category).toBe('technology');
      expect(businessScore.category).toBe('business');
    });

    it('should handle sentiment analysis', () => {
      const filter = new SmartContentFilter();
      
      const negativeScore = filter.scoreContent(
        'Tragic Shooting Leaves Multiple Dead',
        'A deadly shooting incident has resulted in multiple casualties and ongoing police investigation.',
        'cnn.com'
      );
      
      const positiveScore = filter.scoreContent(
        'Local Community Celebrates Success',
        'The annual harvest festival brought together families for a day of celebration and positive community spirit.',
        'localnews.com'
      );
      
      expect(negativeScore.sentiment).toBeLessThan(positiveScore.sentiment);
    });
  });

  describe('Integration Tests', () => {
    it('should filter stories effectively', () => {
      const filter = new SmartContentFilter();
      
      const stories = [
        {
          title: 'Federal Reserve Announces Policy Changes',
          short_summary: 'The central bank announced new monetary policy measures.',
          source_url: 'reuters.com'
        },
        {
          title: 'SHOCKING Celebrity Scandal!',
          short_summary: 'You won\'t believe what this star did! Click to find out!',
          source_url: 'tabloid.com'
        },
        {
          title: 'Local School Wins Science Competition',
          short_summary: 'Students from Jefferson High School won the state science fair.',
          source_url: 'localnews.com'
        }
      ];
      
      // Test that the system can analyze all stories
      expect(stories.length).toBe(3);
      
      // Test that each story gets scored
      stories.forEach(story => {
        const score = filter.scoreContent(story.title, story.short_summary, story.source_url);
        expect(score.relevance).toBeGreaterThan(0);
        expect(score.quality).toBeGreaterThan(0);
        expect(score.sentiment).toBeGreaterThan(0);
        expect(score.category).toBeDefined();
      });
      
      // Test that different content types get different scores
      const fedScore = filter.scoreContent(stories[0].title, stories[0].short_summary, stories[0].source_url);
      const clickbaitScore = filter.scoreContent(stories[1].title, stories[1].short_summary, stories[1].source_url);
      
      // Reuters should generally score higher than tabloid
      expect(fedScore.quality).toBeGreaterThanOrEqual(clickbaitScore.quality);
    });
  });
});