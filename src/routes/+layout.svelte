<script lang="ts">
import { onMount, type Snippet } from 'svelte';
import { browser } from '$app/environment';
import { theme } from '$lib/stores/theme.svelte.js';
import { PUBLIC_MAINTENANCE_MODE, PUBLIC_MAINTENANCE_START, PUBLIC_MAINTENANCE_END, PUBLIC_MAINTENANCE_AUTO, PUBLIC_MAINTENANCE_MESSAGE } from '$env/static/public';
import SplashScreen from '$lib/components/SplashScreen.svelte';
import MaintenanceScreen from '$lib/components/MaintenanceScreen.svelte';
import { page } from '$app/stores';
import { language } from '$lib/stores/language.svelte.js';
import { categories } from '$lib/stores/categories.svelte.js';
import { settings } from '$lib/stores/settings.svelte.js';
import { experimental } from '$lib/stores/experimental.svelte.js';
import { locationService } from '$lib/services/locationService';
import { useOverlayScrollbars } from 'overlayscrollbars-svelte';
import 'overlayscrollbars/overlayscrollbars.css';
import '../styles/index.css';
import type { PageData } from './$types';

// Props from layout load
let { data, children }: {data: PageData, children: Snippet } = $props();

// Maintenance flag (reactive)
const maintenanceActive = $derived.by(() => {
    const pg = $page;
    
    // Manual override via localStorage only (remove ?maintenance=1 support)
    const localMaintenance = browser && typeof localStorage !== 'undefined' && localStorage.getItem('kite-maintenance') === 'true';

    if (localMaintenance) {
        return true;
    }
    
    // Use server-side determination as primary source
    const serverMaintenance = data.maintenanceMode;
    
    // Client-side fallback logic
    const maintenanceAuto = data.maintenanceAuto || PUBLIC_MAINTENANCE_AUTO === 'true';
    const now = new Date();
    const maintenanceStart = data.maintenanceStart || PUBLIC_MAINTENANCE_START;
    const maintenanceEnd = data.maintenanceEnd || PUBLIC_MAINTENANCE_END;
    
    if (maintenanceStart && maintenanceEnd) {
        const startTime = new Date(maintenanceStart);
        const endTime = new Date(maintenanceEnd);
        const hasStarted = now >= startTime;
        const hasEnded = now >= endTime;

        // If the entire window is already in the past, fall back to manual settings
        if (hasStarted && hasEnded) {
            const envMaintenance = PUBLIC_MAINTENANCE_MODE === 'true';
            return serverMaintenance || envMaintenance;
        }

        if (maintenanceAuto) {
            // AUTO=true: Automatically start AND end based on dates
            return hasStarted && !hasEnded;
        } else {
            // AUTO=false: Start based on dates, but don't auto-end
            if (hasStarted) {
                // Once started, stay in maintenance mode regardless of end time
                // Only manual intervention can end it
                return true;
            } else {
                // Before start time – use manual setting
                const envMaintenance = PUBLIC_MAINTENANCE_MODE === 'true';
                return serverMaintenance || envMaintenance;
            }
        }
    }
    
    // Fallback to manual mode
    const envMaintenance = PUBLIC_MAINTENANCE_MODE === 'true';
    
    return serverMaintenance || envMaintenance;
});

// Animated progress for maintenance screen with countdown
let maintenanceProgress = $state(0);
let countdownPercentage = $state(0);

// Function to format timestamp in friendly language
function formatFriendlyTime(timestamp: string): { text: string; boldPart: string } {
    const targetDate = new Date(timestamp);
    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();
    
    if (diffMs <= 0) return { text: 'now', boldPart: 'now' };
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Get day of week
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDay = dayNames[targetDate.getDay()];
    const currentDay = dayNames[now.getDay()];
    
    // Format time in UTC
    const timeStr = targetDate.toLocaleTimeString('en-US', { 
        timeZone: 'UTC', 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const utcTime = `${timeStr} UTC`;
    
    if (diffDays === 0) {
        const boldPart = `today ${utcTime}`;
        return { text: boldPart, boldPart };
    } else if (diffDays === 1) {
        const boldPart = `tomorrow ${utcTime}`;
        return { text: boldPart, boldPart };
    } else if (diffDays <= 7) {
        // This week - just use day name
        const boldPart = `${targetDay} ${utcTime}`;
        return { text: boldPart, boldPart };
    } else if (diffDays <= 14) {
        // Next week - use "next [day]"
        const boldPart = `next ${targetDay} ${utcTime}`;
        return { text: boldPart, boldPart };
    } else {
        // Further out - use date format
        const dateStr = targetDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: targetDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
        const boldPart = `${dateStr} ${utcTime}`;
        return { text: boldPart, boldPart };
    }
}

// Reactive maintenance progress tracking
let maintenanceInterval: ReturnType<typeof setInterval> | undefined;

$effect(() => {
    // Clear any existing interval
    if (maintenanceInterval) {
        clearInterval(maintenanceInterval);
        maintenanceInterval = undefined;
    }
    
    if (maintenanceActive) {
        maintenanceInterval = setInterval(() => {
            const maintenanceStart = data.maintenanceStart || PUBLIC_MAINTENANCE_START;
            const maintenanceEnd = data.maintenanceEnd || PUBLIC_MAINTENANCE_END;
            
            if (maintenanceStart && maintenanceEnd) {
                // Calculate progress percentage from 0% to 100%
                const now = new Date().getTime();
                const startTime = new Date(maintenanceStart).getTime();
                const endTime = new Date(maintenanceEnd).getTime();
                const totalDuration = endTime - startTime;
                const elapsed = now - startTime;
                
                if (elapsed <= 0) {
                    // Maintenance hasn't started yet
                    countdownPercentage = 0;
                    maintenanceProgress = 0;
                } else if (elapsed >= totalDuration) {
                    // Maintenance should be over
                    countdownPercentage = 100;
                    maintenanceProgress = 100;
                } else {
                    // Calculate progress percentage (0% at start, 100% at end)
                    const progressPercentage = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
                    countdownPercentage = progressPercentage;
                    
                    // Smooth oscillating progress around the actual percentage
                    maintenanceProgress = progressPercentage + Math.sin(Date.now() / 3000) * 3;
                }
            } else {
                // Fallback to oscillating progress between 50-80%
                maintenanceProgress = 65 + Math.sin(Date.now() / 3000) * 15;
                countdownPercentage = 65;
            }
        }, 50);
    }
    
    // Cleanup function
    return () => {
        if (maintenanceInterval) {
            clearInterval(maintenanceInterval);
        }
    };
});

const maintenanceMessage = (data.maintenanceMessage || PUBLIC_MAINTENANCE_MESSAGE) 
    ? (data.maintenanceMessage || PUBLIC_MAINTENANCE_MESSAGE)
    : (data.maintenanceEnd || PUBLIC_MAINTENANCE_END)
        ? `We are working hard to bring you exciting new features!`
        : "We are making some exciting improvements to bring you an even better experience. Please check back soon!";

const maintenanceTimestamp = (data.maintenanceEnd || PUBLIC_MAINTENANCE_END)
    ? formatFriendlyTime(data.maintenanceEnd || PUBLIC_MAINTENANCE_END)
    : null;

import { s } from '$lib/client/localization.svelte';

// Initialize OverlayScrollbars at component level (not in onMount)
let overlayScrollbarsInitialized = $state(false);

// OverlayScrollbars setup with mobile-specific options
const [initializeOverlayScrollbars] = useOverlayScrollbars({
	defer: true,
	options: {
		scrollbars: {
			visibility: browser && window.innerWidth < 768 ? 'hidden' : 'auto'
		}
	}
});

onMount(async () => {
	// Initialize all stores
	theme.init();
	
	// Initialize language with location-based defaults on first visit
	try {
		const locationInfo = await locationService.detectLocation();
		language.initWithLocationDefaults(
			data.strings, 
			locationInfo.suggestedUILanguage, 
			locationInfo.suggestedDataLanguage
		);
	} catch (error) {
		console.warn('Failed to detect location for language initialization:', error);
		language.init(data.strings);
	}
	
	categories.init();
	settings.init();
	experimental.init();

	// Clear stale local maintenance override if site is no longer in maintenance
	if (browser) {
		const localFlag = localStorage.getItem('kite-maintenance');
		const envMaintenance = PUBLIC_MAINTENANCE_MODE === 'true' || data.maintenanceMode;
		if (localFlag === 'true' && !envMaintenance) {
			localStorage.removeItem('kite-maintenance');
		}
	}
	
	// Initialize OverlayScrollbars on the body element
	if (browser && document.body && !overlayScrollbarsInitialized) {
		// Add the initialization attribute to prevent flickering
		document.body.setAttribute('data-overlayscrollbars-initialize', '');
		document.documentElement.setAttribute('data-overlayscrollbars-initialize', '');
		
		// Initialize OverlayScrollbars on the body
		initializeOverlayScrollbars(document.body);
		overlayScrollbarsInitialized = true;
	}
});

// Update title and load new strings when language changes
$effect(() => {
	if (browser) {
		const title = s('app.title');
		const motto = s('app.motto');
		document.title = `${title} - ${motto}`;
		
		const lang = language.ui;
		const targetLang = lang === 'default' ? navigator.language.split('-')[0] : lang;

		if (targetLang !== language.locale) {
			language.loadNewStrings(targetLang);
		}
	}
});
</script>

{#if maintenanceActive}
		  <MaintenanceScreen />
{:else}
		  {@render children()}
{/if}