// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
    namespace App {
        // interface Error {}
        // interface Locals {}
        // interface PageData {}
        // interface PageState {}
        // interface Platform {}
    }

    // Global window properties for logging flags
    interface Window {
        __common_icons_logged?: boolean;
        __critical_icons_logged?: boolean;
    }
}

// TypeScript module shims for packages without proper typings
declare module '@skeletonlabs/floating-ui-svelte';
declare module 'overlayscrollbars-svelte';
declare module 'overlayscrollbars-svelte/*';

export {};