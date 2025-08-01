# Design Document

## Overview

The SettingsContentFilter component will be a comprehensive, unified interface that merges the best features from both existing SettingsSmartFilter components. It will provide a clean, professional interface with monochrome icons, logical functional grouping, advanced weight system controls, and no hidden functionality.

## Architecture

### Component Structure

```
SettingsContentFilter.svelte
├── Main Toggle Section
├── Quick Setup Section (Presets)
├── Content Quality Section
├── Topics & Subjects Section  
├── News Types Section
├── Geographic Scope Section
├── Wellness & Mental Health Section
├── Advanced Similarity Section
├── Active Filters Management Section
├── Statistics Section
├── System Controls Section (Import/Export/Reset)
└── Advanced Category Weight Overrides Section
```

### State Management

The component will use the existing `smartContentFilter` store from `src/lib/stores/smartContentFilter.svelte.ts` without modifications, ensuring full compatibility with the existing filtering system.

### Design Principles

1. **Monochrome Icons**: All icons use gray/dark gray colors with opacity/shade changes for interaction states
2. **Functional Grouping**: Settings organized by purpose rather than technical implementation
3. **Progressive Disclosure**: Sections collapse when empty but remain discoverable
4. **No Hidden Features**: All functionality visible and accessible
5. **Consistent Interaction Patterns**: Similar controls behave the same way throughout

## Components and Interfaces

### Main Toggle Section
- Large prominent toggle for enabling/disabling the entire filter system
- Clear description of what content filtering does
- Visual indicator when system is enabled/disabled

### Quick Setup Section (Presets)
- **Basic Presets**: Quality Focus, Politics-Free, High Standards
- **Specialized Presets**: Professional Focus, News Essentials, Global Focus, News Purist, Wellness Focus
- Conflict detection and resolution
- Preset modification indicators
- Reset to original preset functionality

### Content Quality Section
- Low Quality Content filter
- Promotional Content filter  
- Opinion Pieces filter
- Repetitive Coverage filter
- Social Media Drama filter
- Each with monochrome icons and clear descriptions

### Topics & Subjects Section
- Political Content filter
- Sports Coverage filter
- Financial News filter
- Technology News filter
- Entertainment Industry filter
- Celebrity News filter
- Weather Coverage filter
- Grid layout with toggle buttons

### News Types Section
- Breaking News Alerts filter
- Simple toggle interface

### Geographic Scope Section
- Hyper-Local News filter
- International News filter
- Clear geographic context explanations

### Wellness & Mental Health Section
- Negative News filter
- Violent Content filter
- Anxiety-Inducing Content filter
- Economic Pessimism filter
- Mental health focused descriptions

### Advanced Similarity Section
- Content Similarity Detection toggle
- Similarity Threshold slider (0-100%)
- Detection Mode: Today Only vs Historical
- Memory Duration (for historical mode)
- Detection Scope: Within Categories vs Across Categories
- Algorithm Weight Controls:
  - Title Similarity Weight
  - Content Similarity Weight  
  - Entity Similarity Weight
- Preset buttons for common scenarios
- Real-time explanations of settings

### Active Filters Management Section
- Display of all currently active filters as removable tags
- Individual filter removal
- Clear all filters option
- Filter statistics display

### Statistics Section
- Total stories processed
- Stories filtered count
- Filter rate percentage
- Top filter reasons
- Category breakdown
- Visual charts/graphs where appropriate

### System Controls Section
- Export configuration to JSON
- Import configuration from JSON
- Reset to defaults with confirmation
- Version information display

### Advanced Category Weight Overrides Section
- Per-category sensitivity overrides
- Global weight settings:
  - Title Importance (0-100%)
  - Content Importance (0-100%)
  - Context Evidence (0-100%)
- Category-specific weight overrides
- Custom numeric sensitivity controls
- Parameter explanations and tooltips

## Data Models

### Filter Categories
```typescript
interface FilterCategory {
  key: string;
  name: string;
  description: string;
  icon: string; // monochrome icon name
  enabled: boolean;
  hasWeightOverride?: boolean;
  weightOverride?: CategoryWeights;
}

interface CategoryWeights {
  titleImportance: number;
  contentImportance: number;
  contextEvidence: number;
}
```

### Preset Configuration
```typescript
interface FilterPreset {
  id: string;
  name: string;
  description: string;
  icon: string; // monochrome icon
  category: 'basic' | 'specialized';
  preferences: Partial<FilterPreferences>;
  conflicts?: string[]; // IDs of conflicting presets
}
```

### Section Configuration
```typescript
interface FilterSection {
  id: string;
  title: string;
  description: string;
  icon: string; // monochrome icon
  filters: FilterCategory[];
  isCollapsed: boolean;
  hasActiveFilters: boolean;
}
```

## Error Handling

### Import/Export Errors
- File format validation
- Version compatibility checking
- Graceful degradation for missing properties
- User-friendly error messages
- Rollback capability for failed imports

### Filter Application Errors
- Fallback to unfiltered content on algorithm errors
- Error logging for debugging
- User notification of filter failures
- Automatic error recovery

### Storage Errors
- LocalStorage failure handling
- Settings persistence validation
- Default value fallbacks
- User notification of storage issues

## Testing Strategy

### Unit Tests
- Individual filter toggle functionality
- Preset activation/deactivation logic
- Weight override calculations
- Import/export serialization
- Statistics calculation accuracy

### Integration Tests
- Full filter pipeline with various content types
- Preset conflict resolution
- Category weight override application
- Storage persistence across sessions

### User Experience Tests
- Section collapse/expand behavior
- Filter discovery and activation
- Preset modification workflows
- Advanced settings accessibility

### Performance Tests
- Large content set filtering
- Complex weight override calculations
- Statistics generation speed
- UI responsiveness with many active filters

## Accessibility Considerations

### Keyboard Navigation
- Full keyboard accessibility for all controls
- Logical tab order through sections
- Clear focus indicators
- Keyboard shortcuts for common actions

### Screen Reader Support
- Proper ARIA labels for all interactive elements
- Section headings with appropriate hierarchy
- Status announcements for filter changes
- Descriptive text for complex controls

### Visual Accessibility
- High contrast monochrome icons
- Clear visual hierarchy
- Sufficient color contrast ratios
- Scalable text and controls

### Cognitive Accessibility
- Clear, jargon-free descriptions
- Logical grouping and organization
- Progressive disclosure of complexity
- Consistent interaction patterns

## Performance Considerations

### Rendering Optimization
- Lazy loading of collapsed sections
- Virtualization for large filter lists
- Efficient re-rendering on state changes
- Minimal DOM manipulation

### Memory Management
- Efficient state updates
- Cleanup of event listeners
- Optimized reactive computations
- Garbage collection friendly patterns

### Network Optimization
- Minimal external dependencies
- Efficient import/export operations
- Compressed configuration formats
- Offline functionality support