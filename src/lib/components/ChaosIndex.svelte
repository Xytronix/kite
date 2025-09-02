<script lang="ts">
import { s } from '$lib/client/localization.svelte';
import { fade } from 'svelte/transition';
import { createModalBehavior } from '$lib/utils/modalBehavior.svelte';
import { dataService } from '$lib/services/dataService';
import { language } from '$lib/stores/language.svelte.js';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import LottieAnimation from './LottieAnimation.svelte';

// Props
interface Props {
	score: number;
	summary: string;
	lastUpdated: string;
}

let { score, summary, lastUpdated }: Props = $props();

// State
let showModal = $state(false);
let showExplanation = $state(false);
let historicalData = $state<Array<{ date: string; score: number; summary: string }>>([]);
let isLoadingHistory = $state(false);
let chartCanvas = $state<HTMLCanvasElement>();
let chartInstance: Chart | null = null;
let isChartLoading = $state(false);
let detachChartCanvasListeners: (() => void) | null = null;
let hoveredIndex = $state<number | null>(null);
let displaySummary = $state(summary);
let summaryBox: HTMLDivElement | undefined = $state(undefined);
let lockedSummaryHeight: number | null = $state(null);
let summaryScale = $state(1);
let isSummaryExpanded = $state(false);
let summaryOverflow = $state(false);

// Utils
function formatShortDate(dateIso: string): string {
	const d = new Date(dateIso);
	return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function removeLeadingRange(text: string): string {
	return text.replace(/^\s*\d+\s*[–-]\s*\d+°\s*/u, '');
}

function parseRgba(color: string): { r: number; g: number; b: number; a: number } {
	const m = color.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\)/);
	if (!m) return { r: 0, g: 0, b: 0, a: 1 };
	return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] ? Number(m[4]) : 1 };
}

function mixRgba(c1: string, c2: string, t: number): string {
	const a = parseRgba(c1);
	const b = parseRgba(c2);
	const lerp = (x: number, y: number) => x + (y - x) * t;
	return `rgba(${Math.round(lerp(a.r, b.r))}, ${Math.round(lerp(a.g, b.g))}, ${Math.round(lerp(a.b, b.b))}, ${lerp(a.a, b.a)})`;
}

function fitSummaryText() {
	if (!summaryBox) return;
	const content = summaryBox.querySelector('.summary-content') as HTMLElement | null;
	if (!content) return;
	if (isSummaryExpanded) {
		summaryScale = 1;
		summaryOverflow = false;
		return;
	}
	// Reset to full size before measuring
	summaryScale = 1;
	const containerH = summaryBox.clientHeight;
	const contentH = content.scrollHeight;
	if (containerH > 0 && contentH > containerH) {
		const ratio = containerH / contentH;
		// Keep within [0.8, 1]
		summaryScale = Math.max(0.8, Math.min(1, ratio * 0.98));
		// Recompute after applying scale estimate
		setTimeout(() => {
			const newContentH = content.scrollHeight * summaryScale; // approximation
			summaryOverflow = newContentH > containerH + 1;
		}, 0);
	} else {
		summaryScale = 1;
		summaryOverflow = false;
	}
}

// Range toggle: 7 days, 30 days, or 365 days
let rangeDays = $state<7 | 30 | 365>(30);
let history7 = $state<Array<{ date: string; score: number; summary: string }>>([]);
let history30 = $state<Array<{ date: string; score: number; summary: string }>>([]);
let history365 = $state<Array<{ date: string; score: number; summary: string }>>([]);

// Chart scale toggle: linear or logarithmic
let isLogarithmic = $state(true);

// Modal behavior
const modal = createModalBehavior();

// Get temperature description
function getTemperatureText(): string {
	if (score <= 20) return s('worldTension.cool') || 'Cool';
	if (score <= 40) return s('worldTension.mild') || 'Mild';
	if (score <= 60) return s('worldTension.warm') || 'Warm';
	if (score <= 80) return s('worldTension.hot') || 'Hot';
	return s('worldTension.burning') || 'Burning';
}

// Get status color classes
function getStatusColor(): string {
	if (score <= 20) return 'from-blue-500 to-cyan-500';
	if (score <= 40) return 'from-green-500 to-emerald-500';
	if (score <= 60) return 'from-yellow-500 to-orange-500';
	if (score <= 80) return 'from-orange-500 to-red-500';
	return 'from-red-500 to-red-700';
}

// Import Lottie animations (these will be added from LottieFiles)
let weatherAnimations = $state<Record<string, any>>({});

// Load animations dynamically
async function loadAnimations() {
	try {
		// Import all animations
		const [snow, sunnyCloudy, storm, smallFire, bigFire] = await Promise.all([
			import('$lib/assets/lottie/snow.json'),
			import('$lib/assets/lottie/sunny-cloudy.json'),
			import('$lib/assets/lottie/storm.json'), // Storm with lightning
			import('$lib/assets/lottie/small-fire.json'), // Small fire for "very hot"
			import('$lib/assets/lottie/big-fire.json') // Big violent fire for "on fire"
		]);
		
		weatherAnimations = {
			snow: snow.default || snow,
			sunnyCloudy: sunnyCloudy.default || sunnyCloudy,
			storm: storm.default || storm,
			smallFire: smallFire.default || smallFire,
			bigFire: bigFire.default || bigFire
		};
	} catch (error) {
		console.error('Failed to load animations:', error);
	}
}

// Get weather animation based on score
function getWeatherAnimation(): string {
	if (score <= 20) return 'snow'; // Cool - peaceful/cold
	else if (score <= 40) return 'sunnyCloudy'; // Mild - partly cloudy
	else if (score <= 60) return 'storm'; // Warm - storm brewing
	else if (score <= 80) return 'smallFire'; // Hot - small fire
	else return 'bigFire'; // Burning - big fire
}

// Handle click to show modal
async function handleClick() {
	showModal = true;
	showExplanation = false;
	
	// Load animations if not already loaded
	if (Object.keys(weatherAnimations).length === 0) {
		await loadAnimations();
	}
	
	// Load historical data
	if (!isLoadingHistory && historicalData.length === 0) {
		isLoadingHistory = true;
		try {
			const data = await dataService.getChaosIndexHistory(language.data, 30);
			history30 = data;
			historicalData = data;
		} catch (error) {
			console.error('Failed to load historical data:', error);
		} finally {
			isLoadingHistory = false;
		}
	}
}

// Handle close modal
function closeModal() {
	showModal = false;
	showExplanation = false;
	if (detachChartCanvasListeners) {
		detachChartCanvasListeners();
		detachChartCanvasListeners = null;
	}
	if (chartInstance) {
		chartInstance.destroy();
		chartInstance = null;
	}
}

// Get color for a specific score
function getScoreColor(score: number): string {
	if (score <= 20) return 'rgba(59, 130, 246, 1)'; // blue
	if (score <= 40) return 'rgba(34, 197, 94, 1)'; // green
	if (score <= 60) return 'rgba(251, 191, 36, 1)'; // yellow
	if (score <= 80) return 'rgba(251, 146, 60, 1)'; // orange
	return 'rgba(239, 68, 68, 1)'; // red
}

// Get temperature text for a specific score
function getScoreTemperatureText(score: number): string {
	if (score <= 20) return 'Cool';
	if (score <= 40) return 'Mild';
	if (score <= 60) return 'Warm';
	if (score <= 80) return 'Hot';
	return 'Burning';
}

// Get temperature level (0-4) for threshold comparison
function getTemperatureLevel(score: number): number {
	if (score <= 20) return 0; // Cool
	if (score <= 40) return 1; // Mild
	if (score <= 60) return 2; // Warm
	if (score <= 80) return 3; // Hot
	return 4; // Burning
}

// Keep displayed summary in sync with hover state
$effect(() => {
	if (hoveredIndex != null && historicalData[hoveredIndex]) {
		displaySummary = historicalData[hoveredIndex].summary;
		isSummaryExpanded = false;
		setTimeout(fitSummaryText, 0);
	} else {
		displaySummary = summary;
		isSummaryExpanded = false;
		setTimeout(fitSummaryText, 0);
	}
});

// Lock summary height to avoid modal resizing on hover
$effect(() => {
	if (showModal && !showExplanation) {
		requestAnimationFrame(() => {
			if (summaryBox && lockedSummaryHeight == null) {
				lockedSummaryHeight = summaryBox.clientHeight;
				setTimeout(fitSummaryText, 0);
			}
		});
	} else if (!showModal) {
		lockedSummaryHeight = null;
		summaryScale = 1;
		isSummaryExpanded = false;
	}
});

// Create or update chart
function createChart() {
	if (!chartCanvas) {
		console.log('Chart canvas not available');
		return;
	}
	if (historicalData.length < 2) {
		console.log('Not enough historical data:', historicalData.length);
		return;
	}

	isChartLoading = true;

	if (chartInstance) {
		chartInstance.destroy();
		chartInstance = null;
	}

	const isDark = document.documentElement.classList.contains('dark');
	
	// Use only original data points (no intermediate transition points)
	const labels = historicalData.map(d => new Date(d.date));
	const values = historicalData.map(d => d.score);
	const valuesForScale = isLogarithmic ? values.map(v => Math.max(v, 1)) : values;
	const hasZero = values.some(v => v <= 0);
	const firstColor = getScoreColor(values[0]);
	const firstBg = firstColor.replace('1)', '0.1)');
	const minLogVal = Math.max(1, Math.min(...valuesForScale));
	const maxLogVal = Math.max(...valuesForScale);
	const yMinLog = Math.max(1, minLogVal / 1.25);
	const yMaxLog = maxLogVal * 1.25;
	// Dynamic linear range with padding
	const rawMin = Math.min(...values);
	const rawMax = Math.max(...values);
	const rawRange = Math.max(1, rawMax - rawMin);
	const pad = Math.max(5, rawRange * 0.15);
	const yMinLin = Math.max(0, Math.floor(rawMin - pad));
	const yMaxLin = Math.min(100, Math.ceil(rawMax + pad));

	try {
		chartInstance = new Chart(chartCanvas, {
			type: 'line',
			data: {
				labels,
				datasets: [{
					label: s('worldTension.chaosIndex') || 'Chaos Index',
					data: valuesForScale,
					borderColor: firstColor, // Will be overridden by segment gradient
					backgroundColor: firstBg,
					pointBackgroundColor: (ctx: any) => getScoreColor(values[ctx.dataIndex] ?? 0),
					pointBorderColor: (ctx: any) => getScoreColor(values[ctx.dataIndex] ?? 0),
					pointRadius: values.map(() => (historicalData.length <= 7 ? 4 : 2)),
					pointHoverRadius: 6,
					borderWidth: 2,
					tension: 0.45,
					segment: {
						borderColor: (ctx: any) => {
							const i = ctx.p0DataIndex as number;
							const start = values[i];
							const end = values[i + 1];
							if (end === undefined) return getScoreColor(start);
							// If the entire segment stays within the same threshold band, use a solid color
							const startLevel = getTemperatureLevel(start);
							const endLevel = getTemperatureLevel(end);
							if (startLevel === endLevel) {
								return getScoreColor((start + end) / 2);
							}
							// Otherwise, build a small gradient only across this segment
							const chart = ctx.chart as any;
							const yScale = chart.scales.y as any;
							const yFor = (v: number) => yScale.getPixelForValue((isLogarithmic ? Math.max(v, 1) : v) as any);
							const y0 = yFor(start);
							const y1 = yFor(end);
							const gradient = chart.ctx.createLinearGradient(0, y0, 0, y1);
							const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
							const pos = (yt: number) => {
								const d = y1 - y0;
								if (Math.abs(d) < 1e-6) return 0;
								return clamp01((yt - y0) / d);
							};
							// Start/end colors
							gradient.addColorStop(0, getScoreColor(start));
							gradient.addColorStop(1, getScoreColor(end));
							// Threshold transitions crossed by this segment
							const lo = Math.min(start, end);
							const hi = Math.max(start, end);
							for (const t of [20, 40, 60, 80]) {
								if (t <= lo || t >= hi) continue;
								const yt = yFor(t);
								const r = pos(yt);
								const d = 0.01; // small band to avoid anti-aliasing blend
								gradient.addColorStop(clamp01(r - d), getScoreColor(t - 0.001));
								gradient.addColorStop(clamp01(r + d), getScoreColor(t + 0.001));
							}
							return gradient;
						}
					}
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			devicePixelRatio: window.devicePixelRatio || 1,
			interaction: {
				mode: 'index',
				intersect: false
			},
			onHover: (_event, active) => {
				if (active && active.length > 0) {
					// Chart.js v4: active[0] has .index for dataIndex
					hoveredIndex = (active[0] as any).index ?? (active[0] as any).element?.index ?? null;
				} else {
					hoveredIndex = null;
				}
			},
			plugins: {
				legend: {
					display: false
				},
				tooltip: {
					backgroundColor: isDark ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
					titleColor: isDark ? '#e5e7eb' : '#1f2937',
					bodyColor: isDark ? '#e5e7eb' : '#1f2937',
					borderColor: isDark ? '#374151' : '#e5e7eb',
					borderWidth: 1,
					usePointStyle: true,
					displayColors: true,
					callbacks: {
						title: (context) => {
							const date = new Date(context[0].parsed.x);
							return date.toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric',
								year: 'numeric'
							});
						},
						label: (context) => {
							const idx = (context as any).dataIndex ?? 0;
							const rawScore = values[idx] ?? 0;
							const tempText = getScoreTemperatureText(rawScore);
							const base = `${s('worldTension.chaosIndex') || 'Chaos Index'}: ${rawScore}° (${tempText})`;
							if (isLogarithmic && rawScore <= 0) {
								return `${base} — shown at 1° on log scale`;
							}
							return base;
						},
						labelPointStyle: () => ({ pointStyle: 'circle', rotation: 0 })
					}
				}
			},
			scales: {
				x: {
					type: 'time',
					time: {
						unit: rangeDays === 7 ? 'day' : 'day',
						displayFormats: {
							day: rangeDays === 7 ? 'MMM d' : 'MMM d'
						}
					},
					grid: {
						color: isDark ? 'rgba(55, 65, 81, 0.3)' : 'rgba(229, 231, 235, 0.5)',
						display: true
					},
					ticks: {
						color: isDark ? '#9ca3af' : '#6b7280',
						maxRotation: 0
					}
				},
				y: {
					type: isLogarithmic ? 'logarithmic' : 'linear',
					beginAtZero: !isLogarithmic,
					min: isLogarithmic ? yMinLog : yMinLin,
					max: isLogarithmic ? yMaxLog : yMaxLin,
					bounds: 'ticks',
					grid: {
						color: isDark ? 'rgba(55, 65, 81, 0.3)' : 'rgba(229, 231, 235, 0.5)',
						display: true
					},
					ticks: {
						color: isDark ? '#9ca3af' : '#6b7280',
						maxTicksLimit: isLogarithmic ? 12 : undefined,
						callback: (value) => {
							if (isLogarithmic) {
								const v = Number(value);
								if (!isFinite(v) || v <= 0) return '';
								if (hasZero && Math.abs(v - 1) < 1e-9) return `≤1°`;
								return `${Math.round(v)}°`;
							}
							return `${value}°`;
						}
					}
				}
			}
		}
		});
		// Ensure tooltip closes when leaving the canvas and provide cleanup on destroy
		const attachCanvasListeners = (canvas: HTMLCanvasElement) => {
			const hideTooltip = () => {
				if (!chartInstance) return;
				chartInstance.setActiveElements([]);
				chartInstance.update();
				hoveredIndex = null;
			};
			canvas.addEventListener('mouseleave', hideTooltip);
			canvas.addEventListener('touchend', hideTooltip, { passive: true } as EventListenerOptions);
			canvas.addEventListener('touchcancel', hideTooltip, { passive: true } as EventListenerOptions);
			return () => {
				canvas.removeEventListener('mouseleave', hideTooltip);
				canvas.removeEventListener('touchend', hideTooltip as unknown as EventListener);
				canvas.removeEventListener('touchcancel', hideTooltip as unknown as EventListener);
			};
		};
		detachChartCanvasListeners = attachCanvasListeners(chartCanvas);
		console.log('Chart created successfully');
	} catch (error) {
		console.error('Failed to create chart:', error);
		chartInstance = null;
	} finally {
		isChartLoading = false;
	}
}

async function selectRange(days: 7 | 30 | 365) {
	if (rangeDays === days) return;
	rangeDays = days;

	if (days === 7) {
		if (history7.length > 0) {
			historicalData = history7;
			setTimeout(createChart, 0);
			return;
		}
		isLoadingHistory = true;
		try {
			const data = await dataService.getChaosIndexHistory(language.data, 7);
			history7 = data;
			historicalData = data;
		} catch (error) {
			console.error('Failed to load 7-day history:', error);
		} finally {
			isLoadingHistory = false;
		}
		setTimeout(createChart, 0);
		return;
	}

	if (days === 30) {
		if (history30.length > 0) {
			historicalData = history30;
			setTimeout(createChart, 0);
			return;
		}
		isLoadingHistory = true;
		try {
			const data = await dataService.getChaosIndexHistory(language.data, 30);
			history30 = data;
			historicalData = data;
		} catch (error) {
			console.error('Failed to load 30-day history:', error);
		} finally {
			isLoadingHistory = false;
		}
		setTimeout(createChart, 0);
		return;
	}

	// days === 365
	if (history365.length > 0) {
		historicalData = history365;
		setTimeout(createChart, 0);
		return;
	}
	isLoadingHistory = true;
	try {
		const data = await dataService.getChaosIndexHistory(language.data, 365);
		if (Array.isArray(data) && data.length >= 2) {
			history365 = data;
			historicalData = data;
		} else {
			// Not enough data; revert to 30-day view
			rangeDays = 30;
			historicalData = history30;
		}
	} catch (error) {
		console.error('Failed to load 365-day history:', error);
		// Revert to 30-day view on error
		rangeDays = 30;
		historicalData = history30;
	} finally {
		isLoadingHistory = false;
	}
	setTimeout(createChart, 0);
}



// Update chart when data changes
$effect(() => {
	if (historicalData.length >= 2 && showModal && chartCanvas) {
		// Wait for modal fade transition to finish on desktop for reliable canvas sizing
		const delay = (typeof window !== 'undefined' && window.innerWidth >= 768) ? (modal.getTransitionDuration() + 20) : 0;
		requestAnimationFrame(() => {
			setTimeout(createChart, delay);
		});
	}
});

// Apply scroll lock
$effect(() => {
	modal.applyScrollLock(showModal);
	return () => {
		// Ensure scroll is unlocked when component unmounts
		modal.applyScrollLock(false);
	};
});

// Toggle explanation
function toggleExplanation() {
	showExplanation = !showExplanation;
}
</script>

<svelte:window onkeydown={(e) => modal.handleKeydown(e, showModal, closeModal)} />

<!-- Icon Button -->
{#if score > 0}
	<button
		onclick={handleClick}
		class="flex items-center gap-1.5 rounded-md px-1.5 py-2 md:px-2 md:py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
		title="World Tension: {score}° - {getTemperatureText()}"
		aria-label="Show world tension details"
	>
		<!-- Modern status circle -->
		<div class="h-3 w-3 rounded-full bg-gradient-to-r {getStatusColor()} shadow-sm"></div>
		
		<!-- Text -->
		<span>
			{getTemperatureText()}
		</span>
	</button>
{/if}

<!-- Modal -->
{#if showModal}
	<div 
		class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 md:p-4 dark:bg-black/80"
		onclick={(e) => modal.handleBackdropClick(e, closeModal)}
		onkeydown={(e) => e.key === 'Escape' && closeModal()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="chaos-title"
		tabindex="-1"
		transition:fade={{ duration: modal.getTransitionDuration() }}
	>
		<div 
			class="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-xl md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-lg dark:bg-gray-800"
			transition:fade={{ duration: modal.getTransitionDuration() }}
		>
				<!-- Header -->
				<div class="flex flex-shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<h3 id="chaos-title" class="text-lg font-semibold text-gray-900 dark:text-white">
						{s('worldTension.title') || 'Global Stability Index'}
					</h3>
					<button
						onclick={closeModal}
						class="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
						aria-label="Close dialog"
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<!-- Content -->
				<main class="flex-1 p-0">
					<div class="h-full w-full overflow-hidden" data-overlayscrollbars-initialize>
						<div class="px-7 py-6">
					{#if !showExplanation}
						<!-- Current Status -->
						{@const animationKey = getWeatherAnimation()}
						<div class="mb-6 flex items-center justify-between">
							<div>
								<div class="flex items-baseline gap-3">
									<span class="text-4xl font-bold text-gray-900 dark:text-white">{score}°</span>
									<span class="text-lg font-medium text-gray-600 dark:text-gray-400">{getTemperatureText()}</span>
								</div>
								<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
									{s('worldTension.updated') || 'Updated'} {new Date(lastUpdated).toLocaleDateString('en-US', { 
										month: 'short', 
										day: 'numeric', 
										hour: 'numeric', 
										minute: '2-digit' 
									})}
								</p>
							</div>
							<div class="flex h-20 w-20 items-center justify-center">
								<!-- Lottie Weather Animation -->
								{#if weatherAnimations[animationKey]}
									<LottieAnimation 
										animationData={weatherAnimations[animationKey]}
										width={80}
										height={80}
										loop={true}
										autoplay={true}
										loopFrameOffset={animationKey === 'bigFire' ? 2 : animationKey === 'smallFire' ? 1 : 0}
									/>
								{:else}
									<!-- Fallback loading state -->
									<div class="h-14 w-14 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"></div>
								{/if}
							</div>
						</div>

						<!-- Progress Bar -->
						<div class="mb-6">
							<div class="relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
								<div class="absolute inset-0 bg-gradient-to-r from-blue-500 via-yellow-500 to-red-500 opacity-30"></div>
								<div class="absolute left-0 h-full bg-gradient-to-r {getStatusColor()} transition-all duration-300"
									style="width: {score}%">
								</div>
								<div class="absolute h-full w-0.5 bg-gray-900 dark:bg-white"
									style="left: {score}%">
								</div>
							</div>
							<div class="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
								<span>0</span>
								<span>50</span>
								<span>100</span>
							</div>
						</div>

						<!-- Learn More Button -->
						<div class="mb-6 text-center">
							<button
								onclick={toggleExplanation}
								class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
							>
								{s('worldTension.whatIsThis') || 'What is this?'}
							</button>
						</div>

							<!-- Historical Chart (moved up) -->
						{#if historicalData.length >= 2}
							<div class="mb-6">
								<div class="mb-3 space-y-2">
									<div class="flex items-start justify-between gap-2">
										<div class="flex-1 min-w-0">
											<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
												{rangeDays === 7 ? '7-Day Trend' : rangeDays === 30 ? (s('worldTension.trendTitle') || '30-Day Trend') : '1-Year Trend'}
												{hoveredIndex != null && historicalData[hoveredIndex] ? ` — ${formatShortDate(historicalData[hoveredIndex].date)}` : ''}
											</h4>
											<span class="text-xs text-gray-500 dark:text-gray-400">({historicalData.length} points)</span>
										</div>
										<div class="flex items-center gap-2 flex-shrink-0">
											<button
												onclick={() => selectRange(7)}
												class="rounded-md px-2 py-1 text-xs font-medium transition-colors border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 {rangeDays === 7 ? 'bg-gray-100 dark:bg-gray-700' : ''}"
												aria-pressed={rangeDays === 7}
											>
												7d
											</button>
											<button
												onclick={() => selectRange(30)}
												class="rounded-md px-2 py-1 text-xs font-medium transition-colors border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 {rangeDays === 30 ? 'bg-gray-100 dark:bg-gray-700' : ''}"
												aria-pressed={rangeDays === 30}
											>
												30d
											</button>
											<button
												onclick={() => selectRange(365)}
												class="rounded-md px-2 py-1 text-xs font-medium transition-colors border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 {rangeDays === 365 ? 'bg-gray-100 dark:bg-gray-700' : ''}"
												aria-pressed={rangeDays === 365}
											>
												1y
											</button>
										</div>
									</div>
								</div>
								<div class="mb-3 flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span class="text-xs text-gray-500 dark:text-gray-400">Scale:</span>
										<button
											onclick={() => { isLogarithmic = !isLogarithmic; setTimeout(createChart, 0); }}
											class="rounded-md px-2 py-1 text-xs font-medium transition-colors border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 {isLogarithmic ? 'bg-gray-100 dark:bg-gray-700' : ''}"
											aria-pressed={isLogarithmic}
											title={isLogarithmic ? 'Switch to linear scale' : 'Switch to logarithmic scale'}
										>
											{isLogarithmic ? 'Log' : 'Linear'}
										</button>
									</div>
								</div>
								<div class="relative h-48 rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
									<canvas bind:this={chartCanvas} class="h-full w-full"></canvas>
									{#if isChartLoading}
										<div class="absolute inset-4 flex items-center justify-center bg-gray-50/80 dark:bg-gray-800/80">
											<div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
												<div class="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
												Loading chart...
											</div>
										</div>
									{/if}
								</div>
							</div>
						{:else if isLoadingHistory}
							<div class="mb-6">
								<div class="h-24 rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
									<div class="flex h-full items-center justify-center">
										<div class="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
									</div>
								</div>
							</div>
						{/if}

						<!-- Summary -->
						{@const [tempPart, ...restParts] = displaySummary.split('. ')}
						{@const restText = restParts.join('. ')}
						<div bind:this={summaryBox} class="mb-6 rounded-lg bg-gray-50 px-6 py-5 dark:bg-gray-800/50 overflow-hidden" style="height: {isSummaryExpanded ? 'auto' : (lockedSummaryHeight != null ? lockedSummaryHeight + 'px' : 'auto')}">
							<div class="space-y-2 summary-content">
								<p class="text-base font-medium leading-relaxed text-gray-900 dark:text-gray-100" style="font-size: calc(1rem * {summaryScale}); line-height: calc(1.5rem * {summaryScale}); word-break: break-word; overflow-wrap: anywhere; hyphens: auto;">
									{tempPart}.
								</p>
								{#if restText}
									<p class="text-sm leading-relaxed text-gray-600 dark:text-gray-400" style="font-size: calc(0.875rem * {summaryScale}); line-height: calc(1.375rem * {summaryScale}); word-break: break-word; overflow-wrap: anywhere; hyphens: auto;">
										{restText}
									</p>
								{/if}
							</div>
							{#if summaryOverflow || isSummaryExpanded}
								<div class="mt-3 text-right">
									<button class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" onclick={() => { isSummaryExpanded = !isSummaryExpanded; setTimeout(fitSummaryText, 0); }}>
										{isSummaryExpanded ? 'Show less' : 'Show more'}
									</button>
								</div>
							{/if}
						</div>


					{:else}
						<!-- Explanation -->
						<div>
							<button
								onclick={toggleExplanation}
								class="mb-4 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
							>
								← Back
							</button>
							
							<div class="space-y-4">
								<p class="text-sm text-gray-600 dark:text-gray-400" style="word-break: break-word; overflow-wrap: anywhere; hyphens: auto;">
									{s('worldTension.explanation1') || 'The Global Stability Index analyzes world news to measure geopolitical tensions and stability.'}
								</p>
								
								<!-- Modern scale indicators -->
								<div class="space-y-2 text-sm">
									<div class="flex items-center gap-3">
										<div class="h-3 w-3 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 shadow-sm"></div>
											<span class="text-xs font-medium text-gray-500 dark:text-gray-400 inline-block w-16">0–20°</span>
											<span class="text-gray-600 dark:text-gray-400" style="word-break: break-word; overflow-wrap: anywhere; hyphens: auto;">{removeLeadingRange(s('worldTension.scale.cool') || '0-20° Cool - Calm period, routine activity')}</span>
									</div>
									<div class="flex items-center gap-3">
										<div class="h-3 w-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 shadow-sm"></div>
											<span class="text-xs font-medium text-gray-500 dark:text-gray-400 inline-block w-16">21–40°</span>
											<span class="text-gray-600 dark:text-gray-400" style="word-break: break-word; overflow-wrap: anywhere; hyphens: auto;">{removeLeadingRange(s('worldTension.scale.mild') || '21-40° Mild - Normal global tensions')}</span>
									</div>
									<div class="flex items-center gap-3">
										<div class="h-3 w-3 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 shadow-sm"></div>
											<span class="text-xs font-medium text-gray-500 dark:text-gray-400 inline-block w-16">41–60°</span>
											<span class="text-gray-600 dark:text-gray-400" style="word-break: break-word; overflow-wrap: anywhere; hyphens: auto;">{removeLeadingRange(s('worldTension.scale.warm') || '41-60° Warm - Elevated concerns')}</span>
									</div>
									<div class="flex items-center gap-3">
										<div class="h-3 w-3 rounded-full bg-gradient-to-r from-orange-500 to-red-500 shadow-sm"></div>
											<span class="text-xs font-medium text-gray-500 dark:text-gray-400 inline-block w-16">61–80°</span>
											<span class="text-gray-600 dark:text-gray-400" style="word-break: break-word; overflow-wrap: anywhere; hyphens: auto;">{removeLeadingRange(s('worldTension.scale.hot') || '61-80° Hot - Serious situations')}</span>
									</div>
									<div class="flex items-center gap-3">
										<div class="h-3 w-3 rounded-full bg-gradient-to-r from-red-500 to-red-700 shadow-sm"></div>
											<span class="text-xs font-medium text-gray-500 dark:text-gray-400 inline-block w-16">81–100°</span>
											<span class="text-gray-600 dark:text-gray-400" style="word-break: break-word; overflow-wrap: anywhere; hyphens: auto;">{removeLeadingRange(s('worldTension.scale.burning') || '81-100° Burning - Extreme crisis (rare)')}</span>
										</div>
									</div>
								</div>
							</div>
						{/if}
						</div>
					</div>
				</main>
			</div>
	</div>
{/if} 