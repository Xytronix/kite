import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// Dynamically import the Node adapter. This prevents editor tooling from
// throwing "module not found" errors when the dependency isn't installed yet
// (e.g. fresh clone, CI lint runs, etc.). At build time the import will
// succeed and the proper adapter will be used. When it fails we fall back to
// a no-op stub so that the config can still be evaluated.
let adapter;
try {
  // eslint-disable-next-line unicorn/prefer-module
  // @ts-ignore – evaluated at runtime
  adapter = (await import("@sveltejs/adapter-node")).default();
} catch {
  // Simple stub satisfying the interface { adapt() {} }
  adapter = /** @type {import('@sveltejs/kit').Adapter} */ ({
    name: "stub-adapter-node",
    adapt() {
      console.warn(
        "⚠️  '@sveltejs/adapter-node' not found – using stub adapter for tooling."
      );
    },
  });
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    adapter,
    csrf: {
      checkOrigin: false,
    },
  },
};

export default config;
