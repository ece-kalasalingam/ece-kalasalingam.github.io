# Social Feed API (Backend Endpoint)

This repository includes a deployable endpoint at `api/social-feed.js` with this contract:

- Route: `GET /api/social-feed?limit=<n>`
- Response: `{ items: [...], fetchedAt: "<iso>" }`

## Required Secrets

- `LINKEDIN_ORG_URN`
- `LINKEDIN_ACCESS_TOKEN`
- `YOUTUBE_CHANNEL_ID`
- `YOUTUBE_API_KEY`

## Optional Labels

- `LINKEDIN_DISPLAY_NAME`
- `YOUTUBE_DISPLAY_NAME`

## Item Shape

```json
{
  "id": "string",
  "platform": "linkedin | youtube",
  "author": "string",
  "text": "string",
  "mediaUrl": "string|null",
  "postUrl": "string",
  "postedAt": "ISO-8601 string",
  "thumbnailUrl": "string|null"
}
```
