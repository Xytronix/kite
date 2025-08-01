# Requirements Document

## Introduction

This feature creates a new unified SettingsContentFilter component that merges the best features from both the current SettingsSmartFilter.svelte and the old/SettingsSmartFilter.svelte components. The new component will provide a comprehensive, well-organized interface for content filtering with improved usability, monochrome icons, advanced weight system controls, and logical functional grouping.

## Requirements

### Requirement 1

**User Story:** As a user, I want a unified content filter settings interface that combines all the best features from both existing components, so that I have access to all filtering capabilities in one well-organized place.

#### Acceptance Criteria

1. WHEN I access the content filter settings THEN I SHALL see a single unified interface that includes all features from both existing components
2. WHEN I interact with any filter setting THEN the system SHALL maintain all existing functionality without regression
3. WHEN I view the interface THEN all sections SHALL be logically organized by functionality rather than arbitrarily hidden

### Requirement 2

**User Story:** As a user, I want all icons to use a consistent monochrome design, so that the interface has a clean, professional appearance without distracting colors.

#### Acceptance Criteria

1. WHEN I view any icon in the interface THEN it SHALL use monochrome styling (gray/dark gray)
2. WHEN I hover over interactive elements THEN icons MAY change opacity or shade but SHALL NOT use colors
3. WHEN sections are active/inactive THEN the distinction SHALL be made through typography and layout, not icon colors

### Requirement 3

**User Story:** As a user, I want advanced weight system controls for each category, so that I can fine-tune how different aspects of content are weighted when detecting similarity and relevance.

#### Acceptance Criteria

1. WHEN I enable a category filter THEN I SHALL have access to weight override controls for that category
2. WHEN I adjust category weights THEN I SHALL see controls for title importance, content importance, and context evidence
3. WHEN I set custom weights THEN the system SHALL use these instead of global defaults for that category
4. WHEN I reset category weights THEN they SHALL revert to using global weight settings

### Requirement 4

**User Story:** As a user, I want all functionality to be organized by logical groupings, so that I can easily find related settings and understand how they work together.

#### Acceptance Criteria

1. WHEN I view the interface THEN settings SHALL be grouped by: Quick Setup, Content Quality, Topics & Subjects, News Types, Geographic Scope, Wellness & Mental Health, Advanced Similarity, and System Controls
2. WHEN I look for a specific type of filter THEN it SHALL be in the logical section based on its purpose
3. WHEN sections have no active filters THEN they SHALL be collapsed by default but still visible and accessible

### Requirement 5

**User Story:** As a user, I want nothing to be completely hidden from view, so that I can discover all available features and understand the full scope of filtering options.

#### Acceptance Criteria

1. WHEN I view the interface THEN all sections SHALL be visible, either expanded or collapsed
2. WHEN a section is collapsed THEN I SHALL still see its title and be able to expand it
3. WHEN a section has active filters THEN it SHALL auto-expand to show the active settings
4. WHEN a section has no active filters THEN it SHALL collapse but remain discoverable

### Requirement 6

**User Story:** As a user, I want comprehensive preset management, so that I can quickly apply common filtering configurations and understand how they conflict with each other.

#### Acceptance Criteria

1. WHEN I select a preset THEN the system SHALL show which other presets conflict and why
2. WHEN I modify a preset THEN I SHALL see an indicator that it has been customized
3. WHEN I want to return to the original preset THEN I SHALL have a clear way to reset modifications
4. WHEN presets conflict THEN the system SHALL handle deactivation and reactivation intelligently

### Requirement 7

**User Story:** As a user, I want advanced content similarity detection with full control over algorithm parameters, so that I can fine-tune how duplicate or similar content is identified and filtered.

#### Acceptance Criteria

1. WHEN I enable content similarity filtering THEN I SHALL have access to threshold, mode, scope, and weight controls
2. WHEN I adjust similarity weights THEN I SHALL see real-time feedback on how the algorithm will behave
3. WHEN I use historical mode THEN I SHALL be able to set memory duration for story comparison
4. WHEN I configure similarity detection THEN I SHALL have preset buttons for common scenarios (local focus, global focus, balanced)

### Requirement 8

**User Story:** As a user, I want comprehensive import/export functionality, so that I can backup my settings, share configurations, and restore previous setups.

#### Acceptance Criteria

1. WHEN I export settings THEN I SHALL get a complete JSON file with all preferences and metadata
2. WHEN I import settings THEN the system SHALL validate the file and warn about any issues
3. WHEN importing conflicts with current settings THEN I SHALL see a confirmation dialog with details
4. WHEN import/export operations occur THEN they SHALL include version information for compatibility

### Requirement 9

**User Story:** As a user, I want detailed statistics and active filter management, so that I can understand how my filters are performing and easily modify them.

#### Acceptance Criteria

1. WHEN filters are active THEN I SHALL see statistics on total processed, filtered count, and filter rate
2. WHEN I view active filters THEN I SHALL see them as removable tags with clear labels
3. WHEN I want to clear filters THEN I SHALL have options to remove individual filters or reset everything
4. WHEN viewing statistics THEN I SHALL see top filter reasons and category breakdowns

### Requirement 10

**User Story:** As a user, I want granular sensitivity controls with both global and per-category overrides, so that I can fine-tune filtering behavior for different types of content.

#### Acceptance Criteria

1. WHEN I set global sensitivity THEN it SHALL apply to all categories unless overridden
2. WHEN I override category sensitivity THEN I SHALL have options for preset levels (strict/balanced/loose) and custom numeric values
3. WHEN I use custom numeric sensitivity THEN I SHALL see detailed explanations of what each level means
4. WHEN I configure category overrides THEN I SHALL see direct parameter controls for advanced users