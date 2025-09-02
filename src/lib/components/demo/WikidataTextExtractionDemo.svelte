<script lang="ts">
  import type { Category, Story } from "$lib/types";
  import { onMount } from "svelte";

  let demoContainer: HTMLElement;
  let categories: Category[] = [];
  let selectedCategoryId: string | null = null;
  let categoryStories: Story[] = [];
  let selectedStoryId: number | null = null;
  let customHtml: string | null = null;
  let extractedText = "";
  let originalHTML = "";
  let apiResponse = "";
  let isLoading = false;

  const examples = {
    simple: {
      name: "Simple Text",
      html: `<p>This article discusses Paris, the capital of France, and London, the capital of England.</p>`,
    },
    complex: {
      name: "Complex HTML",
      html: `
        <h2>European Capitals</h2>
        <p>This article discusses <a href="/existing-link">Paris</a>, the capital of France.</p>
        <div data-no-wiki>
          <p>This section about Rome should be ignored in extraction.</p>
        </div>
        <p>It also mentions <span data-wiki-id="Q84">London</span> and Berlin.</p>
        <!-- script/style tags removed to avoid Svelte style checker issues in demo HTML -->
      `,
    },
    news: {
      name: "News Article Style",
      html: `
        <article>
          <h1>International Summit Concludes</h1>
          <p>Leaders from the United States, United Kingdom, and Germany met in Geneva yesterday.</p>
          <p>The summit, hosted by Switzerland, addressed climate change and economic cooperation.</p>
          <p>President Biden, Prime Minister Sunak, and Chancellor Scholz signed several agreements.</p>
        </article>
      `,
    },
    mixed: {
      name: "Mixed Content",
      html: `
        <div>
          <p>The Renaissance began in Florence, Italy during the 14th century.</p>
          <blockquote>
            "Art is never finished, only abandoned" - Leonardo da Vinci
          </blockquote>
          <p>Other important Renaissance cities included Venice, Rome, and later spread to Paris and London.</p>
          <ul>
            <li>Michelangelo worked in the Sistine Chapel</li>
            <li>Raphael painted in the Vatican</li>
            <li>Donatello created sculptures in Florence</li>
          </ul>
        </div>
      `,
    },
    modern: {
      name: "Modern Tech & Crypto",
      html: `
        <article>
          <h2>Technology and Cryptocurrency News</h2>
          <p>The price of bitcoin reached new heights this week, while ethereum continues to gain adoption.</p>
          <p>Meanwhile, Apple announced new features for iPhone users, and ChatGPT integration with various platforms.</p>
          <p>Companies like Tesla, Google, and Microsoft are investing heavily in artificial intelligence research.</p>
          <p>Popular platforms including YouTube, Netflix, and Spotify are adapting to changing user preferences.</p>
        </article>
      `,
    },
  } as const;

  type ExampleKey = keyof typeof examples;
  let selectedExample: ExampleKey = "simple";
  type ExampleMap = typeof examples;
  type ExampleEntry = [keyof ExampleMap, ExampleMap[keyof ExampleMap]];
  const exampleEntries = Object.entries(examples) as ExampleEntry[];

  // Extract clean text function (aligned with production; keep anchor text, preserve paragraphs)
  function extractCleanText(root: HTMLElement): string {
    const clone = root.cloneNode(true) as HTMLElement;

    // Remove elements we don't want to process, but keep anchors so their text remains
    clone
      .querySelectorAll(
        "[data-no-wiki], [data-wiki-id], script, style, .skip-linking",
      )
      .forEach((el) => el.remove());

    // Walk DOM to preserve paragraph/list structure
    const blockTags = new Set([
      "P",
      "DIV",
      "ARTICLE",
      "SECTION",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6",
      "UL",
      "OL",
      "LI",
      "BLOCKQUOTE",
      "PRE",
      "TABLE",
      "THEAD",
      "TBODY",
      "TR",
      "TD",
      "TH",
      "HEADER",
      "FOOTER",
      "ASIDE",
      "MAIN",
      "NAV",
    ]);
    const traverse = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.nodeValue || "";
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      const el = node as HTMLElement;
      if (el.matches("br")) return "\n";
      let out = "";
      for (const child of Array.from(node.childNodes)) {
        out += traverse(child);
      }
      if (blockTags.has(el.tagName)) {
        return out.trim() ? out.trim() + "\n\n" : "";
      }
      return out;
    };

    let raw = traverse(clone);

    // Strip bracketed citations: [domain#n], [n], [*], [common]
    raw = raw
      .replace(/\[[^\]\s]+#\d+\]/g, "")
      .replace(/\[(?:\*|\d+|common)\]/gi, "");

    // Normalize whitespace and punctuation spacing
    raw = raw
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .replace(/\s+([\.,;:!?])/g, "$1")
      .replace(/\s+([\)\]\}])/g, "$1")
      .replace(/([\(\[\{])\s+/g, "$1");

    return raw.trim();
  }

  // Simulate Wikidata API call
  async function simulateWikidataAPI(text: string): Promise<any> {
    // Simulate network delay
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 + Math.random() * 1000),
    );

    // Mock entity detection based on common patterns
    const entities = [];
    const entityPatterns = [
      // Places
      {
        pattern: /\bParis\b/gi,
        id: "Q90",
        label: "Paris",
        description: "capital city of France",
        score: 0.95,
      },
      {
        pattern: /\bLondon\b/gi,
        id: "Q84",
        label: "London",
        description: "capital city of England and the United Kingdom",
        score: 0.92,
      },
      {
        pattern: /\bBerlin\b/gi,
        id: "Q64",
        label: "Berlin",
        description: "capital city of Germany",
        score: 0.9,
      },
      {
        pattern: /\bGeneva\b/gi,
        id: "Q71",
        label: "Geneva",
        description: "city in Switzerland",
        score: 0.88,
      },
      {
        pattern: /\bFlorence\b/gi,
        id: "Q2044",
        label: "Florence",
        description: "city in Italy",
        score: 0.87,
      },
      {
        pattern: /\bVenice\b/gi,
        id: "Q641",
        label: "Venice",
        description: "city in Italy",
        score: 0.86,
      },
      {
        pattern: /\bRome\b/gi,
        id: "Q220",
        label: "Rome",
        description: "capital city of Italy",
        score: 0.94,
      },

      // Countries
      {
        pattern: /\bUnited States\b/gi,
        id: "Q30",
        label: "United States",
        description: "country in North America",
        score: 0.96,
      },
      {
        pattern: /\bUnited Kingdom\b/gi,
        id: "Q145",
        label: "United Kingdom",
        description: "country in Europe",
        score: 0.95,
      },
      {
        pattern: /\bGermany\b/gi,
        id: "Q183",
        label: "Germany",
        description: "country in Central Europe",
        score: 0.93,
      },
      {
        pattern: /\bSwitzerland\b/gi,
        id: "Q39",
        label: "Switzerland",
        description: "country in Central Europe",
        score: 0.91,
      },
      {
        pattern: /\bItaly\b/gi,
        id: "Q38",
        label: "Italy",
        description: "country in Southern Europe",
        score: 0.92,
      },
      {
        pattern: /\bFrance\b/gi,
        id: "Q142",
        label: "France",
        description: "country in Western Europe",
        score: 0.93,
      },

      // Historical figures
      {
        pattern: /\bLeonardo da Vinci\b/gi,
        id: "Q762",
        label: "Leonardo da Vinci",
        description: "Italian Renaissance polymath",
        score: 0.98,
      },
      {
        pattern: /\bMichelangelo\b/gi,
        id: "Q5592",
        label: "Michelangelo",
        description: "Italian Renaissance artist",
        score: 0.97,
      },
      {
        pattern: /\bRaphael\b/gi,
        id: "Q5597",
        label: "Raphael",
        description: "Italian Renaissance painter",
        score: 0.89,
      },
      {
        pattern: /\bDonatello\b/gi,
        id: "Q37562",
        label: "Donatello",
        description: "Italian Renaissance sculptor",
        score: 0.85,
      },

      // Cryptocurrencies (lowercase)
      {
        pattern: /\bbitcoin\b/gi,
        id: "Q131723",
        label: "Bitcoin",
        description: "decentralized cryptocurrency",
        score: 0.94,
      },
      {
        pattern: /\bethereum\b/gi,
        id: "Q18216",
        label: "Ethereum",
        description: "blockchain platform",
        score: 0.92,
      },

      // Technology companies
      {
        pattern: /\bApple\b/gi,
        id: "Q312",
        label: "Apple Inc.",
        description: "American technology company",
        score: 0.93,
      },
      {
        pattern: /\bGoogle\b/gi,
        id: "Q95",
        label: "Google",
        description: "American technology company",
        score: 0.95,
      },
      {
        pattern: /\bMicrosoft\b/gi,
        id: "Q2283",
        label: "Microsoft",
        description: "American technology company",
        score: 0.94,
      },
      {
        pattern: /\bTesla\b/gi,
        id: "Q478214",
        label: "Tesla, Inc.",
        description: "American electric vehicle company",
        score: 0.91,
      },

      // Products (mixed case) — keep minimal examples for demo
      {
        pattern: /\biPhone\b/gi,
        id: "Q2766",
        label: "iPhone",
        description: "smartphone made by Apple",
        score: 0.96,
      },

      // Platforms
      {
        pattern: /\bYouTube\b/gi,
        id: "Q866",
        label: "YouTube",
        description: "video sharing platform",
        score: 0.97,
      },
      {
        pattern: /\bNetflix\b/gi,
        id: "Q907311",
        label: "Netflix",
        description: "streaming service",
        score: 0.95,
      },
      {
        pattern: /\bSpotify\b/gi,
        id: "Q408",
        label: "Spotify",
        description: "music streaming service",
        score: 0.93,
      },

      // Concepts
      {
        pattern: /\bartificial intelligence\b/gi,
        id: "Q11660",
        label: "artificial intelligence",
        description: "intelligence demonstrated by machines",
        score: 0.88,
      },
    ];

    for (const { pattern, id, label, description, score } of entityPatterns) {
      if (pattern.test(text)) {
        entities.push({
          id,
          label,
          description,
          score,
          url: `https://www.wikidata.org/wiki/${id}`,
        });
      }
    }

    // Simulate different response scenarios
    const scenarios = ["success", "error", "empty"];
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

    if (scenario === "error") {
      return {
        error: {
          code: "unknown_action",
          info: 'Unrecognized value for parameter "action": wblinktitles.',
        },
      };
    } else if (scenario === "empty") {
      return {
        wblinktitles: {
          entities: [],
        },
      };
    } else {
      return {
        wblinktitles: {
          entities: entities.slice(0, 5), // Limit to 5 entities for demo
        },
      };
    }
  }

  async function runDemo() {
    if (!demoContainer) return;

    isLoading = true;
    apiResponse = "";

    try {
      // Set the HTML content (custom preview overrides example)
      const example = examples[selectedExample];
      const html = customHtml || example.html;
      demoContainer.innerHTML = html;
      originalHTML = html;

      // Extract clean text
      extractedText = extractCleanText(demoContainer);

      // Simulate API call
      const response = await simulateWikidataAPI(extractedText);
      apiResponse = JSON.stringify(response, null, 2);
    } catch (error) {
      apiResponse = `Error: ${error}`;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    runDemo();
    // Minimal category/story loader (non-blocking; best-effort)
    (async () => {
      try {
        // Attempt to fetch latest categories and first category's stories
        const latestResp = await fetch("/api/batches/latest");
        const latest = latestResp.ok ? await latestResp.json() : null;
        const batchId = latest?.id || "latest";
        const catResp = await fetch(
          `/api/batches/${batchId}/categories?lang=en`,
        );
        if (catResp.ok) {
          const catData = await catResp.json();
          categories = (catData.categories || []).map((c: any) => ({
            id: c.id || c.categoryId || c.uuid,
            name: c.name || c.id,
          }));
          selectedCategoryId = categories[0]?.id || null;
          if (selectedCategoryId) {
            const storiesResp = await fetch(
              `/api/batches/${batchId}/categories/${selectedCategoryId}/stories?limit=20&lang=en`,
            );
            if (storiesResp.ok) {
              const sd = await storiesResp.json();
              categoryStories = sd.stories || [];
              selectedStoryId = categoryStories[0]?.cluster_number || null;
            }
          }
        }
      } catch {}
    })();
  });

  function createStoryPreviewHTML(story: Story): string {
    const parts: string[] = [];
    parts.push(`<h2>${story.title}</h2>`);
    parts.push(`<p>${story.short_summary}</p>`);
    if (
      Array.isArray(story.talking_points) &&
      story.talking_points.length > 0
    ) {
      parts.push("<h3>Highlights</h3>");
      parts.push("<ul>");
      for (const p of story.talking_points) parts.push(`<li>${p}</li>`);
      parts.push("</ul>");
    }
    return parts.join("\n");
  }
</script>

<div class="demo-container mx-auto max-w-4xl p-6">
  <h2 class="mb-6 text-2xl font-bold">Wikidata Text Extraction Demo</h2>

  <div class="mb-6">
    <label for="example-select" class="mb-2 block text-sm font-medium">
      Choose an example:
    </label>
    <select
      id="example-select"
      bind:value={selectedExample}
      on:change={runDemo}
      class="rounded border border-gray-300 bg-white px-3 py-2"
    >
      {#each exampleEntries as [key, example]}
        <option value={key}>{example.name}</option>
      {/each}
    </select>

    <button
      on:click={runDemo}
      disabled={isLoading}
      class="ml-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
    >
      {isLoading ? "Processing..." : "Run Demo"}
    </button>
  </div>
  <div class="mb-6">
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div>
        <label for="category-select" class="mb-2 block text-sm font-medium"
          >Category (live)</label
        >
        <select
          id="category-select"
          bind:value={selectedCategoryId}
          on:change={() => {
            // reload stories for selected category
            (async () => {
              try {
                const latestResp = await fetch("/api/batches/latest");
                const latest = latestResp.ok ? await latestResp.json() : null;
                const batchId = latest?.id || "latest";
                if (selectedCategoryId) {
                  const storiesResp = await fetch(
                    `/api/batches/${batchId}/categories/${selectedCategoryId}/stories?limit=20&lang=en`,
                  );
                  if (storiesResp.ok) {
                    const sd = await storiesResp.json();
                    categoryStories = sd.stories || [];
                    selectedStoryId =
                      categoryStories[0]?.cluster_number || null;
                  }
                }
              } catch {}
            })();
          }}
          class="w-full rounded border border-gray-300 bg-white px-3 py-2"
        >
          {#each categories as c}
            <option value={c.id}>{c.name}</option>
          {/each}
        </select>
      </div>
      <div>
        <label for="story-select" class="mb-2 block text-sm font-medium"
          >Story (live)</label
        >
        <select
          id="story-select"
          bind:value={selectedStoryId}
          on:change={() => {
            const s = categoryStories.find(
              (st) => st.cluster_number === Number(selectedStoryId),
            );
            if (s) {
              customHtml = createStoryPreviewHTML(s);
              selectedExample = "simple";
              runDemo();
            }
          }}
          class="w-full rounded border border-gray-300 bg-white px-3 py-2"
        >
          {#each categoryStories as s}
            <option value={s.cluster_number}>{s.title}</option>
          {/each}
        </select>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <!-- Original HTML -->
    <div class="space-y-4">
      <h3 class="text-lg font-semibold">1. Original HTML</h3>
      <div class="rounded border border-gray-300 bg-gray-50 p-4">
        <div bind:this={demoContainer} class="demo-content">
          <!-- Content will be inserted here -->
        </div>
      </div>

      <details class="text-sm">
        <summary class="cursor-pointer font-medium">View HTML Source</summary>
        <pre class="mt-2 overflow-x-auto rounded bg-gray-100 p-3 text-xs"><code
            >{originalHTML}</code
          ></pre>
      </details>
    </div>

    <!-- Extracted Text -->
    <div class="space-y-4">
      <h3 class="text-lg font-semibold">2. Extracted Clean Text</h3>
      <div class="min-h-[100px] rounded border border-gray-300 bg-blue-50 p-4">
        <p class="text-sm whitespace-pre-wrap">
          {extractedText || "No text extracted yet..."}
        </p>
      </div>

      <div class="text-xs text-gray-600">
        <p><strong>Extraction Process:</strong></p>
        <ul class="list-inside list-disc space-y-1">
          <li>Keep anchor text (&lt;a&gt; text is preserved)</li>
          <li>Remove elements with data-no-wiki attribute</li>
          <li>Remove elements with data-wiki-id attribute</li>
          <li>Remove &lt;script&gt; and &lt;style&gt; tags</li>
          <li>Strip citation markers like [domain#n], [n], [*], [common]</li>
          <li>Preserve paragraphs and lists using newlines</li>
        </ul>
      </div>
    </div>
  </div>

  <!-- API Response -->
  <div class="mt-6">
    <h3 class="mb-4 text-lg font-semibold">
      3. Simulated Wikidata API Response
    </h3>

    {#if isLoading}
      <div class="rounded border border-gray-300 bg-yellow-50 p-4">
        <div class="flex items-center space-x-2">
          <div
            class="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-500"
          ></div>
          <span class="text-sm">Calling Wikidata API...</span>
        </div>
      </div>
    {:else if apiResponse}
      <div class="rounded border border-gray-300 bg-green-50 p-4">
        <pre class="overflow-x-auto text-xs"><code>{apiResponse}</code></pre>
      </div>
    {:else}
      <div class="rounded border border-gray-300 bg-gray-50 p-4">
        <p class="text-sm text-gray-500">
          No API response yet. Click "Run Demo" to start.
        </p>
      </div>
    {/if}

    <div class="mt-4 text-xs text-gray-600">
      <p><strong>API Details:</strong></p>
      <ul class="list-inside list-disc space-y-1">
        <li>Endpoint: https://www.wikidata.org/w/api.php</li>
        <li>Action: wblinktitles</li>
        <li>Text limit: 10,000 characters</li>
        <li>Language: en (configurable)</li>
        <li>Score threshold: 0.7 (high confidence only)</li>
      </ul>
    </div>
  </div>

  <!-- Performance Info -->
  <div class="mt-6 rounded bg-gray-100 p-4">
    <h4 class="mb-2 font-semibold">Performance Considerations</h4>
    <div class="space-y-1 text-sm text-gray-700">
      <p>
        • Text extraction is performed on a cloned DOM to avoid modifying the
        original
      </p>
      <p>
        • API calls are cached to avoid duplicate requests for the same text
      </p>
      <p>• Fallback entity extraction is used when the main API fails</p>
      <p>
        • Batch processing limits concurrent API calls to prevent rate limiting
      </p>
      <p>• Only high-confidence entities (score > 0.7) are processed</p>
    </div>
  </div>
</div>
