import type { Article } from '$lib/types';
import type { CitationMapping } from '$lib/utils/citationContext';

/**
 * Base props for components that use citations
 */
export interface CitationProps {
	articles?: Article[];
	citationMapping?: CitationMapping;
}

/**
 * Props for components with shared citation tooltips
 */
export interface SharedCitationProps extends CitationProps {
	citationTooltip?: any; // SourceTooltip instance
}

/**
 * Props for components that render sections
 */
export interface SectionProps {
	title?: string;
	className?: string;
}