<script lang="ts">
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

// Loading stages for post-maintenance sequence
const loadingStages = [
    'Initializing systems...',
    'Loading configuration...',
    'Connecting to services...',
    'Preparing interface...',
    'Almost ready...'
];

function updateProgress() {
    const now = new Date();
    const startTime = new Date(PUBLIC_MAINTENANCE_START || '2025-07-20T00:00:00Z');
    const endTime = new Date(PUBLIC_MAINTENANCE_END || '2025-07-20T14:00:00Z');
    
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
        
        // Update countdown display
        countdownDisplay = { hours, minutes, seconds };
        
        if (hours > 0) {
            timeRemaining = `${hours}h ${minutes}m remaining`;
        } else if (minutes > 0) {
            timeRemaining = `${minutes}m ${seconds}s remaining`;
        } else if (seconds > 0) {
            timeRemaining = `${seconds}s remaining`;
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
        
        <!-- Countdown Display -->
        <div class="mt-6 text-center">
            {#if !isMaintenanceComplete && (countdownDisplay.hours > 0 || countdownDisplay.minutes > 0 || countdownDisplay.seconds > 0)}
                <!-- Large countdown timer -->
                <div class="mb-4">
                    <div class="flex items-center justify-center space-x-4 text-4xl font-mono font-bold text-gray-800 dark:text-gray-100">
                        <div class="text-center">
                            <div class="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 min-w-[60px]">
                                {String(countdownDisplay.hours).padStart(2, '0')}
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Hours</div>
                        </div>
                        <div class="text-gray-400">:</div>
                        <div class="text-center">
                            <div class="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 min-w-[60px]">
                                {String(countdownDisplay.minutes).padStart(2, '0')}
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Minutes</div>
                        </div>
                        <div class="text-gray-400">:</div>
                        <div class="text-center">
                            <div class="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 min-w-[60px]">
                                {String(countdownDisplay.seconds).padStart(2, '0')}
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Seconds</div>
                        </div>
                    </div>
                </div>
            {/if}
            
            <!-- Progress percentage counter -->
            <p class="text-xl text-gray-600 dark:text-gray-400">
                {Math.round(displayProgress)}%
            </p>
            
            <!-- Time remaining or completion status -->
            <p class="min-h-[1.5rem] text-sm text-gray-500 dark:text-gray-400 mt-1">
                {isMaintenanceComplete ? 
                    (PUBLIC_MAINTENANCE_AUTO === 'true' ? 'Preparing to reload...' : 'You may refresh the page') :
                    timeRemaining
                }
            </p>
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