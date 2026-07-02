// functions/mascot/say.js — POST /mascot/say
// Proxies the mascot's speech lines through OpenRouter so the API key stays
// server-side. Set OPENROUTER_API_KEY in the Cloudflare Pages project env
// (and cap the key's spend in the OpenRouter dashboard as a backstop).
// Body: { page, facts, avoid: [recent lines] } → { line }

const MODEL = "google/gemini-2.5-flash-lite";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });

export async function onRequestPost({ request, env }) {
  if (!env.OPENROUTER_API_KEY) return json({ error: "unconfigured" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const page = String(body.page || "").slice(0, 120);
  const facts = String(body.facts || "").slice(0, 600);
  const avoid = (Array.isArray(body.avoid) ? body.avoid : [])
    .slice(0, 24)
    .map((s) => String(s).slice(0, 160));

  const system = [
    "You are the artoshi mascot: a small, round, friendly creature living in the header of argo's portfolio site, artoshi.work.",
    "A visitor just opened a page. Say ONE short, warm, playful line about it — a quiet aside, never a sales pitch.",
    "Rules: lowercase only. at most 12 words. no emoji, no hashtags, no surrounding quotes. no em-dashes or hyphens as pauses, use commas or periods.",
    "Only state things supported by the given facts. Never invent details about argo or the apps.",
    avoid.length
      ? `Do not repeat or closely paraphrase any of these earlier lines:\n- ${avoid.join("\n- ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "content-type": "application/json",
        "http-referer": "https://artoshi.work",
        "x-title": "artoshi mascot",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 60,
        temperature: 1.1,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `page: ${page}\nfacts: ${facts}` },
        ],
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return json({ error: "upstream" }, 502);
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    const line = String(raw)
      .trim()
      .replace(/^["']+|["']+$/g, "")
      .replace(/\s*[—–]\s*|\s+--\s+/g, ", ") // belt and braces: no dashes survive
      .slice(0, 140);
    if (!line) return json({ error: "empty" }, 502);
    return json({ line });
  } catch {
    return json({ error: "unavailable" }, 504);
  }
}
