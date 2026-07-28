#!/usr/bin/env node
// Forkcast data pipeline: pull SF events from Luma's discover API,
// keep the ones whose description mentions food, classify the food,
// and write data/events.json for the static site.

const SF_PLACE_ID = "discplace-BDj7GNbGlsF7Cka";
const LIST_URL = `https://api.lu.ma/discover/get-paginated-events?discover_place_api_id=${SF_PLACE_ID}&pagination_limit=50`;
const EVENT_URL = (slug) => `https://api.lu.ma/url?url=${slug}`;
const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) forkcast/1.0" };

const MAX_PAGES = 10;
const WINDOW_DAYS = 8;
const DETAIL_CONCURRENCY = 5;

// Ordered most-specific-first; first match wins as the primary label.
const FOOD_TYPES = [
  { key: "pizza",   emoji: "🍕", label: "Pizza",   words: ["pizza", "pizzas", "pizzeria", "sourdough slice"] },
  { key: "tacos",   emoji: "🌮", label: "Tacos",   words: ["taco", "tacos", "burrito", "burritos", "quesadilla", "birria", "al pastor"] },
  { key: "sushi",   emoji: "🍣", label: "Sushi",   words: ["sushi", "nigiri", "sashimi", "omakase", "handroll", "hand roll"] },
  { key: "noodles", emoji: "🍜", label: "Noodles", words: ["ramen", "pho", "noodle", "noodles", "udon", "dumpling", "dumplings", "dim sum", "bao", "wonton"] },
  { key: "burgers", emoji: "🍔", label: "Burgers", words: ["burger", "burgers", "hot dog", "hot dogs", "sliders"] },
  { key: "bbq",     emoji: "🍖", label: "BBQ",     words: ["bbq", "barbecue", "barbeque", "grill out", "cookout", "kebab", "kabob", "skewer", "skewers"] },
  { key: "curry",   emoji: "🍛", label: "Curry",   words: ["curry", "biryani", "thali", "dosa", "indian food", "thai food"] },
  { key: "medit",   emoji: "🥙", label: "Halal",   words: ["shawarma", "falafel", "halal", "gyro", "mediterranean food", "hummus"] },
  { key: "salad",   emoji: "🥗", label: "Healthy", words: ["salad", "salads", "poke bowl", "grain bowl", "vegan food", "plant-based food", "acai", "açaí", "smoothie"] },
  { key: "boba",    emoji: "🧋", label: "Boba",    words: ["boba", "bubble tea", "milk tea", "matcha"] },
  { key: "coffee",  emoji: "☕", label: "Coffee",  words: ["coffee", "espresso", "latte", "cappuccino", "cold brew"] },
  { key: "pastry",  emoji: "🍩", label: "Pastries", words: ["donut", "donuts", "doughnut", "pastry", "pastries", "croissant", "bagel", "bagels", "bakery", "baked goods", "muffin", "muffins"] },
  { key: "dessert", emoji: "🍦", label: "Dessert", words: ["ice cream", "gelato", "dessert", "desserts", "cake", "cookies", "cookie", "chocolate", "sweet treats", "boba pop", "mochi"] },
  { key: "pancake", emoji: "🥞", label: "Brunch",  words: ["brunch", "pancake", "pancakes", "waffle", "waffles", "breakfast"] },
  { key: "wine",    emoji: "🥂", label: "Aperitivo", words: ["wine tasting", "wine and cheese", "cheese tasting", "charcuterie", "aperitivo", "happy hour"] },
  // Generic mentions — matched last, shown as plain "Food".
  { key: "food",    emoji: "🍽️", label: "Food",    words: [
    "food", "lunch", "dinner", "snacks", "snack", "refreshments", "catered", "catering",
    "bites", "appetizers", "eats", "feast", "potluck", "food trucks", "food truck",
    "meals", "meal provided", "complimentary drinks", "light fare", "tastings", "tasting menu"
  ] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJSON(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.status === 429) { await sleep(2000 * (i + 1)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tries - 1) throw err;
      await sleep(800 * (i + 1));
    }
  }
}

// Flatten a ProseMirror doc into plain text.
function mirrorToText(node) {
  if (!node) return "";
  if (node.type === "hard_break" || node.type === "horizontal_rule") return "\n";
  if (typeof node.text === "string") return node.text;
  const parts = (node.content || []).map(mirrorToText);
  const joined = parts.join(node.type === "doc" ? "\n" : "");
  return node.type === "paragraph" || node.type === "heading" ? joined + "\n" : joined;
}

function classifyFood(text) {
  const lower = " " + text.toLowerCase().replace(/[\n\r]/g, " ") + " ";
  const hits = [];
  for (const type of FOOD_TYPES) {
    for (const word of type.words) {
      const re = new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z])`, "i");
      if (re.test(lower)) { hits.push({ type, word }); break; }
    }
  }
  if (hits.length === 0) return null;
  // False-positive guards for the generic bucket.
  if (hits.length === 1 && hits[0].type.key === "food") {
    const w = hits[0].word;
    if (w === "food" && /food for thought|soul food(?!\s*(truck|served|provided))|food-grade|foodtech|food tech|food industry|food startup|food delivery|food policy|food waste/i.test(lower)
      && !/free food|food provided|food served|food will be|food and drink|food & drink|food trucks?|great food|good food|delicious food|plenty of food/i.test(lower)) {
      return null;
    }
  }
  return hits;
}

function findSnippet(text, word) {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  const re = new RegExp(`(^|[^a-z])${word}($|[^a-z])`, "i");
  const hit = sentences.find((s) => re.test(s));
  if (!hit) return null;
  const clean = hit.trim().replace(/\s+/g, " ");
  return clean.length > 140 ? clean.slice(0, 137).trimEnd() + "…" : clean;
}

async function main() {
  const now = Date.now();
  const horizon = now + WINDOW_DAYS * 24 * 3600 * 1000;

  // 1. Page through the SF discover feed.
  const listed = [];
  let cursor = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = cursor ? `${LIST_URL}&pagination_cursor=${encodeURIComponent(cursor)}` : LIST_URL;
    const body = await fetchJSON(url);
    for (const entry of body.entries || []) {
      const ev = entry.event;
      if (!ev) continue;
      const start = Date.parse(ev.start_at);
      if (!(start > now - 3 * 3600 * 1000 && start < horizon)) continue;
      if (ev.location_type !== "offline") continue;
      if (!ev.coordinate?.latitude) continue;
      const { latitude: lat, longitude: lng } = ev.coordinate;
      // SF proper only — this is an "around you" radar, not a Bay Area listing.
      if (lat < 37.7 || lat > 37.835 || lng < -122.53 || lng > -122.35) continue;
      listed.push({
        slug: ev.url,
        name: ev.name,
        start: ev.start_at,
        end: ev.end_at,
        lat: ev.coordinate.latitude,
        lng: ev.coordinate.longitude,
        venue: ev.geo_address_info?.short_address || ev.geo_address_info?.address || "San Francisco",
        city: ev.geo_address_info?.city || "",
        cover: ev.cover_url,
        colors: entry.cover_image?.colors || [],
      });
    }
    if (!body.has_more || !body.next_cursor) break;
    cursor = body.next_cursor;
    await sleep(300);
  }
  console.log(`Listed ${listed.length} upcoming offline events in window`);

  // 2. Fetch descriptions with limited concurrency.
  const detailed = [];
  let idx = 0;
  async function worker() {
    while (idx < listed.length) {
      const item = listed[idx++];
      try {
        const body = await fetchJSON(EVENT_URL(item.slug));
        const desc = mirrorToText(body?.data?.description_mirror).trim();
        detailed.push({ ...item, desc });
      } catch (err) {
        console.warn(`  detail failed for ${item.slug}: ${err.message}`);
        detailed.push({ ...item, desc: "" });
      }
      await sleep(150);
    }
  }
  await Promise.all(Array.from({ length: DETAIL_CONCURRENCY }, worker));

  // 3. Classify.
  const events = [];
  for (const ev of detailed) {
    const text = `${ev.name}\n${ev.desc}`;
    const hits = classifyFood(text);
    if (!hits) continue;
    const primary = hits[0];
    const snippet = findSnippet(ev.desc, primary.word) || findSnippet(ev.name, primary.word) || "";
    events.push({
      slug: ev.slug,
      name: ev.name,
      url: `https://lu.ma/${ev.slug}`,
      start: ev.start,
      end: ev.end,
      lat: ev.lat,
      lng: ev.lng,
      venue: ev.venue,
      cover: ev.cover,
      colors: ev.colors,
      food: { key: primary.type.key, emoji: primary.type.emoji, label: primary.type.label },
      allFood: hits.map((h) => ({ key: h.type.key, emoji: h.type.emoji, label: h.type.label })),
      snippet,
    });
  }
  events.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  const out = {
    generatedAt: new Date().toISOString(),
    city: "San Francisco",
    source: "lu.ma",
    count: events.length,
    events,
  };
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync(new URL("../data/", import.meta.url), { recursive: true });
  writeFileSync(new URL("../data/events.json", import.meta.url), JSON.stringify(out, null, 1));
  console.log(`Wrote ${events.length} food events → data/events.json`);
  const tally = {};
  for (const e of events) tally[e.food.label] = (tally[e.food.label] || 0) + 1;
  console.log(tally);
}

main().catch((err) => { console.error(err); process.exit(1); });
