<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import { browser } from '$app/environment';
import { scrollLock } from '$lib/utils/scrollLock';

// Props
interface Props {
	visible?: boolean;
	onClose?: () => void;
}

let { visible = false, onClose }: Props = $props();

// Scrollable element reference
let scrollableElement: HTMLElement | undefined = $state(undefined);

function handleClose() {
	// Close the intro screen without altering the document scroll position
	if (onClose) onClose();
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape' && visible) {
		handleClose();
	}
}

function handleBackdropClick(e: MouseEvent) {
	// Only close if clicking the backdrop itself, not the modal content
	if (e.target === e.currentTarget) {
		handleClose();
	}
}

function handleBackdropKeydown(e: KeyboardEvent) {
	// Handle keyboard interaction for backdrop
	if (e.key === 'Enter' || e.key === ' ') {
		e.preventDefault();
		if (e.target === e.currentTarget) {
			handleClose();
		}
	}
}

function handleWheel(e: WheelEvent) {
	// Allow scrolling within the modal content, but prevent it from bubbling to the background
	const target = e.currentTarget as HTMLElement;
	const { scrollTop, scrollHeight, clientHeight } = target;
	
	// If we're at the top and trying to scroll up, or at the bottom and trying to scroll down,
	// prevent the event to stop background scrolling
	if ((scrollTop === 0 && e.deltaY < 0) || (scrollTop + clientHeight >= scrollHeight && e.deltaY > 0)) {
		e.preventDefault();
	}
}

// Close on escape key and toggle body scroll lock
$effect(() => {
	if (!browser) return;

	if (visible) {
		document.addEventListener('keydown', handleKeydown);
		// Lock background scroll using the shared utility (works with OverlayScrollbars)
		scrollLock.lock();
	} else {
		document.removeEventListener('keydown', handleKeydown);
		scrollLock.unlock();
	}

	return () => {
		document.removeEventListener('keydown', handleKeydown);
		scrollLock.unlock();
	};
});

// No third-party scrollbar; native scrolling is fine for this modal
</script>

{#if visible}
	<div 
		bind:this={scrollableElement}
		class="fixed inset-0 z-[3000] overflow-y-auto" 
		data-overlayscrollbars-initialize
		onclick={handleBackdropClick}
		onkeydown={handleBackdropKeydown}
		onwheel={handleWheel}
		role="dialog"
		aria-modal="true"
		aria-labelledby="intro-title"
		tabindex="0"
	>
		<div class="flex min-h-full items-center justify-center p-4 sm:p-8">
			<div class="w-full max-w-3xl rounded-lg bg-white p-8 dark:bg-gray-800">
				<div class="mb-8 flex items-start justify-between">
					<div class="w-full">
						<h1 id="intro-title" class="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
							{s('app.title') || 'Kite'}
						</h1>
						<p class="text-gray-600 dark:text-gray-300">
							{s('about.subtitle') || 'News app by Kagi'}
						</p>
					</div>
				</div>

				<div class="space-y-6 text-gray-700 dark:text-gray-300">
					<section>
						<h2 class="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
							{@html s('about.why.title') || 'Why Kite?'}
						</h2>
						<p class="mb-4">
							{@html s('about.why.description') || 'Kite provides a better way to read news.'}
						</p>
					</section>
					
					<section>
						<h2 class="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
							{@html s('about.approach.title') || 'Our Approach'}
						</h2>
						<p class="mb-4 text-gray-700 dark:text-gray-300">
							{@html s('about.approach.description1') || 'We aggregate news from multiple sources.'}
						</p>
						<p class="mb-4 text-gray-700 dark:text-gray-300">
							{@html s('about.approach.description2') || 'We provide summaries and context.'}
						</p>
						<p class="mb-4 text-gray-700 dark:text-gray-300">
							{@html s('about.approach.description3') || 'We respect your privacy.'}
						</p>
					</section>

					<section>
						<h2 class="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
							{@html s('about.principles.title') || 'Our Principles'}
						</h2>
						<ul class="space-y-2">
							<li>• {s('about.principles.item1') || 'No tracking or cookies'}</li>
							<li>• {s('about.principles.item2') || 'No ads or sponsored content'}</li>
							<li>• {s('about.principles.item3') || 'Multiple perspectives'}</li>
							<li>• {s('about.principles.item4') || 'Source transparency'}</li>
							<li>• {s('about.principles.item5') || 'Fast and lightweight'}</li>
							<li>• {s('about.principles.item6') || 'Open source'}</li>
						</ul>
					</section>
					
					<section>
						<h2 class="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
							{@html s('about.customization.title') || 'Customization'}
						</h2>
						<p>{@html s('about.customization.description') || 'Customize Kite to fit your reading preferences.'}</p>
					</section>
					
					<section>
						<h2 class="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
							{@html s('about.contact.title') || 'Contact'}
						</h2>
						<p>{@html s('about.contact.description') || 'Questions or feedback? Contact us at news@kagi.com'}</p>
					</section>

					<!-- Disclaimer -->
					<section class="mt-6 rounded-lg bg-gray-100 dark:bg-gray-700 p-4">
						<p class="text-sm text-gray-600 dark:text-gray-400 text-center">
							{s('app.disclaimerAutoGenerated') || 'Summaries are AI-generated and Kite can make mistakes.'}
							{' '}
							{s('app.disclaimerVerify') || 'Please verify important information.'}
						</p>
					</section>

					<div class="mt-8 flex justify-center">
						<button
							onclick={handleClose}
							class="group inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white bg-gradient-to-r from-gray-700 via-gray-600 to-gray-800 hover:from-gray-700 hover:to-gray-700 dark:from-gray-600 dark:via-gray-600 dark:to-gray-700 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 transition-all"
							aria-label={s('article.closeStory') || 'Close'}
						>
							<span>{s('article.closeStory') || 'Close'}</span>
							<svg class="h-4 w-4 opacity-90 group-hover:rotate-90 transition-transform" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
								<path d="M10 8.586l4.95-4.95a1 1 0 1 1 1.414 1.414L11.414 10l4.95 4.95a1 1 0 1 1-1.414 1.414L10 11.414l-4.95 4.95a1 1 0 0 1-1.414-1.414L8.586 10l-4.95-4.95A1 1 0 0 1 5.05 3.636L10 8.586z"/>
							</svg>
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if} 