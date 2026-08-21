
const typeMeta = {
  server:   { label: "Server",      badgeBg: "var(--accent-dim)",  badgeColor: "var(--accent-text)" },
  tower:    { label: "Tower Server", badgeBg: "var(--bg-surface-3)", badgeColor: "#A67C52" },
  switch:   { label: "Network Switch",      badgeBg: "var(--info-dim)",    badgeColor: "var(--info)" },
  pdu:      { label: "Rack PDU",         badgeBg: "var(--violet-dim)",  badgeColor: "var(--violet)" },
  firewall: { label: "Firewall",    badgeBg: "var(--warning-dim)", badgeColor: "var(--warning)" },
  patch:    { label: "Patch Panel", badgeBg: "var(--bg-surface-3)",badgeColor: "var(--text-secondary)" },
};

// ---- generate layout deterministik untuk rack selain R1-A12 ----
function generateLayout(rack) {
  const rand = rackSeededRandom(rack.rackId);
  const devices = [];
  let u = rack.size || RACK_SIZE;
  const oneU = (d) => {
    if (u < 1) return;
    d.start = u; d.end = u; u--;
    devices.push(d);
  };
  if (rack.patch) oneU({ type: "patch", name: "PP-" + rack.rackId, model: "Patch Panel 24-port CAT6", serial: "PP-" + rack.rackId, ip: "—", power: "0 W", back: "24x RJ45", tags: ["patch"] });
  if (rack.firewall) oneU({ type: "firewall", name: "FW-" + rack.rackId, model: "Fortinet FortiGate 100F", serial: "FGT-" + rack.rackId, ip: "10.10.0." + (10 + (u % 100)), power: "45 W", back: "6x GbE WAN/LAN", tags: ["security"] });
  for (let i = 1; i <= rack.sw; i++) oneU({ type: "switch", name: "SW-" + rack.rackId + "-0" + i, model: "Cisco Catalyst 9300-24P", serial: "SW-" + rack.rackId + "-0" + i, ip: "10.10.0." + (30 + (u % 100)), power: "90 W", back: "24x RJ45 + 4x SFP+", tags: ["network-access"] });
  if (rack.pdu >= 1) oneU({ type: "pdu", name: "PDU-" + rack.rackId + "-A", model: "APC AP8941 Switched Rack PDU", serial: "PDU-" + rack.rackId + "-A", ip: "10.10.9." + (u % 200), power: "—", capacity: 24, draw: 2.4, phases: "1-phase, 230V", back: "Input C20 · 24 outlet", tags: ["power"] });
  let srv = 0;
  while (srv < rack.server && u >= 1) {
    const size = Math.min(u, 1 + Math.floor(rand() * 4));
    const end = u - size + 1;
    srv++;
    devices.push({ start: u, end, type: "server", name: "SRV-" + rack.rackId + "-" + String(srv).padStart(2, "0"), model: "Dell PowerEdge R750", serial: "SVC-" + rack.rackId + "-" + String(srv).padStart(2, "0"), ip: "10.10.4." + (10 + (srv % 240)), power: "440 W", back: "2x PSU · 2x 10GbE", tags: ["production"], formFactor: size + "U" });
    u = end - 1;
  }
  if (u >= 10) {
    const endT = u - 9;
    const base = { type: "tower", model: "Dell PowerEdge T550", power: "120 W", back: "1x PSU · 2x 1GbE", tags: ["production", "tower"], formFactor: "10U (Tower)" };
    devices.push({ ...base, start: u, end: endT, name: "SRV-TWR-" + rack.rackId + "-L", serial: "SVC-T550-" + rack.rackId + "-L", ip: "10.10.5." + (10 + (u % 40)), slot: "L" });
    devices.push({ ...base, start: u, end: endT, name: "SRV-TWR-" + rack.rackId + "-R", serial: "SVC-T550-" + rack.rackId + "-R", ip: "10.10.5." + (60 + (u % 40)), slot: "R" });
    u = endT - 1;
  }
  if (rack.pdu >= 2) oneU({ type: "pdu", name: "PDU-" + rack.rackId + "-B", model: "APC AP8941 Switched Rack PDU", serial: "PDU-" + rack.rackId + "-B", ip: "10.10.9." + (u % 200), power: "—", capacity: 24, draw: 1.8, phases: "1-phase, 230V", back: "Input C20 · 24 outlet", tags: ["power"] });
  return devices;
}

let devices = RACK_LAYOUTS["R1-A12"];
let unitToDevice = {};
function unitSlotKey(u, slot) {
  return u + ":" + slot;
}
function buildUnitMap() {
  unitToDevice = {};
  devices.forEach(d => {
    const from = Math.min(d.start, d.end);
    const to = Math.max(d.start, d.end);
    const slots = d.slot ? [d.slot] : ["L", "R"];
    slots.forEach(s => {
      for (let u = from; u <= to; u++) {
        const key = unitSlotKey(u, s);
        const clash = unitToDevice[key];
        if (clash && clash !== d) console.warn("Rack overlap U" + u + " [" + s + "]: " + (clash.name || clash.type) + " vs " + (d.name || d.type));
        unitToDevice[key] = d;
      }
    });
  });
}
buildUnitMap();

let currentRack = RACKS.find(r => r.rackId === "R1-A12") || RACKS[0];
const rackUnitsEl = document.getElementById("rack-units");
let currentView = "front";

// ---- tinggi tiap unit U: konsisten 25px per 1U ----
const uHeightPx = 25;
rackUnitsEl.style.setProperty("--u-h", uHeightPx + "px");

// ---- gambar perangkat (depan/belakang) ----
// Cari: 1) d.image[front|back] eksplisit  2) img/devices/<nama>-<view>.*  3) img/devices/<tipe>-<view>.*
// Ambang tinggi U: gambar baru dicoba jika baris cukup tinggi (>= 34px).
const imgCache = new Map();
const imgPending = new Map();
const DEVICE_IMG_EXT = ["png", "jpg", "jpeg", "webp"];

function deviceImageCandidates(d, view) {
  const cands = [];
  const ex = d.image && d.image[view];
  if (ex) cands.push(ex);
  const srv = (typeof SERVER_MAP !== "undefined") && (SERVER_MAP[(d.name || "").toLowerCase()] || SERVER_MAP[(d.serial || "").toLowerCase()]);
  if (srv && srv.image && srv.image[view]) cands.push(srv.image[view]);
  const nameSlug = String(d.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const typeSlug = String(d.type || "").toLowerCase();
  DEVICE_IMG_EXT.forEach(e => {
    if (nameSlug) cands.push(`data/uploads/devices/${nameSlug}-${view}.${e}`);
    if (nameSlug) cands.push(`img/devices/${nameSlug}-${view}.${e}`);
    cands.push(`img/devices/${typeSlug}-${view}.${e}`);
  });
  return [...new Set(cands)];
}

function mountDeviceImage(el, d, u) {
  if (uHeightPx < 25) return;
  const view = currentView === "front" ? "front" : "back";
  const key = (d.name || d.serial || d.type) + "|" + view;
  const base = Math.min(d.start, d.end);
  const span = Math.max(d.start, d.end) - base + 1;
  const top = -(u - base) * uHeightPx;
  const apply = src => {
    const img = document.createElement("img");
    img.className = "u-img";
    img.alt = d.name || "";
    img.loading = "lazy";
    img.style.top = top + "px";
    img.style.height = (span * uHeightPx) + "px";
    img.addEventListener("load", () => el.classList.add("u-has-img"));
    img.addEventListener("error", () => img.remove());
    el.appendChild(img);
    img.src = src;
  };
  if (imgCache.has(key)) {
    if (imgCache.get(key)) apply(imgCache.get(key));
    return;
  }
  const arr = imgPending.get(key) || [];
  arr.push({ apply });
  imgPending.set(key, arr);
  if (arr.length > 1) return;
  const cands = deviceImageCandidates(d, view);
  let i = 0;
  const probe = () => {
    if (i >= cands.length) {
      imgCache.set(key, "");
      imgPending.set(key, []);
      return;
    }
    const src = cands[i++];
    const t = new Image();
    t.onload = () => {
      imgCache.set(key, src);
      const list = imgPending.get(key) || [];
      imgPending.set(key, []);
      list.forEach(x => x.apply(src));
    };
    t.onerror = probe;
    t.src = src;
  };
  probe();
}

// ---- rack list: cascading dropdown Site/Lokasi -> Rack ----
const siteSelect = document.getElementById("site-select");
const rackSelect = document.getElementById("rack-select");

RACK_SITES.forEach(s => {
  const opt = document.createElement("option");
  opt.value = s.id;
  opt.textContent = s.name + " — " + s.loc;
  siteSelect.appendChild(opt);
});

function syncSiteOptions() {
  RACKS.forEach(r => {
    if (![...siteSelect.options].some(o => o.value === r.site)) {
      const opt = document.createElement("option");
      opt.value = r.site;
      opt.textContent = r.siteName + (r.loc && r.loc !== r.site ? " — " + r.loc : "");
      siteSelect.appendChild(opt);
    }
    const listSite = document.getElementById("list-site");
    if (listSite && ![...listSite.options].some(o => o.value === r.site)) {
      const opt = document.createElement("option");
      opt.value = r.site;
      opt.textContent = r.siteName;
      listSite.appendChild(opt);
    }
  });
}
syncSiteOptions();

function populateRackSelect(siteId) {
  const racks = siteId === "all" ? RACKS : RACKS.filter(r => r.site === siteId);
  rackSelect.innerHTML = "";
  racks.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.rackId;
    opt.textContent = "Rack " + r.rackId + " — " + r.zone;
    rackSelect.appendChild(opt);
  });
}

// ---- load rack ke diagram ----
function loadRack(rackId) {
  const rack = RACKS.find(r => r.rackId === rackId) || currentRack;
  currentRack = rack;
  const base = RACK_LAYOUTS[rack.rackId] ? RACK_LAYOUTS[rack.rackId].map(d => ({ ...d })) : generateLayout(rack);
  devices = applyServerHeightOverrides(base, rack);
  buildUnitMap();
  siteSelect.value = rack.site;
  if (![...rackSelect.options].some(o => o.value === rack.rackId)) {
    populateRackSelect(rack.site);
  }
  rackSelect.value = rack.rackId;
  document.querySelector(".rack-frame-head h3").textContent = rack.rackId;
  const troubleBtn = document.getElementById("rack-trouble-btn");
  if (troubleBtn) {
    troubleBtn.href = "incident-report.html?rack=" + encodeURIComponent(rack.rackId) + "&site=" + encodeURIComponent(rack.site || "");
    troubleBtn.title = "Buat catatan incident untuk rack " + rack.rackId;
  }
  updateRackMeta();
  refreshRackMaintenance();
  renderRackUnits();
  rebuildPduStrips(rack);
  document.getElementById("detail-panel").innerHTML = '<div class="detail-empty"><i class="fa-solid fa-arrow-pointer" style="font-size:22px;display:block;margin-bottom:10px;opacity:.5;"></i>Klik salah satu unit di rack untuk melihat detail asset.</div>';
}

function updateRackMeta() {
  const prefix = currentView === "front" ? "Tampak Depan" : "Tampak Belakang (kabel & power)";
  document.getElementById("rack-meta").textContent = currentRack.zone + " · " + currentRack.siteName + " · " + (currentRack.size || RACK_SIZE) + "U · " + currentRack.util + "% terpakai · " + prefix;
}

function rebuildPduStrips(rack) {
  const left = document.getElementById("pdu-strip-left");
  const right = document.getElementById("pdu-strip-right");
  const pdus = devices.filter(d => d.type === "pdu");
  const getPower = (key, ports) => {
    if (typeof POWER_DATA === "undefined") return { ports, rows: [] };
    if (!POWER_DATA[key]) POWER_DATA[key] = { ports, rows: [] };
    return POWER_DATA[key];
  };
  const keyL = pdus[0] ? pdus[0].name : rack.rackId + "-PDU-L";
  const keyR = pdus[1] ? pdus[1].name : rack.rackId + "-PDU-R";
  const a = getPower(keyL, pdus[0] ? (pdus[0].capacity || 16) : 16);
  left.style.display = "";
  buildPduStrip("pdu-strip-left", a.ports, a.rows.length, "PDU-L", keyL);
  const b = getPower(keyR, pdus[1] ? (pdus[1].capacity || 16) : 16);
  right.style.display = "";
  buildPduStrip("pdu-strip-right", b.ports, b.rows.length, "PDU-R", keyR);
}

function isJoin(d, u) {
  return d.type !== "blank" && u > Math.min(d.start, d.end);
}

function ledClass(d) {
  if (d.type === "pdu") return "warn";
  const s = (currentRack && currentRack.status) || "online";
  if (s === "maintenance") return "dark";
  if (s === "degraded") return "warn";
  if (s === "offline") return "crit";
  return "";
}

function ledLabel(d) {
  if (d.type === "pdu") return "Standby";
  const s = (currentRack && currentRack.status) || "online";
  if (s === "maintenance") return "Maintenance";
  if (s === "degraded") return "Degraded";
  if (s === "offline") return "Offline";
  return "Status OK";
}

function renderUnitCell(u, slot, d, spanFull) {
  const el = document.createElement("div");
  let cls = "u-body" + (spanFull ? " u-full" : " u-" + slot.toLowerCase());
  const isBlank = d.type === "blank";
  if (isBlank) {
    cls += " u-blank";
  } else {
    if (isJoin(d, u)) cls += " u-join";
    if (u === Math.min(d.start, d.end)) cls += " u-first";
    if (u === Math.max(d.start, d.end)) cls += " u-last";
    const span = Math.max(d.start, d.end) - Math.min(d.start, d.end) + 1;
    if (d.type === "server") cls += " u-ff-" + (span >= 4 ? "4u" : span + "u");
    cls += " u-" + d.type;
    const custom = deviceCustomColor(d);
    if (custom) {
      cls += " u-custom-color";
      el.style.setProperty("--dev-bg", custom.color);
      el.style.setProperty("--dev-ink", custom.ink);
    }
    mountDeviceImage(el, d, u);
    if (u === d.start) {
      const lbl = document.createElement("span");
      lbl.className = "u-lbl";
      lbl.textContent = currentView === "front" ? (d.name || "") : (d.back || "—");
      el.appendChild(lbl);
      const led = document.createElement("span");
      led.className = "u-led" + (ledClass(d) ? " " + ledClass(d) : "");
      led.title = ledLabel(d);
      el.appendChild(led);
    }
  }
  el.className = cls;
  el.dataset.unit = u;
  el.dataset.slot = slot;
  el.addEventListener("click", () => selectDevice(d));
  return el;
}

const TYPE_TINTS = { server: "#8fbfea", switch: "#85d8cf", pdu: "#b7a3e3", firewall: "#f5c78c", patch: "#a5aebd", tower: "#a8d5a5" };

function deviceTint(d) {
  const custom = deviceCustomColor(d);
  return (custom && custom.color) || TYPE_TINTS[d.type] || "#8fbfea";
}

const devBgMap = new Map();

function renderRackUnits() {
  rackUnitsEl.innerHTML = "";
  devBgMap.clear();
  const size = currentRack.size || RACK_SIZE;
  const devAtStart = new Map();
  for (const d of devices) {
    if (!d || d.type === "blank") continue;
    const start = Math.min(d.start, d.end);
    if (!devAtStart.has(start)) devAtStart.set(start, []);
    devAtStart.get(start).push(d);
  }
  for (let u = 1; u <= size; u++) {
    const left = unitToDevice[unitSlotKey(u, "L")] || { type: "blank" };
    const right = unitToDevice[unitSlotKey(u, "R")] || { type: "blank" };
    const row = document.createElement("div");
    row.className = "u-row";
    row.dataset.unit = u;
    const num = document.createElement("div");
    num.className = "u-num";
    num.textContent = u;
    if (isJoin(left, u)) num.classList.add("u-join");
    row.appendChild(num);
    if (left === right || (left.type === "blank" && right.type === "blank")) {
      row.appendChild(renderUnitCell(u, "LR", left, true));
    } else {
      row.appendChild(renderUnitCell(u, "L", left, false));
      row.appendChild(renderUnitCell(u, "R", right, false));
    }
    const starts = devAtStart.get(u);
    if (starts) {
      for (const d of starts) {
        const bg = document.createElement("div");
        bg.className = "u-dev-bg" + (d.slot === "L" ? " l" : d.slot === "R" ? " r" : " full");
        bg.style.setProperty("--u-tint", deviceTint(d));
        bg.style.setProperty("--dev-h", ((Math.max(d.start, d.end) - Math.min(d.start, d.end) + 1) * uHeightPx) + "px");
        row.appendChild(bg);
        devBgMap.set(d, bg);
      }
    }
    rackUnitsEl.appendChild(row);
  }
}

if (typeof rackUnitsEl.addEventListener === "function") {
  const clearHover = () => devBgMap.forEach(b => b.classList.remove("hover"));
  rackUnitsEl.addEventListener("mouseover", (e) => {
    const row = e.target.closest ? e.target.closest(".u-row") : null;
    if (!row || !row.dataset.unit) return;
    clearHover();
    const u = Number(row.dataset.unit);
    const tSlot = e.target && e.target.dataset && e.target.dataset.slot;
    const slots = tSlot && tSlot !== "LR" ? [tSlot] : ["L", "R"];
    const seen = new Set();
    slots.forEach(slot => {
      const d = unitToDevice[unitSlotKey(u, slot)];
      if (d && d.type !== "blank" && !seen.has(d)) {
        seen.add(d);
        const bg = devBgMap.get(d);
        if (bg) bg.classList.add("hover");
      }
    });
  });
  rackUnitsEl.addEventListener("mouseleave", clearHover);
}

document.querySelectorAll("#view-toggle button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#view-toggle button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentView = btn.dataset.view;
    updateRackMeta();
    renderRackUnits();
  });
});

// ---- vertical 0U PDU strips flanking the rack (left & right) ----
function buildPduStrip(elId, outletCount, loadedCount, label, deviceKey) {
  const el = document.getElementById(elId);
  el.style.cursor = "pointer";
  el.title = `Klik untuk lihat Power Map ${deviceKey}`;
  let html = `<div class="pdu-strip-label">${label}<i class="fa-solid fa-network-wired pdu-mgmt-ico" title="Port manajemen — buka Power Map lalu klik Port Map"></i></div>`;
  for (let i = 0; i < outletCount; i++) {
    html += `<div class="pdu-outlet${i < loadedCount ? " loaded" : ""}"></div>`;
  }
  html += `<div class="pdu-strip-foot">${loadedCount}/${outletCount}</div>`;
  el.innerHTML = html;
  el.onclick = () => openPowerMap(deviceKey);
}
const PDU_STRIP_MAP = { "PDU-A": { elId: "pdu-strip-left", label: "PDU-L" }, "PDU-B": { elId: "pdu-strip-right", label: "PDU-R" } };

// ---- Ringkasan identitas perangkat (tab Hardware) ----
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const SERVER_MAP = {};
try {
  if (typeof getServers === "function") {
    getServers().forEach(s => {
      if (s.hostname) SERVER_MAP[s.hostname.toLowerCase()] = s;
      if (s.serial) SERVER_MAP[s.serial.toLowerCase()] = s;
    });
  }
} catch (err) { /* abaikan */ }

// ---- Terapkan tinggi U dari record server (uHeight) ke perangkat layout ----
// Record server bisa punya uHeight (Tinggi Rack (U)) yang berbeda dari span
// layout statis. Bila perangkat cocok dengan record server (by name/serial),
// sesuaikan span-nya supaya tinggi di Rack Elevation (depan & belakang)
// mengikuti record server. Sisi yang jadi anchor (start asli) dipertahankan
// agar label/LED tetap di posisi yang sama.
function applyServerHeightOverrides(list, rack) {
  if (!Array.isArray(list) || !rack) return list;
  const size = rack.size || RACK_SIZE;
  return list.map(d => {
    if (!d || d.type === "blank") return d;
    const s = SERVER_MAP[(d.name || "").toLowerCase()] || SERVER_MAP[(d.serial || "").toLowerCase()];
    const h = s ? (parseInt(s.uHeight, 10) || 0) : 0;
    if (!h || h < 1 || h > size) return d;
    const lo = Math.min(d.start, d.end);
    const hi = Math.max(d.start, d.end);
    const cur = hi - lo + 1;
    if (cur === h) return d;
    const anchor = d.start;
    const anchorIsTop = anchor >= d.end;
    if (anchorIsTop) {
      return { ...d, start: anchor, end: Math.max(1, anchor - h + 1) };
    }
    return { ...d, start: anchor, end: Math.min(size, anchor + h - 1) };
  });
}

function deviceCustomColor(d) {
  if (!d || d.type === "blank") return null;
  const s = SERVER_MAP[(d.name || "").toLowerCase()] || SERVER_MAP[(d.serial || "").toLowerCase()];
  const c = d.rackColor || (s && s.rackColor);
  if (!c) return null;
  const hex = String(c).replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return { color: c, ink: "rgba(255,255,255,0.92)" };
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return { color: c, ink: lum > 0.55 ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.92)" };
}

function hwRow(k, v) {
  const val = (v ?? "").toString().trim();
  if (!val || val === "—" || val === "-") return "";
  return `<div class="hw-row"><div class="hw-k">${k}</div><div class="hw-v">${val}</div></div>`;
}

function hwSec(title, body) {
  return body.trim() ? `<div class="hw-sec"><div class="hw-sec-title">${title}</div>${body}</div>` : "";
}

function hwChips(list) {
  if (!list || !list.length) return "";
  return `<div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;">${list.map(x => `<span class="tag-chip" style="background:var(--bg-surface-3);color:var(--text-secondary);margin:0;">${esc(x)}</span>`).join("")}</div>`;
}

function buildHardwarePane(d) {
  const s = SERVER_MAP[(d.name || "").toLowerCase()] || SERVER_MAP[(d.serial || "").toLowerCase()];
  if (s) return buildServerSummaryHTML(s);
  const loU = Math.min(d.start, d.end);
  const hiU = Math.max(d.start, d.end);
  const fallback = [
    hwRow("Tipe Perangkat", typeMeta[d.type] ? typeMeta[d.type].label : d.type),
    hwRow("Model", d.model),
    hwRow("Form Factor", d.formFactor || ((Math.max(d.start, d.end) - Math.min(d.start, d.end) + 1) + "U")),
    hwRow("Serial Number", d.serial),
    hwRow("IP Address", d.ip),
    hwRow("Rack / Posisi", `${currentRack.rackId} · U${loU}${hiU !== loU ? "–U" + hiU : ""}${d.slot ? " · " + (d.slot === "L" ? "Kiri" : "Kanan") : ""}`),
    hwRow("Daya / Power", d.power),
    hwRow("Port (Tampak Belakang)", d.back),
    hwRow("Tag", hwChips(d.tags || [])),
  ].join("");
  return hwSec("Identitas Perangkat", fallback)
    + `<div class="hw-sec" style="padding-top:4px;"><div class="form-hint">Spesifikasi detail perangkat ini belum tersedia di basis data server — gunakan menu Server untuk melihat ringkasan lengkap.</div></div>`;
}

function buildHistoryPane(d) {
  return `<div class="form-hint" style="margin-bottom:14px;">Riwayat incident &amp; maintenance rack ini (dari modul Incident Report &amp; Maintenance).</div>`
    + hwRow("Perangkat terdaftar di", `${esc(d.name)} — ${esc(currentRack.rackId)}`)
    + `<div id="rack-history-fill"><div class="form-hint" style="padding:10px 0;">Memuat riwayat…</div></div>`;
}

// Isi panel Riwayat dengan record incident + maintenance sungguhan dari OPS.
async function fillRackHistory() {
  const el = document.getElementById("rack-history-fill");
  if (!el || !window.RackOps) return;
  try {
    const hist = await RackOps.rackHistory(currentRack.rackId);
    const items = [];
    (hist.incidents || []).forEach(r => {
      const sev = r.sev || r.severity || "";
      const sevTxt = { critical: "Critical", high: "High", medium: "Medium", low: "Low" }[sev] || sev || "Incident";
      items.push({
        icon: "fa-bug", cls: "inc", kind: "Incident",
        no: r.no || r.id || "—",
        title: r.title || r.description || "",
        when: r.occurred_at || r.created_at || "",
        status: r.status || "",
        link: "incident-report.html?q=" + encodeURIComponent(r.no || r.id || ""),
        tag: sevTxt,
      });
    });
    (hist.maintenance || []).forEach(r => {
      items.push({
        icon: "fa-screwdriver-wrench", cls: "maint", kind: "Maintenance",
        no: r.no || r.id || "—",
        title: r.title || "",
        when: r.scheduled_at || "",
        status: r.status || "",
        link: "maintenance.html?q=" + encodeURIComponent(r.no || r.id || ""),
        tag: "",
      });
    });
    items.sort((a, b) => String(b.when).localeCompare(String(a.when)));
    if (!items.length) {
      el.innerHTML = `<div class="form-hint" style="padding:10px 0;">Belum ada catatan incident atau maintenance untuk rack <b>${esc(currentRack.rackId)}</b>. Gunakan tombol <i>Lapor Trouble</i> untuk membuat catatan insiden, atau modul Maintenance untuk jadwal kerja.</div>`;
      return;
    }
    el.innerHTML = `<div class="rack-history-list">` + items.map(it => `
      <a class="rack-history-item ${it.cls}" href="${it.link}" title="Buka di modul ${it.kind}">
        <div class="rh-icon"><i class="fa-solid ${it.icon}"></i></div>
        <div class="rh-body">
          <div class="rh-head"><span class="mono">${it.no}</span>${it.tag ? '<span class="rh-tag">' + esc(it.tag) + '</span>' : ""}<span class="rh-when">${esc((it.when || "").slice(0, 16).replace("T", " "))}</span></div>
          <div class="rh-title">${esc(it.title)}</div>
          <div class="rh-status">${esc(it.status || "")}</div>
        </div>
      </a>`).join("") + `</div>`;
  } catch (e) {
    el.innerHTML = `<div class="form-hint" style="padding:10px 0;">Gagal memuat riwayat.</div>`;
  }
}

// Banner maintenance aktif untuk rack saat ini — diambil dari RECORD modul
// Maintenance (OPS). Menampilkan no. MT, pekerjaan, jadwal, & status.
async function refreshRackMaintenance() {
  const banner = document.getElementById("rack-maint-banner");
  if (!banner || !window.RackOps) return;
  try {
    const hist = await RackOps.rackHistory(currentRack.rackId);
    const active = (hist.maintenance || []).filter(r => ["scheduled", "in_progress"].indexOf(r.status) >= 0);
    if (!active.length) {
      banner.style.display = "none";
      banner.innerHTML = "";
      return;
    }
    const STATUS = { scheduled: "Terjadwal", in_progress: "Dikerjakan" };
    const items = active.map(r => {
      const no = r.no || r.id || "—";
      const when = r.scheduled_at || "";
      const badge = '<span class="rack-maint-badge">' + (STATUS[r.status] || r.status) + '</span>';
      return '<a class="rack-maint-item" href="maintenance.html?q=' + encodeURIComponent(no) + '" title="Buka di modul Maintenance">' +
        '<i class="fa-solid fa-screwdriver-wrench"></i>' +
        '<span class="rack-maint-no">' + esc(no) + '</span>' +
        '<span class="rack-maint-title">' + esc(r.title || "") + '</span>' +
        (when ? '<span class="rack-maint-when">' + esc(String(when).slice(0, 16).replace("T", " ")) + '</span>' : "") +
        badge +
        '</a>';
    }).join("");
    banner.style.display = "block";
    banner.innerHTML = '<span class="rack-maint-label">Maintenance aktif</span>' + items;
  } catch (e) {
    banner.style.display = "none";
  }
}

function selectDevice(d) {
  document.querySelectorAll(".u-body.selected").forEach(el => el.classList.remove("selected", "sel-start", "sel-end"));
  if (d.type === "blank") {
    document.getElementById("detail-panel").innerHTML = `<div class="detail-empty">Slot U kosong — belum ada asset terpasang.</div>`;
    return;
  }
  const cellSel = d.slot
    ? `.u-body[data-slot="${d.slot}"]`
    : `.u-body[data-slot="LR"]`;
  let lo = null, hi = null;
  Object.keys(unitToDevice).forEach(key => {
    if (unitToDevice[key] === d) {
      const u = parseInt(key.split(":")[0], 10);
      lo = lo === null ? u : Math.min(lo, u);
      hi = hi === null ? u : Math.max(hi, u);
      const el = document.querySelector(`.u-row[data-unit="${u}"] ${cellSel}`);
      if (el) el.classList.add("selected");
    }
  });
  const first = lo !== null && document.querySelector(`.u-row[data-unit="${lo}"] ${cellSel}`);
  const last = hi !== null && document.querySelector(`.u-row[data-unit="${hi}"] ${cellSel}`);
  if (first) first.classList.add("sel-start");
  if (last) last.classList.add("sel-end");
  const meta = typeMeta[d.type];
  let extra = "";
  if (d.type === "pdu") {
    const pct = Math.round((d.draw / d.capacity) * 100);
    extra = `<div class="power-meter"><div class="lbl"><span>Power Draw</span><span>${d.draw}A / ${d.capacity}A (${pct}%)</span></div><div class="power-bar"><div class="fill" style="width:${pct}%"></div></div></div>
             <div class="field-grid" style="margin-top:18px"><div class="field-item"><div class="k">Phases</div><div class="v">${d.phases}</div></div><div class="field-item"><div class="k">Outlets</div><div class="v">${(typeof POWER_DATA !== "undefined" && POWER_DATA[d.name]) ? POWER_DATA[d.name].ports : 24} total, ${(typeof POWER_DATA !== "undefined" && POWER_DATA[d.name]) ? POWER_DATA[d.name].rows.length : "—"} in use</div></div></div>`;
  }
  if (d.type === "firewall") {
    extra = `<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-top:20px;margin-bottom:8px">Security Zones</div>
             <div class="zone-list">${(d.zones || []).map(z => `<div class="zone-item"><span class="zname">${z.name}</span><span class="zone-tag ${z.tag}">${z.tag}</span></div>`).join("")}</div>`;
  }
  const showPortMap = d.type && d.type !== "blank" && typeof openPortMap === "function";
  const portmapBtn = showPortMap
    ? `<div class="portmap-btn"><button class="btn primary" onclick="openPortMap('${d.name}', false, 0, { type: '${d.type}', formFactor: '${(d.formFactor || "").replace(/'/g, "")}' })"><i class="fa-solid fa-ethernet"></i>Lihat Port Map</button></div>`
    : "";
  const powerOk = typeof POWER_DATA !== "undefined";
  const ownPdu = powerOk && POWER_DATA[d.name];
  const feedingPdus = powerOk ? Object.keys(POWER_DATA).filter(k => (POWER_DATA[k].rows || []).some(r => r.device === d.name)) : [];
  let powermapBtn = "";
  if (ownPdu) {
    powermapBtn = `<div class="portmap-btn"><button class="btn primary" onclick="openPowerMap('${d.name}')"><i class="fa-solid fa-plug"></i>Lihat Power Map</button></div>`;
  } else if (d.type === "server") {
    const srvRec = SERVER_MAP[(d.name || "").toLowerCase()] || SERVER_MAP[(d.serial || "").toLowerCase()];
    const psuCount = srvRec ? Math.min(10, Math.max(1, parseInt(srvRec.psuCount, 10) || 0)) : 0;
    powermapBtn = `<div class="portmap-btn"><button class="btn primary" onclick="openPowerMap('${d.name}', false, ${psuCount})"><i class="fa-solid fa-plug"></i>Lihat Power Map</button></div>`;
  } else if (feedingPdus.length) {
    powermapBtn = feedingPdus.map(k => `<div class="portmap-btn"><button class="btn primary" onclick="openPowerMap('${k}')"><i class="fa-solid fa-plug"></i>Lihat Power Map · ${k}</button></div>`).join("");
  }
  const tagsHtml = (d.tags && d.tags.length) ? `<div class="tag-row">${d.tags.map(t => `<span class="tag-chip" style="background:color-mix(in srgb, ${tagColor(t)} 18%, transparent);color:${tagColor(t)}"><span class="tdot"></span>${t}</span>`).join("")}</div>` : "";
  const loU = Math.min(d.start, d.end);
  const hiU = Math.max(d.start, d.end);
  document.getElementById("detail-panel").innerHTML = `
    <span class="detail-type-badge" style="background:${meta.badgeBg};color:${meta.badgeColor}">${meta.label}</span>
    <h2 class="detail-title">${d.name}</h2>
    <p class="detail-sub">${d.model}</p>
    ${tagsHtml}
    <div class="tabs"><button class="tab-btn active" data-tab="info">Info</button><button class="tab-btn" data-tab="hardware">Hardware</button><button class="tab-btn" data-tab="history">History</button></div>
    <div class="tab-pane" data-pane="info">
      <div class="field-grid">
        <div class="field-item"><div class="k">Rack</div><div class="v">${currentRack.rackId}</div></div>
        <div class="field-item"><div class="k">Position</div><div class="v">U${loU}${hiU !== loU ? "–U" + hiU : ""}${d.slot ? " · " + (d.slot === "L" ? "Kiri" : "Kanan") : ""}</div></div>
        <div class="field-item"><div class="k">Serial Number</div><div class="v">${d.serial}</div></div>
        <div class="field-item"><div class="k">IP Address</div><div class="v">${d.ip}</div></div>
        <div class="field-item"><div class="k">Power Draw</div><div class="v">${d.power}</div></div>
      </div>${extra}${portmapBtn}${powermapBtn}
    </div>
    <div class="tab-pane" data-pane="hardware" style="display:none;">${buildHardwarePane(d)}</div>
    <div class="tab-pane" data-pane="history" style="display:none;">${buildHistoryPane(d)}</div>`;
  fillRackHistory();
}

document.getElementById("detail-panel").addEventListener("click", e => {
  const tab = e.target.closest(".tab-btn");
  if (!tab) return;
  document.querySelectorAll("#detail-panel .tab-btn").forEach(b => b.classList.toggle("active", b === tab));
  document.querySelectorAll("#detail-panel .tab-pane").forEach(p => {
    p.style.display = p.dataset.pane === tab.dataset.tab ? "" : "none";
  });
});

// ---- rack list table: render + search + filter ----
function rackStatusBadge(status) {
  if (status === "online") return '<span class="badge online"><span class="bdot"></span>Online</span>';
  if (status === "maintenance") return '<span class="badge maintenance"><span class="bdot"></span>Maintenance</span>';
  return '<span class="badge error"><span class="bdot"></span>Degraded</span>';
}

function renderRackTable() {
  const q = document.getElementById("top-search").value.trim().toLowerCase();
  const site = document.getElementById("list-site").value;
  const status = document.getElementById("list-status").value;
  const rows = RACKS.filter(r => {
    const matchQ = !q || r.rackId.toLowerCase().includes(q) || r.siteName.toLowerCase().includes(q) || r.loc.toLowerCase().includes(q) || r.zone.toLowerCase().includes(q);
    const matchSite = site === "all" || r.site === site;
    const matchStatus = status === "all" || r.status === status;
    return matchQ && matchSite && matchStatus;
  });
  document.getElementById("rack-tbody").innerHTML = rows.map(r => `
    <tr data-rack="${r.rackId}" style="cursor:pointer;" title="Klik untuk lihat di diagram">
      <td><div class="strong">${r.rackId}</div></td>
      <td>${r.site}</td>
      <td>${r.loc}</td>
      <td>${r.zone} · ${r.size || RACK_SIZE}U</td>
      <td><div class="outlet-cell"><span class="outlet-nums">${r.util}%</span><div class="outlet-bar"><div class="outlet-fill ${r.util >= 90 ? "crit" : r.util >= 78 ? "warn" : ""}" style="width:${r.util}%"></div></div></div></td>
      <td><span class="mono" style="font-size:12px;">${r.totalDevices}</span> unit</td>
      <td>${rackStatusBadge(r.status)}</td>
      <td><div class="row-actions"><button title="Lihat di Diagram"><i class="fa-solid fa-arrow-pointer"></i></button></div></td>
    </tr>`).join("");
  document.getElementById("rack-count").textContent = `Menampilkan ${rows.length} dari ${RACKS.length} rack`;
}

document.getElementById("rack-tbody").addEventListener("click", e => {
  const tr = e.target.closest("tr[data-rack]");
  if (tr) loadRack(tr.dataset.rack);
});

document.getElementById("top-search").addEventListener("input", renderRackTable);
document.getElementById("list-site").addEventListener("change", renderRackTable);
document.getElementById("list-status").addEventListener("change", renderRackTable);
siteSelect.addEventListener("change", () => {
  populateRackSelect(siteSelect.value);
  loadRack(rackSelect.value);
});
rackSelect.addEventListener("change", () => loadRack(rackSelect.value));

renderRackTable();
const qs = new URLSearchParams(window.location.search);
const rackParam = qs.get("rack");
const deviceParam = qs.get("device");
loadRack(rackParam && RACKS.some(r => r.rackId === rackParam) ? rackParam : "R1-A12");
focusRackDevice(deviceParam);

function focusRackDevice(name) {
  const target = String(name || "").trim();
  if (!target) return;
  const norm = typeof canonKey === "function" ? canonKey(target) : target.toUpperCase();
  const dev = devices.find(d => d && d.name && (typeof canonKey === "function" ? canonKey(d.name) === norm : d.name.toUpperCase() === norm));
  if (!dev) {
    if (typeof showToast === "function") showToast("Perangkat " + target + " tidak ditemukan di rack " + currentRack.rackId, "warn");
    return;
  }
  const bg = devBgMap.get(dev);
  if (bg) {
    bg.classList.add("focus");
    bg.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }
  if (typeof selectDevice === "function") selectDevice(dev);
}
