<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { experimental } from "$lib/stores/experimental.svelte.js";
  import type { Story, Category } from "$lib/types";
  import { autoLinkEntitiesAdvanced } from "$lib/utils/wikidataEntityLinker";
  import { onMount } from "svelte";
  import WikidataTextExtractionDemo from "$lib/components/demo/WikidataTextExtractionDemo.svelte";

  let stories: Story[] = [];
  let selectedStory: Story | null = null;
  let isLoading = false;
  let error = "";
  let extractedText = "";
  let originalHTML = "";
  let apiResponse = "";
  let isProcessing = false;
  let demoContainer: HTMLElement;
  let showAdvancedOptions = false;
  // Demo category state
  let categories: Array<{ id: string; uuid: string; name: string }> = [];
  let uuidToName: Record<string, string> = {};
  let selectedCategoryUuid: string | null = null;

  // Demo configuration
  let useRealAPI = true;
  let textLimit = 1000000;
  let confidenceThreshold = 0.7;
  let enableFallback = true;

  // Load real story data from the provided URL or latest batch
  async function loadStories() {
    isLoading = true;
    error = "";

    try {
      // Try to extract batch ID from URL params or use a default
      const urlParams = new URLSearchParams(window.location.search);
      let batchId =
        urlParams.get("batch") || "b3126c31-7a38-4f56-815b-09ccdadbc60a";
      const categoryId = urlParams.get("category") || "world";
      const dataLang = urlParams.get("data_lang") || "en";

      console.log("🔍 Loading stories from:", {
        batchId,
        categoryId,
        dataLang,
      });

      // Try the specified batch first, then fall back to latest if it fails
      let batchResponse;
      try {
        batchResponse = await fetch(`/api/batches/${batchId}?lang=${dataLang}`);
        if (!batchResponse.ok && batchId !== "latest") {
          console.warn(`Batch ${batchId} failed, trying latest batch`);
          batchId = "latest";
          batchResponse = await fetch(
            `/api/batches/${batchId}?lang=${dataLang}`,
          );
        }
      } catch (fetchError) {
        if (batchId !== "latest") {
          console.warn(`Batch ${batchId} failed, trying latest batch`);
          batchId = "latest";
          batchResponse = await fetch(
            `/api/batches/${batchId}?lang=${dataLang}`,
          );
        } else {
          throw fetchError;
        }
      }

      // Check if the final batch request succeeded
      if (!batchResponse.ok) {
        throw new Error(`Failed to load batch: ${batchResponse.statusText}`);
      }

      const batchData = await batchResponse.json();
      console.log("📦 Batch metadata:", batchData);

      // Now load the categories for this batch (separate endpoint)
      const categoriesResponse = await fetch(
        `/api/batches/${batchId}/categories?lang=${dataLang}`,
      );
      if (!categoriesResponse.ok) {
        throw new Error(
          `Failed to load categories: ${categoriesResponse.statusText}`,
        );
      }

      const categoriesData = await categoriesResponse.json();
      console.log("📂 Categories data:", categoriesData);
      console.log(
        "📂 First few categories:",
        categoriesData.categories?.slice(0, 3),
      );

      // Check if categories data has the expected structure
      if (
        !categoriesData ||
        !categoriesData.categories ||
        !Array.isArray(categoriesData.categories)
      ) {
        throw new Error(
          `Invalid categories data structure. Expected categories array but got: ${JSON.stringify(categoriesData)}`,
        );
      }

      // Normalize categories and map UUID -> name
      categories = (categoriesData.categories || []).map((c: any) => {
        const id = c.id || c.categoryId || c.uuid;
        const uuid = c.uuid || c.id || c.categoryId;
        const name = c.name || c.categoryName || id || uuid;
        return { id, uuid, name };
      });
      uuidToName = {};
      categories.forEach((c) => { uuidToName[c.uuid] = c.name; });

      // Try to find category by name/id first, then fall back to first available
      let category = (categoriesData.categories || []).find(
        (c: any) =>
          (c.id && c.id.toLowerCase() === categoryId.toLowerCase()) ||
          (c.name && c.name.toLowerCase() === categoryId.toLowerCase()),
      );

      if (!category && categoriesData.categories.length > 0) {
        // If no exact match found, use the first available category for demo purposes
        console.warn(
          `Category "${categoryId}" not found, using first available category for demo`,
        );
        category = categoriesData.categories[0];

        // If it's just a UUID string, convert to object format
        if (typeof category === "string") {
          category = { uuid: category, id: "demo", name: "Demo Category" };
        } else if (!category.uuid && category.id) {
          category.uuid = category.id;
        }
      }

      if (!category) {
        const availableCategories = categoriesData.categories
          .map((c: any) =>
            typeof c === "string" ? c : c.id || c.name || c.uuid || "unnamed",
          )
          .filter(Boolean)
          .slice(0, 10) // Limit to first 10 for readability
          .join(", ");
        throw new Error(
          `No categories available in batch. Categories found: ${availableCategories}`,
        );
      }

      console.log("🎯 Using category:", category);
      selectedCategoryUuid = category.uuid || category.id;

      // Load stories for this category
      const storiesResponse = await fetch(
        `/api/batches/${batchId}/categories/${selectedCategoryUuid}/stories?limit=20&lang=${dataLang}`,
      );

      if (!storiesResponse.ok) {
        throw new Error(
          `Failed to load stories: ${storiesResponse.statusText}`,
        );
      }

      const storiesData = await storiesResponse.json();
      stories = storiesData.stories || [];

      console.log("✅ Loaded", stories.length, "stories");

      // Auto-select first story if available
      if (stories.length > 0) {
        selectedStory = stories[0];
      }
    } catch (err) {
      console.error("Failed to load stories:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load stories";
      error = `API Error: ${errorMessage}`;

      // Fallback to mock data for demo purposes
      stories = [
        {
          cluster_number: 1,
          category: "World",
          title: "International Climate Summit Concludes in Geneva",
          short_summary:
            "World leaders from the United States, European Union, China, and India reached a historic agreement on carbon emissions during the three-day summit in Geneva, Switzerland. The agreement includes binding targets for 2030 and establishes a new international monitoring framework.",
          talking_points: [
            "Historic agreement on carbon emissions targets",
            "New international monitoring framework established",
            "Participation from major world economies",
          ],
          quote:
            "This agreement represents a turning point in our collective fight against climate change.",
          quote_author: "UN Secretary-General",
          location: "Geneva, Switzerland",
          key_players: [
            "United States",
            "European Union",
            "China",
            "India",
            "United Nations",
          ],
          articles: [
            {
              title: "Climate Summit Reaches Historic Agreement",
              link: "https://example.com/climate-summit",
              domain: "example.com",
              date: "2024-01-15",
            },
          ],
        } as Story,
        {
          cluster_number: 2,
          category: "Technology",
          title: "Major Breakthrough in Quantum Computing Announced",
          short_summary:
            "Researchers at MIT and Stanford University have achieved a significant milestone in quantum computing, demonstrating error correction capabilities that could pave the way for practical quantum computers. The breakthrough involves new techniques for maintaining quantum coherence.",
          talking_points: [
            "Error correction breakthrough in quantum computing",
            "Collaboration between MIT and Stanford",
            "Potential for practical quantum computers",
          ],
          key_players: ["MIT", "Stanford University"],
          technical_details: [
            "Quantum error correction using topological qubits",
            "Coherence time extended to 100 microseconds",
            "Scalable architecture for 1000+ qubit systems",
          ],
          articles: [
            {
              title: "Quantum Computing Breakthrough at MIT",
              link: "https://example.com/quantum-breakthrough",
              domain: "example.com",
              date: "2024-01-14",
            },
          ],
        } as Story,
      ];

      selectedStory = stories[0];
      console.log("📝 Using fallback mock data");
    } finally {
      isLoading = false;
    }
  }

  async function loadStoriesForCategory(uuid: string) {
    try {
      isLoading = true;
      error = "";
      // Determine language and batch from URL, same as loadStories
      const urlParams = new URLSearchParams(window.location.search);
      const dataLang = urlParams.get("data_lang") || "en";
      let batchId = urlParams.get("batch") || "b3126c31-7a38-4f56-815b-09ccdadbc60a";
      try {
        const test = await fetch(`/api/batches/${batchId}?lang=${dataLang}`);
        if (!test.ok) batchId = "latest";
      } catch { batchId = "latest"; }
      const storiesResponse = await fetch(
        `/api/batches/${batchId}/categories/${uuid}/stories?limit=20&lang=${dataLang}`,
      );
      if (!storiesResponse.ok) {
        throw new Error(`Failed to load stories: ${storiesResponse.statusText}`);
      }
      const storiesData = await storiesResponse.json();
      stories = storiesData.stories || [];
      selectedStory = stories[0] || null;
    } catch (e) {
      console.error(e);
      error = e instanceof Error ? e.message : String(e);
    } finally {
      isLoading = false;
    }
  }

  // Use shared extractor from production
  import { extractCleanText } from "$lib/utils/wikidataEntityLinker";

  // Search-based entity extraction as fallback
  async function searchBasedEntityExtraction(text: string): Promise<any> {
    // Extract potential entities using multiple patterns
    const matches = [];

    // Pattern 1: Traditional capitalized entities (proper nouns)
    const capitalizedPattern =
      /\b[A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){0,2}\b/g;
    const capitalizedMatches = text.match(capitalizedPattern) || [];
    matches.push(...capitalizedMatches);

    // Pattern 2: Known lowercase entities (cryptocurrencies, technologies, etc.)
    const lowercaseEntities =
      /\b(?:bitcoin|ethereum|blockchain|cryptocurrency|covid|nasa|fbi|cia|nsa|tesla|apple|google|microsoft|amazon|facebook|twitter|instagram|youtube|netflix|spotify|uber|airbnb|paypal|visa|mastercard|android|ios|windows|linux|macos|iphone|ipad|macbook|xbox|playstation|nintendo|pokemon|marvel|disney|netflix|hulu|zoom|slack|discord|reddit|wikipedia|github|stackoverflow|jquery|javascript|python|java|html|css|sql|api|json|xml|http|https|wifi|bluetooth|gps|usb|ssd|cpu|gpu|ram|ai|ml|vr|ar|iot|5g|4g|3g|lte|nft|dao|defi|web3|metaverse)\b/gi;
    const lowercaseMatches = text.match(lowercaseEntities) || [];
    matches.push(...lowercaseMatches);

    // Pattern 3: Mixed case technical terms and brands
    const mixedCasePattern =
      /\b(?:iPhone|iPad|MacBook|PlayStation|Xbox|YouTube|LinkedIn|WhatsApp|TikTok|Instagram|Facebook|Twitter|GitHub|OpenAI|DeepMind|SpaceX|Tesla|COVID-19|Wi-Fi|Bluetooth|JavaScript|TypeScript|MongoDB|PostgreSQL|MySQL|GraphQL|REST|API|JSON|XML|HTML|CSS|React|Angular|Vue|Node\.js|Python|Java|C\+\+|C#|Swift|Kotlin|Flutter|Docker|Kubernetes|AWS|Azure|GCP|Firebase|Stripe|PayPal|Shopify|Salesforce|HubSpot|Slack|Zoom|Teams|Discord|Spotify|Netflix|Hulu|Prime|Disney\+|HBO|Max|Paramount\+|Peacock|Apple\+|Twitch|OnlyFans|Patreon|Substack|Medium|Reddit|Quora|Stack\s*Overflow|Wikipedia|Wikimedia|Wikidata|Google|Alphabet|Meta|Microsoft|Amazon|Apple|Tesla|NVIDIA|AMD|Intel|Qualcomm|Samsung|Sony|LG|Huawei|Xiaomi|OnePlus|Oppo|Vivo|Realme|Nothing|Fairphone|Framework|System76|Purism|Pine64|Raspberry\s*Pi|Arduino|ESP32|RISC-V|ARM|x86|x64|CUDA|OpenCL|Vulkan|DirectX|OpenGL|WebGL|WebGPU|WebAssembly|PWA|SPA|SSR|SSG|JAMstack|Serverless|Edge|CDN|DNS|VPN|Tor|I2P|IPFS|BitTorrent|Torrent|P2P|DeFi|NFT|DAO|DApp|Web3|Metaverse|VR|AR|XR|MR|IoT|IIoT|M2M|RFID|NFC|QR|Barcode|OCR|AI|ML|DL|NLP|CV|ASR|TTS|GPT|BERT|T5|CLIP|DALL-E|Midjourney|Stable\s*Diffusion|LLaMA|Alpaca|Vicuna|Claude|Bard|Gemini|PaLM|LaMDA|Chinchilla|Gopher|Megatron|Switch|GLaM|PaLM|Flamingo|Gato|Sparrow|InstructGPT|CodeT5|Codex|Copilot|TabNine|Kite|Sourcegraph|Replit|CodeSandbox|Glitch|Vercel|Netlify|Heroku|Railway|Render|Fly\.io|PlanetScale|Supabase|Firebase|Appwrite|Pocketbase|Directus|Strapi|Sanity|Contentful|Prismic|Forestry|Netlify\s*CMS|Ghost|WordPress|Drupal|Joomla|Magento|Shopify|WooCommerce|BigCommerce|Squarespace|Wix|Webflow|Framer|Figma|Sketch|Adobe\s*XD|InVision|Principle|ProtoPie|Flinto|Marvel|Zeplin|Abstract|Avocode|Sympli|Handoff|Lingo|Brand\.ai|Frontify|Brandfolder|Bynder|Canto|Widen|Nuxeo|Alfresco|SharePoint|OneDrive|Google\s*Drive|Dropbox|Box|iCloud|pCloud|Mega|Sync|Tresorit|SpiderOak|Backblaze|Carbonite|Acronis|Veeam|Commvault|Rubrik|Cohesity|Pure\s*Storage|NetApp|EMC|Dell|HPE|IBM|Oracle|SAP|Salesforce|Workday|ServiceNow|Atlassian|Jira|Confluence|Trello|Asana|Monday|Notion|Obsidian|Roam|Logseq|RemNote|Anki|Quizlet|Coursera|edX|Udemy|Khan\s*Academy|Brilliant|MasterClass|Skillshare|Pluralsight|LinkedIn\s*Learning|Udacity|Codecademy|FreeCodeCamp|The\s*Odin\s*Project|CS50|MIT\s*OpenCourseWare|Stanford\s*Online|Harvard\s*Online|Yale\s*Online|Princeton\s*Online|Berkeley\s*Online|UCLA\s*Online|NYU\s*Online|Columbia\s*Online|UPenn\s*Online|Duke\s*Online|Northwestern\s*Online|Vanderbilt\s*Online|Rice\s*Online|Emory\s*Online|Georgetown\s*Online|Carnegie\s*Mellon\s*Online|Caltech\s*Online|Georgia\s*Tech\s*Online|UIUC\s*Online|UT\s*Austin\s*Online|UW\s*Madison\s*Online|UC\s*San\s*Diego\s*Online|UC\s*Irvine\s*Online|UC\s*Davis\s*Online|UC\s*Santa\s*Barbara\s*Online|Boston\s*University\s*Online|Northeastern\s*Online|Tufts\s*Online|Brandeis\s*Online|Case\s*Western\s*Online|Rochester\s*Online|Syracuse\s*Online|Pitt\s*Online|Penn\s*State\s*Online|Rutgers\s*Online|Maryland\s*Online|Virginia\s*Online|UNC\s*Online|Wake\s*Forest\s*Online|Tulane\s*Online|Miami\s*Online|Florida\s*Online|Georgia\s*Online|Alabama\s*Online|Auburn\s*Online|Tennessee\s*Online|Kentucky\s*Online|Louisville\s*Online|Cincinnati\s*Online|Ohio\s*State\s*Online|Michigan\s*Online|Michigan\s*State\s*Online|Purdue\s*Online|Indiana\s*Online|Illinois\s*Online|Iowa\s*Online|Iowa\s*State\s*Online|Kansas\s*Online|Kansas\s*State\s*Online|Missouri\s*Online|Nebraska\s*Online|Oklahoma\s*Online|Oklahoma\s*State\s*Online|Texas\s*Online|Texas\s*A&M\s*Online|Texas\s*Tech\s*Online|Baylor\s*Online|TCU\s*Online|SMU\s*Online|Houston\s*Online|Rice\s*Online|Colorado\s*Online|Colorado\s*State\s*Online|Utah\s*Online|Utah\s*State\s*Online|Arizona\s*Online|Arizona\s*State\s*Online|New\s*Mexico\s*Online|Nevada\s*Online|UNLV\s*Online|Oregon\s*Online|Oregon\s*State\s*Online|Washington\s*Online|Washington\s*State\s*Online|Idaho\s*Online|Montana\s*Online|Wyoming\s*Online|North\s*Dakota\s*Online|South\s*Dakota\s*Online|Minnesota\s*Online|Wisconsin\s*Online|Iowa\s*Online|Missouri\s*Online|Arkansas\s*Online|Louisiana\s*Online|Mississippi\s*Online|Alabama\s*Online|Tennessee\s*Online|Kentucky\s*Online|West\s*Virginia\s*Online|Virginia\s*Online|North\s*Carolina\s*Online|South\s*Carolina\s*Online|Georgia\s*Online|Florida\s*Online|Delaware\s*Online|Maryland\s*Online|Pennsylvania\s*Online|New\s*Jersey\s*Online|New\s*York\s*Online|Connecticut\s*Online|Rhode\s*Island\s*Online|Massachusetts\s*Online|Vermont\s*Online|New\s*Hampshire\s*Online|Maine\s*Online|Alaska\s*Online|Hawaii\s*Online)\b/g;
    const mixedCaseMatches = text.match(mixedCasePattern) || [];
    matches.push(...mixedCaseMatches);

    // Filter and deduplicate
    const allowSingletons = new Set([
      'bitcoin','ethereum','blockchain','cryptocurrency','crypto','covid','nasa','cia','fbi','tesla','apple','google','microsoft',
      'france','spain','italy','germany','ukraine','poland','russia','china','india','japan','brazil','canada','australia','mexico'
    ]);
    const uniqueMatches = [...new Set(matches)]
      .filter((match) => match.length > 3 && !isCommonWord(match))
      .filter((match) => {
        const tokens = match.trim().split(/\s+/);
        if (tokens.length >= 2) return true;
        const lower = match.toLowerCase();
        return allowSingletons.has(lower);
      })
      .slice(0, 12); // small increase to compensate for singleton allowance

    const entities = [];

    // Search for each potential entity
    for (const match of uniqueMatches) {
      try {
        const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(match)}&language=en&limit=1&format=json&origin=*`;
        const response = await fetch(searchUrl);

        if (!response.ok) continue;

        const data = await response.json();
        if (data.search && data.search.length > 0) {
          const entity = data.search[0];
          entities.push({
            id: entity.id,
            label: entity.label,
            description: entity.description,
            score: 0.8, // Default score for search results
            url: `https://www.wikidata.org/wiki/${entity.id}`,
          });
        }
      } catch (error) {
        console.warn(`Failed to search for entity: ${match}`, error);
      }
    }

    return {
      wblinktitles: {
        entities: entities,
      },
    };
  }

  // Helper function to check if text is a common word that shouldn't be linked
  function isCommonWord(text: string): boolean {
    const commonWords = new Set([
      // Articles, pronouns, conjunctions - truly generic words
      "The",
      "This",
      "That",
      "These",
      "Those",
      "When",
      "Where",
      "What",
      "Who",
      "Why",
      "How",
      "And",
      "But",
      "Or",
      "So",
      "Yet",
      "For",
      "Nor",
      "After",
      "Before",
      "During",
      "Since",
      "With",
      "Without",
      "Within",
      "About",
      "Above",
      "Below",
      "Under",
      "Over",
      "Through",
      "Into",
      "Onto",
      "Upon",
      "From",
      "To",
      "At",
      "In",
      "On",
      "By",
      "Of",
      "As",
      "Like",
      // Generic time references (but allow specific dates/events)
      "Today",
      "Tomorrow",
      "Yesterday",
      "Now",
      "Then",
      "Here",
      "There",
      "Always",
      "Never",
      // Generic descriptors that are never entities
      "Good",
      "Bad",
      "Best",
      "Worst",
      "Better",
      "Worse",
      "Great",
      "Small",
      "Large",
      "Big",
      "Little",
      // Note: Removed months/days as they can be legitimate entities (e.g., "March for Our Lives", "Black Friday")
      // Note: Removed many words that could be legitimate entities in some contexts
    ]);

    return commonWords.has(text);
  }

  // Simulate or call real Wikidata API
  async function callWikidataAPI(text: string): Promise<any> {
    if (!useRealAPI) {
      // Mock response for demo
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 + Math.random() * 1000),
      );

      const entities = [];
      const entityPatterns = [
        {
          pattern: /\bGeneva\b/gi,
          id: "Q71",
          label: "Geneva",
          description: "city in Switzerland",
          score: 0.88,
        },
        {
          pattern: /\bSwitzerland\b/gi,
          id: "Q39",
          label: "Switzerland",
          description: "country in Central Europe",
          score: 0.91,
        },
        {
          pattern: /\bUnited States\b/gi,
          id: "Q30",
          label: "United States",
          description: "country in North America",
          score: 0.96,
        },
        {
          pattern: /\bEuropean Union\b/gi,
          id: "Q458",
          label: "European Union",
          description: "political and economic union",
          score: 0.94,
        },
        {
          pattern: /\bChina\b/gi,
          id: "Q148",
          label: "China",
          description: "country in East Asia",
          score: 0.93,
        },
        {
          pattern: /\bIndia\b/gi,
          id: "Q668",
          label: "India",
          description: "country in South Asia",
          score: 0.92,
        },
        {
          pattern: /\bMIT\b/gi,
          id: "Q49108",
          label: "MIT",
          description:
            "private research university in Cambridge, Massachusetts",
          score: 0.95,
        },
        {
          pattern: /\bStanford University\b/gi,
          id: "Q41506",
          label: "Stanford University",
          description: "private research university in California",
          score: 0.97,
        },
        // Cryptocurrencies and blockchain
        {
          pattern: /\bbitcoin\b/gi,
          id: "Q131723",
          label: "Bitcoin",
          description: "decentralized digital currency",
          score: 0.94,
        },
        {
          pattern: /\bethereum\b/gi,
          id: "Q18967666",
          label: "Ethereum",
          description: "blockchain platform",
          score: 0.93,
        },
        {
          pattern: /\bblockchain\b/gi,
          id: "Q20514253",
          label: "blockchain",
          description: "distributed ledger technology",
          score: 0.9,
        },
        {
          pattern: /\bcryptocurrency\b/gi,
          id: "Q13479982",
          label: "cryptocurrency",
          description: "digital currency using cryptography",
          score: 0.89,
        },
        // Technology companies
        {
          pattern: /\bApple\b/gi,
          id: "Q312",
          label: "Apple Inc.",
          description: "American technology company",
          score: 0.92,
        },
        {
          pattern: /\bGoogle\b/gi,
          id: "Q95",
          label: "Google",
          description: "American technology company",
          score: 0.94,
        },
        {
          pattern: /\bMicrosoft\b/gi,
          id: "Q2283",
          label: "Microsoft",
          description: "American technology company",
          score: 0.93,
        },
        {
          pattern: /\bTesla\b/gi,
          id: "Q478214",
          label: "Tesla, Inc.",
          description: "American electric vehicle manufacturer",
          score: 0.91,
        },
        // AI and technology terms
        // ChatGPT handled dynamically by production extractor; demo pattern removed
        {
          pattern: /\bOpenAI\b/gi,
          id: "Q21708200",
          label: "OpenAI",
          description: "American artificial intelligence company",
          score: 0.94,
        },
        {
          pattern: /\bartificial intelligence\b/gi,
          id: "Q11660",
          label: "artificial intelligence",
          description: "intelligence demonstrated by machines",
          score: 0.88,
        },
        {
          pattern: /\bmachine learning\b/gi,
          id: "Q2539",
          label: "machine learning",
          description: "type of artificial intelligence",
          score: 0.87,
        },
      ];

      for (const { pattern, id, label, description, score } of entityPatterns) {
        if (pattern.test(text) && score >= confidenceThreshold) {
          entities.push({
            id,
            label,
            description,
            score,
            url: `https://www.wikidata.org/wiki/${id}`,
          });
        }
      }

      return {
        wblinktitles: {
          entities: entities.slice(0, 8), // Limit for demo
        },
      };
    }

    // Real API call - try wblinktitles first, then fallback to search-based approach
    try {
      // First try the wblinktitles API (might not be available on all Wikidata instances)
      const response = await fetch("https://www.wikidata.org/w/api.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          action: "wblinktitles",
          text: text.substring(0, textLimit),
          language: "en",
          tosite: 'enwiki',
          format: "json",
          origin: "*",
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Check if the API returned an error (like missing tosite parameter)
      if (data.error) {
        console.warn("wblinktitles API error:", data.error);
        throw new Error(
          `Wikidata API error: ${data.error.code} - ${data.error.info}`,
        );
      }

      // If wblinktitles returned no entities, try the search-based approach
      if (
        !data.wblinktitles?.entities ||
        data.wblinktitles.entities.length === 0
      ) {
        console.log(
          "wblinktitles returned no entities, trying search-based approach",
        );
        return await searchBasedEntityExtraction(text);
      }

      return data;
    } catch (error) {
      console.warn(
        "wblinktitles API failed, trying search-based approach:",
        error,
      );

      // Fallback to search-based entity extraction
      try {
        return await searchBasedEntityExtraction(text);
      } catch (searchError) {
        console.warn(
          "Search-based extraction failed, using mock:",
          searchError,
        );

        if (enableFallback) {
          // Final fallback to mock response
          useRealAPI = false; // Switch to mock mode for this session
          return callWikidataAPI(text);
        } else {
          throw error;
        }
      }
    }
  }

  // Run the demo extraction process
  async function runDemo() {
    if (!selectedStory || !demoContainer) return;

    isProcessing = true;
    apiResponse = "";

    try {
      // Create story content HTML
      const storyHTML = createStoryHTML(selectedStory);
      demoContainer.innerHTML = storyHTML;
      originalHTML = storyHTML;

      // Extract clean text
      extractedText = extractCleanText(demoContainer);

      // Call Wikidata API
      const response = await callWikidataAPI(extractedText);
      apiResponse = JSON.stringify(response, null, 2);

      // Apply entity linking if we have entities
      if (response.wblinktitles?.entities?.length > 0) {
        // Note: Wikipedia tooltips setting is controlled globally
        // The entity linking will respect the current experimental settings
        try {
          await autoLinkEntitiesAdvanced(demoContainer);
        } catch (error) {
          console.warn("Entity linking failed:", error);
        }
      }
    } catch (error) {
      console.error("Demo failed:", error);
      apiResponse = `Error: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      isProcessing = false;
    }
  }

  // Create HTML content from story data
  function createStoryHTML(story: Story): string {
    const parts = [
      `<h2>${story.title}</h2>`,
      `<p class="summary">${story.short_summary}</p>`,
    ];

    if (story.location) {
      parts.push(`<p><strong>Location:</strong> ${story.location}</p>`);
    }

    if (story.key_players?.length) {
      parts.push(
        `<p><strong>Key Players:</strong> ${story.key_players.join(", ")}</p>`,
      );
    }

    // Highlights (talking points)
    if (story.talking_points?.length) {
      parts.push("<h3>Highlights</h3>");
      parts.push("<ol>");
      story.talking_points.forEach((point) => {
        parts.push(`<li>${point}</li>`);
      });
      parts.push("</ol>");
    }

    // Quote
    if (story.quote && story.quote_author) {
      parts.push(
        `<blockquote>"${story.quote}" - ${story.quote_author}</blockquote>`,
      );
    }

    // Perspectives
    if (story.perspectives?.length) {
      parts.push("<h3>Perspectives</h3>");
      story.perspectives.forEach((p) => {
        parts.push(`<p>${p.text}</p>`);
        if (p.sources?.length) {
          const src = p.sources.map((s) => s.name || s.url).join(", ");
          parts.push(`<p><em>Source:</em> ${src}</p>`);
        }
      });
    }

    // Historical background
    if (story.historical_background) {
      parts.push("<h3>Historical background</h3>");
      parts.push(`<p>${story.historical_background}</p>`);
    }

    // International reactions
    if (story.international_reactions?.length) {
      parts.push("<h3>International reactions</h3>");
      parts.push("<ul>");
      story.international_reactions.forEach((r) => parts.push(`<li>${r}</li>`));
      parts.push("</ul>");
    }

    // Humanitarian impact
    if (story.humanitarian_impact) {
      parts.push("<h3>Humanitarian impact</h3>");
      parts.push(`<p>${story.humanitarian_impact}</p>`);
    }

    // Economic implications
    if (story.economic_implications) {
      parts.push("<h3>Economic implications</h3>");
      parts.push(`<p>${story.economic_implications}</p>`);
    }

    // Technical details
    if (story.technical_details?.length) {
      parts.push("<h3>Technical Details</h3>");
      parts.push("<ul>");
      story.technical_details.forEach((detail) => {
        if (typeof detail === "string") {
          parts.push(`<li>${detail}</li>`);
        } else {
          parts.push(
            `<li><strong>${detail.title}:</strong> ${detail.description}</li>`,
          );
        }
      });
      parts.push("</ul>");
    }

    // Business angle
    if (story.business_angle_text || story.business_angle_points?.length) {
      parts.push("<h3>Business angle</h3>");
      if (story.business_angle_text) parts.push(`<p>${story.business_angle_text}</p>`);
      if (story.business_angle_points?.length) {
        parts.push("<ul>");
        story.business_angle_points.forEach((p) => parts.push(`<li>${p}</li>`));
        parts.push("</ul>");
      }
    }

    // Future outlook
    if (story.future_outlook) {
      parts.push("<h3>Future outlook</h3>");
      parts.push(`<p>${story.future_outlook}</p>`);
    }

    // Did you know
    if (story.did_you_know) {
      parts.push("<h3>Did you know?</h3>");
      parts.push(`<p>${story.did_you_know}</p>`);
    }

    // Timeline
    if (story.timeline?.length) {
      parts.push("<h3>Timeline</h3>");
      parts.push("<ul>");
      story.timeline.forEach((e) => {
        parts.push(`<li><strong>${e.date}:</strong> ${e.description}</li>`);
      });
      parts.push("</ul>");
    }

    // Suggested QnA
    if (story.suggested_qna?.length) {
      parts.push("<h3>Quick questions</h3>");
      story.suggested_qna.forEach((qa) => {
        parts.push(`<p><strong>${qa.question}</strong></p>`);
        parts.push(`<p>${qa.answer}</p>`);
      });
    }

    // Sources (domains)
    const sourceDomains = (story.domains || story.articles?.map((a: any) => a.domain) || []).filter(Boolean);
    if (sourceDomains.length) {
      parts.push("<h3>Sources</h3>");
      parts.push("<ul>");
      Array.from(new Set(sourceDomains)).forEach((d: string) => parts.push(`<li>${d}</li>`));
      parts.push("</ul>");
    }

    return parts.join("\n");
  }

  // Handle story selection
  function selectStory(story: Story) {
    selectedStory = story;
    runDemo();
  }

  // Update URL with current story selection
  function updateURL() {
    if (selectedStory) {
      const params = new URLSearchParams(window.location.search);
      params.set("story", selectedStory.cluster_number.toString());
      goto(`?${params.toString()}`, { replaceState: true });
    }
  }

  onMount(() => {
    loadStories();
  });

  // Auto-run demo when story is selected
  $: if (selectedStory && demoContainer) {
    runDemo();
  }
</script>

<svelte:head>
  <title>Wikidata Text Extraction Demo - Real Story Data</title>
  <meta
    name="description"
    content="Interactive demo of Wikidata text extraction using real story data from Kite feeds"
  />
</svelte:head>

<div class="demo-page min-h-screen bg-gray-50 dark:bg-gray-900">
  <div class="container mx-auto max-w-6xl px-4 py-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="mb-4 text-3xl font-bold text-gray-900 dark:text-white">
        Wikidata Text Extraction Demo
      </h1>
      <p class="text-lg text-gray-600 dark:text-gray-300">
        Test the Wikidata entity linking functionality using real story data
        from Kite feeds. Select a story below to see how entities are extracted
        and linked.
      </p>
    </div>

    <!-- Simple in-page category/story controls (consistent with page style) -->
    <div class="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
      <div>
        <label for="demo-category" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
        <select id="demo-category" class="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
          bind:value={selectedCategoryUuid}
          on:change={() => { if (selectedCategoryUuid) loadStoriesForCategory(selectedCategoryUuid); }}>
          {#each categories as c}
            <option value={c.uuid}>{c.name} ({c.uuid?.slice?.(0,8)})</option>
          {/each}
        </select>
      </div>
      <div class="md:col-span-2">
        <label for="demo-story" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Story</label>
        <select id="demo-story" class="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
          on:change={(e) => {
            const val = (e.target as HTMLSelectElement).value;
            const found = stories.find(s => String(s.cluster_number) === val);
            if (found) { selectedStory = found; runDemo(); }
          }}>
          {#each stories as s}
            <option value={s.cluster_number}>{s.title}</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- Story Selection -->
    <div class="mb-8">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
          Select a Story
        </h2>
        <button
          on:click={loadStories}
          disabled={isLoading}
          class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? "Loading..." : "Reload Stories"}
        </button>
      </div>

      {#if error}
        <div
          class="mb-4 rounded border border-yellow-400 bg-yellow-100 px-4 py-3 text-yellow-700"
        >
          <p><strong>Note:</strong> {error}</p>
          <p class="mt-1 text-sm">
            Using fallback demo data for demonstration purposes.
          </p>
        </div>
      {/if}

      {#if isLoading}
        <div class="py-8 text-center">
          <div
            class="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"
          ></div>
          <p class="mt-2 text-gray-600 dark:text-gray-400">
            Loading stories...
          </p>
        </div>
      {:else if stories.length > 0}
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          {#each stories as story}
            <button
              on:click={() => selectStory(story)}
              class="rounded-lg border p-4 text-left transition-colors hover:bg-white dark:hover:bg-gray-800 {selectedStory?.cluster_number ===
              story.cluster_number
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700'}"
            >
              <h3
                class="mb-2 line-clamp-2 font-semibold text-gray-900 dark:text-white"
              >
                {story.title}
              </h3>
              <p class="line-clamp-3 text-sm text-gray-600 dark:text-gray-400">
                {story.short_summary}
              </p>
              <div class="mt-2 flex items-center gap-2">
                <span
                  class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                >
                  {story.category}
                </span>
                {#if story.location}
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    📍 {story.location}
                  </span>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      {:else}
        <div class="py-8 text-center text-gray-500 dark:text-gray-400">
          No stories available. Try reloading or check the URL parameters.
        </div>
      {/if}
    </div>

    <!-- Demo Configuration -->
    <div class="mb-6">
      <button
        on:click={() => (showAdvancedOptions = !showAdvancedOptions)}
        class="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <span
          class="transform transition-transform {showAdvancedOptions
            ? 'rotate-90'
            : ''}">▶</span
        >
        Advanced Options
      </button>

      {#if showAdvancedOptions}
        <div
          class="mt-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
        >
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label class="flex items-center gap-2">
              <input type="checkbox" bind:checked={useRealAPI} />
              <span class="text-sm">Use Real Wikidata API</span>
            </label>

            <label class="flex items-center gap-2">
              <input type="checkbox" bind:checked={enableFallback} />
              <span class="text-sm">Enable Fallback on API Error</span>
            </label>

            <div class="flex items-center gap-2">
              <label for="text-limit" class="text-sm">Text Limit:</label>
              <input
                id="text-limit"
                type="number"
                bind:value={textLimit}
                min="1000"
                max="50000"
                step="1000"
                class="w-20 rounded border px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
              />
            </div>

            <div class="flex items-center gap-2">
              <label for="confidence-threshold" class="text-sm"
                >Confidence:</label
              >
              <input
                id="confidence-threshold"
                type="number"
                bind:value={confidenceThreshold}
                min="0.1"
                max="1.0"
                step="0.1"
                class="w-16 rounded border px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
              />
            </div>
          </div>
        </div>
      {/if}
    </div>

    {#if selectedStory}
      <!-- Demo Results -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Original Content -->
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            1. Story Content with Entity Links
          </h3>
          <div
            class="min-h-[300px] rounded-lg border border-gray-300 bg-white p-4 dark:border-gray-600 dark:bg-gray-800"
          >
            <div
              bind:this={demoContainer}
              class="demo-content prose dark:prose-invert max-w-none"
            >
              <!-- Content will be inserted here -->
            </div>
          </div>

          <details class="text-sm">
            <summary
              class="cursor-pointer font-medium text-gray-700 dark:text-gray-300"
            >
              View Original HTML
            </summary>
            <pre
              class="mt-2 overflow-x-auto rounded bg-gray-100 p-3 text-xs dark:bg-gray-700"><code
                >{originalHTML}</code
              ></pre>
          </details>
        </div>

        <!-- Extracted Text -->
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            2. Extracted Clean Text
          </h3>
          <div
            class="min-h-[200px] rounded-lg border border-gray-300 bg-blue-50 p-4 dark:border-gray-600 dark:bg-blue-900/20"
          >
            <p
              class="text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200"
            >
              {extractedText || "Processing..."}
            </p>
          </div>

          <div class="text-xs text-gray-600 dark:text-gray-400">
            <p><strong>Extraction Process:</strong></p>
            <ul class="mt-1 list-inside list-disc space-y-1">
              <li>Remove existing links and wiki elements</li>
              <li>Remove script and style tags</li>
              <li>Normalize whitespace</li>
              <li>Extract plain text content</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- API Response -->
      <div class="mt-6">
        <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          3. Wikidata API Response
        </h3>

        {#if isProcessing}
          <div
            class="rounded-lg border border-gray-300 bg-yellow-50 p-4 dark:border-gray-600 dark:bg-yellow-900/20"
          >
            <div class="flex items-center space-x-2">
              <div
                class="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-500"
              ></div>
              <span class="text-sm text-gray-700 dark:text-gray-300">
                {useRealAPI
                  ? "Calling Wikidata API..."
                  : "Simulating API call..."}
              </span>
            </div>
          </div>
        {:else if apiResponse}
          <div
            class="rounded-lg border border-gray-300 bg-green-50 p-4 dark:border-gray-600 dark:bg-green-900/20"
          >
            <pre
              class="overflow-x-auto text-xs text-gray-800 dark:text-gray-200"><code
                >{apiResponse}</code
              ></pre>
          </div>
        {:else}
          <div
            class="rounded-lg border border-gray-300 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-800"
          >
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Select a story above to see the API response.
            </p>
          </div>
        {/if}

        <div class="mt-4 text-xs text-gray-600 dark:text-gray-400">
          <p><strong>API Details:</strong></p>
          <ul class="mt-1 list-inside list-disc space-y-1">
            <li>Primary: wblinktitles action (if available)</li>
            <li>Fallback: wbsearchentities for pattern-extracted terms</li>
            <li>Endpoint: https://www.wikidata.org/w/api.php</li>
            <li>Text limit: {textLimit.toLocaleString()} characters</li>
            <li>Confidence threshold: {confidenceThreshold}</li>
            <li>
              Mode: {useRealAPI ? "Real API with fallbacks" : "Mock/Simulation"}
            </li>
          </ul>

          {#if apiResponse.includes('"entities": []')}
            <div
              class="mt-2 rounded border border-yellow-200 bg-yellow-50 p-2 dark:border-yellow-800 dark:bg-yellow-900/20"
            >
              <p class="text-xs text-yellow-800 dark:text-yellow-200">
                <strong>ℹ️ Note:</strong> The wblinktitles API returned no entities
                for this text. This is normal for some content types. The system
                will automatically try the search-based fallback approach.
              </p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Performance & Implementation Notes -->
      <div class="mt-6 rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
        <h4 class="mb-2 font-semibold text-gray-900 dark:text-white">
          Implementation Notes
        </h4>
        <div class="space-y-1 text-sm text-gray-700 dark:text-gray-300">
          <p>
            • This demo uses the same text extraction and entity linking code as
            the main application
          </p>
          <p>
            • Entity links are created and will show Wikipedia tooltips if
            enabled in experimental settings
          </p>
          <p>
            • The system falls back to pattern-based extraction if the Wikidata
            API is unavailable
          </p>
          <p>
            • Only high-confidence entities (score > {confidenceThreshold}) are
            processed
          </p>
          <p>
            • Text is limited to {textLimit.toLocaleString()} characters to prevent
            API timeouts
          </p>
          <p>
            • Real story data is loaded from: <code
              class="rounded bg-gray-200 px-1 dark:bg-gray-700"
              >/api/batches/[batchId]/categories/[categoryId]/stories</code
            >
          </p>
        </div>

        <div
          class="mt-3 rounded border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20"
        >
          <p class="text-sm text-blue-800 dark:text-blue-200">
            <strong>💡 Tip:</strong> To see Wikipedia tooltips on linked entities,
            enable "Show Wikipedia Tooltips" in the main application's experimental
            settings, then return to this demo.
          </p>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .demo-content {
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    line-height: 1.6;
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
