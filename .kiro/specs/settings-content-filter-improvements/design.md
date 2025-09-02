# Design Document

## Overview

This design implements a streamlined, collapsible divider-based architecture for the SettingsContentFilter.svelte component with intelligent auto-expand behavior and comprehensive localization. The solution transforms the component from 12+ individual sections into a clean two-tier hierarchy with smart section management.

## Architecture

### Component Structure
The SettingsContentFilter.svelte component uses a two-tier collapsible architecture:

1. **Top-Level Dividers**: Major sections (Presets, Filters, Filter Scope & Mode, Advanced Weights)
2. **Sub-Sections**: Nested sections within dividers (Content Quality, Topics & Subjects, etc.)
3. **Smart Auto-Expand System**: Intelligent section management with manual override tracking
4. **Localization Layer**: Comprehensive internationalization support

### Key Design Principles
- **Smart Automation**: Auto-expand relevant sections when filters become active
- **User Control**: Respect manual collapse/expand choices with override tracking
- **Visual Hierarchy**: Clear two-tier structure with consistent spacing
- **Internationalization**: Comprehensive localization with fallback support
- **Maintainability**: Reusable patterns for future development

## Components and Interfaces

### Smart Auto-Expand System

#### Manual Override Tracking
```typescript
// State variables for tracking manual user actions
// Only track sections that are actually collapsible
let manuallyCollapsedContentQuality = $state(false);
let manuallyCollapsedTopicsSubjects = $state(false);

// Track previous filter states to detect changes
// Initialize to null to detect first-time changes properly
let previousContentQualityFilters = $state<boolean | null>(null);
let previousTopicsSubjectsFilters = $state<boolean | null>(null);
```

#### Intelligent Auto-Expand Logic with Proper State Management
```typescript
// Initialize sections based on current filter state on component mount
$effect(() => {
  // Only run once on mount when previous states are null
  if (previousContentQualityFilters === null && previousTopicsSubjectsFilters === null) {
    console.log('Initializing sections based on current filter state');
    
    // Auto-expand sections that have active filters on initial load
    if (hasContentQualityFilters && !manuallyCollapsedContentQuality) {
      console.log('Initial auto-expand: Content Quality section');
      showContentQuality = true;
    }
    
    if (hasTopicsSubjectsFilters && !manuallyCollapsedTopicsSubjects) {
      console.log('Initial auto-expand: Topics & Subjects section');
      showTopicsSubjects = true;
    }
  }
});

// Smart auto-expand when filters become active (but respect manual overrides)
$effect(() => {
  // Handle initial state and transitions
  const currentContentQualityFilters = hasContentQualityFilters;
  const currentTopicsSubjectsFilters = hasTopicsSubjectsFilters;
  
  // Skip if this is the very first run and we haven't initialized previous states
  if (previousContentQualityFilters === null && previousTopicsSubjectsFilters === null) {
    console.log('First run - initializing previous states');
    previousContentQualityFilters = currentContentQualityFilters;
    previousTopicsSubjectsFilters = currentTopicsSubjectsFilters;
    return;
  }
  
  // Auto-expand logic - When transitioning from inactive to active
  if (currentContentQualityFilters && 
      previousContentQualityFilters === false && 
      !manuallyCollapsedContentQuality) {
    console.log('Auto-expanding Content Quality section');
    showContentQuality = true;
  }
  
  if (currentTopicsSubjectsFilters && 
      previousTopicsSubjectsFilters === false && 
      !manuallyCollapsedTopicsSubjects) {
    console.log('Auto-expanding Topics & Subjects section');
    showTopicsSubjects = true;
  }

  // Auto-collapse logic - Enable auto-collapse when all filters become inactive
  if (previousContentQualityFilters === true && !currentContentQualityFilters && !manuallyCollapsedContentQuality) {
    console.log('Auto-collapsing Content Quality section');
    showContentQuality = false;
  }
  if (previousTopicsSubjectsFilters === true && !currentTopicsSubjectsFilters && !manuallyCollapsedTopicsSubjects) {
    console.log('Auto-collapsing Topics & Subjects section');
    showTopicsSubjects = false;
  }

  // Reset manual override flags when filters transition from active to inactive
  if (previousContentQualityFilters === true && !currentContentQualityFilters) {
    console.log('Resetting manual override for Content Quality');
    manuallyCollapsedContentQuality = false;
  }
  if (previousTopicsSubjectsFilters === true && !currentTopicsSubjectsFilters) {
    console.log('Resetting manual override for Topics & Subjects');
    manuallyCollapsedTopicsSubjects = false;
  }

  // Update previous states for next comparison
  previousContentQualityFilters = currentContentQualityFilters;
  previousTopicsSubjectsFilters = currentTopicsSubjectsFilters;
});
```

#### Debug and Testing Controls
```typescript
// Temporary debug controls for testing auto-expand/collapse behavior
<div class="flex gap-2 flex-wrap">
  <button onclick={() => console.log('Current state:', { /* state vars */ })}>
    Log Current State
  </button>
  <button onclick={() => smartContentFilter.togglePreference("filterLowQuality")}>
    Toggle Low Quality Filter
  </button>
  <button onclick={() => smartContentFilter.togglePreference("filterPolitics")}>
    Toggle Politics Filter
  </button>
  <button onclick={() => { 
    manuallyCollapsedContentQuality = false;
    manuallyCollapsedTopicsSubjects = false;
  }}>
    Reset Manual Overrides
  </button>
</div>
```

### Section Divider Patterns

#### Top-Level Divider Pattern
Used for major sections like "Presets", "Filters", "Filter Scope & Mode", etc.
```html
<!-- Top-level divider (collapsible) -->
<button
  type="button"
  class="my-3 flex w-full items-center text-left"
  onclick={() => (showSection = !showSection)}
  aria-expanded={showSection}
  aria-controls="section-id"
>
  <div class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
  <span class="px-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
    {s("settings.contentFilter.section.parent") || "Section Name"}
  </span>
  <Icon
    icon="tabler:chevron-right"
    class="ml-2 h-4 w-4 text-gray-400 transition-transform duration-200 {showSection ? 'rotate-90' : ''}"
    aria-hidden="true"
  />
  <div class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
</button>
```

#### Sub-Section Pattern with Enhanced Manual Override Tracking
Used for sections within top-level dividers like "Content Quality", "Topics & Subjects", etc.
```html
<!-- Sub-section within divider with enhanced manual override tracking -->
<div class="mb-6">
  <button
    type="button"
    class="flex w-full items-center justify-between text-left mb-3"
    onclick={() => {
      const wasExpanded = showSubsection;
      showSubsection = !showSubsection;
      
      // Track manual actions to prevent auto-expand/collapse interference
      if (wasExpanded && !showSubsection) {
        // User manually collapsed the section
        console.log('User manually collapsed subsection');
        manuallyCollapsedSubsection = true;
      } else if (!wasExpanded && showSubsection) {
        // User manually expanded the section
        console.log('User manually expanded subsection');
        manuallyCollapsedSubsection = false;
      }
    }}
    aria-expanded={showSubsection}
    aria-controls="subsection-id"
  >
    <div class="flex items-center gap-2">
      <Icon
        icon="tabler:icon-name"
        class="h-4 w-4 text-gray-600 dark:text-gray-400"
      />
      <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {s("settings.contentFilter.subsection.parent") || "Subsection Name"}
      </h5>
      <!-- Active count indicator -->
      {#if hasSubsectionFilters}
        {@const activeCount = getActiveFilterCount()}
        <span class="text-xs font-medium text-blue-600 dark:text-blue-400">
          ({activeCount}/{totalCount} active)
        </span>
      {/if}
    </div>
    <Icon
      icon="tabler:chevron-right"
      class="h-4 w-4 text-gray-400 transition-transform duration-200 {showSubsection ? 'rotate-90' : ''}"
      aria-hidden="true"
    />
  </button>
  
  {#if showSubsection}
  <div id="subsection-id">
    <!-- Subsection content -->
  </div>
  {/if}
</div>
```

### Localization Interface
```typescript
interface LocalizationKey {
  key: string;
  fallback: string;
  context?: string;
}
```

### Spacing System Interface
```typescript
interface SpacingConfig {
  sectionGap: string;
  subsectionGap: string;
  itemGap: string;
  dividerSpacing: string;
}
```

## Data Models

### Component State Structure
```typescript
interface ComponentState {
  // Section visibility state
  showContentQuality: boolean;
  showTopicsSubjects: boolean;
  showNewsTypes: boolean;
  showWellnessMental: boolean;
  
  // Manual override tracking
  manuallyCollapsedContentQuality: boolean;
  manuallyCollapsedTopicsSubjects: boolean;
  manuallyCollapsedNewsTypes: boolean;
  manuallyCollapsedWellnessMental: boolean;
  
  // Filter activity detection
  hasContentQualityFilters: boolean;
  hasTopicsSubjectsFilters: boolean;
  hasNewsTypesFilters: boolean;
  hasWellnessFilters: boolean;
}
```

### Required Localization Keys
The following keys need to be added to all locale files:

```json
{
  "settings.contentFilter.filters.parent": {
    "text": "Filters",
    "translationContext": "Main divider label for the filters section"
  },
  "settings.contentFilter.contentQuality.parent": {
    "text": "Content Quality",
    "translationContext": "Sub-section label for content quality filters"
  },
  "settings.contentFilter.topicsSubjects.parent": {
    "text": "Topics & Subjects",
    "translationContext": "Sub-section label for topic-based filters"
  },
  "settings.contentFilter.newsTypes.parent": {
    "text": "News Types",
    "translationContext": "Sub-section label for news type filters"
  },
  "settings.contentFilter.wellnessMental.parent": {
    "text": "Wellness & Mental Health",
    "translationContext": "Sub-section label for wellness-focused filters"
  },
  "settings.contentFilter.customKeywords.parent": {
    "text": "Custom Keywords",
    "translationContext": "Sub-section label for custom keyword filters"
  },
  "settings.contentFilter.filterScopeMode.parent": {
    "text": "Filter Scope & Mode",
    "translationContext": "Top-level divider for filter scope settings"
  },
  "settings.contentFilter.advancedWeights.parent": {
    "text": "Advanced Weights",
    "translationContext": "Top-level divider for advanced weight settings"
  }
}
```

### Spacing Configuration
```css
:root {
  --content-filter-section-gap: 1.5rem;
  --content-filter-subsection-gap: 1rem;
  --content-filter-item-gap: 0.5rem;
  --content-filter-divider-spacing: 0.75rem;
}
```

## Smart Auto-Expand Behavior

### Auto-Expand Logic Flow
1. **Filter Activation Detection**: Monitor derived values (hasContentQualityFilters, etc.)
2. **Manual Override Check**: Only auto-expand if user hasn't manually collapsed
3. **Section Expansion**: Automatically expand relevant sections when filters become active
4. **Manual Override Tracking**: Set override flag when user manually collapses active sections
5. **Override Reset**: Clear override flags when filters become inactive

### Manual Override Scenarios with Proper State Management
```typescript
// Scenario 1: Initial load with active filters → Auto-expand
$effect(() => {
  if (previousTopicsSubjectsFilters === null && previousContentQualityFilters === null) {
    if (hasTopicsSubjectsFilters && !manuallyCollapsedTopicsSubjects) {
      showTopicsSubjects = true; // Initial auto-expand
    }
  }
});

// Scenario 2: Filter activation → Auto-expand (if not manually collapsed)
if (hasTopicsSubjectsFilters && 
    previousTopicsSubjectsFilters === false && 
    !manuallyCollapsedTopicsSubjects) {
  showTopicsSubjects = true; // Auto-expand on filter activation
}

// Scenario 3: User manually collapses → Set override with proper tracking
onclick={() => {
  const wasExpanded = showTopicsSubjects;
  showTopicsSubjects = !showTopicsSubjects;
  
  if (wasExpanded && !showTopicsSubjects) {
    manuallyCollapsedTopicsSubjects = true; // Remember user's collapse choice
  } else if (!wasExpanded && showTopicsSubjects) {
    manuallyCollapsedTopicsSubjects = false; // User manually expanded
  }
}}

// Scenario 4: Filters become inactive → Auto-collapse and reset override
if (previousTopicsSubjectsFilters === true && !hasTopicsSubjectsFilters) {
  if (!manuallyCollapsedTopicsSubjects) {
    showTopicsSubjects = false; // Auto-collapse when filters become inactive
  }
  manuallyCollapsedTopicsSubjects = false; // Reset override for future activations
}

// Scenario 5: State transition tracking with proper previous state management
previousTopicsSubjectsFilters = hasTopicsSubjectsFilters; // Always update for next comparison
```

### Error Handling

#### Localization Fallbacks
1. **Primary**: Use localization key from current locale
2. **Secondary**: Fall back to English (en.json) if key exists
3. **Tertiary**: Use hardcoded fallback string
4. **Logging**: Log missing keys for development tracking

#### State Management Safeguards
1. **Override Reset**: Ensure manual override flags are properly reset
2. **State Consistency**: Validate section visibility matches expected behavior
3. **Performance**: Minimize reactive updates with proper dependency tracking

## Testing Strategy

### Smart Auto-Expand Testing
1. **Initial State Tests**: Verify sections auto-expand on component mount when filters are already active
2. **Auto-Expand Tests**: Verify sections expand when filters transition from inactive to active
3. **Auto-Collapse Tests**: Verify sections collapse when all filters in a section become inactive
4. **Manual Override Tests**: Ensure manual collapse is respected and prevents auto-expand
5. **Override Reset Tests**: Confirm override flags reset when filters become inactive, allowing future auto-expand
6. **State Transition Tests**: Validate proper previous state tracking and transition detection
7. **Debug Control Tests**: Verify debug buttons work correctly for testing scenarios
8. **Performance Tests**: Ensure reactive updates don't cause excessive re-renders

### User Interaction Testing
1. **Preset Selection**: Test auto-expand when selecting different presets
2. **Manual Collapse**: Test manual collapse with active filters
3. **Manual Expand**: Test manual expand functionality
4. **Mixed Scenarios**: Test combinations of auto-expand and manual control

### Localization Testing
1. **Key Resolution**: Verify all localization keys resolve correctly
2. **Language Switching**: Test immediate UI updates when switching languages
3. **Fallback Behavior**: Test graceful fallback when keys are missing
4. **Layout Stability**: Ensure long translations don't break layout

### Visual and Accessibility Testing
1. **Visual Regression**: Compare before/after screenshots of divider structure
2. **Responsive Behavior**: Verify consistent spacing across screen sizes
3. **Keyboard Navigation**: Test collapsible sections with keyboard
4. **Screen Reader**: Verify proper ARIA attributes and announcements

### Implementation Phases

#### Phase 1: Smart Auto-Expand System ✅ COMPLETED
- ✅ Implement manual override tracking state variables with proper initialization
- ✅ Update $effect logic with separate initialization and transition effects
- ✅ Modify click handlers to track both manual collapse and expand actions
- ✅ Add comprehensive debug logging and test controls
- ✅ Fix initial state handling and transition detection
- ✅ Enable both auto-expand and auto-collapse functionality
- ✅ Test auto-expand, auto-collapse, and manual override behavior

#### Phase 2: Divider Structure Implementation
- Convert remaining sections to sub-section pattern (News Types, Wellness & Mental Health, Custom Keywords)
- Implement new top-level dividers (Filter Scope & Mode, Advanced Weights)
- Apply consistent spacing system throughout
- Ensure proper collapsible behavior for all sections

#### Phase 3: Localization Implementation
- Add all required localization keys to en.json
- Replace hardcoded strings with localization function calls
- Implement fallback mechanisms for missing keys
- Add runtime validation for development environment

#### Phase 4: Multi-language Support
- Add translations for all new keys to existing locale files
- Test with different languages to ensure layout stability
- Implement proper text overflow handling
- Validate immediate UI updates when switching languages

#### Phase 5: Quality Assurance and Testing
- Comprehensive testing of smart auto-expand behavior
- Visual regression testing for divider structure consistency
- Cross-language testing for all supported locales
- Performance impact assessment and optimization
- Documentation updates with implementation patterns

## Technical Considerations

### Performance Impact
- Localization function calls have minimal performance overhead
- CSS custom properties provide efficient spacing management
- No additional bundle size impact for core functionality

### Browser Compatibility
- CSS custom properties supported in all modern browsers
- Fallback values provided for older browser support
- Progressive enhancement approach for advanced features

### Accessibility Improvements
- Consistent spacing improves screen reader navigation
- Proper localization supports international accessibility standards
- Maintained semantic HTML structure for assistive technologies

## Migration Strategy

### Development Workflow
1. Create feature branch for improvements
2. Implement changes incrementally with testing
3. Validate against existing functionality
4. Deploy with feature flag if needed

### Rollback Plan
- All changes are additive and backward compatible
- Original hardcoded strings remain as fallbacks
- CSS spacing can be easily reverted via custom properties

## Success Metrics

### Localization Success
- 100% of user-facing text uses localization keys
- All supported languages display correctly
- Zero layout breaks with different text lengths

### Spacing Success
- Consistent visual spacing across all filter sections
- Maintained responsive behavior on all screen sizes
- Improved user experience scores in usability testing