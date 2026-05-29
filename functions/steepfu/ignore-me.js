const ignoreCookieName = "steepfu_ignore_downloads";
const cookieMaxAge = 60 * 60 * 24 * 365;

export async function onRequest({ request }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed.", {
      status: 405,
      headers: {
        Allow: "GET, HEAD"
      }
    });
  }

  return new Response(
    request.method === "HEAD" ? null : "Steepfu downloads from this browser will be ignored.",
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "Set-Cookie": makeCookie(ignoreCookieName, "1")
      }
    }
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
