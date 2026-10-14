// Pangano Bricks — chat assistant behind the green button.
// Works with no server at all: a built-in brain answers the common questions
// (which brick, how many, delivery, hours, where we are), runs a brick
// calculator and builds a ready-to-send WhatsApp quote. If /api/chat is
// switched on (ANTHROPIC_API_KEY set on Vercel), free-typed questions go to
// the AI instead, and fall back to the built-in brain if it fails.

(() => {
  const WA_NUMBER = "263772360468";
  const STORE_KEY = "pangano-chat-v1";
  const BRICKS_PER_M2 = { single: 52, double: 104 }; // 222×106×73 brick, 10 mm joints
  const WASTAGE = 1.05;

  // ---------- What we sell ----------
  const PRODUCTS = [
    { id: "common", name: "Red Common Bricks", sw: "linear-gradient(135deg,#b4492a,#7c2d1a)", link: "products.html#common",
      keys: /\b(red )?common\b(?!.*semi)/, use: "General house walling, walls you'll plaster inside and out, and boundary walls." },
    { id: "load", name: "Load-Bearing Bricks", sw: "linear-gradient(135deg,#8e2f17,#5e1d0d)", link: "products.html#range",
      keys: /load[\s-]?bearing|structural brick/, use: "Structural walls that carry the building's weight, multi-storey and commercial builds.",
      note: "Confirm the specification with your builder or engineer before ordering." },
    { id: "face", name: "Face Bricks", sw: "linear-gradient(135deg,#d08a5a,#a35f34)", link: "products.html#face",
      keys: /\bface ?bricks?\b(?!.*(rustic|botswana))|\bfacebrick/, use: "House exteriors and any wall left bare, with no plaster or paint." },
    { id: "rustic", name: "Red Rustic Face Bricks", sw: "linear-gradient(135deg,#a8452a,#5a2414)", link: "products.html#rustic",
      keys: /(red )?rustic(?!.*black)/, use: "Exposed and feature walls, pillars and gate posts, braai areas." },
    { id: "black", name: "Black Rustic Face Bricks", sw: "linear-gradient(135deg,#3a3a3e,#141416)", link: "products.html#range",
      keys: /black/, use: "Modern decorative designs, contemporary exteriors and feature walls." },
    { id: "semi", name: "Semi-Common Bricks", sw: "linear-gradient(135deg,#d9774a,#a9532c)", link: "products.html#range",
      keys: /semi/, use: "General walling that will be plastered, extensions and outbuildings. A budget-friendly choice." },
    { id: "blue", name: "Blue-Heart Bricks", sw: "linear-gradient(135deg,#7c2d1a 0 30%,#3c4458 30% 70%,#7c2d1a 70%)", link: "products.html#range",
      keys: /blue/, use: "General walling and other uses allowed by the product specification." },
    { id: "cement", name: "Cement Bricks", sw: "linear-gradient(135deg,#a7a9ad,#74777c)", link: "products.html#range",
      keys: /cement|concrete brick|block/, use: "A wide range of construction uses: walls, boundary walls and outbuildings." },
    { id: "botswana", name: "Botswana Face Bricks", sw: "linear-gradient(135deg,#e2b277,#b8803f)", link: "products.html#range",
      keys: /botswana/, use: "Exposed walls and house exteriors.", note: "Ask us about current availability." },
    { id: "interlock", name: "Interlocking Pavers", sw: "linear-gradient(135deg,#a8452a 0 33%,#3a3a3e 33% 66%,#9a9ca0 66%)", link: "products.html#paving",
      keys: /interlock|\bpavers?\b(?!.*(rect|driveway|herring))|paving/, use: "Walkways, patios, pool surrounds and courtyards. Red, charcoal, grey or a mix." },
    { id: "rect", name: "Rectangular Pavers & Edging", sw: "linear-gradient(135deg,#8c8f94,#5d6066)", link: "products.html#paving",
      keys: /rectang|herring|edging|kerb|border/, use: "Driveways, carports and parking. Herringbone is the strongest pattern for cars turning." },
    { id: "tiles", name: "Flooring Tiles", sw: "linear-gradient(135deg,#b4492a 0 50%,#8c8f94 50%)", link: "products.html#paving",
      keys: /tile|floor/, use: "Verandas, outdoor floors, garden paths and stoeps. Red and grey." },
  ];
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

  // Which product suits which job (checked before product names).
  const JOBS = [
    { re: /foundation|footing|slab|base course/, ids: ["load", "common"], say: "For foundations, builders normally use a strong brick rated for the load:" , warn: true },
    { re: /multi[\s-]?stor|storey|double[\s-]?stor|structur|load[\s-]?bearing|commercial|flats|apartment/, ids: ["load"], say: "For structural, load-bearing work:", warn: true },
    { re: /plaster|inside wall|internal|interior/, ids: ["common", "semi", "cement"], say: "For walls you'll plaster, any of these work:" },
    { re: /exterior|outside wall|bare|unplaster|no plaster|facade|house front/, ids: ["face", "botswana"], say: "For walls left bare with no plaster:" },
    { re: /modern|contemporary|dark|stylish/, ids: ["black"], say: "For a modern look, go dark and textured:" },
    { re: /pillar|gate ?post|gate|feature wall|braai|fireplace/, ids: ["rustic", "black"], say: "Pillars, gate posts and feature walls look best in rustic face brick:" },
    { re: /boundary|security wall|durawall|perimeter|fence/, ids: ["common", "face", "cement"], say: "For a boundary wall: common or cement bricks if you'll plaster it, face bricks if it stays bare:" },
    { re: /extension|outbuilding|cottage|servant|garage|shed|budget|cheap|afford/, ids: ["semi", "common", "cement"], say: "For extensions and outbuildings on a budget:" },
    { re: /driveway|carport|parking|\bcars?\b/, ids: ["rect"], say: "For driveways and carports:" },
    { re: /walkway|patio|pool|courtyard|path|garden/, ids: ["interlock", "tiles"], say: "For walkways, patios and paths:" },
    { re: /veranda|stoep|porch|floor/, ids: ["tiles"], say: "For verandas and outdoor floors:" },
    { re: /\b(house|home|building a|build a|construct)/, ids: ["common", "face", "load"], say: "A house usually uses a mix: common bricks for walls you'll plaster, face bricks if the outside stays bare, and load-bearing bricks where the structure needs them. Tell me which part you're on, or let's estimate how many you need:" },
  ];

  const FACTS = {
    delivery: "We deliver anywhere. Send your site location and we'll include the delivery cost in your quote. Orders are stacked, strapped and delivered straight to site, and big builds can be split into phases (foundation, walls, paving).",
    hours: "We're open 24 hours, 7 days a week, and we reply on WhatsApp at any time.",
    where: "Harare: 8 Temple Bar Building, Cnr N. Mandela / Anyway St, Harare.\nBindura: 767 Bindura CBD.\nYard: Piki area, Shashi.",
    price: "Prices move with the market, so we don't post a price list. We quote competitive prices on WhatsApp, usually within minutes. Tell me what you need and I'll put the quote request together for you.",
    pay: "Payment options are confirmed with your quote on WhatsApp. Only ever pay using details given by our official number, +263 77 236 0468.",
    scam: "Pangano Bricks only takes orders and payments through our official WhatsApp number, +263 77 236 0468. If someone claiming to be Pangano asks you to pay into a different account, don't pay. Message us first to confirm.",
    min: "We take custom quantities, from a few hundred bricks for a boundary wall to a whole site's supply. We'll tell you whether delivery or collection makes more sense for your order size.",
    collect: "Yes. Ask us on WhatsApp and we'll arrange a collection time and give you directions.",
    who: "Pangano Bricks is a building materials supplier. We connect customers with reliable brick manufacturers and supply quality bricks and pavers at competitive prices to homeowners, builders, contractors, developers and companies.",
    structural: "Choosing a brick for structural work is about more than looks or price. For foundations and load-bearing walls, check the product with a qualified builder or structural engineer and the manufacturer's specification.",
  };

  const MAIN_CHIPS = ["Get a quote", "How many bricks do I need?", "Which brick for my job?", "Delivery & hours", "Where are you?"];

  // ---------- Helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br />");
  const waLink = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
  const num = (n) => Math.round(n).toLocaleString("en-US");
  const icon = '<svg class="icon" aria-hidden="true"><use href="#i-wa"/></svg>';

  // ---------- Build the widget ----------
  const launcher = document.querySelector(".chat-launcher");
  if (!launcher) return;

  const panel = document.createElement("section");
  panel.className = "chat-panel";
  panel.id = "chatPanel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Pangano Bricks assistant");
  panel.hidden = true;
  panel.innerHTML = `
    <header class="chat-head">
      <span class="chat-avatar"><img src="assets/img/icon-180.png" alt="" width="40" height="40" /></span>
      <div class="chat-title"><strong>Pangano Assistant</strong><span><i></i>Online 24/7 · replies instantly</span></div>
      <button class="chat-restart" type="button" aria-label="Start a new chat" title="Start again"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"/></svg></button>
      <button class="chat-close" type="button" aria-label="Close chat"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </header>
    <div class="chat-log" role="log" aria-live="polite"></div>
    <div class="chat-chips"></div>
    <form class="chat-form" autocomplete="off">
      <label class="sr-only" for="chatInput">Type your message</label>
      <input id="chatInput" class="chat-input" type="text" maxlength="500" placeholder="Ask about bricks, delivery, prices…" />
      <button class="chat-send" type="submit" aria-label="Send"><svg viewBox="0 0 24 24"><path d="M4 12 20 4l-6 16-3-7-7-1z"/></svg></button>
    </form>
    <a class="chat-human" href="${waLink("Hi Pangano Bricks, I'd like to talk to someone.")}" target="_blank" rel="noopener">${icon} Talk to a person on WhatsApp</a>`;
  document.body.appendChild(panel);

  const log = panel.querySelector(".chat-log");
  const chipsEl = panel.querySelector(".chat-chips");
  const form = panel.querySelector(".chat-form");
  const input = panel.querySelector(".chat-input");

  // Teaser bubble, once per visit
  let teaser = null;
  let seenTeaser = false;
  try { seenTeaser = sessionStorage.getItem(STORE_KEY + "-teased") === "1"; } catch (e) { /* storage blocked */ }
  if (!seenTeaser) {
    setTimeout(() => {
      if (!panel.hidden) return;
      teaser = document.createElement("button");
      teaser.type = "button";
      teaser.className = "chat-teaser";
      teaser.innerHTML = "<strong>Need help choosing bricks?</strong> Ask me anything. I reply instantly.";
      teaser.addEventListener("click", () => open());
      document.body.appendChild(teaser);
      requestAnimationFrame(() => teaser.classList.add("show"));
      try { sessionStorage.setItem(STORE_KEY + "-teased", "1"); } catch (e) { /* storage blocked */ }
    }, 7000);
  }
  function hideTeaser() { if (teaser) { teaser.remove(); teaser = null; } }

  // ---------- State ----------
  let history = [];   // rendered messages: { from: "bot"|"me", html }
  let aiTurns = [];   // plain-text turns for the AI: { role, content }
  let flow = null;    // { type: "quote"|"calc", step, data }
  let chips = [];
  let aiAvailable = location.protocol.startsWith("http");

  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ history: history.slice(-60), aiTurns: aiTurns.slice(-12), flow, chips })); } catch (e) { /* storage blocked */ }
  }
  function load() {
    try {
      const s = JSON.parse(sessionStorage.getItem(STORE_KEY) || "null");
      if (s && Array.isArray(s.history) && s.history.length) { ({ history, aiTurns, flow, chips } = s); return true; }
    } catch (e) { /* storage blocked or corrupt */ }
    return false;
  }

  // ---------- Rendering ----------
  function addMsg(from, html, opts = {}) {
    const el = document.createElement("div");
    el.className = `chat-msg ${from}${html.includes("chat-cards") ? " has-cards" : ""}`;
    el.innerHTML = html;
    log.appendChild(el);
    if (!opts.restore) { history.push({ from, html }); save(); }
    log.scrollTop = log.scrollHeight;
    return el;
  }
  function setChips(list) {
    chips = list || [];
    chipsEl.innerHTML = "";
    chips.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chat-chip";
      b.textContent = c;
      b.addEventListener("click", () => handle(c, true));
      chipsEl.appendChild(b);
    });
    log.scrollTop = log.scrollHeight;
    save();
  }
  function typing() {
    const el = document.createElement("div");
    el.className = "chat-msg bot typing";
    el.innerHTML = "<span></span><span></span><span></span>";
    el.setAttribute("aria-label", "Typing");
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  // Bot "types" briefly so replies feel natural, then posts each part.
  async function say(parts, nextChips) {
    setChips([]);
    for (const part of [].concat(parts)) {
      const t = typing();
      await new Promise((r) => setTimeout(r, Math.min(900, 350 + part.length * 2)));
      t.remove();
      addMsg("bot", part);
    }
    setChips(nextChips || []);
  }
  function productCards(ids) {
    return `<div class="chat-cards">${ids.map((id) => {
      const p = byId[id];
      return `<a class="chat-card" href="${p.link}"><span class="bt-swatch" style="--sw:${p.sw}" aria-hidden="true"></span><span><strong>${esc(p.name)}</strong><small>${esc(p.use)}${p.note ? ` <em>${esc(p.note)}</em>` : ""}</small></span></a>`;
    }).join("")}</div>`;
  }
  function waButton(text, label) {
    return `<a class="chat-wa" href="${waLink(text)}" target="_blank" rel="noopener">${icon} ${esc(label)}</a>`;
  }

  // ---------- Understanding the message ----------
  const has = (t, re) => re.test(t);
  function findProducts(t) {
    const hits = PRODUCTS.filter((p) => p.keys.test(t)).map((p) => p.id);
    // "black rustic" shouldn't also match red rustic; "semi-common" shouldn't match common
    return hits.filter((id) => !(id === "rustic" && hits.includes("black")) && !(id === "common" && hits.includes("semi")) && !(id === "face" && (hits.includes("rustic") || hits.includes("black") || hits.includes("botswana"))));
  }
  function findJob(t) { return JOBS.find((j) => j.re.test(t)); }

  // ---------- Flows ----------
  function startQuote(preset = {}) {
    flow = { type: "quote", step: "product", data: { ...preset } };
    if (flow.data.product) return askQty();
    say("Great, let's build your quote. <strong>What do you need?</strong> Pick one, or type it (e.g. “face bricks and pavers”).",
      ["Red common bricks", "Face bricks", "Rustic face bricks", "Load-bearing bricks", "Cement bricks", "Pavers", "Flooring tiles", "A mix / not sure"]);
  }
  function askQty() {
    if (flow.data.qty) return askWhere();
    flow.step = "qty";
    say(`<strong>How many?</strong> A number of bricks, square metres for paving, or the size of what you're building is fine.`,
      ["1,000", "5,000", "10,000", "Not sure: help me calculate"]);
  }
  function askWhere() {
    flow.step = "where";
    say("<strong>Where's the site?</strong> Town and suburb is enough for the delivery cost. Or say “I'll collect”.", ["I'll collect", "Harare", "Bindura"]);
  }
  function askName() {
    flow.step = "name";
    say("Last one: <strong>what name should we use?</strong> (optional)", ["Skip"]);
  }
  function finishQuote() {
    const d = flow.data;
    flow = null;
    const lines = [
      "Hi Pangano Bricks, I'd like a quote.",
      `• Product: ${d.product}`,
      `• Quantity: ${d.qty}`,
      `• Site: ${d.where}`,
    ];
    if (d.name) lines.push(`• Name: ${d.name}`);
    const text = lines.join("\n");
    say([
      `<div class="chat-summary"><span>Your quote request</span><dl><dt>Product</dt><dd>${esc(d.product)}</dd><dt>Quantity</dt><dd>${esc(d.qty)}</dd><dt>Site</dt><dd>${esc(d.where)}</dd>${d.name ? `<dt>Name</dt><dd>${esc(d.name)}</dd>` : ""}</dl></div>`,
      `All set. Tap below and WhatsApp opens with this already typed. Just press send and we'll reply with prices and delivery.${waButton(text, "Send quote on WhatsApp")}`,
    ], ["Start another quote", "How many bricks do I need?", "Delivery & hours"]);
  }

  function startCalc(fromQuote, area) {
    flow = { type: "calc", step: "wall", data: { fromQuote: !!fromQuote, product: fromQuote ? fromQuote.product : null, area: area || null } };
    say("Let's estimate it. <strong>What kind of wall?</strong>",
      ["Single wall (110 mm, half-brick)", "Double wall (230 mm, one brick)", "Not sure"]);
  }
  function parseSize(t) {
    const area = t.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|m²|sq ?m|square)/i);
    if (area) return { area: parseFloat(area[1].replace(",", ".")) };
    const ns = (t.match(/\d+(?:[.,]\d+)?/g) || []).map((n) => parseFloat(n.replace(",", ".")));
    if (ns.length >= 2) return { length: ns[0], height: ns[1] };
    if (ns.length === 1) return { single: ns[0] };
    return null;
  }
  function calcStep(t) {
    const d = flow.data;
    if (flow.step === "wall") {
      d.wall = /double|230|one brick|thick|9 ?inch/i.test(t) ? "double" : "single";
      if (/not sure/i.test(t)) {
        addNote("Most house walls in Zimbabwe are double (230 mm) on the outside and single (110 mm) for some internal walls. I'll use <strong>double</strong>, and you can change it later.");
        d.wall = "double";
      }
      if (d.area) return calcResult();
      flow.step = "size";
      return say("<strong>How big is the wall?</strong> Type the total length and height in metres, like <em>30 x 2.4</em>, or an area like <em>72 m2</em>.",
        ["10 x 2", "30 x 2.4", "50 m2"]);
    }
    if (flow.step === "size") {
      const s = parseSize(t);
      if (!s) return say("I didn't catch the size. Try something like <em>30 x 2.4</em> (length × height in metres) or <em>72 m2</em>.", ["30 x 2.4", "72 m2"]);
      if (s.single != null) { d.length = s.single; flow.step = "height"; return say(`Got ${s.single} m long. <strong>And how high?</strong> (metres)`, ["1.8", "2.4", "2.7"]); }
      d.area = s.area != null ? s.area : s.length * s.height;
      return calcResult();
    }
    if (flow.step === "height") {
      const h = parseFloat((t.match(/\d+(?:[.,]\d+)?/) || [""])[0].replace(",", "."));
      if (!h) return say("How high is the wall in metres? For example <em>2.4</em>.", ["1.8", "2.4", "2.7"]);
      d.area = d.length * h;
      return calcResult();
    }
  }
  function addNote(html) { addMsg("bot", html); }
  function calcResult() {
    const d = flow.data;
    const per = BRICKS_PER_M2[d.wall];
    const bricks = d.area * per;
    const withWaste = Math.ceil((bricks * WASTAGE) / 100) * 100;
    const qty = `about ${num(withWaste)} bricks (${num(d.area)} m² ${d.wall} wall)`;
    const fromQuote = d.fromQuote;
    const product = d.product;
    flow = null;
    if (fromQuote) {
      flow = { type: "quote", step: "where", data: { product: product || "Bricks", qty } };
    }
    say([
      `<div class="chat-calc"><span>Estimate</span><b>≈ ${num(withWaste)}</b><small>bricks</small></div>`,
      `${num(d.area)} m² of ${d.wall === "double" ? "double (230 mm)" : "single (110 mm)"} wall × ~${per} bricks per m² = ${num(bricks)}, plus 5% for breakage and cuts.\n\nDoors and windows aren't taken off, so you may need a bit less. Your builder should confirm the final number.`
    ].map((x, i) => (i ? fmt(x) : x)), fromQuote ? [] : ["Get a quote for this", "Calculate another wall", "Which brick for my job?"]);
    lastEstimate = qty;
    if (fromQuote) setTimeout(askWhere, 1500);
  }
  let lastEstimate = null;

  function quoteStep(t) {
    const d = flow.data;
    if (flow.step === "product") {
      const ids = findProducts(t.toLowerCase());
      d.product = /mix|not sure/i.test(t) ? "A mix (please advise)"
        : /^pavers?$|^(red common|face|rustic face|load-bearing|cement) bricks$|^flooring tiles$/i.test(t.trim()) ? t.trim()
        : ids.length ? ids.map((id) => byId[id].name).join(" + ") : t;
      return askQty();
    }
    if (flow.step === "qty") {
      if (/calculat|not sure|help/i.test(t)) return startCalc({ product: d.product });
      d.qty = t;
      return askWhere();
    }
    if (flow.step === "where") { d.where = /collect/i.test(t) ? "I'll collect" : t; return askName(); }
    if (flow.step === "name") { d.name = /^skip$/i.test(t.trim()) ? "" : t.trim(); return finishQuote(); }
  }

  // ---------- Built-in answers ----------
  const GREET = /^(hi+|hey+|hello+|hie|helo|howzit|yo|mhoro|makadii|makadini|mangwanani|masikati|manheru|good (morning|afternoon|evening|day))\b[\s,!.]*/;
  const BRICKISH = /brick|paver|paving|tile|wall|build|house|construct|chidhinha|zvidhinha|dhinha/;

  function reply(raw) {
    let t = raw.toLowerCase().replace(/[’']/g, "'").replace(/[?!.,]+/g, " ").replace(/\s+/g, " ").trim();
    t = t.replace(/\bbriks?\b|\bbrik\b|\bbrickz\b/g, "bricks").replace(/zvidhinha|chidhinha|madhinha/g, "bricks");
    const greeted = GREET.test(t);
    if (greeted) t = t.replace(GREET, "").trim();
    if (greeted && !t) {
      const again = history.filter((m) => m.from === "me").length > 1;
      return say(again ? "Hi again! What are you building? I can suggest bricks, estimate how many you need or put a quote together."
        : "Hi! 👋 What are you building? I can suggest the right bricks, estimate how many you need, or put your quote together for WhatsApp.", MAIN_CHIPS);
    }

    if (has(t, /^get a quote for this$/)) return startQuote({ qty: lastEstimate });
    if (has(t, /^(start another quote|get a quote|quote|i want to order|order|buy)\b/) || has(t, /\b(get|want|need|request)\b.*\bquote\b|\bplace an? order\b/)) {
      const ids = findProducts(t);
      return startQuote(ids.length ? { product: ids.map((id) => byId[id].name).join(" + ") } : {});
    }
    // "I need 5000 common bricks" → straight into a quote with both filled in
    const qtyMatch = t.match(/\b(\d{1,3}(?:[ ,]\d{3})+|\d+(?:\.\d+)?\s?k|\d{2,})\b/);
    const named = findProducts(t);
    if (qtyMatch && named.length && !has(t, /\b(m2|m²|metres?|meters?|x)\b/))
      return startQuote({ product: named.map((id) => byId[id].name).join(" + "), qty: qtyMatch[1].replace(/\s?k$/, "000") });
    if (has(t, /\bcement\b/) && !has(t, /brick|block/))
      return say(["We don't sell bags of cement, but we do supply <strong>cement bricks</strong>:", productCards(["cement"])], ["Quote for cement bricks", "See all bricks"]);
    if (has(t, /how many|calculat|estimate|quantity of|number of bricks|how much bricks/) || has(t, /^calculate another wall$/)) {
      const size = parseSize(t);
      return startCalc(null, size && (size.area != null ? size.area : size.length != null ? size.length * size.height : null));
    }

    if (has(t, /thank|ndatenda|tatenda|appreciate|cheers/))
      return say("You're welcome! Anything else I can help with?", ["Get a quote", "How many bricks do I need?", "Talk to a person"]);

    if (has(t, /scam|fake|fraud|legit|genuine|trust|\breal\b|official/)) return say(fmt(FACTS.scam), ["Get a quote", "Where are you?"]);
    if (has(t, /price|cost|how much|\bmari\b|mutengo|marii|\brates?\b|charges?|cheap|expensive|\$|usd|per thousand/)) {
      const ids = findProducts(t);
      return say(fmt(FACTS.price), [ids.length ? `Quote for ${byId[ids[0]].name.toLowerCase()}` : "Get a quote", "How many bricks do I need?"]);
    }
    if (has(t, /pay|ecocash|bank|cash|swipe|transfer|zig/)) return say(fmt(FACTS.pay), ["Get a quote"]);
    if (has(t, /deliver|transport|truck|lorry|bring|send to|distance|delivery & hours/)) {
      const out = [fmt(FACTS.delivery)];
      if (has(t, /hours/)) out.push(fmt(FACTS.hours));
      return say(out, ["Get a quote", "Where are you?"]);
    }
    if (has(t, /who are you|about (you|pangano)|manufactur|do you make|your own|factory|kiln|company/)) return say(fmt(FACTS.who), ["What do you sell?", "Get a quote"]);
    const RANGE = /\b(types?|kinds?|sorts?|variet(y|ies)|options?|range|products?|catalog(ue)?|selection|categor(y|ies)|list)\b|what (bricks|pavers|do you (sell|have|stock|offer|supply))|\b(do|can) you (sell|have|stock|offer|supply)\b|\bavailable\b|in stock|show me|what bricks/;
    const CHOOSE = /which brick for my job|which bricks? (should|do|can|to)|what bricks? (should|do i need|to use)|recommend|suggest|best bricks?|help me choose|advice|advise/;
    const askJob = has(t, /which brick for my job/) || (has(t, CHOOSE) && !findJob(t) && !findProducts(t).length);
    if (askJob) return say("Tell me what you're building and I'll point you to the right brick. For example: <em>foundation</em>, <em>boundary wall</em>, <em>house exterior</em>, <em>gate pillars</em>, <em>driveway</em>.",
      ["Foundation", "Plastered walls", "House exterior, no plaster", "Gate pillars", "Boundary wall", "Driveway", "Patio / walkway"]);
    if (has(t, RANGE) && has(t, /paver|paving/) && !has(t, /brick/)) return say(["Here's our paving and flooring:", productCards(["interlock", "rect", "tiles"])], ["Get a quote", "See all bricks"]);
    if (has(t, RANGE)) {
      const named = findProducts(t);
      if (named.length && !has(t, /which brick for my job/)) return say([productCards(named)], [`Quote for ${byId[named[0]].name.toLowerCase()}`, "How many bricks do I need?", "See all bricks"]);
      if (has(t, /which brick for my job/)) return say("Tell me what you're building and I'll point you to the right brick. For example: <em>foundation</em>, <em>boundary wall</em>, <em>house exterior</em>, <em>gate pillars</em>, <em>driveway</em>.",
        ["Foundation", "Plastered walls", "House exterior, no plaster", "Gate pillars", "Boundary wall", "Driveway", "Patio / walkway"]);
      return say(["Here's everything we supply. Tap any one for details, or tell me what you're building and I'll narrow it down:", productCards(["common", "load", "face", "rustic", "black", "semi", "blue", "cement", "botswana"]), productCards(["interlock", "rect", "tiles"])],
        ["Which brick for my job?", "Get a quote"]);
    }

    const job = findJob(t);
    if (job) {
      const parts = [esc(job.say), productCards(job.ids)];
      if (job.warn) parts.push(fmt(FACTS.structural));
      return say(parts, [`Quote for ${byId[job.ids[0]].name.toLowerCase()}`, "How many bricks do I need?"]);
    }
    const ids = findProducts(t);
    if (ids.length) {
      const parts = [productCards(ids)];
      if (ids.includes("load")) parts.push(fmt(FACTS.structural));
      return say(parts, [`Quote for ${byId[ids[0]].name.toLowerCase()}`, "How many bricks do I need?", "Which brick for my job?"]);
    }

    if (has(t, /open|hours|time|close|weekend|sunday|holiday|24/)) return say(fmt(FACTS.hours), ["Get a quote", "Where are you?"]);
    if (has(t, /where|address|location|located|office|yard|direction|map|harare|bindura|shashi|piki|find you/))
      return say(`${fmt(FACTS.where)}<div class="chat-links"><a href="https://www.google.com/maps/search/?api=1&query=8+Temple+Bar+Building+Harare" target="_blank" rel="noopener">Harare map →</a><a href="https://www.google.com/maps/search/?api=1&query=Bindura+CBD+Zimbabwe" target="_blank" rel="noopener">Bindura map →</a></div>`, ["Do you deliver?", "Get a quote"]);
    if (has(t, /collect|pick ?up|fetch/)) return say(fmt(FACTS.collect), ["Where are you?", "Get a quote"]);
    if (has(t, /minimum|small order|few bricks|how few/)) return say(fmt(FACTS.min), ["Get a quote", "How many bricks do I need?"]);
    if (has(t, /phase|split|schedule|stages/)) return say(fmt(FACTS.delivery), ["Get a quote"]);
    if (has(t, /human|agent|person|someone|call|phone|number|contact|whatsapp|talk to/))
      return say(`You can reach a person any time on WhatsApp: <strong>+263 77 236 0468</strong>. We're open 24/7.${waButton("Hi Pangano Bricks, I'd like to talk to someone.", "Open WhatsApp")}`, ["Get a quote"]);
    if (has(t, /^see all bricks$/)) return reply("what types of bricks");
    if (has(t, BRICKISH))
      return say(["I can help with that. Tell me what you're building (for example <em>boundary wall</em>, <em>house exterior</em> or <em>driveway</em>) and I'll suggest the right brick. Here's what we supply:",
        productCards(["common", "load", "face", "rustic", "black", "semi", "blue", "cement", "botswana"])], ["Which brick for my job?", "How many bricks do I need?", "Get a quote"]);
    return say(`I'm not sure about that one. A person on our team can answer it on WhatsApp, any time.${waButton(`Hi Pangano Bricks, ${raw}`, "Ask on WhatsApp")}`, MAIN_CHIPS);
  }

  // ---------- AI (optional) ----------
  async function askAI(text) {
    const t = typing();
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: aiTurns.slice(-12) }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (!data.reply) throw new Error("empty");
      t.remove();
      let out = String(data.reply);
      const actions = [];
      if (/\[QUOTE\]/.test(out)) actions.push("Get a quote");
      if (/\[CALC\]/.test(out)) actions.push("How many bricks do I need?");
      out = out.replace(/\[(QUOTE|CALC|WHATSAPP)\]/g, "").trim();
      aiTurns.push({ role: "assistant", content: out });
      addMsg("bot", fmt(out) + (/\[WHATSAPP\]/.test(data.reply) ? waButton(`Hi Pangano Bricks, ${text}`, "Continue on WhatsApp") : ""));
      setChips(actions.length ? actions : ["Get a quote", "How many bricks do I need?"]);
      return true;
    } catch (e) {
      t.remove();
      // 503 = AI not switched on; anything else = network or upstream issue. Either way, built-in brain takes over.
      aiAvailable = false;
      aiTurns.pop();
      return false;
    }
  }

  // ---------- Input ----------
  let busy = false;
  async function handle(text, fromChip) {
    text = String(text).trim();
    if (!text || busy) return;
    busy = true;
    addMsg("me", esc(text));
    try {
      if (/^(cancel|stop|start over|restart|menu)$/i.test(text)) {
        flow = null;
        await say("No problem. What would you like to do?", MAIN_CHIPS);
      } else if (flow && !fromChip && /\?|^(how|what|which|who|why|when|do|does|can|could|is|are|hi|hello|hey|mhoro|makadii)\b/i.test(text)
                 && !(flow.type === "calc" && /\d/.test(text))) {
        flow = null;
        if (aiAvailable) {
          aiTurns.push({ role: "user", content: text.slice(0, 500) });
          if (!(await askAI(text))) await reply(text);
        } else await reply(text);
      } else if (flow && flow.type === "quote") {
        await quoteStep(text);
      } else if (flow && flow.type === "calc") {
        await calcStep(text);
      } else if (!fromChip && aiAvailable) {
        aiTurns.push({ role: "user", content: text.slice(0, 500) });
        const ok = await askAI(text);
        if (!ok) await reply(text);
      } else {
        await reply(text);
      }
    } finally {
      busy = false;
    }
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = "";
    handle(v, false);
  });

  // ---------- Open / close ----------
  function welcome() {
    log.innerHTML = "";
    history = []; aiTurns = []; flow = null;
    say(["Hi! 👋 I'm Pangano's assistant.",
      "I can help you <strong>pick the right brick</strong>, <strong>work out how many you need</strong>, or <strong>put your quote together</strong> so you just press send on WhatsApp. What are you building?"], MAIN_CHIPS);
  }
  function open() {
    hideTeaser();
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add("open"));
    launcher.setAttribute("aria-expanded", "true");
    launcher.classList.add("active");
    document.body.classList.add("chat-open");
    if (!log.children.length) {
      if (load()) {
        history.forEach((m) => addMsg(m.from, m.html, { restore: true }));
        setChips(chips);
      } else welcome();
    }
    if (window.matchMedia("(min-width: 640px)").matches) setTimeout(() => input.focus(), 50);
  }
  function close() {
    panel.classList.remove("open");
    launcher.setAttribute("aria-expanded", "false");
    launcher.classList.remove("active");
    document.body.classList.remove("chat-open");
    setTimeout(() => { panel.hidden = true; }, 250);
    launcher.focus();
  }
  launcher.setAttribute("aria-controls", "chatPanel");
  launcher.setAttribute("aria-expanded", "false");
  launcher.addEventListener("click", () => (panel.hidden ? open() : close()));
  panel.querySelector(".chat-close").addEventListener("click", close);
  panel.querySelector(".chat-restart").addEventListener("click", () => { setChips([]); welcome(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) close(); });

  // Any "Help me choose"-style link can open the assistant: <a data-chat="message">
  document.querySelectorAll("[data-chat]").forEach((el) => el.addEventListener("click", (e) => {
    e.preventDefault();
    open();
    const msg = el.getAttribute("data-chat");
    if (msg) setTimeout(() => handle(msg, true), 300);
  }));
})();
