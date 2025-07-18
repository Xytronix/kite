import fs from 'fs';
import path from 'path';

// Read the kite_feeds.json file
const kiteFeeds = JSON.parse(fs.readFileSync('kite_feeds.json', 'utf8'));

// Language mapping from kite_feeds.json to locale files
const languageMapping: Record<string, string> = {
  'en': 'en.json',
  'de': 'de.json', 
  'fr': 'fr.json',
  'es': 'es.json',
  'pt': 'pt.json',
  'it': 'it.json',
  'nl': 'nl.json',
  'zh-Hans': 'zh.json',
  'zh-Hant': 'zh.json', // Using same file for both Chinese variants
  'ja': 'ja.json',
  'hi': 'hi.json',
  'uk': 'uk.json'
};

// Extract all display names from kite_feeds.json
const extractedTranslations: Record<string, Record<string, { text: string; translationContext: string }>> = {};

// Initialize language objects
Object.keys(languageMapping).forEach(lang => {
  extractedTranslations[lang] = {};
});

// Process each category in kite_feeds.json
Object.entries(kiteFeeds).forEach(([categoryKey, categoryData]: [string, any]) => {
  if (categoryData.display_names) {
    Object.entries(categoryData.display_names).forEach(([lang, translation]: [string, any]) => {
      if (extractedTranslations[lang]) {
        // Create a category key based on the original key
        const categoryId = `category.${categoryKey.toLowerCase().replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '')}`;
        extractedTranslations[lang][categoryId] = {
          text: translation,
          translationContext: `Display name for the ${categoryKey} news category`
        };
      }
    });
  }
});

// Function to read existing locale file
function readLocaleFile(filename: string): Record<string, any> {
  const filePath = path.join('src/lib/locales', filename);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.log(`Could not read ${filename}, creating new file`);
    return {};
  }
}

// Function to write locale file
function writeLocaleFile(filename: string, data: Record<string, any>): void {
  const filePath = path.join('src/lib/locales', filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 4) + '\n');
}

// Process each language
Object.entries(languageMapping).forEach(([lang, filename]: [string, string]) => {
  console.log(`Processing ${lang} -> ${filename}`);
  
  // Read existing locale file
  const existingData = readLocaleFile(filename);
  
  // Get extracted translations for this language
  const newTranslations = extractedTranslations[lang] || {};
  
  // Check for duplicates and merge
  let duplicatesFound = 0;
  let newEntriesAdded = 0;
  
  Object.entries(newTranslations).forEach(([key, value]: [string, { text: string; translationContext: string }]) => {
    if (existingData[key]) {
      // Check if the translation is different
      if (existingData[key].text !== value.text) {
        console.log(`  Duplicate with different translation found for ${key}:`);
        console.log(`    Existing: "${existingData[key].text}"`);
        console.log(`    New: "${value.text}"`);
        duplicatesFound++;
      } else {
        console.log(`  Duplicate with same translation: ${key}`);
        duplicatesFound++;
      }
    } else {
      existingData[key] = value;
      newEntriesAdded++;
    }
  });
  
  console.log(`  Added ${newEntriesAdded} new entries, found ${duplicatesFound} duplicates`);
  
  // Write updated file
  writeLocaleFile(filename, existingData);
});

console.log('\nExtraction complete!');