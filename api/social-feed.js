export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET") {
      return json({ error: "Method Not Allowed" }, 405);
    }

    const limitParam = Number.parseInt(url.searchParams.get("limit") || "12", 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 30) : 12;
    const platformParam = (url.searchParams.get("platform") || "").toLowerCase().trim();
    const fetchLinkedIn = !platformParam || platformParam === "linkedin";
    const fetchYouTube = !platformParam || platformParam === "youtube";

    try {
      const [linkedinPosts, youtubePosts] = await Promise.all([
        fetchLinkedIn ? fetchLinkedInPosts(env, limit) : Promise.resolve([]),
        fetchYouTube ? fetchYouTubePosts(env, limit) : Promise.resolve([])
      ]);

      const items = [...linkedinPosts, ...youtubePosts]
        .filter((item) => item && item.postedAt)
        .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
        .slice(0, limit);

      return json({ items, fetchedAt: new Date().toISOString() }, 200);
    } catch (error) {
      return json({ error: "Failed to fetch social feed", details: String(error?.message || error) }, 502);
    }
  }
};

async function fetchLinkedInPosts(env, limit) {
  const orgUrn = String(env.LINKEDIN_ORG_URN || "").trim();
  const accessToken = String(env.LINKEDIN_ACCESS_TOKEN || "").trim();
  if (!orgUrn || !accessToken) return [];

  const endpoint = new URL("https://api.linkedin.com/rest/posts");
  endpoint.searchParams.set("q", "author");
  endpoint.searchParams.set("author", orgUrn);
  endpoint.searchParams.set("count", String(limit));
  endpoint.searchParams.set("sortBy", "LAST_MODIFIED");

  const response = await fetch(endpoint.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": "202405",
      "X-Restli-Protocol-Version": "2.0.0"
    }
  });

  if (!response.ok) {
    throw new Error(`LinkedIn API error ${response.status}`);
  }

  const payload = await response.json();
  const elements = Array.isArray(payload?.elements) ? payload.elements : [];

  return elements.map((post) => {
    const id = String(post?.id || post?.urn || "").trim();
    const commentary = String(post?.commentary || post?.content?.commentary || "").trim();
    const created = Number(post?.createdAt || post?.lastModifiedAt || 0);
    const postedAt = created > 0 ? new Date(created).toISOString() : null;

    return {
      id: id || `linkedin-${crypto.randomUUID()}`,
      platform: "linkedin",
      author: String(env.LINKEDIN_DISPLAY_NAME || "ECE Department").trim(),
      text: commentary,
      mediaUrl: null,
      postUrl: buildLinkedInPostUrl(id),
      postedAt,
      thumbnailUrl: null
    };
  });
}

function buildLinkedInPostUrl(id) {
  if (!id) return "https://www.linkedin.com";
  const encoded = encodeURIComponent(id);
  return `https://www.linkedin.com/feed/update/${encoded}/`;
}

async function fetchYouTubePosts(env, limit) {
  const channelId = String(env.YOUTUBE_CHANNEL_ID || "").trim();
  const apiKey = String(env.YOUTUBE_API_KEY || "").trim();
  if (!channelId || !apiKey) return [];

  const endpoint = new URL("https://www.googleapis.com/youtube/v3/search");
  endpoint.searchParams.set("key", apiKey);
  endpoint.searchParams.set("channelId", channelId);
  endpoint.searchParams.set("part", "snippet");
  endpoint.searchParams.set("order", "date");
  endpoint.searchParams.set("type", "video");
  endpoint.searchParams.set("maxResults", String(Math.min(limit, 25)));

  const response = await fetch(endpoint.toString());
  if (!response.ok) {
    throw new Error(`YouTube API error ${response.status}`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload?.items) ? payload.items : [];

  return items.map((item) => {
    const videoId = String(item?.id?.videoId || "").trim();
    const snippet = item?.snippet || {};

    return {
      id: videoId || `youtube-${crypto.randomUUID()}`,
      platform: "youtube",
      author: String(snippet?.channelTitle || env.YOUTUBE_DISPLAY_NAME || "ECE Department").trim(),
      text: String(snippet?.title || "").trim(),
      mediaUrl: null,
      postUrl: videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : "https://www.youtube.com",
      postedAt: String(snippet?.publishedAt || ""),
      thumbnailUrl: String(snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url || snippet?.thumbnails?.default?.url || "").trim() || null
    };
  });
}

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, s-maxage=300, stale-while-revalidate=300"
    }
  });
}
