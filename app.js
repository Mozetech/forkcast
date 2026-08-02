/* Forkcast front end: load events.json, render map pins + card rail + chips.
   Theme follows the clock: light by day, dark after dusk. */

const SF = [37.773, -122.424];
const TZ = "America/Los_Angeles";
const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};

/* ── hand-drawn icon set (24x24, stroke) ────────────────── */

const P = (inner, w = 1.7) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const dot = (x, y, r = 1.15) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;

const ICONS = {
  all: P(`<path d="M12 3l1.9 7.1L21 12l-7.1 1.9L12 21l-1.9-7.1L3 12l7.1-1.9Z"/>`),
  food: P(`<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="4"/>`, 1.5),
  pizza: P(`<path d="M3.8 6.2C8.5 3.6 15.5 3.6 20.2 6.2L12 21Z"/>${dot(9.4, 8.6)}${dot(14.6, 9.8)}${dot(11.5, 13.2)}`),
  tacos: P(`<path d="M3.5 17a8.5 8.5 0 0 1 17 0Z"/><path d="M6.6 13.8c1-1.4 2.4-1.4 3.2-.2 1-1.4 2.5-1.4 3.4-.1 1-1.3 2.4-1.3 3.4-.2"/>`),
  sushi: P(`<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>`),
  noodles: P(`<path d="M3.5 12.5h17"/><path d="M4 12.5a8 8 0 0 0 16 0"/><path d="M7.4 3.2l7.4 6.6"/><path d="M10.8 2.8l5.8 5.6"/><path d="M9 20.4h6"/>`),
  burgers: P(`<path d="M4.5 10.5a7.5 5.5 0 0 1 15 0"/><path d="M4.5 13.4l2.3 1.1 2.4-1.1 2.4 1.1 2.4-1.1 2.4 1.1 2.1-1.1"/><path d="M5 16.6h14v.8a2.6 2.6 0 0 1-2.6 2.6H7.6A2.6 2.6 0 0 1 5 17.4Z"/>`),
  bbq: P(`<path d="M4.5 19.5L19.5 4.5"/><path d="M9.4 11.6l3 3-3 3-3-3Z"/><path d="M14.9 6.1l3 3-3 3-3-3Z"/>`),
  curry: P(`<path d="M3.5 12.5h17"/><path d="M4 12.5a8 8 0 0 0 16 0"/><path d="M9.5 4.2c-.9 1.4.9 2.3 0 3.7"/><path d="M14.5 4.2c-.9 1.4.9 2.3 0 3.7"/>`),
  medit: P(`<path d="M7.6 6.8a4.4 3.2 0 0 1 8.8 0"/><path d="M7.6 6.8l3 13.6h2.8l3-13.6"/><path d="M8.5 10.6q3.5 1.7 7 0"/><path d="M9.3 14.2q2.7 1.4 5.4 0"/>`),
  salad: P(`<path d="M19.8 4.2C10.6 4.6 5.4 9.8 4.6 19.4 14 19 19.4 13.6 19.8 4.2Z"/><path d="M4.6 19.4C9 13.6 13.6 9.2 19.8 4.2"/>`),
  boba: P(`<path d="M7.7 7.4h8.6l-1 12.8H8.7Z"/><path d="M10.9 7.4l2.1-4.6"/>${dot(10.3, 16.9, 1.05)}${dot(12.4, 17.5, 1.05)}${dot(14.1, 16.6, 1.05)}`),
  coffee: P(`<path d="M5.4 9.4h9.8v4.4a4.4 4.4 0 0 1-4.4 4.4h-1a4.4 4.4 0 0 1-4.4-4.4Z"/><path d="M15.2 10.6h.9a2.4 2.4 0 0 1 0 4.8h-1.3"/><path d="M8.8 3.6c-.8 1.2.8 2 0 3.2"/><path d="M12 3.6c-.8 1.2.8 2 0 3.2"/>`),
  pastry: P(`<circle cx="12" cy="12.6" r="7.4"/><circle cx="12" cy="12.6" r="2.6"/><path d="M8.2 8.8l.9.9"/><path d="M15.8 8.6l-.9.9"/><path d="M7 14.8l1.2-.4"/><path d="M17 14.4l-1.2-.4"/>`),
  dessert: P(`<path d="M7.6 10.8a4.4 4.4 0 1 1 8.8 0"/><path d="M7.6 10.8h8.8"/><path d="M7.9 10.8L12 21l4.1-10.2"/><path d="M10.1 14.2h5"/>`),
  pancake: P(`<ellipse cx="12" cy="7.6" rx="7.2" ry="2.6"/><path d="M4.8 7.6v3.6c0 1.5 3.2 2.7 7.2 2.7s7.2-1.2 7.2-2.7V7.6"/><path d="M4.8 11.2v4c0 1.5 3.2 2.7 7.2 2.7s7.2-1.2 7.2-2.7v-4"/>`),
  wine: P(`<path d="M5.8 4.2h12.4a6.2 4.9 0 0 1-12.4 0Z"/><path d="M12 10.6V19"/><path d="M8.2 19.6h7.6"/>`),
  pin: P(`<path d="M12 21c-4.3-4.7-6.7-7.9-6.7-11a6.7 6.7 0 0 1 13.4 0c0 3.1-2.4 6.3-6.7 11Z"/><circle cx="12" cy="9.6" r="2.2"/>`),
  check: P(`<path d="M5 12.5l4.5 4.5L19 7.5"/>`, 2.2),
};

const icon = (key, size) =>
  `<span class="ic" style="width:${size}px;height:${size}px">${ICONS[key] || ICONS.food}</span>`;

/* ── map & theme ────────────────────────────────────────── */

const map = L.map("map", { zoomControl: false, attributionControl: true }).setView(SF, 13);
let tileLayer = null;

const state = { events: [], day: "today", food: null, live: null, markers: new Map(), booted: false, dark: null };

const isNight = () => { const h = new Date().getHours(); return h >= 19 || h < 7; };
function applyTheme() {
  const dark = isNight();
  if (dark === state.dark) return;
  state.dark = dark;
  document.body.classList.toggle("dark", dark);
  if (tileLayer) tileLayer.remove();
  tileLayer = L.tileLayer(TILES[dark ? "dark" : "light"], {
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    maxZoom: 19,
  }).addTo(map);
}
applyTheme();
setInterval(applyTheme, 60000);

const $ = (id) => document.getElementById(id);
const railEl = $("rail"), chipsEl = $("chips"), emptyEl = $("empty");

/* ── time helpers ───────────────────────────────────────── */

const fmtDay = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TZ });
const fmtTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });
const dayKey = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

function whenLabel(ev) {
  if (Date.parse(ev.start) <= Date.now()) return "Now";
  const d = new Date(ev.start);
  const k = dayKey(d);
  const t = fmtTime.format(d).replace(":00", "");
  if (k === dayKey(new Date())) return `Today ${t}`;
  if (k === dayKey(new Date(Date.now() + 864e5))) return `Tmrw ${t}`;
  return `${fmtDay.format(d)} ${t}`;
}
const isSoon = (iso) => {
  const dt = Date.parse(iso) - Date.now();
  return dt > -2 * 36e5 && dt < 3 * 36e5;
};

function inDay(ev) {
  if (state.day === "now") {
    const s = Date.parse(ev.start);
    const e = ev.end ? Date.parse(ev.end) : s + 3 * 36e5;
    return s < Date.now() + 60 * 60000 && e > Date.now();
  }
  const k = dayKey(new Date(ev.start));
  if (state.day === "today") return k === dayKey(new Date());
  if (state.day === "tomorrow") return k === dayKey(new Date(Date.now() + 864e5));
  return true;
}
const visible = () =>
  state.events.filter((e) => inDay(e) && (!state.food || e.food.key === state.food));

/* ── render ─────────────────────────────────────────────── */

function renderChips() {
  const tally = new Map();
  for (const e of state.events.filter(inDay)) {
    tally.set(e.food.key, (tally.get(e.food.key) || 0) + 1);
  }
  const order = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  chipsEl.innerHTML = "";
  const all = document.createElement("button");
  all.className = "chip" + (state.food ? "" : " is-on");
  all.innerHTML = `${icon("all", 15)}All`;
  all.onclick = () => { state.food = null; render(); };
  chipsEl.appendChild(all);
  order.forEach(([key, n], i) => {
    const meta = state.events.find((e) => e.food.key === key).food;
    const b = document.createElement("button");
    b.className = "chip" + (state.food === key ? " is-on" : "");
    b.style.animationDelay = `${0.05 * (i + 1)}s`;
    b.innerHTML = `${icon(key, 15)}${meta.label}<span class="n">${n}</span>`;
    b.onclick = () => { state.food = state.food === key ? null : key; render(); };
    chipsEl.appendChild(b);
  });
}

function renderRail(list) {
  railEl.innerHTML = "";
  list.forEach((ev, i) => {
    const card = document.createElement("article");
    card.className = "card" + (state.live === ev.slug ? " is-live" : "");
    card.dataset.slug = ev.slug;
    card.style.animationDelay = `${Math.min(i * 0.06, 0.5)}s`;
    const art = ev.cover
      ? `style="background-image:url('${ev.cover}')"`
      : `style="background:linear-gradient(135deg,${ev.colors[1] || "#d9885f"},${ev.colors[0] || "#8f5a3c"})"`;
    card.innerHTML = `
      <div class="card-art" ${art}>
        <span class="card-badge">${icon(ev.food.key, 13)}${ev.food.label}</span>
        <span class="card-when ${isSoon(ev.start) ? "is-soon" : ""}">${whenLabel(ev)}</span>
        ${regd.has(ev.slug) ? `<span class="card-reg">${icon("check", 12)}</span>` : ""}
      </div>
      <div class="card-body">
        <h3 class="card-name">${ev.name}</h3>
        <p class="card-venue">${icon("pin", 12)}<span class="venue-text">${ev.venue}</span></p>
        <div class="card-foot">
          <span class="card-quote">${ev.snippet ? "“" + ev.snippet + "”" : ""}</span>
          <a class="card-go" href="${ev.url}" target="_blank" rel="noopener" data-embed="${ev.embed || ""}">Go</a>
        </div>
      </div>`;
    card.onclick = () => focusEvent(ev, { fly: true });
    card.querySelector(".card-go").onclick = (e) => {
      e.stopPropagation();
      markRegistered(ev, card);
      if (ev.embed) { e.preventDefault(); openModal(ev.embed); }
    };
    railEl.appendChild(card);
  });
  emptyEl.hidden = list.length > 0;
}

function renderMarkers(list) {
  for (const m of state.markers.values()) m.remove();
  state.markers.clear();
  const seen = new Map(); // spread events that share an exact venue pin
  for (let ev of list) {
    const key = ev.lat.toFixed(5) + "," + ev.lng.toFixed(5);
    const n = seen.get(key) || 0;
    seen.set(key, n + 1);
    if (n > 0) {
      const a = n * 2.4;
      ev = { ...ev, lat: ev.lat + 0.00045 * n * Math.cos(a), lng: ev.lng + 0.00055 * n * Math.sin(a) };
    }
    const mIcon = L.divIcon({
      className: "pin" + (state.live === ev.slug ? " is-live" : ""),
      html: `<div class="pin-inner">${icon(ev.food.key, 18)}</div>`,
      iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -42],
    });
    const m = L.marker([ev.lat, ev.lng], { icon: mIcon }).addTo(map);
    m.bindPopup(
      `<div class="pop-name">${ev.name}</div>
       <div class="pop-meta">${ev.food.label} · ${whenLabel(ev)} · ${ev.venue}</div>`,
      { closeButton: false }
    );
    m.on("click", () => focusEvent(ev, { scroll: true }));
    state.markers.set(ev.slug, m);
  }
}

function focusEvent(ev, { fly, scroll } = {}) {
  state.live = ev.slug;
  document.querySelectorAll(".card").forEach((c) =>
    c.classList.toggle("is-live", c.dataset.slug === ev.slug));
  state.markers.forEach((m, slug) => {
    const el = m.getElement();
    if (el) el.classList.toggle("is-live", slug === ev.slug);
  });
  const marker = state.markers.get(ev.slug);
  if (fly && marker) {
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 14.5), { duration: 0.8 });
    setTimeout(() => marker.openPopup(), 850);
  }
  if (scroll) {
    const card = railEl.querySelector(`[data-slug="${ev.slug}"]`);
    if (card) card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }
}

function render() {
  const list = visible();
  renderChips();
  renderRail(list);
  renderMarkers(list);
  $("count").textContent = list.length;
  if (list.length) {
    try {
      const bounds = L.latLngBounds(list.map((e) => [e.lat, e.lng])).pad(0.18);
      state.lastBounds = bounds;
      if (state.booted) map.flyToBounds(bounds, { duration: 0.9, maxZoom: 14.5 });
      else map.fitBounds(bounds, { animate: false, maxZoom: 14.5 });
    } catch (err) { console.warn("fit failed", err); }
  }
  state.booted = true;
}

/* ── local memory: which events you've opened registration for ── */

const regd = new Set(JSON.parse(localStorage.getItem("fk-reg") || "[]"));
function markRegistered(ev, card) {
  if (regd.has(ev.slug)) return;
  regd.add(ev.slug);
  localStorage.setItem("fk-reg", JSON.stringify([...regd]));
  const art = card.querySelector(".card-art");
  if (art && !art.querySelector(".card-reg")) {
    art.insertAdjacentHTML("beforeend", `<span class="card-reg">${icon("check", 12)}</span>`);
  }
}

/* ── register modal (Luma's official embed, in place) ───── */

const modalEl = $("modal"), frameEl = $("modal-frame");
function openModal(src) {
  frameEl.src = src;
  modalEl.hidden = false;
}
function closeModal() {
  modalEl.hidden = true;
  frameEl.src = "about:blank";
}
$("modal-x").onclick = closeModal;
$("modal-backdrop").onclick = closeModal;
addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

/* ── day switcher ───────────────────────────────────────── */

const daysEl = $("days"), thumb = daysEl.querySelector(".day-thumb");
function moveThumb() {
  const on = daysEl.querySelector(".day.is-on");
  thumb.style.left = on.offsetLeft + "px";
  thumb.style.width = on.offsetWidth + "px";
}
daysEl.querySelectorAll(".day").forEach((b) => {
  b.onclick = () => {
    daysEl.querySelectorAll(".day").forEach((x) => x.classList.remove("is-on"));
    b.classList.add("is-on");
    state.day = b.dataset.day;
    state.food = null;
    moveThumb();
    render();
  };
});

/* ── data loading: on boot, on demand, and on a clock ───── */

let lastLoad = 0;

function applyData(d) {
  state.events = d.events.filter((e) => Date.parse(e.end || e.start) > Date.now());
  if (!state.booted && !state.events.some(inDay)) state.day = "week"; // never land on an empty screen
  daysEl.querySelectorAll(".day").forEach((x) =>
    x.classList.toggle("is-on", x.dataset.day === state.day));
  const age = Math.round((Date.now() - Date.parse(d.generatedAt)) / 36e5);
  $("stamp").innerHTML =
    `updated ${age <= 0 ? "just now" : age + "h ago"} · events from <a href="https://lu.ma/sf" target="_blank" rel="noopener">lu.ma</a> + <a href="https://www.eventbrite.com/d/ca--san-francisco/food-and-drink--events/" target="_blank" rel="noopener">eventbrite</a>`;
  moveThumb();
  render();
}

function loadData() {
  return fetch("data/events.json?t=" + Date.now())
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => { lastLoad = Date.now(); applyData(d); })
    .catch((err) => {
      console.error("load failed", err);
      if (!state.events.length) {
        emptyEl.hidden = false;
        emptyEl.querySelector("span:last-child").textContent = "couldn't load events";
      }
    });
}

setTimeout(() => { map.invalidateSize(false); loadData(); }, 0);

// Keep an open tab current: poll every 30 min, and refetch on refocus if stale.
setInterval(loadData, 30 * 60000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() - lastLoad > 10 * 60000) loadData();
});

// Heal a map that was fitted while its container had no size (background tab,
// hidden pane): refit as soon as the container becomes measurable.
new ResizeObserver(() => {
  map.invalidateSize(false);
  if (state.lastBounds && map.getZoom() < 10) {
    map.fitBounds(state.lastBounds, { animate: false, maxZoom: 14.5 });
  }
}).observe(document.getElementById("map"));

$("refresh").onclick = () => {
  const b = $("refresh");
  b.classList.add("spin");
  loadData().finally(() => setTimeout(() => b.classList.remove("spin"), 700));
};

addEventListener("resize", moveThumb);
