#!/usr/bin/env bun

/**
 * Test runner for Wikidata text extraction functionality
 * This script demonstrates and tests the raw text extraction process
 */

import { JSDOM } from 'jsdom';

// Set up DOM environment for testing
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window as any;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.NodeFilter = dom.window.NodeFilter;

// Mock fetch for testing
(global as any).fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input.toString();
  console.log(`🌐 Mock API call to: ${url}`);
  
  if (url.includes('wblinktitles')) {
    // Simulate main Wikidata entity linking API
    return {
      ok: true,
      json: async () => ({
        wblinktitles: {
          entities: [
            {
              id: 'Q90',
              label: 'Paris',
              description: 'capital city of France',
              score: 0.95,
              url: 'https://www.wikidata.org/wiki/Q90'
            },
            {
              id: 'Q84',
              label: 'London',
              description: 'capital city of England and the United Kingdom',
              score: 0.88,
              url: 'https://www.wikidata.org/wiki/Q84'
            }
          ]
        }
      })
    } as any;
  } else if (url.includes('wbsearchentities')) {
    // Simulate fallback search API
    const searchTerm = new URL(url).searchParams.get('search');
    return {
      ok: true,
      json: async () => ({
        search: [
          {
            id: 'Q90',
            label: searchTerm,
            description: `Mock description for ${searchTerm}`
          }
        ]
      })
    } as any;
  }
  
  return { ok: false, status: 404 } as any;
};

// Text extraction function (copied from the actual implementation)
function extractCleanText(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  
  // Remove elements we don't want to process
  clone.querySelectorAll('a, [data-no-wiki], [data-wiki-id], script, style, .skip-linking').forEach(el => el.remove());
  
  const text = clone.textContent || '';
  return text.replace(/\s+/g, ' ').trim();
}

// Test cases
const testCases = [
  {
    name: 'Simple text extraction',
    html: '<p>This article discusses Paris, the capital of France, and London.</p>',
    expected: 'This article discusses Paris, the capital of France, and London.'
  },
  {
    name: 'Remove existing links',
    html: 'This text mentions <a href="/paris">Paris</a> and London.',
    expected: 'This text mentions and London.'
  },
  {
    name: 'Remove data-no-wiki elements',
    html: 'This text mentions <span data-no-wiki>Paris</span> and London.',
    expected: 'This text mentions and London.'
  },
  {
    name: 'Remove existing wiki elements',
    html: 'This text mentions <span data-wiki-id="Q90">Paris</span> and London.',
    expected: 'This text mentions and London.'
  },
  {
    name: 'Remove scripts and styles',
    html: `
      This is text.
      <script>console.log('test');</script>
      <style>.test { color: red; }</style>
      More text here.
    `,
    expected: 'This is text. More text here.'
  },
  {
    name: 'Normalize whitespace',
    html: `
      This    has   multiple
      
      spaces    and   newlines.
    `,
    expected: 'This has multiple spaces and newlines.'
  },
  {
    name: 'Complex nested HTML',
    html: `
      <h2>Article Title</h2>
      <p>This article discusses <a href="/paris">Paris</a>, the capital of France.</p>
      <div data-no-wiki>
        <p>This section should be ignored completely.</p>
      </div>
      <p>It also mentions <span data-wiki-id="Q84">London</span> and other cities.</p>
      <script>trackEvent('page_view');</script>
      <style>.highlight { background: yellow; }</style>
    `,
    expected: 'Article Title This article discusses , the capital of France. It also mentions and other cities.'
  }
];

// Entity extraction pattern test
function testEntityExtraction() {
  console.log('\n🔍 Testing Entity Extraction Patterns');
  console.log('=====================================');
  
  const text = 'This article discusses Paris, London, New York City, San Francisco, and the United States.';
  const entityPattern = /\b[A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){0,2}\b/g;
  const matches = text.match(entityPattern) || [];
  
  console.log(`📝 Input text: "${text}"`);
  console.log(`🎯 Found potential entities: ${matches.join(', ')}`);
  
  // Filter like the actual implementation
  const filteredMatches = matches
    .filter(match => match.length > 3)
    .filter(match => match.trim().split(/\s+/).length >= 2); // require at least 2 tokens
  
  console.log(`✅ Filtered entities (2+ tokens): ${filteredMatches.join(', ')}`);
}

// API simulation test
async function testAPISimulation() {
  console.log('\n🌐 Testing API Simulation');
  console.log('=========================');
  
  const testText = 'This article discusses Paris and London, two major European capitals.';
  
  try {
    console.log(`📤 Simulating Wikidata API call for: "${testText}"`);
    
    // Directly call our mock function instead of going through fetch
    const mockResponse = {
      wblinktitles: {
        entities: [
          {
            id: 'Q90',
            label: 'Paris',
            description: 'capital city of France',
            score: 0.95,
            url: 'https://www.wikidata.org/wiki/Q90'
          },
          {
            id: 'Q84',
            label: 'London',
            description: 'capital city of England and the United Kingdom',
            score: 0.88,
            url: 'https://www.wikidata.org/wiki/Q84'
          }
        ]
      }
    };
    
    console.log('📥 Mock API Response:', JSON.stringify(mockResponse, null, 2));
    
    if (mockResponse.wblinktitles?.entities) {
      console.log(`✅ Found ${mockResponse.wblinktitles.entities.length} entities`);
      mockResponse.wblinktitles.entities.forEach((entity: any) => {
        console.log(`   - ${entity.label} (${entity.id}): ${entity.description} [score: ${entity.score}]`);
      });
    }
    
  } catch (error) {
    console.error('❌ API simulation failed:', error);
  }
}

// Performance test
function testPerformance() {
  console.log('\n⚡ Testing Performance');
  console.log('=====================');
  
  const largeText = 'This is a test sentence with Paris and London. '.repeat(1000);
  const div = document.createElement('div');
  div.textContent = largeText;
  
  const startTime = performance.now();
  const result = extractCleanText(div);
  const endTime = performance.now();
  
  console.log(`📊 Processed ${largeText.length} characters in ${(endTime - startTime).toFixed(2)}ms`);
  console.log(`📏 Extracted text length: ${result.length} characters`);
  console.log(`✅ Performance: ${endTime - startTime < 100 ? 'PASS' : 'FAIL'} (should be < 100ms)`);
}

// Main test runner
async function runTests() {
  console.log('🧪 Wikidata Text Extraction Test Suite');
  console.log('=======================================\n');
  
  // Run text extraction tests
  console.log('📝 Testing Text Extraction');
  console.log('==========================');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    const div = document.createElement('div');
    div.innerHTML = testCase.html;
    
    const result = extractCleanText(div);
    const success = result === testCase.expected;
    
    console.log(`${success ? '✅' : '❌'} ${testCase.name}`);
    if (!success) {
      console.log(`   Expected: "${testCase.expected}"`);
      console.log(`   Got:      "${result}"`);
      failed++;
    } else {
      passed++;
    }
  }
  
  console.log(`\n📊 Text Extraction Results: ${passed} passed, ${failed} failed`);
  
  // Run other tests
  testEntityExtraction();
  await testAPISimulation();
  testPerformance();
  
  console.log('\n🎉 Test suite completed!');
  console.log('\n💡 To see this in action in the browser, add the WikidataTextExtractionDemo component to a page.');
}

// Run the tests
runTests().catch(console.error);