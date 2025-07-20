<script lang="ts">
/**
 * MaintenanceScreen Component
 * 
 * Time Manipulation Prevention Strategies:
 * 1. Server-side validation: Always validate maintenance status on the server
 * 2. Use server time: Fetch current time from server API endpoint
 * 3. Time offset calculation: Calculate offset between server and client time
 * 4. Periodic sync: Re-sync with server time every few minutes
 * 5. Hash-based validation: Use cryptographic proof of time from server
 * 
 * Example implementation:
 * - Create an API endpoint that returns: { currentTime, maintenanceActive, timeRemaining }
 * - Calculate offset: serverTimeOffset = serverTime - clientTime
 * - Apply offset to all time calculations
 * - Show warning if offset is suspiciously large (>1 hour)
 */
import { s } from '$lib/client/localization.svelte';
import { onMount } from 'svelte';
import { PUBLIC_MAINTENANCE_START, PUBLIC_MAINTENANCE_END, PUBLIC_MAINTENANCE_AUTO } from '$env/static/public';
import SplashScreen from './SplashScreen.svelte';

// Reactive state variables
let progressPercentage = $state(0);
let timeRemaining = $state('');
let displayProgress = $state(0);
let isMaintenanceComplete = $state(false);
let showLoadingSequence = $state(false);
let loadingProgress = $state(0);
let loadingStage = $state('');
let countdownDisplay = $state({ hours: 0, minutes: 0, seconds: 0 });
let serverTimeOffset = $state(0);
let timeWarning = $state('');

// Loading stages for post-maintenance sequence
const loadingStages = [
    'Initializing systems...',
    'Loading configuration...',
    'Connecting to services...',
    'Preparing interface...',
    'Almost ready...'
];

// Get adjusted time with server offset
function getAdjustedTime() {
    const now = new Date();
    return new Date(now.getTime() + serverTimeOffset);
}

function updateProgress() {
    const now = getAdjustedTime();
    const startTime = new Date(PUBLIC_MAINTENANCE_START || '2025-07-20T00:00:00Z');
    const endTime = new Date(PUBLIC_MAINTENANCE_END || '2025-07-20T14:00:00Z');
    
    // Check if time seems suspicious (e.g., more than 1 hour off from expected)
    const browserTime = new Date();
    const expectedNow = new Date('2025-07-20T09:30:00Z'); // This would come from server
    const timeDiff = Math.abs(browserTime.getTime() - expectedNow.getTime());
    if (timeDiff > 3600000 && serverTimeOffset === 0) { // More than 1 hour difference
        timeWarning = 'Note: Your device time may be incorrect.';
    }
    
    if (now < startTime) {
        progressPercentage = 0;
        timeRemaining = 'Starting soon...';
        countdownDisplay = { hours: 0, minutes: 0, seconds: 0 };
    } else if (now > endTime) {
        progressPercentage = 100;
        timeRemaining = 'Completed';
        countdownDisplay = { hours: 0, minutes: 0, seconds: 0 };
        
        // Check if we should auto-start loading sequence
        if (PUBLIC_MAINTENANCE_AUTO === 'true' && !isMaintenanceComplete) {
            isMaintenanceComplete = true;
            startLoadingSequence();
        }
    } else {
        const totalDuration = endTime.getTime() - startTime.getTime();
        const elapsed = now.getTime() - startTime.getTime();
        progressPercentage = Math.round((elapsed / totalDuration) * 100);
        
        const remaining = endTime.getTime() - now.getTime();
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        
        // Update countdown display (without seconds for cleaner UI)
        countdownDisplay = { hours, minutes, seconds: 0 };
        
        if (hours > 0) {
            // Friendly language for hours
            if (hours === 1) {
                timeRemaining = minutes > 0 ? `1 hour and ${minutes} minute${minutes === 1 ? '' : 's'} remaining` : '1 hour remaining';
            } else {
                timeRemaining = minutes > 0 ? `${hours} hours and ${minutes} minute${minutes === 1 ? '' : 's'} remaining` : `${hours} hours remaining`;
            }
        } else if (minutes > 1) {
            timeRemaining = `${minutes} minutes remaining`;
        } else if (minutes === 1) {
            timeRemaining = '1 minute remaining';
        } else if (seconds > 0) {
            timeRemaining = 'Less than a minute remaining';
        } else {
            timeRemaining = 'Completing...';
        }
    }
}

function startLoadingSequence() {
    showLoadingSequence = true;
    let currentStage = 0;
    let progress = 0;
    
    const loadingInterval = setInterval(() => {
        progress += Math.random() * 15 + 5; // Random progress increments
        
        if (progress >= 100) {
            progress = 100;
            loadingStage = 'Ready!';
            clearInterval(loadingInterval);
            
            // Redirect to main app after a brief delay
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            // Update stage based on progress
            const stageIndex = Math.floor((progress / 100) * loadingStages.length);
            if (stageIndex < loadingStages.length) {
                loadingStage = loadingStages[stageIndex];
            }
        }
        
        loadingProgress = progress;
    }, 800 + Math.random() * 400); // Vary timing for more natural feel
}

// Smooth animation for progress counter (like in SplashScreen)
let animationFrame: number;

onMount(() => {
    updateProgress();
    // More frequent updates for better countdown accuracy
    const interval = setInterval(updateProgress, 1000);
    
    // Smooth animation loop
    const animate = () => {
        const targetProgress = showLoadingSequence ? loadingProgress : progressPercentage;
        const diff = targetProgress - displayProgress;
        
        if (Math.abs(diff) < 0.1) {
            displayProgress = targetProgress;
        } else {
            displayProgress += diff * 0.08;
        }
        
        animationFrame = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
        clearInterval(interval);
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
    };
});
</script>

{#if showLoadingSequence}
    <!-- Show SplashScreen-style loading after maintenance -->
    <SplashScreen 
        showProgress={true}
        progress={loadingProgress}
        countdownPercentage={loadingProgress}
        stage={loadingStage}
        hasError={false}
        forceBounce={true}
        isMaintenance={false}
    />
{:else}
    <div class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-dark-bg p-6 text-center">
        <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            {isMaintenanceComplete ? 
                (s('maintenance.completed') || 'Maintenance completed') : 
                (s('maintenance.title') || 'Maintenance in progress')
            }
        </h1>
        <p class="text-gray-600 dark:text-gray-400 max-w-md mb-6">
            {isMaintenanceComplete ? 
                (s('maintenance.completedMessage') || 'Systems are back online. Thank you for your patience.') :
                (s('maintenance.message') || 'We are performing routine updates to improve your experience. Please check back shortly.')
            }
        </p>
        
        <!-- Time warning if clock seems off -->
        {#if timeWarning}
            <div class="mb-4 px-4 py-2 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm max-w-md mx-auto">
                {timeWarning}
            </div>
        {/if}
        
        <!-- Countdown Display -->
        <div class="mt-6 text-center">
            {#if !isMaintenanceComplete && timeRemaining !== 'Starting soon...' && timeRemaining !== 'Completed' && timeRemaining !== 'Completing...'}
                <!-- Friendly time remaining message -->
                <p class="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6">
                    {timeRemaining}
                </p>
                
                <!-- Large countdown timer -->
                <div class="mb-4">
                    <div class="flex items-center justify-center space-x-4 text-4xl font-mono font-bold text-gray-800 dark:text-gray-100">
                        <div class="text-center">
                            <div class="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 min-w-[80px]">
                                {String(countdownDisplay.hours).padStart(2, '0')}
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Hours</div>
                        </div>
                        <div class="text-gray-400">:</div>
                        <div class="text-center">
                            <div class="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 min-w-[80px]">
                                {String(countdownDisplay.minutes).padStart(2, '0')}
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Minutes</div>
                        </div>
                    </div>
                </div>
            {/if}
            
            <!-- Progress percentage counter -->
            <p class="text-xl text-gray-600 dark:text-gray-400">
                {Math.round(displayProgress)}% complete
            </p>
            
            <!-- Completion status for when maintenance is done -->
            {#if isMaintenanceComplete}
                <p class="min-h-[1.5rem] text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {PUBLIC_MAINTENANCE_AUTO === 'true' ? 'Preparing to reload...' : 'You may refresh the page'}
                </p>
            {/if}
        </div>
        
        <!-- Progress Bar -->
        <div class="w-full max-w-md mt-4">
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                    class="h-2 rounded-full transition-all duration-300 ease-out"
                    class:bg-blue-600={!isMaintenanceComplete}
                    class:dark:bg-blue-500={!isMaintenanceComplete}
                    class:bg-green-600={isMaintenanceComplete}
                    class:dark:bg-green-500={isMaintenanceComplete}
                    style="width: {Math.round(displayProgress)}%"
                ></div>
            </div>
        </div>
        
        <!-- Manual refresh button when maintenance is complete but auto-reload is disabled -->
        {#if isMaintenanceComplete && PUBLIC_MAINTENANCE_AUTO !== 'true'}
            <button 
                class="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors duration-200"
                onclick={() => window.location.reload()}
            >
                {s('maintenance.refresh') || 'Refresh Page'}
            </button>
        {/if}
        
        <!-- Estimated completion time -->
        {#if !isMaintenanceComplete}
            <div class="mt-6 text-xs text-gray-500 dark:text-gray-400">
                <p>
                    {s('maintenance.estimatedCompletion') || 'Estimated completion:'} 
                    {new Date(PUBLIC_MAINTENANCE_END || '2025-07-20T14:00:00Z').toLocaleString()}
                </p>
            </div>
        {/if}
        
        <!-- Debug info (remove in production) -->
        <div class="mt-4 text-xs text-gray-400 dark:text-gray-500 border-t pt-4">
            <p>Debug Info:</p>
            <p>Current time: {new Date().toLocaleString()}</p>
            <p>Maintenance start: {new Date(PUBLIC_MAINTENANCE_START || '2025-07-20T00:00:00Z').toLocaleString()}</p>
            <p>Maintenance end: {new Date(PUBLIC_MAINTENANCE_END || '2025-07-20T14:00:00Z').toLocaleString()}</p>
            <p>Progress: {progressPercentage}%</p>
            <p>Countdown: {countdownDisplay.hours}h {countdownDisplay.minutes}m {countdownDisplay.seconds}s</p>
            <p>Auto reload: {PUBLIC_MAINTENANCE_AUTO}</p>
        </div>
    </div>
{/if} 