const updateBaseUrl = "https://pub-b634ec39d39a4b7ab2eb406856434122.r2.dev/mac/latest/";
const latestFeedUrl = `${updateBaseUrl}latest-mac.yml`;
const visitorCookieName = "steepfu_download_id";
const cookieMaxAge = 60 * 60 * 24 * 365;

export async function onRequest({ request, env }) {
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

  const cookies = parseCookies(request.headers.get("Cookie"));
  const visitorId = cookies[visitorCookieName] || crypto.randomUUID();
  const responseHeaders = new Headers({
    "Cache-Control": "no-store",
    Location: `${updateBaseUrl}${artifactName}`
  });

  if (request.method === "GET" && !cookies[visitorCookieName]) {
    responseHeaders.append("Set-Cookie", makeCookie(visitorCookieName, visitorId));
  }

  if (request.method === "GET") {
    writeDownloadAnalytics({ request, env, artifactName, visitorId });
  }

  return new Response(null, {
    status: 302,
    headers: responseHeaders
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

function writeDownloadAnalytics({ request, env, artifactName, visitorId }) {
  if (!env.DOWNLOAD_ANALYTICS?.writeDataPoint) {
    return;
  }

  const url = new URL(request.url);
  const version = artifactName.match(/Steepfu-(\d+\.\d+\.\d+)/)?.[1] || "unknown";

  env.DOWNLOAD_ANALYTICS.writeDataPoint({
    blobs: [
      "steepfu",
      version,
      artifactName,
      artifactName.includes("-arm64") ? "mac-arm64" : "mac-x64",
      request.cf?.country || "unknown",
      classifyDevice(request.headers.get("User-Agent") || ""),
      referrerHost(request.headers.get("Referer")),
      url.searchParams.get("source") || "direct"
    ],
    doubles: [1],
    indexes: [visitorId]
  });
}

function parseCookies(header) {
  return Object.fromEntries(
    (header || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");
        if (separatorIndex === -1) {
          return [part, ""];
        }
        return [
          decodeURIComponent(part.slice(0, separatorIndex)),
          decodeURIComponent(part.slice(separatorIndex + 1))
        ];
      })
  );
}

function makeCookie(name, value) {
  return [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `Max-Age=${cookieMaxAge}`,
    "Path=/",
    "Secure",
    "HttpOnly",
    "SameSite=Lax"
  ].join("; ");
}

function classifyDevice(userAgent) {
  if (/bot|crawler|spider|crawling/i.test(userAgent)) {
    return "bot";
  }

  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) {
    return "tablet";
  }

  if (/Mobi|iPhone|Android/i.test(userAgent)) {
    return "mobile";
  }

  return "desktop";
}

function referrerHost(referrer) {
  if (!referrer) {
    return "direct";
  }

  try {
    return new URL(referrer).hostname || "direct";
  } catch {
    return "invalid";
  }
}
