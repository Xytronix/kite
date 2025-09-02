<script lang="ts">
	import { sections } from '$lib/stores/sections.svelte.js';
	import { s } from '$lib/client/localization.svelte';
	import { experimental } from '$lib/stores/experimental.svelte.js';
	import { buildCitationMapping, replaceWithNumberedCitations, type CitationMapping } from '$lib/utils/citationContext';
	import { aggregateCitationsFromTexts, aggregateCitationsPerPerspective } from '$lib/utils/citationAggregator';
	import CitationText from './CitationText.svelte';
	import SectionSources from './SectionSources.svelte';
	import StoryEndSources from './StoryEndSources.svelte';
	import SourceTooltip from './SourceTooltip.svelte';
	import StorySummary from './StorySummary.svelte';
	import StoryHighlights from './StoryHighlights.svelte';
	import StoryQuote from './StoryQuote.svelte';
	import StoryImage from './StoryImage.svelte';
	import StorySources from './StorySources.svelte';
	import StoryPerspectives from './StoryPerspectives.svelte';
	import StoryTimeline from './StoryTimeline.svelte';
	import StoryInternationalReactions from './StoryInternationalReactions.svelte';
	import StorySuggestedQnA from './StorySuggestedQnA.svelte';
	import StoryActionItems from './StoryActionItems.svelte';
	import StoryDidYouKnow from './StoryDidYouKnow.svelte';
	import StoryListSection from './StoryListSection.svelte';
	import StoryTextSection from './StoryTextSection.svelte';
 	import { getSectionIcon } from '$lib/constants/sections';
    import Icon from '@iconify/svelte';
    import { linkKnownEntityAcrossRoot, refreshWikipediaTooltips } from '$lib/utils/linkingUtils.js';

	// Props
	interface Props {
		story: any;
		imagesPreloaded?: boolean;
		showSourceOverlay?: boolean;
		currentSource?: any;
		sourceArticles?: any[];
		currentMediaInfo?: any;
		isLoadingMediaInfo?: boolean;
	}

	let { 
		story, 
		imagesPreloaded = false,
		showSourceOverlay = $bindable(false),
		currentSource = $bindable(null),
		sourceArticles = $bindable([]),
		currentMediaInfo = $bindable(null),
		isLoadingMediaInfo = $bindable(false)
	}: Props = $props();

	// Get enabled sections in the correct order
	const enabledSections = $derived(
		sections.list
			.filter(section => section.enabled)
			.sort((a, b) => a.order - b.order)
	);

	// Check if a section has content
	function hasContent(sectionId: string): boolean {
		switch (sectionId) {
			case 'summary':
				return !!story.short_summary;
			case 'primaryImage':
				return !!story.articles?.find((a: any) => a.image);
			case 'highlights':
				return !!story.talking_points?.length;
			case 'quotes':
				return !!story.quote;
			case 'secondaryImage':
				return (story.articles?.filter((a: any) => a.image)?.length ?? 0) >= 2;
			case 'perspectives':
				return !!story.perspectives?.length;
			case 'historicalBackground':
				return !!story.historical_background;
			case 'humanitarianImpact':
				return !!story.humanitarian_impact;
			case 'technicalDetails':
				return !!story.technical_details?.length;
			case 'businessAngle':
				return !!(story.business_angle_text || story.business_angle_points?.length);
			case 'scientificSignificance':
				return !!story.scientific_significance?.length;
			case 'travelAdvisory':
				return !!story.travel_advisory?.length;
			case 'performanceStatistics':
				return !!story.performance_statistics?.length;
			case 'leagueStandings':
				return !!story.league_standings;
			case 'designPrinciples':
				return !!story.design_principles;
			case 'userExperienceImpact':
				return !!story.user_experience_impact?.length;
			case 'gameplayMechanics':
				return !!story.gameplay_mechanics?.length;
			case 'industryImpact':
				return !!story.gaming_industry_impact?.length;
			case 'technicalSpecifications':
				return !!story.technical_specifications;
			case 'timeline':
				return !!story.timeline?.length;
			case 'internationalReactions':
				return !!story.international_reactions?.length;
			case 'suggestedQnA':
				return !!story.suggested_qna?.length;
			case 'actionItems':
				return !!story.user_action_items?.length;
			case 'didYouKnow':
				return !!story.did_you_know;
			case 'sources':
				return !!story.domains?.length;
			default:
				return false;
		}
	}

	// Get the sections to render (enabled and have content)
	const sectionsToRender = $derived(
		enabledSections.filter(section => hasContent(section.id))
	);
	
	// Build global citation mapping for the story
	const citationMapping = $derived.by(() => {
		return buildCitationMapping(story, story.articles || []);
	});

	// Link known location QID across the rendered story content
	$effect(() => {
		try {
			const rootEl = document.querySelector('.story-sections') as HTMLElement | null;
			const locationQid = story?.location_qid as string | undefined;
			const locationLabel = (story?.location || '').toString();
			if (rootEl && locationLabel) {
				(async () => {
					let targetQid = locationQid;
					if (!targetQid) {
						try {
							const { resolveWikiTitleWithContext } = await import('$lib/utils/wikiResolver');
							// Prefer portion before comma to reduce ambiguity (e.g., "Washington" from "Washington, DC, USA")
							const base = locationLabel.split(',')[0].trim() || locationLabel;
							const resolved = await resolveWikiTitleWithContext(base, 'place');
							if (resolved?.qid) targetQid = resolved.qid;
						} catch {}
					}
					if (targetQid) {
						// Treat as place so variants like "Washington, DC" resolve consistently,
						// but avoid replacing inside media outlet names (e.g., Washington Post) via util guard
						linkKnownEntityAcrossRoot(rootEl, locationLabel, targetQid, undefined, { treatAsPlace: true })
							.then(() => { try { refreshWikipediaTooltips(rootEl); } catch {} })
							.catch(() => {});
					}
				})();
			}
		} catch {}
	});

	// Shared tooltip reference for business angle section
let businessAngleCitationTooltip = $state<SourceTooltip | undefined>();

	// Get all cited articles from business angle section
	const businessAngleCitedArticles = $derived.by(() => {
		const texts = [];
		if (story.business_angle_text) {
			texts.push(citationMapping ? replaceWithNumberedCitations(story.business_angle_text, citationMapping) : story.business_angle_text);
		}
		if (story.business_angle_points?.length > 0) {
			story.business_angle_points.forEach((point: string) => {
				texts.push(citationMapping ? replaceWithNumberedCitations(point, citationMapping) : point);
			});
		}

		const result = aggregateCitationsFromTexts(texts, citationMapping, story.articles || []);
		console.log('Business Angle Debug:', {
			texts,
			citationMapping: !!citationMapping,
			articles: story.articles?.length || 0,
			citedArticles: result.citedArticles.length,
			citedArticlesDomains: result.citedArticles.map(a => a?.domain).filter(Boolean),
			experimental: experimental.sourceIconPosition
		});
		return result;
	});

	// Get paragraph-level citations for business angle
	const businessAngleParagraphCitations = $derived.by(() => {
		const paragraphs = [];
		if (story.business_angle_text) {
			paragraphs.push({ text: story.business_angle_text });
		}
		if (story.business_angle_points?.length > 0) {
			story.business_angle_points.forEach((point: string) => {
				paragraphs.push({ text: point });
			});
		}

		// Ensure texts use numbered citations so aggregation can detect them
		const numberedParagraphs = paragraphs.map(({ text }) => ({
			text: citationMapping ? replaceWithNumberedCitations(text, citationMapping) : text
		}));

		const perParagraphCitations = aggregateCitationsPerPerspective(numberedParagraphs, citationMapping, story.articles || []);
		const result = perParagraphCitations.map((citation, index) => ({
			articles: citation.citedArticles,
			title: index === 0 && story.business_angle_text ? 'Main Text' : `Point ${index + (story.business_angle_text ? 0 : 1)}`
		}));
		
		console.log('Business Angle Paragraph Citations Debug:', {
			paragraphs: paragraphs.length,
			perParagraphCitations: perParagraphCitations.length,
			result: result.length,
			resultArticles: result.flatMap(r => r.articles).length,
			resultDomains: result.flatMap(r => r.articles).map(a => a?.domain).filter(Boolean)
		});
		
		return result;
	});

	// Business Angle layout - align spacing with StorySummary (no reserved min-height)
	const businessAngleContainerClasses = $derived('flex flex-col');
	const businessAngleContentClasses = $derived('flex-grow');
</script>

<div class="story-sections">
{#each sectionsToRender as section}
	{#if section.id === 'summary'}
		<StorySummary {story} {citationMapping} />
	{:else if section.id === 'primaryImage'}
		{@const imageArticle = story.articles?.find((a: any) => a.image)}
		{#if imageArticle}
			<StoryImage article={imageArticle} imagesPreloaded={imagesPreloaded} />
		{/if}
	{:else if section.id === 'highlights'}
		<StoryHighlights points={story.talking_points} articles={story.articles} {citationMapping} />
	{:else if section.id === 'quotes'}
		<StoryQuote 
			quote={story.quote}
			author={story.quote_author}
			attribution={story.quote_attribution}
			sourceUrl={story.quote_source_url}
			sourceDomain={story.quote_source_domain}
			articles={story.articles}
			{citationMapping}
		/>
	{:else if section.id === 'secondaryImage'}
		{@const secondaryImage = story.articles?.filter((a: any) => a.image)[1]}
		{#if secondaryImage}
			<StoryImage article={secondaryImage} imagesPreloaded={imagesPreloaded} />
		{/if}
	{:else if section.id === 'perspectives'}
		<StoryPerspectives perspectives={story.perspectives} articles={story.articles} {citationMapping} />
	{:else if section.id === 'historicalBackground'}
        <StoryTextSection 
			title={s('section.historicalBackground') || 'Historical Background'}
			content={story.historical_background}
			articles={story.articles}
            {citationMapping}
            icon={getSectionIcon('historicalBackground')}
		/>
	{:else if section.id === 'humanitarianImpact'}
        <StoryTextSection 
			title={s('section.humanitarianImpact') || 'Humanitarian Impact'}
			content={story.humanitarian_impact}
			articles={story.articles}
            {citationMapping}
            icon={getSectionIcon('humanitarianImpact')}
		/>
	{:else if section.id === 'technicalDetails'}
        <StoryListSection 
			title={s('section.technicalDetails') || 'Technical Details'}
			items={story.technical_details}
			articles={story.articles}
            {citationMapping}
            icon={getSectionIcon('technicalDetails')}
		/>
	{:else if section.id === 'businessAngle'}
    <section class="mt-6">
            <h3 class="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-800 dark:text-gray-200">
                <Icon icon={getSectionIcon('businessAngle')} class="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <span>{s('section.businessAngle') || 'Business Angle'}</span>
            </h3>
			<div class="{businessAngleContainerClasses}">
				<div class="{businessAngleContentClasses}">
					{#if story.business_angle_text}
						<p class="mb-4 text-gray-700 dark:text-gray-300">
							<CitationText 
								text={citationMapping ? replaceWithNumberedCitations(story.business_angle_text, citationMapping) : story.business_angle_text} 
								showFavicons={true} 
								showNumbers={false} 
								inline={false} 
								articles={businessAngleCitedArticles.citedArticles} 
								{citationMapping}
								citationTooltip={businessAngleCitationTooltip}
							/>
						</p>
					{/if}
					{#if story.business_angle_points?.length > 0}
						<ul class="mb-4 list-inside list-disc space-y-2 text-gray-700 dark:text-gray-300">
							{#each story.business_angle_points as point}
								<li>
									<CitationText 
										text={citationMapping ? replaceWithNumberedCitations(point, citationMapping) : point} 
										showFavicons={true} 
										showNumbers={false} 
										inline={true} 
										articles={businessAngleCitedArticles.citedArticles} 
										{citationMapping}
										citationTooltip={businessAngleCitationTooltip}
									/>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
				
				<!-- Section-level sources -->
				{#if experimental.sourceIconPosition === 'section-end'}
					<div class="mt-auto">
						<SectionSources 
							articles={businessAngleCitedArticles.citedArticles} 
							{citationMapping} 
							sectionTitle={s('section.businessAngle') || 'Business Angle'}
							paragraphCitations={businessAngleParagraphCitations}
						/>
					</div>
				{/if}
			</div>
			
		<!-- Shared Source Tooltip for Business Angle -->
			<SourceTooltip 
				bind:this={businessAngleCitationTooltip} 
				articles={businessAngleCitedArticles.citedArticles} 
				citationNumbers={businessAngleCitedArticles.citedNumbers} 
				hasCommonKnowledge={businessAngleCitedArticles.hasCommonKnowledge}
				citedItems={businessAngleCitedArticles.citedItems}
				{citationMapping}
			/>
		</section>
    {:else if section.id === 'scientificSignificance'}
        <StoryListSection 
            title={s('section.scientificSignificance') || 'Scientific Significance'}
            items={story.scientific_significance}
            articles={story.articles}
            {citationMapping}
            icon={getSectionIcon('scientificSignificance')}
        />
    {:else if section.id === 'travelAdvisory'}
        <StoryListSection 
            title={s('section.travelAdvisory') || 'Travel Advisory'}
            items={story.travel_advisory}
            articles={story.articles}
            {citationMapping}
            icon={getSectionIcon('travelAdvisory')}
        />
    {:else if section.id === 'performanceStatistics'}
        <StoryListSection 
            title={s('section.performanceStatistics') || 'Performance Statistics'}
            items={story.performance_statistics}
            articles={story.articles}
            {citationMapping}
            icon={getSectionIcon('performanceStatistics')}
        />
    {:else if section.id === 'leagueStandings'}
        <StoryTextSection 
            title={s('section.leagueStandings') || 'League Standings'}
            content={story.league_standings}
            articles={story.articles}
            {citationMapping}
            icon={getSectionIcon('leagueStandings')}
        />
    {:else if section.id === 'designPrinciples'}
        <StoryTextSection 
            title={s('section.designPrinciples') || 'Design Principles'}
            content={story.design_principles}
            articles={story.articles}
            {citationMapping}
            icon={getSectionIcon('designPrinciples')}
        />
    {:else if section.id === 'userExperienceImpact'}
        <StoryListSection 
            title={s('section.userExperienceImpact') || 'User Experience Impact'}
            items={story.user_experience_impact}
            articles={story.articles}
            {citationMapping}
            icon={getSectionIcon('userExperienceImpact')}
        />
    {:else if section.id === 'gameplayMechanics'}
        <StoryListSection 
            title={s('section.gameplayMechanics') || 'Gameplay Mechanics'}
            items={story.gameplay_mechanics}
            articles={story.articles}
            {citationMapping}
            icon={getSectionIcon('gameplayMechanics')}
        />
    {:else if section.id === 'industryImpact'}
        <StoryListSection 
            title={s('section.industryImpact') || 'Industry Impact'}
            items={story.gaming_industry_impact}
            articles={story.articles}
            {citationMapping}
            icon={getSectionIcon('industryImpact')}
        />
    {:else if section.id === 'technicalSpecifications'}
        <StoryTextSection 
            title={s('section.technicalSpecifications') || 'Technical Specifications'}
            content={story.technical_specifications}
            articles={story.articles}
            {citationMapping}
            icon={getSectionIcon('technicalSpecifications')}
        />
    {:else if section.id === 'timeline'}
        <StoryTimeline timeline={story.timeline} articles={story.articles} {citationMapping} />
    {:else if section.id === 'internationalReactions'}
        <StoryInternationalReactions reactions={story.international_reactions} articles={story.articles} {citationMapping} />
    {:else if section.id === 'suggestedQnA'}
        <StorySuggestedQnA qna={story.suggested_qna} articles={story.articles} {citationMapping} />
    {:else if section.id === 'actionItems'}
        <StoryActionItems actionItems={story.user_action_items} articles={story.articles} {citationMapping} />
    {:else if section.id === 'didYouKnow'}
        <StoryDidYouKnow content={story.did_you_know} articles={story.articles} {citationMapping} />
	{:else if section.id === 'sources'}
		<StorySources 
			domains={story.domains}
			articles={story.articles}
			{citationMapping}
			bind:showSourceOverlay
			bind:currentSource
			bind:sourceArticles
			bind:currentMediaInfo
			bind:isLoadingMediaInfo
		/>
	{/if}
{/each}

<!-- Story-end sources (only shows when position is set to 'story-end') -->
<StoryEndSources 
  {story} 
  {citationMapping}
  bind:showSourceOverlay
  bind:currentSource
  bind:sourceArticles
  bind:currentMediaInfo
  bind:isLoadingMediaInfo
/>
</div>

<style>
	.story-sections {
		cursor: default;
	}
	
	.story-sections :global(*) {
		cursor: inherit;
	}
	
	.story-sections :global(a) {
		cursor: pointer;
	}
</style> 