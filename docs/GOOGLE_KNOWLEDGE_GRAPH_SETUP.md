# Google Cloud Enterprise Knowledge Graph Setup

This guide explains how to set up Google Cloud Enterprise Knowledge Graph API for enhanced Wikipedia tooltips with better entity recognition and disambiguation.

## Prerequisites

1. Google Cloud Project
2. Billing enabled on your project
3. Enterprise Knowledge Graph API enabled

## Setup Steps

### 1. Enable the Enterprise Knowledge Graph API

```bash
# Enable the API
gcloud services enable enterpriseknowledgegraph.googleapis.com

# Verify it's enabled
gcloud services list --enabled --filter="name:enterpriseknowledgegraph.googleapis.com"
```

### 2. Set up Authentication

#### Option A: Service Account (Recommended for Production)

```bash
# Create a service account
gcloud iam service-accounts create wikipedia-kg-service \
    --description="Service account for Wikipedia Knowledge Graph integration" \
    --display-name="Wikipedia KG Service"

# Grant necessary permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:wikipedia-kg-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/enterpriseknowledgegraph.user"

# Create and download key
gcloud iam service-accounts keys create ~/wikipedia-kg-key.json \
    --iam-account=wikipedia-kg-service@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

#### Option B: User Account (Development Only)

```bash
# Authenticate with your user account
gcloud auth login

# Get access token (expires in 1 hour)
gcloud auth print-access-token
```

### 3. Configure Environment Variables

Add to your `.env` file (server-side only, never exposed to client):

```env
# Your Google Cloud Project ID
GOOGLE_CLOUD_PROJECT_ID=your-project-id

# Service account key JSON (entire JSON as string)
GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project-id",...}'

# Optional: Public Knowledge Graph API key (fallback)
GOOGLE_KNOWLEDGE_GRAPH_API_KEY=your-api-key
```

**⚠️ Security Note**: These are server-side environment variables only. Never use `VITE_` prefix for API keys as they would be exposed to the client.

### 4. Test the Integration

```bash
# Test the API directly
curl -X GET \
     -H "Authorization: Bearer $(gcloud auth print-access-token)" \
     "https://enterpriseknowledgegraph.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/global/publicKnowledgeGraphEntities:Search?query=Albert%20Einstein&limit=1"
```

## API Endpoints Used

### Search Entities
```
GET https://enterpriseknowledgegraph.googleapis.com/v1/projects/{PROJECT_ID}/locations/global/publicKnowledgeGraphEntities:Search
```

Parameters:
- `query`: Search query string
- `limit`: Number of results (default: 20)
- `languages`: Language codes (e.g., 'en', 'de', 'fr')
- `types`: Schema.org types to filter by

### Lookup by MID
```
GET https://enterpriseknowledgegraph.googleapis.com/v1/projects/{PROJECT_ID}/locations/global/publicKnowledgeGraphEntities:Lookup
```

Parameters:
- `ids`: Entity MIDs to lookup
- `languages`: Language codes

## Security Considerations

### Production Deployment

**✅ Secure Implementation**: This implementation uses server-side API routes that never expose credentials to the client.

The system includes:

1. **Server-side API routes**: `/api/wikipedia/search` and `/api/wikipedia/lookup`
2. **Secure token generation**: JWT signing with service account private key
3. **Client-side abstraction**: Client code never sees API keys or tokens
4. **Graceful fallbacks**: Falls back to direct Wikipedia API if Google Cloud is unavailable

```typescript
// Client-side usage (secure)
const result = await fetchWikipediaContentWithEnhancedSearch('Albert Einstein');

// Server handles all authentication and API calls internally
```

### Rate Limits

- Basic edition: 1,000 requests per day
- Advanced edition: Higher limits available

### Costs

- Basic edition: Free tier available
- Advanced edition: Pay per request

## Troubleshooting

### Common Issues

1. **403 Forbidden**: Check API is enabled and authentication is correct
2. **404 Not Found**: Verify project ID and endpoint URL
3. **Token Expired**: Refresh access token (expires every hour)

### Debug Mode

Enable debug logging:

```typescript
// In your browser console
localStorage.setItem('debug', 'wikipedia:*');
```

## Fallback Strategy

The implementation includes multiple fallback layers:

1. **Enterprise Knowledge Graph** (most accurate)
2. **Public Knowledge Graph API** (good fallback)
3. **Direct Wikipedia API** (reliable fallback)

This ensures the system works even if Google Cloud services are unavailable.

## Benefits

- **Better Entity Recognition**: Disambiguates between entities with similar names
- **Richer Metadata**: Entity types, confidence scores, multiple identifiers
- **Structured Data**: JSON-LD format compatible with Schema.org
- **Multi-language Support**: Better language handling than direct Wikipedia search
- **Image Quality**: Higher quality entity images
- **Reliability**: Google's curated knowledge base

## Example Response

```json
{
  "@context": {"@vocab": "http://schema.org/"},
  "@type": "ItemList",
  "itemListElement": [{
    "result": {
      "@id": "c-07xuup16g",
      "name": "Albert Einstein",
      "description": "German-born theoretical physicist",
      "detailedDescription": {
        "articleBody": "Albert Einstein was a German-born theoretical physicist...",
        "url": "https://en.wikipedia.org/wiki/Albert_Einstein",
        "license": "https://en.wikipedia.org/wiki/Wikipedia:Text_of_Creative_Commons_Attribution-ShareAlike_3.0_Unported_License"
      },
      "image": {
        "contentUrl": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ...",
        "url": "https://en.wikipedia.org/wiki/File:Einstein_1921_by_F_Schmutzer_-_restoration.jpg"
      },
      "identifier": [
        {"@type": "PropertyValue", "propertyID": "googleKgMID", "value": "/m/0jcx"},
        {"@type": "PropertyValue", "propertyID": "wikidataQID", "value": "Q937"}
      ],
      "@type": ["Person", "Thing"]
    }
  }]
}
```