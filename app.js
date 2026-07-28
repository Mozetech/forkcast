/* Forkcast front end: load events.json, render map pins + card rail + chips. */

const SF = [37.773, -122.424];
const TZ = "America/Los_Angeles";

const map = L.map("map", { zoomControl: false, attributionControl: true })
  .setView(SF, 13);
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; OpenStreetMap &copy; CARTO',
  maxZoom: 19,
}).addTo(map);

const state = { events: [], day: "today", food: null, live: null, markers: new Map() };

const $ = (id) => document.getElementById(id);
const railEl = $("rail"), chipsEl = $("chips"), emptyEl = $("empty");

const fmtDay = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TZ });
const fmtTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });
const dayKey = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

function whenLabel(iso) {
  const d = new Date(iso);
  const today = dayKey(new Date());
  const tomorrow = dayKey(new Date(Date.now() + 864e5));
  const k = dayKey(d);
  const t = fmtTime.format(d).replace(":00", "");
  if (k === today) return `Today ${t}`;
  if (k === tomorrow) return `Tmrw ${t}`;
  return `${fmtDay.format(d)} ${t}`;
}
const priceTag = (ev) =>
  ev.price > 0 ? ` · $${ev.price}` : ev.price === 0 ? " · Free" : "";
const isSoon = (iso) => {
  const dt = Date.parse(iso) - Date.now();
  return dt > -2 * 36e5 && dt < 3 * 36e5;
};

function inDay(ev) {
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
  all.innerHTML = `<span class="e">✨</span>All`;
  all.onclick = () => { state.food = null; render(); };
  chipsEl.appendChild(all);
  order.forEach(([key, n], i) => {
    const meta = state.events.find((e) => e.food.key === key).food;
    const b = document.createElement("button");
    b.className = "chip" + (state.food === key ? " is-on" : "");
    b.style.animationDelay = `${0.05 * (i + 1)}s`;
    b.innerHTML = `<span class="e">${meta.emoji}</span>${meta.label}<span class="n">${n}</span>`;
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
      : `style="background:linear-gradient(135deg,${ev.colors[1] || "#ffd9c9"},${ev.colors[2] || "#ffe9d6"})"`;
    card.innerHTML = `
      <div class="card-art" ${art}>
        <span class="card-badge"><span class="e">${ev.food.emoji}</span>${ev.food.label}</span>
        <span class="card-when ${isSoon(ev.start) ? "is-soon" : ""}">${whenLabel(ev.start)}${priceTag(ev)}</span>
      </div>
      <div class="card-body">
        <h3 class="card-name">${ev.name}</h3>
        <p class="card-venue">📍 ${ev.venue}</p>
        <div class="card-foot">
          <span class="card-quote">${ev.snippet ? "“" + ev.snippet + "”" : ""}</span>
          <a class="card-go" href="${ev.url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Go</a>
        </div>
      </div>`;
    card.onclick = () => focusEvent(ev, { fly: true });
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
    const icon = L.divIcon({
      className: "pin" + (state.live === ev.slug ? " is-live" : ""),
      html: `<div class="pin-inner"><span>${ev.food.emoji}</span></div>`,
      iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -42],
    });
    const m = L.marker([ev.lat, ev.lng], { icon }).addTo(map);
    m.bindPopup(
      `<div class="pop-name">${ev.name}</div>
       <div class="pop-meta">${ev.food.emoji} ${whenLabel(ev.start)}${priceTag(ev)} · ${ev.venue}</div>`,
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
    map.flyTo([ev.lat, ev.lng], Math.max(map.getZoom(), 14.5), { duration: 0.8 });
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
      if (state.booted) map.flyToBounds(bounds, { duration: 0.9, maxZoom: 14.5 });
      else map.fitBounds(bounds, { animate: false, maxZoom: 14.5 });
    } catch (err) { console.warn("fit failed", err); }
  }
  state.booted = true;
}

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

/* ── boot ───────────────────────────────────────────────── */

function boot(d) {
  state.events = d.events.filter((e) => Date.parse(e.end || e.start) > Date.now());
  if (!state.events.some(inDay)) state.day = "week"; // never land on an empty screen
  daysEl.querySelectorAll(".day").forEach((x) =>
    x.classList.toggle("is-on", x.dataset.day === state.day));
  const age = Math.round((Date.now() - Date.parse(d.generatedAt)) / 36e5);
  $("stamp").innerHTML =
    `updated ${age <= 0 ? "just now" : age + "h ago"} · events from <a href="https://lu.ma/sf" target="_blank" rel="noopener">lu.ma</a> + <a href="https://www.eventbrite.com/d/ca--san-francisco/food-and-drink--events/" target="_blank" rel="noopener">eventbrite</a>`;
  moveThumb();
  render();
}

fetch("data/events.json")
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((d) => requestAnimationFrame(() => { map.invalidateSize(false); boot(d); }))
  .catch((err) => {
    console.error("load failed", err);
    emptyEl.hidden = false;
    emptyEl.querySelector("span:last-child").textContent = "couldn't load events";
  });

addEventListener("resize", moveThumb);
