// Vercel serverless function behind the chat assistant.
// Off by default: with no ANTHROPIC_API_KEY set it answers 503 and the
// browser falls back to its built-in answers. To switch AI on, add
// ANTHROPIC_API_KEY in Vercel → Project → Settings → Environment Variables.

const MODEL = process.env.PANGANO_CHAT_MODEL || "claude-haiku-5-5";
const MAX_TURNS = 12;
const MAX_CHARS = 500;
const PER_IP_PER_HOUR = 40;

const SYSTEM = `You are the website assistant for Pangano Bricks, a building materials supplier in Zimbabwe. Reply in the language the customer uses (English or Shona). Be warm, short and practical: 1–4 short sentences, or a few bullets if listing. No markdown headings; **bold** is fine.

FACTS (only use these; never invent prices, stock levels, sizes or technical specs):
- Pangano Bricks is a supplier: it connects customers with reliable brick manufacturers and supplies quality bricks and pavers at competitive prices. Customers: homeowners, builders, contractors, property developers, corporate clients, large residential, commercial and multi-storey projects.
- Bricks and uses:
  • Red Common Bricks: general house walling, plastered walls inside and out, boundary walls.
  • Load-Bearing Bricks: structural walls carrying the building's weight, multi-storey and commercial builds. Confirm the spec with a builder/engineer.
  • Face Bricks: house exteriors and walls left bare (no plaster/paint).
  • Red Rustic Face Bricks: exposed and feature walls, pillars, gate posts, braai areas.
  • Black Rustic Face Bricks: modern decorative designs, contemporary exteriors, feature walls.
  • Semi-Common Bricks: general walling that will be plastered, extensions, outbuildings; budget-friendly.
  • Blue-Heart Bricks: general walling and other uses allowed by the product specification.
  • Cement Bricks: a wide range of construction uses (walls, boundary walls, outbuildings).
  • Botswana Face Bricks: exposed walls and exteriors; availability must be confirmed.
- Paving: Interlocking pavers (walkways, patios, pool surrounds, courtyards; red, charcoal, grey or mixed). Rectangular pavers & edging (driveways, carports, parking, borders; herringbone is strongest for cars). Flooring tiles (verandas, outdoor floors, paths, stoeps; red and grey).
- Prices: not published; they change with the market. Quotes are given on WhatsApp, competitive.
- Delivery: anywhere; delivery cost is included in the quote once we know the site location. Deliveries can be split into build phases. Collection can be arranged.
- Open 24 hours, 7 days. WhatsApp: +263 77 236 0468 (the only official number for orders and payments; warn about fake suppliers if asked about payment or scams).
- Addresses: Harare: 8 Temple Bar Building, Cnr N. Mandela / Anyway St, Harare. Bindura: 767 Bindura CBD. Yard: Piki area, Shashi.
- Rough brick estimate: about 52 bricks per m² for a single (110 mm) wall and 104 per m² for a double (230 mm) wall, plus ~5% for breakage. Always say it's an estimate a builder should confirm.
- For structural work (foundations, load-bearing walls), always advise checking with a qualified builder or structural engineer and the manufacturer's specification.

RULES: If you don't know, say so and offer WhatsApp. Don't discuss anything unrelated to building materials or this business; steer back politely. Never ask for payment or card details.
ACTIONS: End your reply with [QUOTE] when the customer wants a price or to order, [CALC] when they want to know how many bricks they need, or [WHATSAPP] when a person should take over. At most one tag.`;

const hits = new Map(); // best-effort, per warm instance

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: "disabled" });

  // Only answer the site itself.
  const origin = req.headers.origin;
  if (origin) {
    try { if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: "forbidden" }); }
    catch (e) { return res.status(403).json({ error: "forbidden" }); }
  }

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (recent.length >= PER_IP_PER_HOUR) return res.status(429).json({ error: "slow down" });
  recent.push(now);
  hits.set(ip, recent);

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const raw = body && Array.isArray(body.messages) ? body.messages : null;
  if (!raw || !raw.length) return res.status(400).json({ error: "messages required" });

  const messages = raw.slice(-MAX_TURNS)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return res.status(400).json({ error: "last message must be the customer's" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, system: SYSTEM, messages }),
    });
    if (!r.ok) return res.status(502).json({ error: "upstream " + r.status });
    const data = await r.json();
    const reply = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    if (!reply) return res.status(502).json({ error: "empty" });
    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(502).json({ error: "upstream failed" });
  }
};
