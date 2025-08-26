# Requirements Document

## Introduction

This feature implements a streamlined, collapsible divider-based architecture for the SettingsContentFilter.svelte component with smart auto-expand behavior and comprehensive localization support. The solution addresses usability issues through consistent visual hierarchy, intelligent section management, and proper internationalization.

## Requirements

### Requirement 1

**User Story:** As a user configuring content filters, I want sections to intelligently expand when relevant filters become active (like when selecting presets), but still allow me to manually collapse them if desired, so that I have both helpful automation and full control.

#### Acceptance Criteria

1. ✅ WHEN I select a preset that activates filters THEN the relevant filter sections should automatically expand to show the active filters
2. ✅ WHEN I manually collapse a section with active filters THEN it should stay collapsed and respect my choice (manual override)
3. ✅ WHEN filters become inactive THEN the manual override should reset, allowing auto-expand to work again for future activations
4. ✅ WHEN I manually expand or collapse any section THEN it should respond immediately without interference from automatic logic
5. ✅ WHEN multiple sections have active filters THEN each should independently manage its auto-expand and manual override state
6. ✅ WHEN the component loads with existing active filters THEN relevant sections should auto-expand on initial render
7. ✅ WHEN all filters in a section become inactive THEN the section should auto-collapse (unless manually overridden)
8. ✅ WHEN debugging the behavior THEN comprehensive logging and test controls should be available

**Current Status**: ✅ IMPLEMENTED with comprehensive debugging controls for testing

### Requirement 2

**User Story:** As a user navigating the content filter settings, I want a streamlined two-tier divider system with consistent spacing and visual hierarchy, so that the interface is organized and easy to scan.

#### Acceptance Criteria

1. WHEN I view the component THEN it should use a two-tier hierarchy: top-level dividers (Presets, Filters, Filter Scope & Mode, Advanced Weights) and sub-sections within dividers
2. WHEN I see top-level dividers THEN they should use horizontal lines, uppercase labels, `my-3` spacing, and chevron rotation
3. WHEN I see sub-sections THEN they should use icon + title + chevron pattern, `mb-6` container spacing, and active count indicators
4. WHEN sections are collapsed or expanded THEN the spacing should remain consistent across all screen sizes
5. WHEN I compare the new structure to the old THEN there should be fewer top-level sections (5 main sections vs 12+ individual sections)

### Requirement 3

**User Story:** As an international user, I want all section headers and divider labels to be properly localized with comprehensive language support, so that I can use the interface in my preferred language.

#### Acceptance Criteria

1. WHEN I view any section header THEN it should use localization keys with proper fallback text
2. WHEN localization keys are missing THEN appropriate keys should be added to all locale files (en.json, de.json, es.json, fr.json, hi.json, it.json, ja.json, nl.json, pt.json, uk.json, zh.json)
3. WHEN I switch languages THEN all divider and section labels should update immediately
4. WHEN translations are very long THEN the layout should handle them gracefully without breaking

### Requirement 4

**User Story:** As a developer maintaining this component, I want clear implementation patterns and comprehensive testing coverage, so that the solution is maintainable and can be applied to other components.

#### Acceptance Criteria

1. ✅ WHEN implementing manual override tracking THEN it should use dedicated state variables (manuallyCollapsedContentQuality, etc.) and proper reset logic
2. ✅ WHEN implementing click handlers THEN they should track both manual collapse and expand actions with consistent patterns across all sections
3. ✅ WHEN implementing the $effect logic THEN it should handle initial state, transitions, and manual overrides with proper previous state tracking
4. ✅ WHEN testing the implementation THEN comprehensive debug controls and logging should be available for validation
5. ✅ WHEN debugging issues THEN the system should provide clear console logging for all state changes and transitions
6. ✅ WHEN validating behavior THEN test buttons should allow easy testing of filter activation, manual overrides, and state resets

**Current Status**: ✅ IMPLEMENTED with enhanced debugging and testing capabilities