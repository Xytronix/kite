# Kite - News. Elevated.

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)

This repository contains public files for [Kite](https://kite.kagi.com), news app for people who want a healthy news diet, developed by [Kagi](https://kagi.com).

Kite is designed for people who want to stay informed without getting overwhelmed. We provide thrice-daily updates of the most important news stories, from carefully curated sources and summarized by advanced language models to give you the essential information you need. We strive for diversity and transparency of resources and welcome your contributions to widen perspectives. This multi-source approach helps reveal the full picture beyond any single viewpoint.

Most of what powers Kite is open sourced and is found in this repository.

This includes

- Kite web app
- Community curated feeds
- Media information

## Core Principles

- Updated only once per day - no endless scrolling (12PM UTC)
- Facts and perspectives, opinion-free
- Zero tracking, zero ads
- Pure signal, no noise
- Quality over quantity
- Complete news diet in 5 minutes

You can read more about core principles behind Kite

- [Avoid News: Towards a Healthy News Diet](https://www.gwern.net/docs/culture/2010-dobelli.pdf) ([HN discussion](https://news.ycombinator.com/item?id=21430337))
- [News is bad for you](http://www.theguardian.com/media/2013/apr/12/news-is-bad-rolf-dobelli) ([HN discussion](https://news.ycombinator.com/item?id=6894244))
- [Stop reading news](https://fs.blog/2013/12/stop-reading-news/) ([HN discussion](https://news.ycombinator.com/item?id=19084099))

If you prefer to watch a short video, check this Ted talk: [Four reasons you should stop watching the news | Rolf Dobelli](https://www.youtube.com/watch?v=-miTTiaqFlI).

## Table of Contents

- [Report System](#report-system)
- [Editing Feed Categories (`kite_feeds.json`)](#editing-feed-categories-kite_feedsjson)
  - [Category Structure and Parameters](#category-structure-and-parameters)
  - [Category Types and Topical Focus Requirements](#category-types-and-topical-focus-requirements)
  - [Language Requirements](#language-requirements)
  - [Feed Quality Guidelines](#feed-quality-guidelines)
  - [Common Issues and Solutions](#common-issues-and-solutions)
  - [Adding a New Category](#adding-a-new-category)
- [RSS and Atom Feed Support](#rss-and-atom-feed-support)
  - [RSS Feed Quality Guidelines](#rss-feed-quality-guidelines)
- [Localization (`src/lib/locales/`)](#localization-srcliblocales)
  - [Display Names in Categories](#display-names-in-categories)
  - [Locale Files](#locale-files)
  - [Adding Translations](#adding-translations)
  - [Translation Guidelines](#translation-guidelines)
- [Editing Media Information (`media_data.json`)](#editing-media-information-media_datajson)
  - [Media Entry Structure and Parameters](#media-entry-structure-and-parameters)
  - [Media Typology Classifications](#media-typology-classifications)
  - [Country Guidelines](#country-guidelines)
  - [Domain Guidelines](#domain-guidelines)
  - [Description Guidelines](#description-guidelines)
  - [Ownership Information](#ownership-information)
  - [Adding New Media Organizations](#adding-new-media-organizations)
  - [Updating Existing Entries](#updating-existing-entries)
  - [Information Sources](#information-sources)
  - [Quality Standards](#quality-standards)
- [Developer Setup](#developer-setup)

## Report System

Kite includes a built-in report system that allows users to report issues with stories, categorization, sources, or content quality.

When a user submits a report, they are redirected to GitHub's issue creation page with pre-filled content, allowing them to create an issue using their own GitHub account.

## Editing Feed Categories (`kite_feeds.json`)

<details>
<summary>📝 How to Edit Categories</summary>

To edit community curated categories, submit a pull request editing `kite_feeds.json`. If you do not know how to do that, you can [open an issue](https://github.com/kagisearch/kite-public/issues/new/choose) and share the feeds you want to add there.

</details>

<details>
<summary>🏗️ Category Structure and Parameters</summary>

Each category in `kite_feeds.json` follows this structure:

```jsonc
{
  "Category Name": {
    "category_type": "country|region|topic",
    "source_language": "en|de|fr|es|pt|it|nl|zh-Hans|zh-Hant|ja|hi|uk|etc",
    "display_names": {
      "en": "English Name",
      "de": "German Name", 
      "fr": "French Name",
      // ... other language translations
    },
    "feeds": [
      "https://example.com/rss-feed-1",
      "https://example.com/rss-feed-2"
    ]
  }
}
```

#### Required Parameters

- **`category_type`**: Must be one of:
  - `"country"` - For country-specific news (e.g., "Germany", "France")
  - `"region"` - For regional coverage (e.g., "Europe", "USA | California") 
  - `"topic"` - For subject-specific news (e.g., "Technology", "Climate")

- **`source_language`**: Primary language of the feeds (ISO 639-1 code)

- **`display_names`**: Object containing category name translations for supported languages

- **`feeds`**: Array of RSS feed URLs

</details>

<details>
<summary>📂 Category Types and Topical Focus Requirements</summary>

### Category Types and Topical Focus Requirements

#### Country Categories (`category_type: "country"`)
**Purpose**: News specifically about events, politics, and developments within that country.

**Feed Requirements**:
- ✅ **DO**: Include feeds that focus on domestic news, local politics, national economy, internal affairs
- ✅ **DO**: Use country-specific sections of news sites (e.g., `/us/`, `/politics/`, `/domestic/`)
- ❌ **DON'T**: Include general world news feeds from that country's media
- ❌ **DON'T**: Include international news sections

**Examples**:
```jsonc
// ✅ GOOD - US domestic news
"https://www.cnn.com/politics/" // US politics
"https://www.npr.org/sections/politics/" // US political coverage
"https://www.washingtonpost.com/politics/" // US domestic politics

// ❌ BAD - World news from US sources  
"https://www.cnn.com/world/" // International news
"https://www.npr.org/sections/world/" // World news
```

#### Region Categories (`category_type: "region"`)
**Purpose**: News about a geographic region or administrative division.

**Naming Convention**: Use format `"Country | Region"` for sub-national regions.

**Examples**:
- `"Europe"` - European affairs, EU politics, cross-border issues
- `"USA | California"` - California state news, local politics, regional issues
- `"Germany | Bavaria"` - Bavarian state news and politics

#### Topic Categories (`category_type: "topic"`)
**Purpose**: Subject-specific news regardless of geographic origin.

**Examples**:
- `"Economy"` - Economic news, markets, financial developments
- `"Technology"` - Tech industry news, product launches, innovation
- `"Climate"` - Environmental news, climate change, sustainability
- `"Space"` - Space exploration, astronomy, aerospace industry

</details>

<details>
<summary>🌐 Language Requirements</summary>

### Language Requirements

- **Preferred**: All feeds within a category use the same language
- **Acceptable**: Mixed languages are okay for category completion when same-language sources are insufficient
- The `source_language` parameter should reflect the primary/majority language of the feeds
- When possible, create separate categories for different languages covering the same topic/region
- Prioritize same-language sources but don't exclude quality sources due to language alone

</details>

<details>
<summary>✅ Feed Quality Guidelines</summary>

### Feed Quality Guidelines

When adding RSS feeds:

1. **Verify feed functionality**: Ensure the feed is active and has recent content (daily updates preferred)
2. **Check topical relevance**: Feeds must align with the category's purpose and geographic/topical focus
3. **Quality standards**: Choose reputable sources with high-quality journalism
4. **Avoid**: Gossip sites, SEO content farms, low-quality aggregators
5. **Official feeds only**: Use RSS feeds provided directly by news organizations
6. **Respect robots.txt**: Kite respects website crawling policies and terms of service
7. **No scraping services**: Avoid third-party feed generators like RSSHub that scrape content

### Minimum Requirements

- **25 feeds minimum** per category to ensure quality coverage
- All feeds must be working and regularly updated
- Feeds must be topically relevant to the category's focus
- Language consistency across all feeds in a category

</details>

<details>
<summary>⚠️ Common Issues and Solutions</summary>

### Common Issues and Solutions

#### ❌ Problem: Generic World News in Country Categories
Many contributors add general international news feeds from a country's media to that country's category.

**Example of what NOT to do**:
```jsonc
"USA": {
  "feeds": [
    "https://www.cnn.com/world/", // ❌ World news from US source
    "https://www.npr.org/sections/world/" // ❌ International news section
  ]
}
```

#### ✅ Solution: Focus on Domestic/Topical Content
Use feeds that specifically cover the country's internal affairs or the topic's subject matter.

**Example of what TO do**:
```jsonc
"USA": {
  "category_type": "country",
  "source_language": "en",
  "display_names": {
    "en": "USA",
    "de": "USA",
    "fr": "États-Unis"
  },
  "feeds": [
    "https://www.cnn.com/politics/", // ✅ US domestic politics
    "https://www.npr.org/sections/politics/", // ✅ US political coverage
    "https://www.washingtonpost.com/politics/" // ✅ US internal affairs
  ]
}

"Economy": {
  "category_type": "topic",
  "source_language": "en", 
  "display_names": {
    "en": "Economy",
    "de": "Wirtschaft",
    "fr": "Économie"
  },
  "feeds": [
    "https://www.reuters.com/business/", // ✅ Business/economic news
    "https://www.ft.com/markets/", // ✅ Financial markets
    "https://www.bloomberg.com/economics/" // ✅ Economic analysis
  ]
}
```

#### Feed Selection Strategy

1. **For Country Categories**: Look for `/domestic/`, `/politics/`, `/national/`, `/inland/` sections
2. **For Topic Categories**: Use subject-specific feeds regardless of source country
3. **For Region Categories**: Focus on cross-border issues and regional affairs

#### Cross-Category Feed Discovery

When adding a news source, always check if it offers feeds for multiple categories:

**✅ DO Check for Multiple Feeds**:
```jsonc
// Example: Reuters offers multiple topic-specific feeds
"https://www.reuters.com/business/rss"     // → Economy category
"https://www.reuters.com/technology/rss"   // → Technology category  
"https://www.reuters.com/world/us/rss"     // → USA category
"https://www.reuters.com/sports/rss"       // → Sports category
```

**Research Strategy**:
1. **Check the source's RSS page** (often `/rss`, `/feeds`, or in footer)
2. **Look for section-specific feeds** (`/politics/rss`, `/business/feed`, etc.)
3. **Test different URL patterns** (`/category/rss.xml`, `/section/feed`)
4. **Add relevant feeds to appropriate categories** in the same pull request

**Benefits of Cross-Category Discovery**:
- Maximizes value from each quality source
- Ensures consistent coverage across categories
- Reduces duplicate research effort
- Improves overall feed diversity

</details>

<details>
<summary>➕ Adding a New Category</summary>

### Adding a New Category

1. Choose appropriate `category_type` based on your category's focus
2. Set the correct `source_language` for your feeds  
3. Provide `display_names` with at least English translation
4. Ensure you have at least 25 high-quality, topically relevant feeds
5. **Verify topical focus**: Confirm feeds match the category's geographic or subject scope
6. Test that all feeds are working and contain recent content
7. Submit a pull request with your changes

</details>

## RSS and Atom Feed Support

Kite supports both RSS and Atom feed formats. When adding feeds to `kite_feeds.json`, ensure they are valid RSS or Atom feeds that return proper XML content.

### How to Find RSS Feeds

Most news websites provide RSS feeds, but they're not always easy to find. Here are proven methods:

#### 1. **Check Common RSS Locations**
```
https://example.com/rss
https://example.com/rss.xml
https://example.com/feed
https://example.com/feed.xml
https://example.com/feeds
https://example.com/atom.xml
```

#### 2. **Look for RSS Links on Website**
- **Footer links**: "RSS", "Feeds", "Subscribe"
- **Section pages**: Politics, Business, Sports pages often have their own feeds
- **RSS icons**: 🟠 Orange RSS symbol or "RSS" text links

#### 3. **Check Website Sitemap**
```
https://example.com/sitemap.xml
https://example.com/sitemap_index.xml
```
Sitemaps often list all available RSS feeds

#### 4. **Try Section-Specific Patterns**
```
https://example.com/politics/rss
https://example.com/business/feed
https://example.com/sports/rss.xml
https://example.com/news/domestic/rss
```

#### 5. **Browser Developer Tools**
- View page source and search for "rss", "feed", or "xml"
- Look in `<head>` section for `<link rel="alternate" type="application/rss+xml">`

#### 6. **Search Engine Discovery**
Use search engines to find RSS feeds on specific sites:
```
site:example.com rss
site:example.com feed
site:example.com "rss feed"
site:example.com filetype:xml
```

#### 7. **Test Feed Quality**
- Open RSS URL in browser - should show XML with recent articles
- **Verify content is included** - Feed must contain article text/summaries, not just headlines
- Check that feed updates regularly (daily preferred)
- Ensure articles have titles, dates, and substantial content

#### 8. **Legal Considerations**
- **RSS feeds are generally intended for syndication** - publishers provide them for distribution
- **Check for restrictions** - some feeds may have usage terms in the feed description

<details>
<summary>🔍 RSS Feed Quality Guidelines</summary>

### RSS Feed Quality Guidelines

#### Preferred Feed Types
- **Full-text RSS feeds** - Feeds that include complete article content (preferred)
- **Official RSS feeds** - Feeds provided directly by the news organization
- **Topic-specific feeds** - Feeds focused on specific subjects rather than general news

#### Common RSS Feed Issues

**Headlines Only**: Some feeds only provide article titles and links without content
- ❌ **Avoid** - Kite needs content in the feed, not just headlines
- 🔍 **Look for alternatives** - Find feeds with article summaries or full content

**Truncated Content**: Feeds that cut off article text after a few sentences
- ✅ **Acceptable** - Truncated content is okay, better than headlines only
- 💡 **Tip** - Look for feeds with more complete content when available

**Broken RSS Feeds**: Feeds that return errors or invalid XML
- ❌ **Avoid** - These feeds won't work in Kite
- 🔍 **Test** - Always verify feeds are working before adding

#### How to Check RSS Feed Quality

1. **Open the RSS URL directly** in your browser
   - Should display XML content with `<rss>` or `<feed>` tags
   - Should contain recent articles (updated within days)

2. **Check content completeness**:
   ```xml
   <item>
     <title>Article Title</title>
     <description>Full article text or summary...</description>
     <pubDate>Recent date</pubDate>
   </item>
   ```

3. **Verify it's working**:
   - Feed loads without errors
   - Contains multiple recent articles
   - Articles have titles, dates, and some content

#### Feed Selection Preferences

**✅ DO Use**:
- Official RSS feeds from the news organization's website
- Topic-specific feeds (e.g., `/politics/`, `/business/`, `/technology/`)
- Feeds with full or substantial article content
- Feeds updated regularly (daily or more frequent)

**❌ DON'T Use**:
- Google News RSS feeds when the original source already exists
- Generic "world news" feeds for country-specific categories
- Feeds that haven't been updated in weeks/months
- Feeds that return only social media posts or brief updates
- **Scraping services** like RSSHub or similar feed generators
- **Feeds that violate robots.txt** - We respect website crawling policies

**Examples**:
```jsonc
// ✅ GOOD - Official, topic-specific feeds
"https://www.reuters.com/business/finance/rss" // Reuters finance section
"https://www.bbc.com/news/business/rss.xml"    // BBC business news

// ❌ AVOID - Google News aggregation when original exists
"https://news.google.com/rss/search?q=site:reuters.com" // Use Reuters directly instead

// ❌ AVOID - Generic world news for country categories  
"https://www.cnn.com/services/rss/all.rss" // Too broad for "USA" category
```

</details>

## Localization (`src/lib/locales/`)

<details>
<summary>🌍 Display Names in Categories</summary>

### Display Names in Categories

All categories in `kite_feeds.json` must include `display_names` with translations:

```jsonc
{
  "USA": {
    "display_names": {
      "en": "USA",           // English (required)
      "de": "USA",           // German
      "fr": "États-Unis",    // French  
      "es": "EE.UU.",        // Spanish
      "pt": "EUA",           // Portuguese
      "it": "USA",           // Italian
      "nl": "VS",            // Dutch
      "zh-Hans": "美国",      // Chinese Simplified
      "zh-Hant": "美國",      // Chinese Traditional
      "ja": "アメリカ",        // Japanese
      "hi": "यूएसए",         // Hindi
      "uk": "США"            // Ukrainian
    }
  }
}
```

</details>

<details>
<summary>📁 Locale Files</summary>

### Locale Files

Translation files are located in `src/lib/locales/` with one JSON file per language:

- `en.json` - English (base language)
- `de.json` - German
- `fr.json` - French
- `es.json` - Spanish
- etc.

</details>

<details>
<summary>➕ Adding Translations</summary>

### Adding Translations

1. **Add to English first** (`src/lib/locales/en.json`):
```json
{
  "category.economy": "Economy",
  "category.usa": "USA"
}
```

2. **Add to other languages** (e.g., `src/lib/locales/de.json`):
```json
{
  "category.economy": "Wirtschaft", 
  "category.usa": "USA"
}
```

</details>

<details>
<summary>📋 Translation Guidelines</summary>

### Translation Guidelines

- **English first**: Always add new keys to `en.json` before other languages
- **Consistent naming**: Use dot notation (`category.economy`, `ui.button.save`)
- **Complete coverage**: All locale files should have the same keys as `en.json`
- **Cultural adaptation**: Translate meaning and context, not just literal words
- **No duplicates**: Each translation key should appear only once per file

</details>

## Editing Media Information (`media_data.json`)

Kite uses `media_data.json` to display additional context about news sources, including ownership, funding model, and editorial stance. This transparency helps users understand the perspective and potential biases of their news sources.

<details>
<summary>🏗️ Media Entry Structure and Parameters</summary>

### Media Entry Structure and Parameters

Each media organization entry follows this structure:

```jsonc
{
  "country": "Germany",
  "organization": "Der Spiegel",
  "domains": [
    "spiegel.de",
    "spiegel.com"
  ],
  "description": "Der Spiegel is a weekly news magazine and digital news platform established in 1947, known for its investigative journalism and political coverage.",
  "owner": "Spiegel Employees (50.5%), Mohn family (25.5%), Augstein family (24%)",
  "typology": "Private Media"
}
```

#### Required Parameters

- **`country`**: ISO country name where the organization is based (use empty string `""` for international/global organizations)
- **`organization`**: Official name of the media organization
- **`domains`**: Array of primary domains used by the organization (without `https://` or `www.`)
- **`description`**: Comprehensive description of the organization, its focus, and editorial approach
- **`owner`**: Ownership structure with percentages when available
- **`typology`**: Media funding/ownership classification (see below)

#### Optional Parameters

- **`logo_url`**: Direct URL to the organization's logo image
- **`iconify_icon`**: Iconify icon identifier (e.g., `"simple-icons:bbc"`)

</details>

<details>
<summary>📊 Media Typology Classifications</summary>

### Media Typology Classifications

Use one of these standardized classifications:

#### `"Private Media"`
- Privately owned commercial media organizations
- Funded through advertising, subscriptions, or private investment
- Editorial independence varies by ownership structure

#### `"State Funded Media"`
- Government-funded or government-controlled media
- Includes public broadcasters with government funding
- May have varying degrees of editorial independence

#### `"Public Media"`
- Public service media with editorial independence
- Funded through public means but editorially independent
- Often governed by public boards rather than direct government control

</details>

<details>
<summary>🌍 Country Guidelines</summary>

### Country Guidelines

- Use full country names as they appear in the feeds categories
- For international organizations, use empty string `""`
- For regional organizations, use the primary country of operation
- Maintain consistency with existing country naming in the file

</details>

<details>
<summary>🌐 Domain Guidelines</summary>

### Domain Guidelines

- Include all primary domains used by the organization
- Use root domains without protocols (`example.com`, not `https://www.example.com`)
- Include both international and local domain variants when applicable
- List the primary domain first in the array

</details>

<details>
<summary>📝 Description Guidelines</summary>

### Description Guidelines

Write comprehensive descriptions that include:

1. **Organization type**: Newspaper, magazine, broadcaster, digital platform, etc.
2. **Founding information**: Year established and key historical context
3. **Editorial focus**: Political stance, subject specialization, target audience
4. **Geographic coverage**: Local, national, regional, or international scope
5. **Notable characteristics**: Investigative focus, political alignment, special features

</details>

<details>
<summary>🏢 Ownership Information</summary>

### Ownership Information

Provide detailed ownership structure:

- Include major shareholders with percentages when available
- Specify ownership type (family, corporate, cooperative, etc.)
- Note any significant changes in ownership
- For complex structures, focus on ultimate controlling interests

**Examples**:
```jsonc
// Detailed ownership with percentages
"owner": "Spiegel Employees (50.5%), Mohn family (25.5%), Augstein family (24%)"

// Corporate ownership
"owner": "Mediahuis"

// Government ownership
"owner": "German Federal Government"

// Family ownership
"owner": "Thomson Family"

// Cooperative ownership
"owner": "taz Cooperative - Readers ownership"
```

</details>

<details>
<summary>➕ Adding New Media Organizations</summary>

### Adding New Media Organizations

1. **Research thoroughly**: Verify all information from reliable sources
2. **Check existing entries**: Ensure no duplicates exist
3. **Use consistent formatting**: Follow the established structure and style
4. **Provide sources**: Include your information sources in the pull request description
5. **Verify domains**: Ensure all listed domains are active and belong to the organization

</details>

<details>
<summary>🔄 Updating Existing Entries</summary>

### Updating Existing Entries

When updating existing media information:

- Verify current accuracy of all fields
- Update ownership changes or organizational restructuring
- Improve descriptions with additional context when helpful
- Add missing optional parameters (logo_url, iconify_icon) when available
- Cite sources for any significant changes

</details>

<details>
<summary>📚 Information Sources</summary>

### Information Sources

Base your entries on reliable sources such as:

- Organization's official "About" pages
- Media ownership databases (e.g., statemediamonitor.com)
- Journalism organizations and press freedom groups
- Academic media studies and reports
- Financial regulatory filings for public companies

**Always cite your sources in pull request descriptions.**

</details>

<details>
<summary>✅ Quality Standards</summary>

### Quality Standards

Ensure all entries meet these standards:

- **Accuracy**: All information must be factually correct and current
- **Neutrality**: Descriptions should be objective and factual
- **Completeness**: Include all required fields with comprehensive information
- **Consistency**: Follow established formatting and style conventions
- **Relevance**: Focus on information that helps users understand the source's perspective and credibility

</details>

## Developer Setup

### Install & run Kite front-end

Kite front end is a statically served app and is fully open source.

Here is how to run it locally:

```bash
# Clone the repository
git clone https://github.com/kagisearch/kite-public.git
cd kite-public

# Make sure you have the Node.js LTS version installed.
node -v

# Install dependencies
npm install

# Run development server
npm run dev
```

Check out the Vite documentation on how a production build works: https://vite.dev/guide/static-deploy.html

### Kite Data Usage

Kite front-end uses Kite application data that can be found at [kite.kagi.com/kite.json](https://kite.kagi.com/kite.json) (explore other files from there). Note that kite.json and files referenced by it are licensed under [CC BY-NC license](https://creativecommons.org/licenses/by-nc/4.0/). This means that this data can be used free of charge (with attribution and for non-commercial use). If you would like to license this data for commercial use let us know through support@kagi.com.

### Custom Front-ends

Kite web app is just one example front-end that one can run on top of the Kite data. We encourage others to contribute improvements to the Kite frontend.

**We would also love to see what kind of custom front-ends you can create on top of Kite data!** Feel free to share them with us and others by editing this Readme file.