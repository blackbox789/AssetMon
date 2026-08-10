
const typeMeta = {
  server:   { label: "Server",      badgeBg: "var(--accent-dim)",  badgeColor: "var(--accent-text)" },
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
  if (rack.pdu >= 2) oneU({ type: "pdu", name: "PDU-" + rack.rackId + "-B", model: "APC AP8941 Switched Rack PDU", serial: "PDU-" + rack.rackId + "-B", ip: "10.10.9." + (u % 200), power: "—", capacity: 24, draw: 1.8, phases: "1-phase, 230V", back: "Input C20 · 24 outlet", tags: ["power"] });
  return devices;
}

let devices = RACK_LAYOUTS["R1-A12"];
let unitToDevice = {};
function buildUnitMap() {
  unitToDevice = {};
  devices.forEach(d => {
    const from = Math.min(d.start, d.end);
    const to = Math.max(d.start, d.end);
    for (let u = from; u <= to; u++) unitToDevice[u] = d;
  });
}
buildUnitMap();

let currentRack = RACKS.find(r => r.rackId === "R1-A12") || RACKS[0];
const rackUnitsEl = document.getElementById("rack-units");
let currentView = "front";

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
  devices = RACK_LAYOUTS[rack.rackId] ? RACK_LAYOUTS[rack.rackId] : generateLayout(rack);
  buildUnitMap();
  siteSelect.value = rack.site;
  if (![...rackSelect.options].some(o => o.value === rack.rackId)) {
    populateRackSelect(rack.site);
  }
  rackSelect.value = rack.rackId;
  document.querySelector(".rack-frame-head h3").textContent = rack.rackId;
  updateRackMeta();
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

function renderRackUnits() {
  rackUnitsEl.innerHTML = "";
  const size = currentRack.size || RACK_SIZE;
  for (let u = 1; u <= size; u++) {
    const d = unitToDevice[u] || { type: "blank" };
    const join = Number.isFinite(d.start) && u > Math.min(d.start, d.end);
    const span = Number.isFinite(d.start) ? Math.max(d.start, d.end) - Math.min(d.start, d.end) + 1 : 1;
    const ff = span >= 4 ? "4u" : span + "u";
    const custom = deviceCustomColor(d);
    const row = document.createElement("div");
    let cls = `u-row u-${d.type}`;
    if (d.type === "server") cls += ` u-ff-${ff}`;
    if (join) cls += " u-join";
    if (custom) cls += " u-custom-color";
    row.className = cls;
    if (custom) {
      row.style.setProperty("--dev-bg", custom.color);
      row.style.setProperty("--dev-ink", custom.ink);
    }
    row.dataset.unit = u;
    let label = "";
    if (u === d.start) {
      label = currentView === "front" ? (d.name || "") : (d.back || (d.type === "blank" ? "" : "—"));
    }
    row.innerHTML = `<div class="u-num">${u}</div><div class="u-body">${label}</div>`;
    row.addEventListener("click", () => selectDevice(d));
    rackUnitsEl.appendChild(row);
  }
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

function deviceCustomColor(d) {
  if (!d || d.type === "blank") return null;
  const s = SERVER_MAP[(d.name || "").toLowerCase()] || SERVER_MAP[(d.serial || "").toLowerCase()];
  const c = s && s.rackColor;
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
    hwRow("Rack / Posisi", `${currentRack.rackId} · U${loU}${hiU !== loU ? "–U" + hiU : ""}`),
    hwRow("Daya / Power", d.power),
    hwRow("Port (Tampak Belakang)", d.back),
    hwRow("Tag", hwChips(d.tags || [])),
  ].join("");
  return hwSec("Identitas Perangkat", fallback)
    + `<div class="hw-sec" style="padding-top:4px;"><div class="form-hint">Spesifikasi detail perangkat ini belum tersedia di basis data server — gunakan menu Server untuk melihat ringkasan lengkap.</div></div>`;
}

function buildHistoryPane(d) {
  return `<div class="form-hint" style="margin-bottom:14px;">Riwayat pemeliharaan &amp; audit perangkat ini.</div>`
    + hwRow("Perangkat terdaftar di", `${esc(d.name)} — ${esc(currentRack.rackId)}`)
    + hwRow("Catatan Pemeliharaan", "Belum ada entri riwayat pemeliharaan.");
}

function selectDevice(d) {
  document.querySelectorAll(".u-row.selected").forEach(el => el.classList.remove("selected"));
  if (d.type === "blank") {
    document.getElementById("detail-panel").innerHTML = `<div class="detail-empty">Slot U kosong — belum ada asset terpasang.</div>`;
    return;
  }
  Object.keys(unitToDevice).forEach(u => {
    if (unitToDevice[u] === d) {
      const el = document.querySelector(`.u-row[data-unit="${u}"]`);
      if (el) el.classList.add("selected");
    }
  });
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
        <div class="field-item"><div class="k">Position</div><div class="v">U${loU}${hiU !== loU ? "–U" + hiU : ""}</div></div>
        <div class="field-item"><div class="k">Serial Number</div><div class="v">${d.serial}</div></div>
        <div class="field-item"><div class="k">IP Address</div><div class="v">${d.ip}</div></div>
        <div class="field-item"><div class="k">Power Draw</div><div class="v">${d.power}</div></div>
      </div>${extra}${portmapBtn}${powermapBtn}
    </div>
    <div class="tab-pane" data-pane="hardware" style="display:none;">${buildHardwarePane(d)}</div>
    <div class="tab-pane" data-pane="history" style="display:none;">${buildHistoryPane(d)}</div>`;
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
const rackParam = new URLSearchParams(window.location.search).get("rack");
loadRack(rackParam && RACKS.some(r => r.rackId === rackParam) ? rackParam : "R1-A12");
