/* =========================
   ProtocolBuddy - app.js
   Offline-first MVP (Objectbeveiliging)
   ========================= */

/* ---------- Helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const STORAGE = {
  favorites: "pb_favorites_v1",
  checklist: "pb_checklist_v1",
  mostUsed: "pb_most_used_v1"
};

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(msg) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("is-show");
  setTimeout(() => el.classList.remove("is-show"), 1600);
}

/* ---------- UI refs ---------- */
const navButtons = $$(".nav-btn");
const views = $$(".view");

const protocolSearch = $("#protocolSearch");
const btnClearSearch = $("#btnClearSearch");
const btnOpenMostUsed = $("#btnOpenMostUsed");
const categoryChips = $("#categoryChips");
const protocolList = $("#protocolList");
const protocolCount = $("#protocolCount");

const favoritesList = $("#favoritesList");
const favoritesEmpty = $("#favoritesEmpty");

const modal = $("#protocolModal"); // <dialog>
const btnCloseModal = $("#btnCloseModal");
const modalTitle = $("#protocolModalTitle");
const modalContent = $("#protocolModalContent");
const btnToggleFavorite = $("#btnToggleFavorite");
const btnOpenInProtocols = $("#btnOpenInProtocols");

const checklistPanel = $("#checklistPanel");
const checklistTabs = $$(".tab");
const btnChecklistReset = $("#btnChecklistReset");
const btnChecklistSave = $("#btnChecklistSave");

const chatThread = $("#chatThread");
const chatForm = $("#chatForm");
const chatInput = $("#chatInput");
const quickBtns = $$(".quick-replies .chip");

/* ---------- Settings refs (NEW) ---------- */
const btnSettings = $("#btnSettings");
const settingsModal = $("#settingsModal");
const btnCloseSettings = $("#btnCloseSettings");
const btnResetFavorites = $("#btnResetFavorites");
const btnResetUsage = $("#btnResetUsage");
const btnResetAllData = $("#btnResetAllData");

/* ---------- State ---------- */
let PROTOCOLS = [];
let FILTER = { query: "", category: "Alle" };
let CURRENT_PROTOCOL_ID = null;

let favorites = new Set(loadLS(STORAGE.favorites, []));
let mostUsed = loadLS(STORAGE.mostUsed, {}); // { protocolId: count }

let checklistState = loadLS(STORAGE.checklist, {
  activeTab: "start",
  checked: { start: {}, ronde: {}, einde: {} }
});

/* =========================
   Sample fallback protocols (only if protocols.json fails)
   ========================= */
function fallbackProtocols() {
  const data = [
    {
      id: "start-dienst",
      title: "Start dienst / overdracht",
      category: "Dienst",
      keywords: ["start", "overdracht", "dienst", "briefing", "logboek"],
      situation: "Je begint je dienst of neemt de post over.",
      goal: "Scherpe start: weten wat speelt en middelen werken.",
      steps: [
        "Neem overdracht: bijzonderheden, incidenten, open punten.",
        "Check middelen: porto, telefoon, zaklamp, sleutels/passen.",
        "Check panelen: brand/inbraak/technisch volgens instructie.",
        "Korte controle: deuren dicht, nooduitgangen vrij.",
        "Noteer starttijd + status in logboek."
      ],
      say: ["“Welke open punten moet ik opvolgen?”", "“Zijn er storingen of zones met extra aandacht?”"],
      escalate: "Bij storing of ontbrekende middelen: meld direct bij leiding/meldkamer.",
      dont: ["Niet starten zonder communicatie.", "Geen aannames bij onduidelijkheid."]
    },
    {
      id: "ronde-lopen",
      title: "Ronde lopen / controlepunten",
      category: "Rondes",
      keywords: ["ronde", "controle", "deur", "ramen", "sloten", "rook", "geluid"],
      situation: "Je loopt een ronde door het object.",
      goal: "Afwijkingen vroeg zien en risico’s beperken.",
      steps: [
        "Volg route of scanpunten volgens opdracht.",
        "Let op: open deuren/ramen, schade, rook/geur, verdachte geluiden.",
        "Check nooduitgangen: vrij, niet geblokkeerd.",
        "Noteer afwijking: tijd, locatie, wat je ziet/hoort/ruikt.",
        "Acuut risico? Afstand en escaleer."
      ],
      say: ["“Ik loop ronde en meld afwijkingen direct.”"],
      escalate: "Bij rook/inbraaksporen/agressie: meld direct en volg noodprotocol.",
      dont: ["Niet alleen een verdachte ruimte in als dat niet mag."]
    },
    {
      id: "alarmmelding",
      title: "Alarmmelding (inbraak/brandpaneel)",
      category: "Nood",
      keywords: ["alarm", "paneel", "inbraak", "brand", "melding", "sirene"],
      situation: "Er gaat een alarm af of paneel geeft melding.",
      goal: "Juiste opvolging en veilige controle starten.",
      steps: [
        "Lees type melding + zone op het paneel.",
        "Meld aan leiding/meldkamer: type, zone, jouw actie.",
        "Ga alleen volgens procedure richting locatie.",
        "Controleer op rook/sporen zonder risico te nemen.",
        "Leg vast in logboek: tijd, zone, bevinding, acties."
      ],
      say: ["“Melding zone X. Ik volg procedure en meld terug.”"],
      escalate: "Rook/brand/indringer: direct opschalen volgens noodprocedure.",
      dont: ["Niet resetten zonder check/goedkeuring."]
    }
  ];

  return data.map(p => ({ ...p, __fallback: true }));
}

/* =========================
   Load protocols (offline-first)
   ========================= */
async function loadProtocols() {
  try {
    const res = await fetch("./protocols.json");
    if (!res.ok) throw new Error("protocols.json missing");
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("protocols.json invalid");
    return data;
  } catch {
    return fallbackProtocols();
  }
}

/* =========================
   Navigation (views)
   ========================= */
function setActiveView(name) {
  views.forEach(v => v.classList.toggle("is-active", v.dataset.view === name));
  navButtons.forEach(b => {
    const active = b.dataset.nav === name;
    b.classList.toggle("is-active", active);
    if (active) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
}
function initNav() {
  navButtons.forEach(btn => {
    btn.addEventListener("click", () => setActiveView(btn.dataset.nav));
  });
}

/* =========================
   Categories + list
   ========================= */
function getCategories(protocols) {
  const cats = new Set(["Alle"]);
  protocols.forEach(p => cats.add(p.category || "Overig"));
  return Array.from(cats);
}
function renderCategoryChips() {
  const cats = getCategories(PROTOCOLS);
  categoryChips.innerHTML = "";

  cats.forEach(cat => {
    const b = document.createElement("button");
    b.className = "chip";
    b.type = "button";
    b.textContent = cat;
    b.dataset.cat = cat;

    if (FILTER.category === cat) {
      b.style.borderColor = "rgba(56,189,248,0.35)";
      b.style.background = "rgba(56,189,248,0.14)";
    }

    b.addEventListener("click", () => {
      FILTER.category = cat;
      renderCategoryChips();
      renderProtocols();
    });

    categoryChips.appendChild(b);
  });
}

function matchesQuery(p, q) {
  if (!q) return true;
  const hay = [
    p.title,
    p.category,
    p.situation,
    p.goal,
    ...(p.keywords || [])
  ].join(" ").toLowerCase();
  return hay.includes(q.toLowerCase());
}

function renderProtocols(listOverride = null) {
  const q = FILTER.query.trim().toLowerCase();
  const cat = FILTER.category;

  const list = (listOverride || PROTOCOLS)
    .filter(p => (cat === "Alle" ? true : (p.category || "Overig") === cat))
    .filter(p => matchesQuery(p, q));

  protocolCount.textContent = String(list.length);
  protocolList.innerHTML = "";

  list.forEach(p => {
    const li = document.createElement("li");
    li.className = "list-item";
    li.dataset.id = p.id;

    const title = document.createElement("p");
    title.className = "title";
    title.textContent = p.title;

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = `${p.category || "Overig"} • ${p.situation || ""}`.trim();

    const tags = document.createElement("div");
    tags.className = "tags";

    const favTag = document.createElement("span");
    favTag.className = "tag";
    favTag.textContent = favorites.has(p.id) ? "⭐ Favoriet" : "☆ Niet favoriet";
    tags.appendChild(favTag);

    const usedCount = mostUsed[p.id] || 0;
    if (usedCount > 0) {
      const used = document.createElement("span");
      used.className = "tag";
      used.textContent = `Gebruikt: ${usedCount}`;
      tags.appendChild(used);
    }

    li.appendChild(title);
    li.appendChild(meta);
    li.appendChild(tags);

    li.addEventListener("click", () => openProtocol(p.id));
    protocolList.appendChild(li);
  });
}

function findProtocolById(id) {
  return PROTOCOLS.find(p => p.id === id) || null;
}

/* =========================
   Modal
   ========================= */
function protocolToHtml(p) {
  const steps = (p.steps || []).map(s => `<li>${escapeHtml(s)}</li>`).join("");
  const say = (p.say || []).map(s => `<li>${escapeHtml(s)}</li>`).join("");
  const dont = (p.dont || []).map(s => `<li>${escapeHtml(s)}</li>`).join("");

  return `
    <div class="card" style="margin:0; box-shadow:none;">
      <p class="muted small" style="margin:0 0 10px;">
        Disclaimer: algemene richtlijnen. Volg altijd instructies van je werkgever/opdracht en de wet.
      </p>

      ${p.situation ? `
        <p class="small muted" style="margin:0 0 6px;">Situatie</p>
        <p style="margin:0 0 12px;"><strong>${escapeHtml(p.situation)}</strong></p>
      ` : ""}

      ${p.goal ? `
        <p class="small muted" style="margin:0 0 6px;">Doel</p>
        <p style="margin:0 0 12px;">${escapeHtml(p.goal)}</p>
      ` : ""}

      <p class="small muted" style="margin:0 0 6px;">Stappen</p>
      <ol class="steps" style="margin:0 0 12px;">${steps}</ol>

      ${(p.say && p.say.length) ? `
        <p class="small muted" style="margin:0 0 6px;">Wat zeg ik?</p>
        <ul style="margin:0 0 12px; padding-left: 18px;">${say}</ul>
      ` : ""}

      ${p.escalate ? `
        <p class="small muted" style="margin:0 0 6px;">Escalatie</p>
        <p style="margin:0 0 12px;">${escapeHtml(p.escalate)}</p>
      ` : ""}

      ${(p.dont && p.dont.length) ? `
        <p class="small muted" style="margin:0 0 6px;">Niet doen</p>
        <ul style="margin:0; padding-left: 18px;">${dont}</ul>
      ` : ""}
    </div>
  `;
}

function updateFavoriteButton() {
  if (!CURRENT_PROTOCOL_ID) return;
  const isFav = favorites.has(CURRENT_PROTOCOL_ID);
  btnToggleFavorite.textContent = isFav ? "⭐ In favorieten" : "☆ Voeg toe";
}

function openProtocol(id) {
  const p = findProtocolById(id);
  if (!p) return;

  CURRENT_PROTOCOL_ID = id;

  mostUsed[id] = (mostUsed[id] || 0) + 1;
  saveLS(STORAGE.mostUsed, mostUsed);

  modalTitle.textContent = p.title;
  modalContent.innerHTML = protocolToHtml(p);

  updateFavoriteButton();

  if (typeof modal.showModal === "function") modal.showModal();
  else modal.setAttribute("open", "open");

  renderProtocols();
  renderFavorites();
}

function closeModal() {
  CURRENT_PROTOCOL_ID = null;
  if (typeof modal.close === "function") modal.close();
  else modal.removeAttribute("open");
}

function initModal() {
  btnCloseModal.addEventListener("click", closeModal);

  // ✅ correct for dialog: click backdrop closes
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  btnToggleFavorite.addEventListener("click", () => {
    if (!CURRENT_PROTOCOL_ID) return;
    toggleFavorite(CURRENT_PROTOCOL_ID);
  });

  btnOpenInProtocols.addEventListener("click", () => {
    closeModal();
    setActiveView("protocols");
  });
}

/* =========================
   Favorites
   ========================= */
function toggleFavorite(id) {
  if (!id) return;
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);

  saveLS(STORAGE.favorites, Array.from(favorites));

  updateFavoriteButton();
  renderProtocols();
  renderFavorites();

  toast(favorites.has(id) ? "Toegevoegd aan favorieten" : "Verwijderd uit favorieten");
}

function renderFavorites() {
  const favArr = Array.from(favorites)
    .map(id => findProtocolById(id))
    .filter(Boolean);

  favoritesList.innerHTML = "";

  if (favArr.length === 0) {
    favoritesEmpty.style.display = "block";
    return;
  }
  favoritesEmpty.style.display = "none";

  favArr.forEach(p => {
    const li = document.createElement("li");
    li.className = "list-item";
    li.dataset.id = p.id;

    li.innerHTML = `
      <p class="title">${escapeHtml(p.title)}</p>
      <p class="meta">${escapeHtml((p.category || "Overig") + " • " + (p.situation || ""))}</p>
      <div class="tags"><span class="tag">⭐ Favoriet</span></div>
    `;

    li.addEventListener("click", () => openProtocol(p.id));
    favoritesList.appendChild(li);
  });
}

/* =========================
   Search + filters
   ========================= */
function initSearch() {
  protocolSearch.addEventListener("input", (e) => {
    FILTER.query = e.target.value || "";
    renderProtocols();
  });

  btnClearSearch.addEventListener("click", () => {
    protocolSearch.value = "";
    FILTER.query = "";
    FILTER.category = "Alle";
    renderCategoryChips();
    renderProtocols();
    toast("Zoekfilter gewist");
  });

  btnOpenMostUsed.addEventListener("click", () => {
    const sorted = [...PROTOCOLS].sort((a, b) => (mostUsed[b.id] || 0) - (mostUsed[a.id] || 0));
    const top = sorted.slice(0, 6).filter(p => (mostUsed[p.id] || 0) > 0);

    if (top.length === 0) {
      toast("Nog geen gebruiksdata");
      return;
    }

    protocolCount.textContent = String(top.length);
    protocolList.innerHTML = "";

    top.forEach(p => {
      const li = document.createElement("li");
      li.className = "list-item";
      li.innerHTML = `
        <p class="title">${escapeHtml(p.title)}</p>
        <p class="meta">${escapeHtml(p.category || "Overig")} • Gebruikt: ${mostUsed[p.id] || 0}</p>
        <div class="tags"><span class="tag">Top</span></div>
      `;
      li.addEventListener("click", () => openProtocol(p.id));
      protocolList.appendChild(li);
    });

    toast("Meest gebruikte protocollen");
  });
}

/* =========================
   Emergency quick open buttons
   ========================= */
function initEmergencyButtons() {
  $$("[data-open-protocol]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-open-protocol");
      openProtocol(id);
    });
  });
}

/* =========================
   Checklists
   ========================= */
const CHECKLISTS = {
  start: [
    { id: "start-1", text: "Overdracht lezen/ontvangen (bijzonderheden, incidenten, aandachtspunten).", sub: "Vraag door bij onduidelijkheid." },
    { id: "start-2", text: "Middelen check: porto, telefoon, zaklamp, sleutels/passen.", sub: "Werkt alles? Batterij?" },
    { id: "start-3", text: "Panelen/storingen checken volgens instructie (brand/inbraak).", sub: "Noteer storingen." },
    { id: "start-4", text: "Korte controle: deuren dicht, nooduitgangen vrij.", sub: "Let op blokkades." },
    { id: "start-5", text: "Start in logboek: tijd + status + naam.", sub: "Maak het standaard." }
  ],
  ronde: [
    { id: "ronde-1", text: "Route/scanpunten volgen (niet ‘random’).", sub: "Consistentie = veiligheid." },
    { id: "ronde-2", text: "Let op: open deuren/ramen, schade, rook/geur, verdachte geluiden.", sub: "Alles wat afwijkt noteren." },
    { id: "ronde-3", text: "Nooduitgangen vrij + niet geblokkeerd.", sub: "Dit gaat vaak mis." },
    { id: "ronde-4", text: "Verdachte situatie? Afstand houden + opschalen.", sub: "Veiligheid eerst." }
  ],
  einde: [
    { id: "einde-1", text: "Logboek bijwerken: incidenten, afwijkingen, acties, tijden.", sub: "Kort maar volledig." },
    { id: "einde-2", text: "Middelen inleveren/opladen (porto, sleutels, badges).", sub: "Voorkom ‘kwijt’." },
    { id: "einde-3", text: "Overdracht doen: wat speelde er, wat moet opgevolgd worden.", sub: "Zonder aannames." }
  ]
};

function setChecklistTab(tab) {
  checklistState.activeTab = tab;
  saveLS(STORAGE.checklist, checklistState);

  checklistTabs.forEach(t => {
    const active = t.dataset.checktab === tab;
    t.classList.toggle("is-active", active);
    t.setAttribute("aria-selected", active ? "true" : "false");
  });

  renderChecklist();
}

function renderChecklist() {
  const tab = checklistState.activeTab;
  const items = CHECKLISTS[tab] || [];
  const checkedMap = checklistState.checked[tab] || {};

  checklistPanel.innerHTML = "";

  items.forEach(item => {
    const wrap = document.createElement("div");
    wrap.className = "check-item";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = `chk-${item.id}`;
    input.checked = !!checkedMap[item.id];

    input.addEventListener("change", () => {
      checkedMap[item.id] = input.checked;
      checklistState.checked[tab] = checkedMap;
      saveLS(STORAGE.checklist, checklistState);
    });

    const label = document.createElement("label");
    label.setAttribute("for", input.id);
    label.innerHTML = `
      ${escapeHtml(item.text)}
      ${item.sub ? `<span class="sub">${escapeHtml(item.sub)}</span>` : ""}
    `;

    wrap.appendChild(input);
    wrap.appendChild(label);
    checklistPanel.appendChild(wrap);
  });
}

function initChecklists() {
  checklistTabs.forEach(btn => {
    btn.addEventListener("click", () => setChecklistTab(btn.dataset.checktab));
  });

  btnChecklistReset.addEventListener("click", () => {
    const tab = checklistState.activeTab;
    checklistState.checked[tab] = {};
    saveLS(STORAGE.checklist, checklistState);
    renderChecklist();
    toast("Checklist gereset");
  });

  btnChecklistSave.addEventListener("click", () => {
    saveLS(STORAGE.checklist, checklistState);
    toast("Checklist opgeslagen");
  });

  setChecklistTab(checklistState.activeTab || "start");
}

/* =========================
   Chatbot (offline assistant)
   ========================= */
function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function scoreProtocol(p, tokens) {
  const keys = new Set([...(p.keywords || []).map(k => k.toLowerCase())]);
  const hay = [
    p.title,
    p.category,
    p.situation,
    p.goal,
    ...(p.keywords || [])
  ].join(" ").toLowerCase();

  let score = 0;

  tokens.forEach(t => {
    if (keys.has(t)) score += 4;
    if (hay.includes(t)) score += 1;

    // small synonym boosts
    if (t === "rook" && hay.includes("brand")) score += 2;
    if (t === "brand" && hay.includes("rook")) score += 2;
    if (t === "ehbo" && hay.includes("medisch")) score += 2;
    if (t === "sirene" && hay.includes("alarm")) score += 2;
    if (t === "indringer" && (hay.includes("inbraak") || hay.includes("verdacht"))) score += 2;
  });

  return score;
}

function bestMatchProtocol(userText) {
  const tokens = tokenize(userText);
  if (tokens.length === 0) return null;

  let best = null;
  let bestScore = 0;

  for (const p of PROTOCOLS) {
    const s = scoreProtocol(p, tokens);
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }

  if (bestScore < 2) return null;
  return best;
}

function addChatMessage(role, html) {
  const wrap = document.createElement("div");
  wrap.className = `chat-msg ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = html;

  wrap.appendChild(bubble);
  chatThread.appendChild(wrap);
  chatThread.scrollTop = chatThread.scrollHeight;

  return wrap;
}

function botReply(userText) {
  const p = bestMatchProtocol(userText);

  if (!p) {
    addChatMessage(
      "bot",
      `Ik snap je situatie nog niet zeker. Probeer 2–4 woorden zoals <strong>“alarm”, “rook”, “agressie”, “toegang”, “verdacht”</strong>.`
    );
    return;
  }

  const firstSteps = (p.steps || []).slice(0, 3);
  const stepsHtml = firstSteps.map(s => `<li>${escapeHtml(s)}</li>`).join("");

  const node = addChatMessage(
    "bot",
    `
      <strong>Dit past waarschijnlijk:</strong> ${escapeHtml(p.title)}<br/>
      <span class="muted small">Stap 1–3</span>
      <ol class="steps" style="margin:10px 0 8px;">${stepsHtml}</ol>
      <button class="btn primary" type="button" data-chat-open="${escapeHtml(p.id)}">Open volledig protocol</button>
    `
  );

  const btn = node.querySelector("[data-chat-open]");
  if (btn) btn.addEventListener("click", () => openProtocol(btn.getAttribute("data-chat-open")));
}

function initChat() {
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = (chatInput.value || "").trim();
    if (!text) return;

    addChatMessage("user", escapeHtml(text));
    chatInput.value = "";
    botReply(text);
  });

  quickBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const q = btn.dataset.quick || btn.textContent;
      addChatMessage("user", escapeHtml(q));
      botReply(q);
    });
  });
}

/* =========================
   Settings (NEW)
   ========================= */
function openSettings() {
  if (!settingsModal) return;
  if (typeof settingsModal.showModal === "function") settingsModal.showModal();
  else settingsModal.setAttribute("open", "open");
}
function closeSettings() {
  if (!settingsModal) return;
  if (typeof settingsModal.close === "function") settingsModal.close();
  else settingsModal.removeAttribute("open");
}

function initSettings() {
  // If button doesn't exist in HTML, we just don't init settings
  if (!btnSettings || !settingsModal) return;

  btnSettings.addEventListener("click", openSettings);
  btnCloseSettings?.addEventListener("click", closeSettings);

  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettings();
  });

  btnResetFavorites?.addEventListener("click", () => {
    favorites = new Set();
    saveLS(STORAGE.favorites, []);
    renderFavorites();
    renderProtocols();
    toast("Favorieten gereset");
  });

  btnResetUsage?.addEventListener("click", () => {
    mostUsed = {};
    saveLS(STORAGE.mostUsed, mostUsed);
    renderProtocols();
    toast("Meest gebruikt gereset");
  });

  btnResetAllData?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE.favorites);
    localStorage.removeItem(STORAGE.mostUsed);
    localStorage.removeItem(STORAGE.checklist);

    favorites = new Set();
    mostUsed = {};
    checklistState = { activeTab: "start", checked: { start: {}, ronde: {}, einde: {} } };

    renderFavorites();
    renderProtocols();
    setChecklistTab("start");

    toast("Alle data gereset");
    closeSettings();
  });
}

/* =========================
   Init
   ========================= */
async function init() {
  initNav();
  initSearch();
  initEmergencyButtons();
  initChecklists();
  initChat();
  initModal();
  initSettings(); // ✅ NEW

  PROTOCOLS = await loadProtocols();

  PROTOCOLS = PROTOCOLS.map(p => ({
    ...p,
    id: p.id || slugify(p.title || "protocol")
  }));

  renderCategoryChips();
  renderProtocols();
  renderFavorites();

  setActiveView("protocols");

  const usingFallback = PROTOCOLS.some(p => p.__fallback === true);
  if (usingFallback) toast("Demo protocollen geladen (protocols.json niet gevonden)");
}

document.addEventListener("DOMContentLoaded", init);

/* =========================
   Service Worker register (offline + install)
   ========================= */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}
