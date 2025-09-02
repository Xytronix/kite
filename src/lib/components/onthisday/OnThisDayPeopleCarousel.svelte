<script lang="ts">
import { browser } from '$app/environment';
import type { OnThisDayEvent } from '$lib/types';
import { s } from '$lib/client/localization.svelte';
import { batchService } from '$lib/services/batchService';
import { fetchWikipediaContent, extractWikipediaIdsFromContent } from '$lib/services/wikipediaService';

interface Props {
	people: OnThisDayEvent[];
}

let { people }: Props = $props();

// People images cache (for carousel)
let peopleImagesCache = new Map<string, string>();
let imagesLoaded = $state(0); // Counter to trigger reactivity when images load

// People carousel state
let currentSlide = $state(0);
const itemsPerSlide = 3;
const chunkedPeople = $derived(
	people.reduce((chunks: OnThisDayEvent[][], item: OnThisDayEvent, index: number) => {
		const chunkIndex = Math.floor(index / itemsPerSlide);
		if (!chunks[chunkIndex]) chunks[chunkIndex] = [];
		chunks[chunkIndex].push(item);
		return chunks;
	}, [])
);

// Preload Wikipedia thumbnails for people (for carousel images)
async function preloadPeopleImages() {
	if (people.length === 0) return;
	
	// Skip preloading in time travel mode
	if (batchService.isTimeTravelMode()) return;
	

	
	const imagePromises = people.map(async (person, index) => {
		// Extract Wikipedia IDs from the person's content using improved extraction
		const wikiIds = extractWikipediaIdsFromContent(person.content);
		if (wikiIds.length === 0) {
			return;
		}
		
		const wikiId = wikiIds[0]; // Use the first Wikipedia ID found
		
		try {
			// fetchWikipediaContent now handles Q-IDs and accented characters properly
			console.debug('Loading Wikipedia content for OnThisDay person:', wikiId, 'from content:', person.content.substring(0, 100) + '...');
			const data = await fetchWikipediaContent(wikiId);
			if (data?.thumbnail?.source) {
				const cacheKey = person.year + person.content;
				peopleImagesCache.set(cacheKey, data.thumbnail.source);
				imagesLoaded++; // Trigger reactivity
				console.debug('Successfully loaded thumbnail for:', wikiId, 'URL:', data.thumbnail.source);
			}
		} catch (error) {
			console.debug('Failed to load Wikipedia content for OnThisDay person:', wikiId, error);
		}
	});
	
	await Promise.allSettled(imagePromises);
}

// Get cached image for a person (reactive to imagesLoaded)
function getPersonImage(person: OnThisDayEvent): string {
	// Reference imagesLoaded to trigger reactivity when images load
	imagesLoaded;
	const cacheKey = person.year + person.content;
	const cached = peopleImagesCache.get(cacheKey);
	return cached || null;
}

// Generate initials from person's name for fallback
function getPersonInitials(person: OnThisDayEvent): string {
	// Extract name from the content (look for the first link text)
	const linkMatch = person.content.match(/<a[^>]*>([^<]+)<\/a>/);
	if (linkMatch) {
		const name = linkMatch[1];
		const words = name.split(' ').filter(word => word.length > 0);
		if (words.length >= 2) {
			return (words[0][0] + words[words.length - 1][0]).toUpperCase();
		} else if (words.length === 1) {
			return words[0].substring(0, 2).toUpperCase();
		}
	}
	return '??';
}

// Generate a consistent color based on the person's name
function getPersonColor(person: OnThisDayEvent): string {
	const linkMatch = person.content.match(/<a[^>]*>([^<]+)<\/a>/);
	const name = linkMatch ? linkMatch[1] : person.content;
	
	// Simple hash function to generate consistent colors
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}
	
	// Generate pleasant colors (avoiding too dark or too light)
	const colors = [
		'#3B82F6', // blue
		'#10B981', // emerald
		'#8B5CF6', // violet
		'#F59E0B', // amber
		'#EF4444', // red
		'#06B6D4', // cyan
		'#84CC16', // lime
		'#F97316', // orange
		'#EC4899', // pink
		'#6366F1', // indigo
	];
	
	return colors[Math.abs(hash) % colors.length];
}

// Carousel functions
function nextSlide() {
	if (currentSlide < chunkedPeople.length - 1) {
		currentSlide++;
	}
}

function prevSlide() {
	if (currentSlide > 0) {
		currentSlide--;
	}
}

function goToSlide(index: number) {
	currentSlide = index;
}

// Handle pagination dot keyboard events
function handleDotKeydown(event: KeyboardEvent, index: number) {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		goToSlide(index);
	}
}

// Wheel navigation
function handleWheel(event: WheelEvent) {
	event.preventDefault();
	if (event.deltaX > 0) {
		nextSlide();
	} else if (event.deltaX < 0) {
		prevSlide();
	}
}

// Setup function to run when props change
function setup(props: Props) {
	if (browser && props.people.length > 0) {
		preloadPeopleImages();
	}
}
$effect(() => setup({ people }));
</script>

<div>
	<h3 class="mb-4 text-2xl font-bold text-gray-700 dark:text-gray-300">
		{s('onthisday.people') || 'People'}
	</h3>

	<!-- Carousel for Desktop -->
	<div class="relative hidden md:block">
		<!-- Left Arrow -->
		{#if currentSlide > 0}
			<button
				class="absolute top-1/2 left-[-2rem] -translate-y-1/2 cursor-pointer rounded px-2 py-1 text-gray-400 transition-colors hover:text-gray-600 focus-visible-ring dark:text-gray-500 dark:hover:text-gray-300"
				onclick={prevSlide}
				aria-label="Previous slide"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2.5"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</button>
		{/if}

		<!-- Slides Wrapper -->
		<div class="overflow-hidden" onwheel={handleWheel}>
			<div
				class="flex transition-transform duration-300 ease-out"
				style="transform: translateX(-{currentSlide * 100}%)"
			>
				{#each chunkedPeople as slide}
					<div class="flex w-full shrink-0 justify-around">
						{#each slide as person, index}
							<div class="relative flex w-1/3 flex-col items-center px-4 text-center">
								<!-- Vertical separator -->
								{#if index < slide.length - 1}
									<div class="absolute top-0 right-0 h-full w-[1px] bg-[var(--color-header)]"></div>
								{/if}

								<!-- Year -->
								<span class="mr-auto mb-2 text-2xl font-bold text-[var(--color-header)]">
									{person.year}
								</span>

								<!-- Image + Text -->
								<div class="flex items-start gap-4">
									{#if getPersonImage(person)}
										<!-- Try to load image first -->
										<img
											class="h-10 w-10 flex-shrink-0 rounded-full object-cover"
											src={getPersonImage(person)}
											alt="Person"
											onerror={(e) => {
												const target = e.target as HTMLImageElement;
												target.style.display = 'none';
												(target.nextElementSibling as HTMLElement)!.style.display = 'flex';
											}}
										/>
										<!-- Fallback avatar (hidden by default) -->
										<div 
											class="h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center text-white text-xs font-semibold"
											style="background-color: {getPersonColor(person)}; display: none;"
										>
											{getPersonInitials(person)}
										</div>
									{:else}
										<!-- Initial avatar fallback -->
										<div 
											class="h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center text-white text-xs font-semibold"
											style="background-color: {getPersonColor(person)}"
										>
											{getPersonInitials(person)}
										</div>
									{/if}
									<span class="text-left text-sm text-gray-700 dark:text-gray-300">
										{@html person.content.replace(/href=/g, 'class="underline text-gray-800 hover:text-gray-600 cursor-pointer transition-colors dark:text-gray-200 dark:hover:text-gray-400" href=')}
									</span>
								</div>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		</div>

		<!-- Right Arrow -->
		{#if currentSlide < chunkedPeople.length - 1}
			<button
				class="absolute top-1/2 right-[-2rem] -translate-y-1/2 cursor-pointer rounded px-2 py-1 text-gray-400 transition-colors hover:text-gray-600 focus-visible-ring dark:text-gray-500 dark:hover:text-gray-300"
				onclick={nextSlide}
				aria-label="Next slide"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2.5"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
				</svg>
			</button>
		{/if}

		<!-- Dots Pagination -->
		{#if chunkedPeople.length > 1}
			<div class="mt-4 flex justify-center space-x-2">
				{#each chunkedPeople as _, i}
					<button
						class="h-2 w-2 rounded-full transition-colors focus-visible-ring {currentSlide === i
							? 'bg-gray-600 dark:bg-gray-400'
							: 'bg-gray-300 dark:bg-gray-600'}"
						onclick={() => goToSlide(i)}
						onkeydown={(e) => handleDotKeydown(e, i)}
						aria-label={`Go to slide ${i + 1}`}
					></button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- List for Mobile -->
	<div class="block md:hidden">
		{#each people as person}
			<div class="mb-4 flex items-start gap-4">
				<!-- Year -->
				<span class="text-2xl font-bold text-[var(--color-header)]">
					{person.year}
				</span>
				<!-- Content -->
				<span class="text-sm text-gray-700 dark:text-gray-300">
					{@html person.content.replace(/href=/g, 'class="underline text-gray-800 hover:text-gray-600 cursor-pointer transition-colors dark:text-gray-200 dark:hover:text-gray-400" href=')}
				</span>
			</div>
		{/each}
	</div>
</div>