<script lang="ts">
  import Icon from '@iconify/svelte';

  // Props using Svelte 5 runes syntax
  interface Props {
    emoji?: string;
    className?: string;
  }

  let { emoji, className = 'w-5 h-5' }: Props = $props();

  // Comprehensive Functional Emoji to Iconify Mapping
  const EMOJI_TO_ICONIFY: Record<string, string> = {
    // Navigation & Arrows
    "🏠": "heroicons-outline:home",
    "🏡": "heroicons-outline:home-modern",
    "⬆️": "heroicons-outline:arrow-up",
    "⬇️": "heroicons-outline:arrow-down",
    "⬅️": "heroicons-outline:arrow-left",
    "➡️": "heroicons-outline:arrow-right",
    "↗️": "heroicons-outline:arrow-up-right",
    "↘️": "heroicons-outline:arrow-down-right",
    "↙️": "heroicons-outline:arrow-down-left",
    "↖️": "heroicons-outline:arrow-up-left",
    "↕️": "heroicons-outline:arrows-up-down",
    "↔️": "heroicons-outline:arrows-right-left",
    "🔙": "heroicons-outline:arrow-left",
    "🔜": "heroicons-outline:arrow-right",
    "🔝": "heroicons-outline:arrow-up",
    "↩️": "heroicons-outline:arrow-uturn-left",
    "↪️": "heroicons-outline:arrow-uturn-right",
    "⤴️": "heroicons-outline:arrow-trending-up",
    "⤵️": "heroicons-outline:arrow-trending-down",
    "🔄": "heroicons-outline:arrow-path",

    // Communication
    "📧": "heroicons-outline:envelope",
    "📨": "heroicons-outline:envelope-open",
    "📞": "heroicons-outline:phone",
    "📱": "heroicons-outline:device-phone-mobile",
    "💬": "heroicons-outline:chat-bubble-left",
    "💭": "heroicons-outline:chat-bubble-oval-left",
    "🗨️": "heroicons-outline:chat-bubble-left-ellipsis",
    "📢": "heroicons-outline:megaphone",
    "📣": "heroicons-outline:speaker-wave",
    "📲": "heroicons-outline:device-phone-mobile",
    "☎️": "heroicons-outline:phone",

    // UI Controls
    "✅": "heroicons-outline:check",
    "❌": "heroicons-outline:x-mark",
    "❎": "heroicons-outline:x-circle",
    "✔️": "heroicons-outline:check-circle",
    "⭐": "heroicons-outline:star",
    "🔍": "heroicons-outline:magnifying-glass",
    "🔎": "heroicons-outline:magnifying-glass-plus",
    "🔒": "heroicons-outline:lock-closed",
    "🔓": "heroicons-outline:lock-open",
    "🔑": "heroicons-outline:key",
    "⚙️": "heroicons-outline:cog-6-tooth",
    "🛠️": "heroicons-outline:wrench-screwdriver",
    "🔧": "heroicons-outline:wrench",
    "⛔": "heroicons-outline:no-symbol",
    "🚫": "heroicons-outline:no-symbol",
    "❗": "heroicons-outline:exclamation-circle",
    "⚠️": "heroicons-outline:exclamation-triangle",
    "ℹ️": "heroicons-outline:information-circle",
    "❓": "heroicons-outline:question-mark-circle",
    "➕": "heroicons-outline:plus",
    "➖": "heroicons-outline:minus",
    "✖️": "heroicons-outline:x-mark",

    // Files & Documents
    "📁": "heroicons-outline:folder",
    "📂": "heroicons-outline:folder-open",
    "📄": "heroicons-outline:document",
    "📃": "heroicons-outline:document-text",
    "📋": "heroicons-outline:clipboard",
    "📊": "heroicons-outline:chart-bar",
    "📈": "heroicons-outline:chart-bar",
    "📉": "heroicons-outline:presentation-chart-line",
    "🗂️": "heroicons-outline:folder",
    "🗃️": "heroicons-outline:archive-box",
    "🗄️": "heroicons-outline:archive-box",
    "📑": "heroicons-outline:document-duplicate",
    "📜": "heroicons-outline:document",
    "📰": "heroicons-outline:newspaper",
    "📓": "heroicons-outline:book-open",
    "📔": "heroicons-outline:book-open",
    "📕": "heroicons-outline:book-open",
    "📗": "heroicons-outline:book-open",
    "📘": "heroicons-outline:book-open",
    "📙": "heroicons-outline:book-open",
    "📚": "heroicons-outline:book-open",

    // Office & Business
    "💼": "heroicons-outline:briefcase",
    "🏢": "heroicons-outline:building-office",
    "🏪": "heroicons-outline:building-storefront",
    "🏦": "heroicons-outline:building-library",
    "💻": "heroicons-outline:computer-desktop",
    "🖥️": "heroicons-outline:computer-desktop",
    "🖨️": "heroicons-outline:printer",
    "💳": "heroicons-outline:credit-card",
    "💰": "heroicons-outline:banknotes",
    "💵": "heroicons-outline:currency-dollar",
    "💴": "heroicons-outline:currency-yen",
    "💶": "heroicons-outline:currency-euro",
    "💷": "heroicons-outline:currency-pound",
    "🗓️": "heroicons-outline:calendar",
    "📅": "heroicons-outline:calendar-days",
    "📆": "heroicons-outline:calendar-days",

    // Media & Entertainment
    "▶️": "heroicons-outline:play",
    "⏸️": "heroicons-outline:pause",
    "⏹️": "heroicons-outline:stop",
    "⏭️": "heroicons-outline:forward",
    "⏮️": "heroicons-outline:backward",
    "⏯️": "heroicons-outline:play-pause",
    "🔊": "heroicons-outline:speaker-wave",
    "🔇": "heroicons-outline:speaker-x-mark",
    "📷": "heroicons-outline:camera",
    "🎥": "heroicons-outline:video-camera",
    "🎬": "heroicons-outline:film",
    "🎵": "heroicons-outline:musical-note",
    "🎶": "heroicons-outline:musical-note",
    "📺": "heroicons-outline:tv",
    "📻": "heroicons-outline:radio",

    // Technology & Computing
    "⌨️": "material-symbols:keyboard",
    "🖱️": "material-symbols:mouse",
    "💾": "material-symbols:save",
    "💿": "material-symbols:album",
    "📀": "material-symbols:album",
    "💽": "material-symbols:album",
    "🔌": "material-symbols:power",
    "🔋": "heroicons-outline:battery-100",
    "📠": "material-symbols:fax",

    // Transportation
    "🚗": "heroicons-outline:truck",
    "🚕": "heroicons-outline:truck",
    "🚙": "heroicons-outline:truck",
    "🚌": "heroicons-outline:truck",
    "🚎": "heroicons-outline:truck",
    "🏎️": "heroicons-outline:truck",
    "🚓": "heroicons-outline:truck",
    "🚑": "heroicons-outline:truck",
    "🚒": "heroicons-outline:truck",
    "🚐": "heroicons-outline:truck",
    "🛻": "heroicons-outline:truck",
    "🚚": "heroicons-outline:truck",
    "🚛": "heroicons-outline:truck",
    "🚜": "heroicons-outline:truck",
    "🛴": "material-symbols:directions-bike",
    "🚲": "material-symbols:directions-bike",
    "🛵": "material-symbols:two-wheeler",
    "🏍️": "material-symbols:two-wheeler",
    "✈️": "material-symbols:flight",
    "🛩️": "material-symbols:flight",
    "🛫": "material-symbols:flight-takeoff",
    "🛬": "material-symbols:flight-land",
    "🚁": "material-symbols:helicopter",
    "🚂": "material-symbols:train",
    "🚆": "material-symbols:train",
    "🚄": "material-symbols:train",
    "🚅": "material-symbols:train",
    "🚈": "material-symbols:train",
    "🚝": "material-symbols:train",
    "🚞": "material-symbols:train",
    "🚋": "material-symbols:tram",
    "🚃": "material-symbols:train",
    "🚟": "material-symbols:train",
    "🚠": "material-symbols:cable-car",
    "🚡": "material-symbols:cable-car",
    "⛵": "material-symbols:sailing",
    "🛶": "material-symbols:kayaking",
    "🚤": "material-symbols:directions-boat",
    "🛥️": "material-symbols:directions-boat",
    "🚢": "material-symbols:directions-boat",

    // Science & Nature
    "🔬": "material-symbols:science",
    "🧪": "material-symbols:science",
    "🧬": "material-symbols:biotech",
    "💉": "material-symbols:vaccines",
    "💊": "material-symbols:medication",
    "🩺": "heroicons-outline:heart",
    "🌡️": "heroicons-outline:fire",
    "🔭": "material-symbols:telescope",
    "🗿": "material-symbols:landscape",
    "⚗️": "material-symbols:science",
    "🧫": "material-symbols:science",
    "🧲": "material-symbols:magnet-on",

    // Weather & Nature
    "☀️": "heroicons-outline:sun",
    "🌤️": "material-symbols:partly-cloudy-day",
    "⛅": "material-symbols:cloud",
    "🌥️": "material-symbols:cloud",
    "☁️": "heroicons-outline:cloud",
    "🌦️": "material-symbols:rainy",
    "🌧️": "material-symbols:rainy",
    "⛈️": "material-symbols:thunderstorm",
    "🌩️": "material-symbols:thunderstorm",
    "🌨️": "material-symbols:weather-snowy",
    "❄️": "material-symbols:ac-unit",
    "☃️": "material-symbols:ac-unit",
    "⛄": "material-symbols:ac-unit",
    "🌬️": "material-symbols:air",
    "💨": "material-symbols:air",
    "🌪️": "material-symbols:tornado",
    "🌫️": "material-symbols:foggy",
    "🌊": "heroicons-outline:lifebuoy",
    "💧": "material-symbols:water-drop",
    "💦": "material-symbols:water-drop",

    // Sports & Activities
    "⚽": "material-symbols:sports-soccer",
    "🏀": "material-symbols:sports-basketball",
    "🏈": "material-symbols:sports-football",
    "⚾": "material-symbols:sports-baseball",
    "🎾": "material-symbols:sports-tennis",
    "🏐": "material-symbols:sports-volleyball",
    "🏉": "material-symbols:sports-rugby",
    "🥎": "material-symbols:sports-baseball",
    "🏓": "material-symbols:sports-tennis",
    "🏸": "material-symbols:sports-tennis",
    "🥅": "material-symbols:sports-soccer",
    "🏑": "material-symbols:sports-hockey",
    "🏒": "material-symbols:sports-hockey",
    "🥍": "material-symbols:sports-tennis",
    "🏏": "heroicons-outline:trophy",
    "🎱": "material-symbols:sports-esports",
    "🏆": "heroicons-outline:trophy",
    "🥇": "heroicons-outline:trophy",
    "🥈": "heroicons-outline:trophy",
    "🥉": "heroicons-outline:trophy",
    "🎖️": "heroicons-outline:trophy",
    "🏅": "heroicons-outline:trophy",
    "🎗️": "heroicons-outline:trophy",

    // Time & Calendar
    "⏰": "heroicons-outline:clock",
    "⏲️": "heroicons-outline:clock",
    "⏱️": "heroicons-outline:clock",
    "⏳": "heroicons-outline:clock",
    "⌛": "heroicons-outline:clock",

    // Additional unique emojis
    "🎯": "material-symbols:gps-fixed",
    "🎲": "material-symbols:casino",
    "🃏": "material-symbols:casino",
    "🀄": "material-symbols:casino",
    "🎴": "material-symbols:casino",
    "🎭": "material-symbols:theater-comedy",
    "🎪": "material-symbols:festival",
    "🎧": "material-symbols:headphones",
    "🎼": "heroicons-outline:musical-note",
    "🎹": "material-symbols:piano",
    "🥁": "material-symbols:music-note",
    "🎷": "material-symbols:music-note",
    "🎺": "material-symbols:music-note",
    "🎸": "material-symbols:music-note",
    "🪕": "material-symbols:music-note",
    "🎻": "material-symbols:music-note",
    "🌍": "heroicons-outline:globe-europe-africa",
    "🌎": "heroicons-outline:globe-americas",
    "🌏": "heroicons-outline:globe-asia-australia",
    "⛅️": "material-symbols:cloud",

    // Additional emojis found in story data
    "🆘": "material-symbols:emergency",
    "🗳️": "material-symbols:how-to-vote",
    "🕊️": "material-symbols:eco",
    "💥": "heroicons-outline:bolt",
    "🤝": "material-symbols:handshake",
    "🪖": "material-symbols:security",
    "🚪": "heroicons-outline:arrow-right-on-rectangle",

    // Recently found unmapped emojis
    "🌐": "heroicons-outline:globe-alt",
    "🕵️‍♂️": "heroicons-outline:eye",
    "🕵‍♂": "heroicons-outline:eye",
    "🏛️": "heroicons-outline:building-library",
    "🏛": "heroicons-outline:building-library",
    "🎤": "material-symbols:mic",
    "🌾": "material-symbols:agriculture",
    "🛄": "material-symbols:luggage",
    "🛃": "material-symbols:security",
    "📶": "material-symbols:signal-cellular-alt",
    "🛒": "material-symbols:shopping-cart",
    "🛡️": "heroicons-outline:shield-check",
    "🛡": "heroicons-outline:shield-check",
    "🔐": "heroicons-outline:lock-closed",
    "🤖": "material-symbols:smart-toy",
    "🕳️": "material-symbols:radio-button-unchecked",
    "🕳": "material-symbols:radio-button-unchecked",
    "✨": "heroicons-outline:sparkles",
    "🪐": "material-symbols:public",
    "🦎": "material-symbols:pets",
    "🧠": "material-symbols:psychology",
    "⛳": "material-symbols:golf-course",
    "🕹️": "material-symbols:sports-esports",
    "🕹": "material-symbols:sports-esports",
    "🍌": "material-symbols:eco",
    "🎮": "material-symbols:sports-esports",
    "🛸": "material-symbols:flight",

    // More unmapped emojis from console warnings
    "🪧": "heroicons-outline:megaphone",
    "🗺️": "heroicons-outline:map",
    "🗺": "heroicons-outline:map",
    "🦋": "heroicons-outline:sparkles",
    "🚀": "heroicons-outline:rocket-launch",
    "🔥": "heroicons-outline:fire",
    "🕯️": "material-symbols:candle",
    "🕯": "material-symbols:candle",
    "🚔": "heroicons-outline:shield-check",
    "🛑": "heroicons-outline:stop-circle",
    "🍏": "material-symbols:eco",
    "🍎": "material-symbols:eco",
    "🔮": "material-symbols:auto-awesome",
    "🐧": "material-symbols:pets",
    "🦊": "material-symbols:pets",
    "🪟": "material-symbols:window",
    "🛍️": "material-symbols:shopping-bag",
    "🛍": "material-symbols:shopping-bag",
    "📦": "material-symbols:inventory",
    "🖼️": "heroicons-outline:photo",
    "🖼": "heroicons-outline:photo",
    "⚖️": "heroicons-outline:scale",
    "⚖": "heroicons-outline:scale",
    "🌱": "material-symbols:eco",
    "🎣": "material-symbols:sports",
    "🏔️": "material-symbols:landscape",
    "🏔": "material-symbols:landscape",
    "🪙": "heroicons-outline:currency-dollar",
    "🏊‍♂️": "material-symbols:pool",
    "🏊‍♂": "material-symbols:pool",
    "🏧": "material-symbols:atm",
    "🍽️": "material-symbols:restaurant",
    "🍽": "material-symbols:restaurant",
    "🏥": "heroicons-outline:heart",
    "🏘️": "heroicons-outline:home-modern",
    "🏘": "heroicons-outline:home-modern",
    "⚡": "heroicons-outline:bolt",
    "🚍": "heroicons-outline:truck",
    "🎉": "material-symbols:celebration",
    "😔": "material-symbols:sentiment-dissatisfied",
    "🌲": "material-symbols:park",
    "🎓": "heroicons-outline:academic-cap",
    "🚧": "material-symbols:construction",
    "🐬": "material-symbols:pets",
    "💱": "heroicons-outline:currency-dollar",
    "✉️": "heroicons-outline:envelope",
    "✉": "heroicons-outline:envelope",
    "🛢️": "material-symbols:oil-barrel",
    "🛢": "material-symbols:oil-barrel",
    "🦠": "material-symbols:coronavirus",
    "👶": "material-symbols:child-care",
    "🏃‍♂️": "material-symbols:directions-run",
    "🏃‍♂": "material-symbols:directions-run",
    "⛽": "material-symbols:local-gas-station",
    "🇧🇷": "heroicons-outline:flag",
    "📝": "heroicons-outline:pencil-square",
    "🚶‍♀️": "material-symbols:directions-walk",
    "🚶‍♀": "material-symbols:directions-walk",
    "🐊": "material-symbols:pets",
    "🌞": "heroicons-outline:sun",
    "🏗️": "material-symbols:construction",
    "🏗": "material-symbols:construction",
    "🛟": "material-symbols:life-ring",
    "🚴‍♂️": "material-symbols:directions-bike",
    "🚴‍♂": "material-symbols:directions-bike",
    "🚇": "material-symbols:train",
    "🏫": "heroicons-outline:building-office-2",
    "🥐": "material-symbols:bakery-dining",
    "☔": "material-symbols:umbrella",
    "🧭": "material-symbols:explore",
    "🐦": "material-symbols:pets",
    "☕": "material-symbols:local-cafe",
    "🚻": "material-symbols:wc",
    "🪂": "material-symbols:paragliding",
    "🥊": "material-symbols:sports-mma",
    "🛂": "material-symbols:security",
    "⛏️": "material-symbols:construction",
    "⛏": "material-symbols:construction",
    "🛣️": "material-symbols:route",
    "🛣": "material-symbols:route",
    "⚔️": "heroicons-outline:sword",
    "⚔": "heroicons-outline:sword",
    "🍲": "material-symbols:restaurant",
    "💣": "heroicons-outline:fire",
    "🧨": "heroicons-outline:fire",
    "🍇": "material-symbols:eco",
    "🚦": "material-symbols:traffic",
    "🛕": "material-symbols:temple-hindu",
    "🔫": "material-symbols:gavel",
    "💝": "heroicons-outline:gift",
    "🧳": "material-symbols:luggage",
    "🕵️‍♀️": "heroicons-outline:eye",
    "🕵‍♀": "heroicons-outline:eye",
    "📬": "heroicons-outline:inbox",
    "🧑‍⚖️": "heroicons-outline:scale",
    "🧑‍⚖": "heroicons-outline:scale",
    "🇮🇳": "heroicons-outline:flag",
    "✊": "material-symbols:front-hand",
    "🚨": "heroicons-outline:exclamation-triangle",
    "🧐": "heroicons-outline:magnifying-glass",
    "🌄": "material-symbols:landscape",
    "🦟": "material-symbols:pest-control",
    "☢️": "material-symbols:nuclear",
    "☢": "material-symbols:nuclear",
    "🏙️": "heroicons-outline:building-office",
    "🏙": "heroicons-outline:building-office",
    "🥚": "material-symbols:egg",
    "🎨": "material-symbols:palette",
    "🏁": "material-symbols:flag",
    "🏃‍♀️": "material-symbols:directions-run",
    "🏃‍♀": "material-symbols:directions-run"
  };

  // Simple function to get icon name
  function getIconName(emoji: string): string | null {
    if (!emoji) return null;
    
    // Trim whitespace and remove variation selectors
    const trimmed = emoji.trim();
    const normalized = trimmed.replace(/[\uFE0E\uFE0F]/g, "");
    
    // Try mapping the raw trimmed emoji, then normalized version
    const mapped = EMOJI_TO_ICONIFY[trimmed] || EMOJI_TO_ICONIFY[normalized] || null;
    
    // Log unmapped emojis for debugging
    if (!mapped) {
      console.warn(`🚫 Unmapped emoji: "${emoji}" (trimmed: "${trimmed}", normalized: "${normalized}")`);
    }
    
    return mapped;
  }

  // Function to get library-specific scaling
  function getScaledClassName(iconName: string | null, baseClassName: string): string {
    if (!iconName) return baseClassName;
    
    // Extract size from base className (e.g., "w-3 h-3", "w-4 h-4" or "w-5 h-5")
    const sizeMatch = baseClassName.match(/w-(\d+)\s+h-(\d+)/);
    if (!sizeMatch) return baseClassName;
    
    const baseSize = parseInt(sizeMatch[1]);
    let scaledSize = baseSize;
    
    // Normalize all icons to consistent visual sizes regardless of library
    // Target: Make all icons appear the same visual size
    if (iconName.startsWith('material-symbols:')) {
      // Material Symbols are very thin and small, scale up dramatically
      if (baseSize <= 3) scaledSize = 6;      // 12px → 24px
      else if (baseSize <= 4) scaledSize = 7; // 16px → 28px
      else if (baseSize <= 5) scaledSize = 8; // 20px → 32px
      else scaledSize = Math.min(12, Math.ceil(baseSize * 1.6));
    } else if (iconName.startsWith('heroicons-outline:')) {
      // Heroicons are well-balanced, use as baseline with slight adjustment
      scaledSize = baseSize;
    } else if (iconName.startsWith('tabler:')) {
      // Tabler icons are very bold and large, scale down dramatically
      if (baseSize <= 3) scaledSize = 2;      // 12px → 8px
      else if (baseSize <= 4) scaledSize = 2; // 16px → 8px
      else if (baseSize <= 5) scaledSize = 3; // 20px → 12px
      else scaledSize = Math.max(2, Math.floor(baseSize * 0.5));
    }
    
    // Ensure minimum size but allow smaller for very bold icons
    scaledSize = Math.max(2, scaledSize);
    
    // Replace the size in the className
    return baseClassName.replace(/w-\d+\s+h-\d+/, `w-${scaledSize} h-${scaledSize}`);
  }

  // Get the icon name for current emoji
  let iconName = $derived(getIconName(emoji || ''));
  
  // Get the scaled className based on icon library
  let scaledClassName = $derived(getScaledClassName(iconName, className));
</script>

{#if iconName}
  <Icon icon={iconName} class={scaledClassName} />
{:else if emoji}
  <span class={className}>{emoji}</span>
{/if}