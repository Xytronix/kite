// TypeScript module shims for packages without proper typings

declare module '@skeletonlabs/floating-ui-svelte';
declare module 'overlayscrollbars-svelte';
declare module 'overlayscrollbars-svelte/*';

declare module '@iconify/svelte';

declare module '$app/state';

// Basic shims for frequently used $app modules when VS Code intellisense can't
// locate the generated SvelteKit types (these are replaced by real typings at
// build/dev time, but adding them here keeps the editor quiet).
declare module '$app/environment' {
  export const browser: boolean;
  export const dev: boolean;
  export const building: boolean;
  export const version: string;
}

declare module '$app/navigation' {
  export function goto(url: string, opts?: Record<string, any>): Promise<void>;
  export function invalidate(url: string): Promise<void>;
  export function prefetch(url: string): Promise<void>;
}

declare module '$app/stores'; 