import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit(),
    tailwindcss(),
  ],
  optimizeDeps: {
    exclude: [
      "@iconify/svelte",
      "svelte-dnd-action",
      "svelte-portal",
      "overlayscrollbars-svelte",
      "@floating-ui/dom",
      "@floating-ui/utils",
      "@skeletonlabs/floating-ui-svelte"
    ],
    include: [
      "@iconify/json",
      "chart.js",
      "chartjs-adapter-date-fns",
      "date-fns",
      "lottie-web",
      "mustache",
      "overlayscrollbars",
      "sortablejs"
    ]
  },
  ...(process.env.VITEST && {
    resolve: {
      conditions: ["browser"],
    },
  }),
});
