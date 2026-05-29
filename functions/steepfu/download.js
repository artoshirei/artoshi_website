const updateBaseUrl = "https://pub-b634ec39d39a4b7ab2eb406856434122.r2.dev/mac/latest/";
const latestFeedUrl = `${updateBaseUrl}latest-mac.yml`;

export async function onRequest({ request }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed.", {
      status: 405,
      headers: {
        Allow: "GET, HEAD"
      }
    });
  }

  const feedResponse = await fetch(latestFeedUrl, {
    cf: {
      cacheEverything: true,
      cacheTtl: 60
    }
  });

  if (!feedResponse.ok) {
    return new Response("Steepfu download feed is temporarily unavailable.", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }

  const feed = await feedResponse.text();
  const artifactName = findDownloadArtifact(feed);

  if (!artifactName) {
    return new Response("Steepfu download feed did not include a macOS DMG.", {
      status: 502,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      "Cache-Control": "no-store",
      Location: `${updateBaseUrl}${artifactName}`
    }
  });
}

function findDownloadArtifact(feed) {
  return findFirstMatchingUrl(feed, /^Steepfu-\d+\.\d+\.\d+-arm64\.dmg$/) ||
    findFirstMatchingUrl(feed, /^Steepfu-\d+\.\d+\.\d+\.dmg$/);
}

function findFirstMatchingUrl(feed, artifactPattern) {
  const urlPattern = /^\s*-\s*url:\s*["']?([^"'\n#]+)["']?\s*$/gm;
  let match;

  while ((match = urlPattern.exec(feed)) !== null) {
    const artifactName = match[1].trim();
    if (artifactPattern.test(artifactName)) {
      return artifactName;
    }
  }

  return null;
}
