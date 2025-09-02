// Section configuration type
export interface SectionConfig {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
}

// Default sections configuration
export const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: "summary", name: "Summary", enabled: true, order: 1 },
  { id: "primaryImage", name: "Primary Image", enabled: true, order: 2 },
  { id: "sources", name: "Sources", enabled: true, order: 3 },
  { id: "highlights", name: "Highlights", enabled: true, order: 4 },
  { id: "quotes", name: "Quotes", enabled: true, order: 5 },
  { id: "secondaryImage", name: "Secondary Image", enabled: true, order: 6 },
  { id: "perspectives", name: "Perspectives", enabled: true, order: 7 },
  {
    id: "historicalBackground",
    name: "Historical Background",
    enabled: true,
    order: 8,
  },
  {
    id: "humanitarianImpact",
    name: "Humanitarian Impact",
    enabled: true,
    order: 9,
  },
  {
    id: "technicalDetails",
    name: "Technical Details",
    enabled: true,
    order: 10,
  },
  { id: "businessAngle", name: "Business Angle", enabled: true, order: 11 },
  {
    id: "scientificSignificance",
    name: "Scientific Significance",
    enabled: true,
    order: 12,
  },
  { id: "travelAdvisory", name: "Travel Advisory", enabled: true, order: 13 },
  {
    id: "performanceStatistics",
    name: "Performance Statistics",
    enabled: true,
    order: 14,
  },
  { id: "leagueStandings", name: "League Standings", enabled: true, order: 15 },
  {
    id: "designPrinciples",
    name: "Design Principles",
    enabled: true,
    order: 16,
  },
  {
    id: "userExperienceImpact",
    name: "User Experience Impact",
    enabled: true,
    order: 17,
  },
  {
    id: "gameplayMechanics",
    name: "Gameplay Mechanics",
    enabled: true,
    order: 18,
  },
  { id: "industryImpact", name: "Industry Impact", enabled: true, order: 19 },
  {
    id: "technicalSpecifications",
    name: "Technical Specifications",
    enabled: true,
    order: 20,
  },
  { id: "timeline", name: "Timeline", enabled: true, order: 21 },
  {
    id: "internationalReactions",
    name: "International Reactions",
    enabled: true,
    order: 22,
  },
  { id: "suggestedQnA", name: "Suggested Q&A", enabled: true, order: 23 },
  { id: "actionItems", name: "Action Items", enabled: true, order: 24 },
  { id: "didYouKnow", name: "Did You Know", enabled: true, order: 25 },
];

// Centralized section icon mapping (used across settings and story UIs)
export const SECTION_ICONS: Record<string, string> = {
  summary: "tabler:file-text",
  primaryImage: "tabler:photo",
  highlights: "tabler:highlight",
  quotes: "tabler:quote",
  secondaryImage: "tabler:photo-plus",
  perspectives: "tabler:eye",
  // Note: Ensure key matches section id used throughout app
  historicalBackground: "tabler:history",
  humanitarianImpact: "tabler:heart",
  technicalDetails: "tabler:tool",
  businessAngle: "tabler:briefcase",
  scientificSignificance: "tabler:flask",
  travelAdvisory: "tabler:map-pin",
  performanceStatistics: "tabler:chart-bar",
  leagueStandings: "tabler:trophy",
  designPrinciples: "tabler:palette",
  userExperienceImpact: "tabler:user",
  gameplayMechanics: "tabler:device-gamepad",
  industryImpact: "tabler:building-factory",
  technicalSpecifications: "tabler:list-details",
  timeline: "tabler:clock",
  internationalReactions: "tabler:world",
  suggestedQnA: "tabler:help",
  actionItems: "tabler:checklist",
  didYouKnow: "tabler:bulb",
  sources: "tabler:link",
};

export function getSectionIcon(sectionId: string): string {
  return SECTION_ICONS[sectionId] || "tabler:file";
}
