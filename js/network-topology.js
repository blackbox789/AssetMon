/* ============================================
   RackView — Network Topology (Phase 1)
   Graf dibangun data-driven dari:
     - RACK_LAYOUTS / RACKS  (lokasi device → rack/site)
     - PORT_DATA  (koneksi data)
     - POWER_DATA (koneksi power)
   Tampilan: kotak per rack + node device + edge data/power.
   ============================================ */

const svg = document.getElementById("topo-svg");
const svgNS = "http://www.w3.org/2000/svg";
function escA(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

// ---------- node & edge builder ----------
const nodeMap = {};    // id -> node
const nodesById = {};  // alias (sama dengan nodeMap)
const edges = [];      // { a, b, kind, label, ... }
const seenEdges = new Set();

function slugKey(s) {
  return String(s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function ensureNode(name, extra) {
  const key = String(name || "").trim();
  if (!key) return null;
  const id = slugKey(key);
  if (!id) return null;
  if (!nodeMap[id]) {
    // perangkat nyata yang belum terinventori tetap dapat tipe benar (bukan "external")
    const unplacedType = TOPO_UNPLACED_TYPES[key.toUpperCase()];
    nodeMap[id] = { id, name: key, type: unplacedType || "external", unplaced: !unplacedType ? undefined : true, model: "", ip: "", rack: null, site: null, siteName: "", tags: [], posisiU: "", x: 0, y: 0 };
  }
  if (extra) {
    Object.keys(extra).forEach(k => {
      if (extra[k] !== undefined && extra[k] !== null) nodeMap[id][k] = extra[k];
    });
  }
  return nodeMap[id];
}

function addEdge(aName, bName, kind, extra) {
  const a = ensureNode(aName), b = ensureNode(bName);
  if (!a || !b || a.id === b.id) return;
  const key = [a.id, b.id].sort().join("|") + "::" + kind;
  if (seenEdges.has(key)) return;
  seenEdges.add(key);
  edges.push(Object.assign({ a: a.id, b: b.id, kind }, extra || {}));
}

// ---- Peta role per perangkat (untuk auto-layer) ----
// Prioritas: record devices dari SQLite (async) → localStorage (rv_switches/rv_accessories).
const TOPO_ROLE_MAP = {};
function topoRoleKey(name) {
  return String(name || "").trim().toUpperCase().replace(/\s+/g, " ");
}
// Node konseptual WAN (boleh tampil di semua site)
const TOPO_CONCEPTUAL = new Set(["INTERNET", "ISP UPSTREAM", "DMZ SEGMENT", "WAN"]);
// Perangkat nyata yang dirujuk kabel tapi belum diinventori — beri tipe benar agar tidak jadi "external"
const TOPO_UNPLACED_TYPES = { "SW-ACC-04": "switch", "JBOD-ENCL-01": "storage" };
function topoIsConceptual(n) {
  return Boolean(n.ref) || TOPO_CONCEPTUAL.has(String(n.name || "").toUpperCase());
}
(function loadTopoRolesFromLocal() {
  [SWITCH_STORAGE_KEY, ACC_STORAGE_KEY].forEach(sk => {
    try {
      const arr = JSON.parse(localStorage.getItem(sk) || "[]");
      (Array.isArray(arr) ? arr : []).forEach(r => {
        const k = topoRoleKey(r && (r.hostname || r.name));
        if (k && r.role) TOPO_ROLE_MAP[k] = r.role;
      });
    } catch (e) { /* abaikan */ }
  });
})();
(async function refreshTopoRolesFromDb() {
  try {
    const base = typeof API_BASE !== "undefined" ? API_BASE : "/api";
    const res = await fetch(base + "/devices");
    if (!res.ok || !res.json) return;
    const list = await res.json();
    let changed = false;
    (Array.isArray(list) ? list : []).forEach(d => {
      let data = {};
      try { data = typeof d.data === "string" ? (JSON.parse(d.data) || {}) : (d.data || {}); } catch (e) {}
      const k = topoRoleKey(d.deviceKey || d.name);
      if (k && data.role && TOPO_ROLE_MAP[k] !== data.role) {
        TOPO_ROLE_MAP[k] = data.role;
        changed = true;
      }
      // penempatan resmi dari tabel devices → node yang belum punya rak langsung terhubung
      const n = nodeMap[slugKey(k)];
      if (n) {
        const rk = d.rackId ? String(d.rackId).toUpperCase() : "";
        const st = d.site ? String(d.site).toUpperCase() : "";
        if (rk && !n.rack) { n.rack = rk; changed = true; }
        if (st && !n.site) { n.site = st; changed = true; }
      }
    });
    if (changed && typeof render === "function") render();
  } catch (_) { /* offline / no-op */ }
})();

// ---- isi node dari RACK_LAYOUTS (device yang benar-benar terpasang) ----
if (typeof RACK_LAYOUTS !== "undefined") {
  Object.entries(RACK_LAYOUTS).forEach(([rackId, devs]) => {
    const rack = Array.isArray(RACKS) && RACKS.find(r => r.rackId === rackId);
    (devs || []).forEach(d => {
      if (!d || !d.name || d.type === "blank") return;
      ensureNode(d.name, {
        type: d.type, model: d.model, ip: d.ip, rack: rackId,
        site: rack && rack.site, siteName: rack && rack.siteName,
        tags: d.tags, posisiU: d.start, power: d.power, serial: d.serial
      });
    });
  });
}

// ---- node PDU dari POWER_DATA (mungkin belum ada di RACK_LAYOUTS) ----
if (typeof POWER_DATA !== "undefined") {
  Object.keys(POWER_DATA).forEach(k => {
    const info = (typeof PDU_DATA !== "undefined" && PDU_DATA.find(p => p.name === k)) || null;
    ensureNode(k, {
      type: "pdu", model: info && info.model, ip: info && info.ip,
      rack: info && info.rack, site: info && info.site, siteName: info && (function(){ const r = Array.isArray(RACKS) && RACKS.find(x => x.rackId === info.rack); return r && r.siteName; })()
    });
  });
}

// ---- edge data dari PORT_DATA ----
if (typeof PORT_DATA !== "undefined") {
  Object.entries(PORT_DATA).forEach(([dev, data]) => {
    (data.rows || []).forEach(r => {
      if (!r || !r.dest) return;
      addEdge(dev, r.dest, "data", { label: r.label, media: r.media, vlan: r.vlan, fromPort: r.port, toPort: r.destPort });
      // ISP connection: connectedTo → ISP node
      if ((r.connType === "isp" || (r.connectedTo || "").startsWith("ISP-")) && r.connectedTo) {
        ensureNode(r.connectedTo, { type: "isp", rack: null, site: null, ip: "" });
      }
    });
  });
}

// ---- ISP + WAN edges dari detectISPEdges / detectWANEdges (port-data.js) ----
(function buildISPWanEdges() {
  if (typeof detectISPEdges !== "function") return;
  detectISPEdges().forEach(e => {
    ensureNode(e.from, { type: "isp" });
    ensureNode(e.to);
    addEdge(e.from, e.to, "isp", { label: e.label, bgp: e.bgp });
  });
  if (typeof detectWANEdges !== "function") return;
  detectWANEdges().forEach(e => {
    ensureNode(e.from);
    ensureNode(e.to);
    addEdge(e.from, e.to, "wan", { label: e.label });
  });
})();

// ---- ISP devices dari /api/devices (async) ----
(async function hydrateISPNodes() {
  if (typeof fetch !== "function") return;
  const base = typeof API_BASE !== "undefined" ? API_BASE : "/api";
  try {
    const res = await fetch(base + "/devices");
    if (!res.ok) return;
    const list = await res.json();
    if (!Array.isArray(list)) return;
    let changed = false;
    list.forEach(d => {
      const t = String(d.type || "").toLowerCase();
      if (t !== "isp") return;
      const key = canonKey(d.deviceKey || d.name || "");
      if (!key) return;
      let data = {};
      try { data = typeof d.data === "string" ? (JSON.parse(d.data) || {}) : (d.data || {}); } catch (e) {}
      const existing = nodeMap[slugKey(key)];
      if (existing) {
        if (!existing.ip && data.ip) { existing.ip = data.ip; changed = true; }
        if (!existing.model && data.model) { existing.model = data.model; changed = true; }
        existing.type = "isp";
      } else {
        ensureNode(key, { type: "isp", ip: data.ip || "", model: data.model || data.asn || "", rack: null, site: null });
        changed = true;
      }
    });
    if (changed && typeof render === "function") render();
  } catch (_) { /* offline */ }
})();

// ---- edge power dari POWER_DATA ----
if (typeof POWER_DATA !== "undefined") {
  Object.entries(POWER_DATA).forEach(([pdu, data]) => {
    (data.rows || []).forEach(r => {
      if (!r || !r.device) return;
      addEdge(pdu, r.device, "power", { label: r.label, outlet: r.outlet, psu: r.psu });
    });
  });
}

// ---------- tipe & warna ----------
const typeColor = {
  server: "var(--accent)", switch: "var(--info)", pdu: "var(--violet)",
  firewall: "var(--warning)", router: "var(--text-muted)", patch: "#a5aebd",
  ids: "#EC4899", lb: "#14B8A6", isp: "#E11D48",
  tower: "var(--accent)", storage: "var(--accent)", external: "#8a8f98"
};
const typeMeta = {
  server:   { label: "Server",        badgeBg: "var(--accent-dim)",   badgeColor: "var(--accent-text)" },
  switch:   { label: "Network Switch", badgeBg: "var(--info-dim)",     badgeColor: "var(--info)" },
  pdu:      { label: "Rack PDU",      badgeBg: "var(--violet-dim)",   badgeColor: "var(--violet)" },
  firewall: { label: "Firewall",      badgeBg: "var(--warning-dim)",  badgeColor: "var(--warning)" },
  router:   { label: "Router / WAN",  badgeBg: "var(--bg-surface-3)", badgeColor: "var(--text-secondary)" },
  ids:      { label: "IDS/IPS",       badgeBg: "rgba(236,72,153,0.14)", badgeColor: "#EC4899" },
  lb:       { label: "Load Balancer", badgeBg: "rgba(20,184,166,0.14)", badgeColor: "#14B8A6" },
  patch:    { label: "Patch Panel",   badgeBg: "var(--bg-surface-3)", badgeColor: "var(--text-secondary)" },
  tower:    { label: "Tower Server",  badgeBg: "var(--accent-dim)",   badgeColor: "var(--accent-text)" },
  storage:  { label: "Storage",       badgeBg: "var(--accent-dim)",   badgeColor: "var(--accent-text)" },
  isp:      { label: "ISP",           badgeBg: "rgba(225,29,72,0.14)", badgeColor: "#E11D48" },
  external: { label: "Eksternal",     badgeBg: "var(--bg-surface-3)", badgeColor: "var(--text-secondary)" }
};
const typeOrder = { switch: 0, router: 1, firewall: 2, server: 3, storage: 3, pdu: 4, patch: 5, tower: 6, isp: 7, external: 8 };

// ---------- model hierarki logis (core → distribution → access) ----------
const LAYER_LABELS = {
  0: "WAN / Eksternal",
  1: "Edge Router",
  2: "Edge Firewall",
  3: "IDS / IPS",
  4: "Load Balancer",
  5: "Core Switch",
  6: "Distribution Switch",
  7: "Access Switch",
  8: "Management / Services",
  9: "Server / Storage"
};
function detectAutoLayer(n) {
  const name = String(n.name || "").toUpperCase();
  const t = n.type || "";
  if (t === "isp") return 0;
  if (name.startsWith("FW-") || t === "firewall") return 2;
  if (/IDS|IPS/.test(name) || t === "ids") return 3;
  if (/^LB-|LOAD\s*BAL/.test(name) || t === "lb") return 4;
  if (/^SW[- ]/.test(name) || t === "switch") {
    // PRIORITAS 1: field role dari form/DB (Core/Distribution/Access/Management)
    const ROLE_LAYER = { core: 5, distribution: 6, access: 7, management: 8 };
    const role = TOPO_ROLE_MAP[topoRoleKey(n.name)];
    if (role && ROLE_LAYER[String(role).trim().toLowerCase()]) return ROLE_LAYER[String(role).trim().toLowerCase()];
    // PRIORITAS 2: heuristik nama hostname
    if (/CORE/.test(name)) return 5;
    if (/DIST/.test(name)) return 6;
    if (/ACC|ACCESS/.test(name)) return 7;
    if (/MGMT|BACKUP|LAB/.test(name)) return 8;
    return 7;
  }
  if (/^(JBOD|STOR|NAS|DISK)/.test(name) || t === "storage" || t === "server" || t === "tower" || t === "pdu" || t === "patch") return 9;
  if (/^(ROUTER|EDGE-ROUTER|WAN|ISP|DMZ|INTERNET)/.test(name) || t === "router" || t === "external") return 0;
  return 9;
}
const AUTO_LAYER_KEY = { 0: "wan", 1: "router", 2: "firewall", 3: "ids", 4: "lb", 5: "core", 6: "distribution", 7: "access", 8: "management" };
let topoLayers = {};   // deviceKey -> layer key (manual assignment)
function loadTopoLayers() {
  topoLayers = {};
  try { topoLayers = JSON.parse(localStorage.getItem(TOPO_LAYERS_KEY) || "{}") || {}; } catch (e) { topoLayers = {}; }
}
function saveTopoLayers() {
  try { localStorage.setItem(TOPO_LAYERS_KEY, JSON.stringify(topoLayers)); } catch (e) { /* abaikan */ }
}
function deviceLayer(n) {
  const m = topoLayers[n.id];
  if (m === "wan") return 0;
  if (m === "router") return 1;
  if (m === "firewall") return 2;
  if (m === "ids") return 3;
  if (m === "lb") return 4;
  if (m === "core") return 5;
  if (m === "distribution") return 6;
  if (m === "access") return 7;
  if (m === "management") return 8;
  return detectAutoLayer(n);
}
const LAYER_TYPE_ORDER = { router: 0, firewall: 1, switch: 2, server: 3, storage: 3, tower: 3, pdu: 4, patch: 5, isp: 6, external: 7 };

// ---------- tree topologi (mode Logis) — spine 9 layer + VLAN segmentation ----------
const TREE_CARD_W = 118, TREE_CARD_H = 64, TREE_GAP = 24, TREE_ROW_H = 118;
const VLN_PER_ROW = 4, GRP_PAD = 18, GRP_GAP = 42;
const treeRows = [];        // { label, y, nodes:[{ n, x, ref }] }
const treeVlanGroups = [];  // { label, x, y, w, h, l3:{n,x,y}, leaves:[{n,x,y}] }
const treePduLane = { nodes: [], y: 0 };
const treeConnectors = [];  // { fromX:[...], fromY, toX:[...], toY }

const REF_SPINE = [
  { label: "INTERNET / WAN", type: "external", name: "Internet", icon: "cloud" },
  { label: "ROUTER / GATEWAY", type: "router", name: "Router", icon: "router" },
  { label: "IDS / IPS", type: "ids", name: "IDS / IPS", icon: "ids" },
  { label: "LOAD BALANCER", type: "lb", name: "Load Balancer", icon: "lb" }
];
const REF_L3 = ["L3 Switch · VLAN 11", "L3 Switch · VLAN 22", "L3 Switch · VLAN 33"];
const VLAN_LANES = [
  { label: "VLAN 11", chip: "var(--info)" },
  { label: "VLAN 22", chip: "var(--accent)" },
  { label: "VLAN 33", chip: "var(--violet)" }
];

function treeRefNode(type, name) {
  return { id: "ref-" + slugKey(name), name, type, rack: null, site: null, ip: "", model: "referensi", ref: true };
}

function buildVlanMap() {
  const map = {};
  if (typeof PORT_DATA !== "undefined") {
    Object.entries(PORT_DATA).forEach(([dev, data]) => {
      (data.rows || []).forEach(r => {
        if (!r.dest || !r.vlan || !/^v(\d+)$/.test(String(r.vlan))) return;
        const id = slugKey(r.dest);
        const v = parseInt(String(r.vlan).slice(1), 10);
        const lane = v === 10 ? 0 : v === 20 ? 1 : v === 30 ? 2 : -1;
        if (lane >= 0 && map[id] === undefined) map[id] = lane;
      });
    });
  }
  return map;
}

function buildTreeLayout() {
  const vlanMap = buildVlanMap();
  const byType = { wan: [], router: [], fw: [], ids: [], lb: [], core: [], dist: [], access: [], mgmt: [], leaf: [], pdu: [] };
  Object.values(nodeMap).forEach(n => {
    // Cakupan site: node rak hanya dari site terpilih; eksternal (WAN/Internet) tetap tampil
    if (n.rack && currentSite && n.site && n.site !== currentSite) return;
    // perangkat nyata tanpa penempatan tidak dimasukkan ke tree logis (lihat kotak "Belum terpasang" di fisik)
    if (!n.rack && !topoIsConceptual(n)) return;
    const L = deviceLayer(n);
    if (n.type === "pdu") byType.pdu.push(n);
    else if (n.type === "isp") byType.wan.push(n);
    else if (L === 0) byType.wan.push(n);
    else if (L === 1) byType.router.push(n);
    else if (L === 2) byType.fw.push(n);
    else if (L === 3) byType.ids.push(n);
    else if (L === 4) byType.lb.push(n);
    else if (L === 5) byType.core.push(n);
    else if (L === 6) byType.dist.push(n);
    else if (L === 7) byType.access.push(n);
    else if (L === 8) byType.mgmt.push(n);
    else byType.leaf.push(n);
  });
  const sortN = list => list.sort((a, b) => a.name.localeCompare(b.name));
  Object.values(byType).forEach(sortN);

  // lane lists: [ {n, ref} ]; ref muncul hanya bila layer kosong
  const withRef = (list, type, name, label) => ({ label, nodes: list.length ? list.map(n => ({ n, ref: false })) : [{ n: treeRefNode(type, name), ref: true }] });
  const lanes = [
    withRef(byType.wan, "external", "Internet", REF_SPINE[0].label),
    withRef(byType.router, "router", "Router", REF_SPINE[1].label),
    withRef(byType.fw, "firewall", "Firewall", "EDGE FIREWALL"),
    withRef(byType.ids, "ids", "IDS / IPS", REF_SPINE[2].label),
    withRef(byType.lb, "lb", "Load Balancer", REF_SPINE[3].label),
    withRef(byType.core, "switch", "Core Switch", "CORE SWITCH"),
    withRef(byType.dist, "switch", "Distribution Switch", "DISTRIBUTION SWITCH"),
    withRef(byType.access, "switch", "Access Switch", "ACCESS SWITCH"),
    withRef(byType.mgmt, "switch", "Management Switch", "MANAGEMENT SWITCH")
  ];
  const LANE_KEYS = ["wan", "router", "firewall", "ids", "lb", "core", "distribution", "access", "management"];

  // width computation (need centerX)
  const laneW = l => l.nodes.length * TREE_CARD_W + Math.max(0, l.nodes.length - 1) * TREE_GAP;
  let maxW = Math.max.apply(null, lanes.map(laneW));
  // VLAN zone width
  const grpW = GRP_PAD * 2 + VLN_PER_ROW * TREE_CARD_W + (VLN_PER_ROW - 1) * TREE_GAP;
  const vlanZoneW = grpW * 3 + GRP_GAP * 2;
  const pduW = byType.pdu.length ? byType.pdu.length * TREE_CARD_W + (byType.pdu.length - 1) * TREE_GAP : 0;
  maxW = Math.max(maxW, vlanZoneW, pduW, 700);
  const centerX = maxW / 2;

  treeRows.length = 0; treeVlanGroups.length = 0; treeConnectors.length = 0;
  let y = 44;
  lanes.forEach((l, i) => {
    const w = laneW(l);
    let x = centerX - w / 2;
    const nodes = l.nodes.map(tn => { const p = { n: tn.n, x: x + TREE_CARD_W / 2, y, ref: tn.ref }; x += TREE_CARD_W + TREE_GAP; return p; });
    treeRows.push({ key: LANE_KEYS[i], label: l.label, y, nodes });
    y += TREE_ROW_H;
  });

  // VLAN zone
  const laneLeaves = [[], [], []];
  let rr = 0;
  byType.leaf.forEach(n => {
    let idx = -1;
    const m = topoLayers[n.id];
    if (m === "vlan11") idx = 0;
    else if (m === "vlan22") idx = 1;
    else if (m === "vlan33") idx = 2;
    if (idx < 0) { const vm = vlanMap[n.id]; idx = (vm === undefined || vm < 0 || vm > 2) ? -1 : vm; }
    if (idx < 0) idx = rr++ % 3;
    laneLeaves[idx].push(n);
  });
  const zoneY = y;
  const zoneH = 34 + TREE_CARD_H + 20 + Math.ceil(Math.max(1, Math.max(laneLeaves[0].length, laneLeaves[1].length, laneLeaves[2].length)) / VLN_PER_ROW) * (TREE_CARD_H + TREE_GAP) + 30;
  const zoneX0 = centerX - vlanZoneW / 2;
  for (let g = 0; g < 3; g++) {
    const gx = zoneX0 + g * (grpW + GRP_GAP);
    const leaves = laneLeaves[g].map((n, i) => {
      const col = i % VLN_PER_ROW, row = Math.floor(i / VLN_PER_ROW);
      return { n, x: gx + GRP_PAD + col * (TREE_CARD_W + TREE_GAP), y: zoneY + 74 + row * (TREE_CARD_H + TREE_GAP) };
    });
    const l3 = { n: treeRefNode("switch", REF_L3[g]), x: gx + grpW / 2, y: zoneY + 34, ref: true };
    treeVlanGroups.push({ key: ["vlan11", "vlan22", "vlan33"][g], label: VLAN_LANES[g].label, chip: VLAN_LANES[g].chip, x: gx, y: zoneY, w: grpW, h: zoneH, l3, leaves });
    // connector L3 -> leaves
    treeConnectors.push({ fromX: [l3.x], fromY: l3.y + TREE_CARD_H / 2, toX: leaves.map(p => p.x), toY: leaves.length ? leaves[0].y - TREE_CARD_H / 2 : l3.y + TREE_CARD_H / 2 + 20 });
  }
  // connector Access lane -> VLAN L3 switches
  if (treeRows.length && treeVlanGroups.length) {
    const acc = treeRows[treeRows.length - 1].nodes;
    treeConnectors.push({ fromX: acc.map(p => p.x), fromY: acc[0].y + TREE_CARD_H / 2, toX: treeVlanGroups.map(g => g.l3.x), toY: treeVlanGroups[0].l3.y - TREE_CARD_H / 2 });
  }
  y += zoneH + 24;

  // power lane
  if (byType.pdu.length) {
    treePduLane.nodes.length = 0;
    let x = centerX - pduW / 2;
    byType.pdu.forEach(n => { treePduLane.nodes.push({ n, x: x + TREE_CARD_W / 2, y }); x += TREE_CARD_W + TREE_GAP; });
    treePduLane.y = y;
    y += TREE_ROW_H;
  } else treePduLane.nodes.length = 0;

  // spine connectors (adjacent lanes)
  for (let i = 0; i < treeRows.length - 1; i++) {
    const a = treeRows[i].nodes, b = treeRows[i + 1].nodes;
    treeConnectors.push({ fromX: a.map(p => p.x), fromY: a[0].y + TREE_CARD_H / 2, toX: b.map(p => p.x), toY: b[0].y - TREE_CARD_H / 2 });
  }
  return { totalW: maxW, totalH: y + 14 };
}

// ---------- render tree (mode Logis) ----------
function shape(g, tag, attrs) {
  const el = document.createElementNS(svgNS, tag);
  Object.keys(attrs).forEach(k => el.setAttribute(k, attrs[k]));
  g.appendChild(el);
  return el;
}
function drawNodeIcon(g, type, cx, cy, color) {
  const S = { fill: "none", stroke: color, "stroke-width": 1.7, "stroke-linecap": "round", "stroke-linejoin": "round" };
  switch (type) {
    case "cloud":
    case "isp":
      shape(g, "ellipse", Object.assign({ cx: cx - 7, cy: cy, rx: 5.5, ry: 4.5, fill: color }, S));
      shape(g, "ellipse", Object.assign({ cx: cx + 7, cy: cy + 1, rx: 5.5, ry: 4.5, fill: color }, S));
      shape(g, "ellipse", Object.assign({ cx: cx, cy: cy - 1, rx: 6.5, ry: 5, fill: color }, S));
      break;
    case "router":
      shape(g, "circle", Object.assign({ cx: cx - 6, cy: cy, r: 4, fill: color }, S));
      shape(g, "circle", Object.assign({ cx: cx + 6, cy: cy - 4.5, r: 2.4, fill: color }, S));
      shape(g, "circle", Object.assign({ cx: cx + 6, cy: cy + 4.5, r: 2.4, fill: color }, S));
      shape(g, "line", Object.assign({ x1: cx - 2.5, y1: cy, x2: cx + 3, y2: cy - 4 }, S));
      shape(g, "line", Object.assign({ x1: cx - 2.5, y1: cy, x2: cx + 3, y2: cy + 4 }, S));
      break;
    case "firewall":
      shape(g, "path", Object.assign({ d: "M " + cx + " " + (cy - 9) + " L " + (cx - 8) + " " + (cy - 6) + " L " + (cx - 8) + " " + (cy + 2) + " Q " + cx + " " + (cy + 9) + " " + cx + " " + (cy + 9) + " Q " + cx + " " + (cy + 9) + " " + (cx + 8) + " " + (cy + 2) + " L " + (cx + 8) + " " + (cy - 6) + " Z" }, S));
      break;
    case "ids":
      shape(g, "path", Object.assign({ d: "M " + cx + " " + (cy - 9) + " L " + (cx - 8) + " " + (cy - 6) + " L " + (cx - 8) + " " + (cy + 2) + " Q " + cx + " " + (cy + 9) + " " + cx + " " + (cy + 9) + " Q " + cx + " " + (cy + 9) + " " + (cx + 8) + " " + (cy + 2) + " L " + (cx + 8) + " " + (cy - 6) + " Z" }, S));
      shape(g, "circle", Object.assign({ cx: cx, cy: cy - 1, r: 3 }, S));
      break;
    case "lb":
      shape(g, "line", Object.assign({ x1: cx - 9, y1: cy - 6, x2: cx + 9, y2: cy - 6 }, S));
      shape(g, "line", Object.assign({ x1: cx, y1: cy - 6, x2: cx, y2: cy - 1 }, S));
      shape(g, "line", Object.assign({ x1: cx - 6, y1: cy - 1, x2: cx - 6, y2: cy + 2 }, S));
      shape(g, "line", Object.assign({ x1: cx + 6, y1: cy - 1, x2: cx + 6, y2: cy + 2 }, S));
      shape(g, "path", Object.assign({ d: "M " + (cx - 9) + " " + (cy + 2) + " L " + (cx - 3) + " " + (cy + 2) + " L " + (cx - 4.5) + " " + (cy + 7) + " L " + (cx - 7.5) + " " + (cy + 7) + " Z" }, S));
      shape(g, "path", Object.assign({ d: "M " + (cx + 3) + " " + (cy + 2) + " L " + (cx + 9) + " " + (cy + 2) + " L " + (cx + 7.5) + " " + (cy + 7) + " L " + (cx + 4.5) + " " + (cy + 7) + " Z" }, S));
      break;
    case "switch":
      shape(g, "rect", Object.assign({ x: cx - 9, y: cy - 6, width: 18, height: 12, rx: 2.5, fill: "none" }, S));
      [[cx - 5, cy + 2], [cx, cy + 2], [cx + 5, cy + 2]].forEach(([px, py]) => shape(g, "circle", Object.assign({ cx: px, cy: py, r: 1.4, fill: color }, S)));
      break;
    case "server":
      shape(g, "rect", Object.assign({ x: cx - 8, y: cy - 7, width: 16, height: 14, rx: 2, fill: "none" }, S));
      shape(g, "line", Object.assign({ x1: cx - 8, y1: cy - 1.5, x2: cx + 8, y2: cy - 1.5 }, S));
      shape(g, "line", Object.assign({ x1: cx - 8, y1: cy + 4, x2: cx + 8, y2: cy + 4 }, S));
      shape(g, "circle", Object.assign({ cx: cx + 5, cy: cy - 5.5, r: 1.2, fill: color }, S));
      break;
    case "storage":
      shape(g, "ellipse", Object.assign({ cx: cx, cy: cy - 6, rx: 8, ry: 3, fill: "none" }, S));
      shape(g, "line", Object.assign({ x1: cx - 8, y1: cy - 6, x2: cx - 8, y2: cy + 6 }, S));
      shape(g, "line", Object.assign({ x1: cx + 8, y1: cy - 6, x2: cx + 8, y2: cy + 6 }, S));
      shape(g, "path", Object.assign({ d: "M " + (cx - 8) + " " + (cy + 6) + " A 8 3 0 0 0 " + (cx + 8) + " " + (cy + 6) }, S));
      break;
    case "pdu":
      shape(g, "rect", Object.assign({ x: cx - 4, y: cy - 7, width: 8, height: 11, rx: 1.5, fill: "none" }, S));
      shape(g, "line", Object.assign({ x1: cx - 3, y1: cy + 4, x2: cx - 3, y2: cy + 8 }, S));
      shape(g, "line", Object.assign({ x1: cx + 3, y1: cy + 4, x2: cx + 3, y2: cy + 8 }, S));
      break;
    case "tower":
      shape(g, "rect", Object.assign({ x: cx - 4, y: cy - 7, width: 8, height: 14, rx: 1.5, fill: "none" }, S));
      shape(g, "line", Object.assign({ x1: cx, y1: cy - 7, x2: cx, y2: cy - 10 }, S));
      shape(g, "circle", Object.assign({ cx: cx, cy: cy - 11, r: 1.3, fill: color }, S));
      break;
    case "patch":
      shape(g, "rect", Object.assign({ x: cx - 8, y: cy - 6, width: 16, height: 12, rx: 2, fill: "none" }, S));
      [[cx - 4, cy - 2], [cx + 4, cy - 2], [cx - 4, cy + 2], [cx + 4, cy + 2]].forEach(([px, py]) => shape(g, "circle", Object.assign({ cx: px, cy: py, r: 1.3, fill: color }, S)));
      break;
    default:
      shape(g, "circle", Object.assign({ cx: cx, cy: cy, r: 8, fill: "none" }, S));
      shape(g, "ellipse", Object.assign({ cx: cx, cy: cy, rx: 8, ry: 3.5, fill: "none" }, S));
      shape(g, "line", Object.assign({ x1: cx, y1: cy - 8, x2: cx, y2: cy + 8 }, S));
  }
}
function showRefPanel(n) {
  const panel = document.getElementById("detail-panel");
  if (!panel) return;
  panel.innerHTML = `<span class="detail-type-badge" style="background:var(--bg-surface-3);color:var(--text-secondary)">Node Referensi</span>
    <h2 class="detail-title">${n.name}</h2>
    <p class="detail-sub">Layer <b>${n.name}</b> belum memiliki perangkat nyata di data. Node ini adalah placeholder agar arsitektur tetap lengkap — perangkat akan otomatis muncul saat datanya ada.</p>`;
}
function onTreeCard(p) {
  document.querySelectorAll(".tree-card").forEach(c => c.classList.remove("selected"));
  if (p._g) p._g.classList.add("selected");
  if (p.ref) { showRefPanel(p.n); return; }
  selectNode(p.n.id);
}
function drawTreeCard(p) {
  const g = document.createElementNS(svgNS, "g");
  g.dataset.id = p.n.id;
  g.style.cursor = "pointer";
  const col = typeColor[p.n.type] || typeColor.external;
  const card = shape(g, "rect", { x: p.x - TREE_CARD_W / 2, y: p.y - TREE_CARD_H / 2, width: TREE_CARD_W, height: TREE_CARD_H, rx: 10, class: "tree-card" + (p.ref ? " ref" : "") });
  card.setAttribute("stroke", col);
  const iconG = document.createElementNS(svgNS, "g");
  g.appendChild(iconG);
  drawNodeIcon(iconG, p.n.type || "external", p.x, p.y - 13, col);
  const nm = shape(g, "text", { x: p.x, y: p.y + 7, class: "tree-name", "text-anchor": "middle" });
  nm.textContent = p.n.name.length > 14 ? p.n.name.slice(0, 13) + "…" : p.n.name;
  const sub = shape(g, "text", { x: p.x, y: p.y + 20, class: "tree-sub", "text-anchor": "middle" });
  sub.textContent = p.ref ? "referensi" : ((typeMeta[p.n.type] || {}).label || p.n.model || p.n.rack || "");
  g.addEventListener("click", () => onTreeCard(p));
  svg.appendChild(g);
  p._g = g;
  if (!p.ref) svgNodes[p.n.id] = g;
  return g;
}
function drawConnectors() {
  treeConnectors.forEach(c => {
    const fromXs = c.fromX, toXs = c.toX, fromY = c.fromY, toY = c.toY;
    if (fromXs.length === 1 && toXs.length === 1 && fromXs[0] === toXs[0]) {
      shape(svg, "line", { x1: fromXs[0], y1: fromY, x2: toXs[0], y2: toY, class: "tree-link" });
      return;
    }
    const allX = fromXs.concat(toXs);
    const minX = Math.min.apply(null, allX), maxX = Math.max.apply(null, allX);
    const barY = (fromY + toY) / 2;
    fromXs.forEach(fx => shape(svg, "line", { x1: fx, y1: fromY, x2: fx, y2: barY, class: "tree-link" }));
    shape(svg, "line", { x1: minX, y1: barY, x2: maxX, y2: barY, class: "tree-link" });
    toXs.forEach(tx => shape(svg, "line", { x1: tx, y1: barY, x2: tx, y2: toY, class: "tree-link" }));
  });
}
function drawTreeCaption(x, y, txt, extra) {
  const t = shape(svg, "text", Object.assign({ x, y, class: "tree-caption" }, extra || {}));
  t.textContent = txt;
}
function renderLogicalTree() {
  const dim = buildTreeLayout();
  treeTotalW = dim.totalW;
  svg.setAttribute("viewBox", "0 0 " + dim.totalW + " " + dim.totalH);
  svg.innerHTML = "";
  svgEdges.length = 0;
  Object.keys(svgNodes).forEach(k => delete svgNodes[k]);

  drawConnectors();

  treeRows.forEach(row => {
    if (editMode && row.key) drawRowPick(row, row.nodes.filter(p => !p.ref).length);
    else drawTreeCaption(18, row.y - TREE_CARD_H / 2 - 12, row.label);
    row.nodes.forEach(drawTreeCard);
  });

  // zona VLAN
  treeVlanGroups.forEach((grp, gi) => {
    shape(svg, "rect", { x: grp.x, y: grp.y, width: grp.w, height: grp.h, rx: 12, class: "vlan-box" });
    shape(svg, "rect", { x: grp.x, y: grp.y, width: grp.w, height: 30, rx: 12, class: "vlan-box-head" });
    const chip = shape(svg, "rect", { x: grp.x + 12, y: grp.y + 9, width: 12, height: 12, rx: 3 });
    chip.setAttribute("fill", grp.chip);
    const hd = shape(svg, "text", { x: grp.x + 30, y: grp.y + 19, class: "vlan-head-text" });
    hd.textContent = grp.label;
    const note = shape(svg, "text", { x: grp.x + grp.w - (editMode ? 34 : 12), y: grp.y + 19, class: "vlan-head-text vlan-head-note", "text-anchor": "end" });
    note.textContent = editMode ? "Layer 3 · atur" : "Layer 3";
    if (editMode) drawVlanPick(grp);
    drawTreeCard(grp.l3);
    grp.leaves.forEach(drawTreeCard);
  });
  if (treeVlanGroups.length) {
    drawTreeCaption(18, treeVlanGroups[0].y - 12, "VLAN SEGMENTATION · LAYER 3");
  }

  // lane power — hanya daftar PDU (koneksi power digambar di Power Map, bukan topologi)
  if (treePduLane.nodes.length) {
    drawTreeCaption(18, treePduLane.y - TREE_CARD_H / 2 - 12, "POWER DISTRIBUTION");
    treePduLane.nodes.forEach(drawTreeCard);
  }

  updateInfo();
}

// ---------- layout: kartu rack (semua rack site) + mini silhouette ----------
const PAD = 14, HEAD = 30, GAP = 22;
const STRIP_W = 46, CARD_MIN_H = 130;
const PHYS_CONTENT_W = 218, PHYS_ROW_H = 24;
const PHYS_TINTS = { server: "#8fbfea", switch: "#85d8cf", pdu: "#b7a3e3", firewall: "#f5c78c", patch: "#a5aebd", tower: "#a8d5a5", storage: "#f97316", ups: "#eab308" };
const rackBoxes = [];
const unplacedNodes = [];
let activeTracePath = null;

// titik sambung trunk di tepi kartu yang menghadap target
function cardAnchor(box, tx, ty) {
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const dx = tx - cx, dy = ty - cy;
  if (Math.abs(dx) > Math.abs(dy)) return { x: dx > 0 ? box.x + box.w : box.x, y: cy };
  return { x: cx, y: dy > 0 ? box.y + box.h : box.y };
}

// Kelompok layer utk urutan blok di kartu fisik (selaras spine logis)
function physGroupOf(n) {
  const t = n.type;
  if (t === "router") return { o: 0, label: "ROUTER / WAN" };
  if (t === "firewall") return { o: 1, label: "FIREWALL" };
  if (t === "ids") return { o: 2, label: "IDS / IPS" };
  if (t === "lb") return { o: 3, label: "LOAD BALANCER" };
  if (t === "switch") {
    const L = deviceLayer(n);
    if (L === 5) return { o: 4, label: "CORE SWITCH" };
    if (L === 6) return { o: 5, label: "DISTRIBUTION SWITCH" };
    if (L === 8) return { o: 7, label: "MANAGEMENT SWITCH" };
    return { o: 6, label: "ACCESS SWITCH" };
  }
  if (t === "server" || t === "tower" || t === "storage") return { o: 8, label: "SERVER / STORAGE" };
  if (t === "patch") return { o: 9, label: "PATCH PANEL" };
  if (t === "pdu" || t === "ups") return { o: 10, label: "POWER" };
  if (/JBOD|NAS/.test(String(n.name || "").toUpperCase())) return { o: 8, label: "SERVER / STORAGE" };
  return { o: 11, label: "LAINNYA" };
}
function physCardRows(list) {
  const arr = list.map(n => ({ n, g: physGroupOf(n) }))
    .sort((a, b) => a.g.o - b.g.o || a.n.name.localeCompare(b.n.name));
  const rows = [];
  let last = null;
  arr.forEach(({ n, g }) => {
    if (g.label !== last) { rows.push({ cap: g.label }); last = g.label; }
    rows.push({ dev: n });
  });
  return rows;
}

// Semua rack dari SQLite (fallback: konstanta RACKS) — supaya rak kosong ikut tampil
let ALL_RACKS = Array.isArray(RACKS) ? RACKS.slice() : [];
(async function refreshAllRacksFromDb() {
  try {
    const base = typeof API_BASE !== "undefined" ? API_BASE : "/api";
    const res = await fetch(base + "/racks");
    if (!res.ok || !res.json) return;
    const j = await res.json();
    if (Array.isArray(j) && j.length) { ALL_RACKS = j; render(); }
  } catch (e) { /* offline */ }
})();

function layoutNodes() {
  const rackGroups = {};
  const externalNodes = [];
  unplacedNodes.length = 0;
  Object.values(nodeMap).forEach(n => {
    if (n.rack) {
      if (currentSite && n.site && n.site !== currentSite) return; // cakupan site
      (rackGroups[n.rack] = rackGroups[n.rack] || []).push(n);
    } else if (topoIsConceptual(n) || n.type === "isp") externalNodes.push(n);
    else unplacedNodes.push(n); // perangkat nyata tanpa penempatan
  });
  Object.values(rackGroups).forEach(list => {
    list.sort((a, b) => (typeOrder[a.type] !== undefined ? typeOrder[a.type] : 8) - (typeOrder[b.type] !== undefined ? typeOrder[b.type] : 8) || a.name.localeCompare(b.name));
  });
  externalNodes.sort((a, b) => a.name.localeCompare(b.name));

  // band eksternal di atas
  let ex = 90;
  externalNodes.forEach(n => { n.x = ex; n.y = 26; ex += 150; });
  const extH = externalNodes.length ? 70 : 0;

  const rackIds = Object.keys(rackGroups).sort();
  const boxW = PAD * 2 + STRIP_W + 6 + PHYS_CONTENT_W;

  // Sumber rak = tabel racks (semua rack site, termasuk yang kosong)
  const srcRacks = ALL_RACKS.length ? ALL_RACKS : [];
  let cards = srcRacks
    .filter(r => !currentSite || currentSite === "__all__" || String(r.site || "").toUpperCase() === String(currentSite).toUpperCase())
    .map(r => ({ id: String(r.rackId).toUpperCase(), zone: r.zone || "", size: Number(r.size) || 42, totalDevices: Number(r.totalDevices) || 0, devices: rackGroups[String(r.rackId).toUpperCase()] || [] }));
  // rak yang ada device-nya tapi belum terdaftar di tabel racks tetap digambar
  rackIds.forEach(rid => { if (!cards.find(c => c.id === rid)) cards.push({ id: rid, zone: "", size: 42, totalDevices: 0, devices: rackGroups[rid] }); });
  cards.sort((a, b) => a.id.localeCompare(b.id));

  let cursorX = 0, cursorY = extH + 26, rowHeight = 0;
  rackBoxes.length = 0;
  const PHYS_COLS = 3;
  cards.forEach((card, i) => {
    const col = i % PHYS_COLS;
    if (col === 0 && i > 0) { cursorY += rowHeight + GAP; cursorX = 0; rowHeight = 0; }
    const list = card.devices;
    const rows = list.length ? physCardRows(list) : [];
    const h = Math.max(CARD_MIN_H, HEAD + PAD * 2 + rows.length * PHYS_ROW_H + (rows.length ? 6 : 0));
    const box = { rackId: card.id, x: cursorX, y: cursorY, w: boxW, h, nodes: list };
    box.zone = card.zone;
    box.size = card.size;
    box.usedTotal = Math.max(list.length, card.totalDevices || 0);
    box.empty = box.usedTotal === 0;
    box.rows = rows;
    // posisi node (kolom tunggal berurutan per kelompok) — dipakai edge/trace
    let ry = cursorY + HEAD + PAD;
    rows.forEach(r => {
      r.y = ry;
      if (r.dev) {
        r.dev.x = cursorX + PAD + STRIP_W + 6 + PHYS_CONTENT_W / 2;
        r.dev.y = ry + PHYS_ROW_H / 2 + 2;
      }
      ry += PHYS_ROW_H;
    });
    rackBoxes.push(box);
    const rack = Array.isArray(RACKS) && RACKS.find(r => r.rackId === card.id);
    box.siteName = rack && rack.siteName;
    box.site = rack && rack.site;
    rowHeight = Math.max(rowHeight, h);
    cursorX += boxW + GAP;
  });

  let totalW = Math.max(400, rackBoxes.length ? Math.min(3, rackBoxes.length) * boxW + (Math.min(3, rackBoxes.length) - 1) * GAP : externalNodes.length * 150);
  let totalH = Math.max(200, rackBoxes.length ? cursorY + rowHeight : extH + 60);

  // saat filter rack spesifik: pindahkan box terpilih ke pojok kiri atas
  if (currentRack !== "all") {
    const box = rackBoxes.find(b => b.rackId === currentRack);
    if (box) {
      const targetY = extH + 26;
      const dx = -box.x, dy = targetY - box.y;
      box.x += dx; box.y += dy;
      box.nodes.forEach(n => { n.x += dx; n.y += dy; });
      totalW = Math.max(400, box.w);
      totalH = Math.max(200, targetY + box.h + 20);
    }
  }
  return { totalW, totalH };
}

// ---------- render ----------
const svgNodes = {};   // id -> <g>
const svgEdges = [];   // { el, a, b, kind }
let currentRack = "all";
let currentSite = "";        // site.id — cakupan utama kedua mode
let currentLayout = "logical"; // logical | physical

function topoSiteList() {
  const out = [];
  if (Array.isArray(RACKS)) {
    RACKS.forEach(r => {
      if (r.site && !out.find(s => s.id === r.site)) out.push({ id: r.site, name: r.siteName || r.site });
    });
  }
  return out;
}
function populateScopeSelects() {
  const siteSel = document.getElementById("filter-site");
  if (!siteSel) return;
  const sites = topoSiteList();
  // opsi khusus: gambaran global antar-site (hanya bermakna di mode Logis)
  siteSel.innerHTML = '<option value="__all__">🌐 Semua Site (WAN)</option>'
    + sites.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
  if (!currentSite) currentSite = sites.length ? sites[0].id : "";
  if (currentSite !== "__all__" && !sites.find(s => s.id === currentSite)) currentSite = sites.length ? sites[0].id : "";
  siteSel.value = currentSite;
  fillRackOptions();
  // sinkron ke picker Atur Layer
  topoScope.site = currentSite === "__all__" ? "" : currentSite;
}
function fillRackOptions() {
  const rackSel = document.getElementById("filter-rack");
  if (!rackSel) return;
  if (currentSite === "__all__") {
    rackSel.innerHTML = '<option value="all">Semua Rack</option>';
    rackSel.disabled = true;
    topoScope.rack = "";
    return;
  }
  const racks = (Array.isArray(RACKS) ? RACKS : []).filter(r => r.site === currentSite).map(r => r.rackId).sort();
  rackSel.innerHTML = `<option value="all">Semua Rack (${racks.length})</option>` + racks.map(r => `<option value="${r}">${r}</option>`).join("");
  if (currentRack !== "all" && !racks.includes(currentRack)) currentRack = "all";
  rackSel.value = currentRack;
  rackSel.disabled = currentLayout === "logical";
  // picker Atur Layer mengikuti scope ini; "Semua Rack" = seluruh site
  topoScope.rack = currentRack === "all" ? "" : currentRack;
}
function updateModeVisibility() {
  const isLogical = currentLayout === "logical";
  const layersBtn = document.getElementById("topo-layers-btn");
  if (layersBtn) layersBtn.style.display = isLogical ? "" : "none";
  const rackSel = document.getElementById("filter-rack");
  if (rackSel) {
    rackSel.disabled = isLogical;
    rackSel.title = isLogical ? "Topologi logis berlaku per site (lintas rak)" : "Fokus ke satu rak atau semua";
  }
  const scopeLabel = document.getElementById("editbar-scope-label");
  if (scopeLabel) scopeLabel.textContent = (topoScope.rack ? "rack " + topoScope.rack : "site " + (topoScope.site || "-"));
}

function render() {
  if (currentLayout === "logical") {
    if (currentSite === "__all__") { renderGlobalView(); return; }
    renderLogicalTree();
    updateLegend();
    return;
  }
  const dim = layoutNodes();
  svg.setAttribute("viewBox", "0 0 " + dim.totalW + " " + dim.totalH);
  svg.innerHTML = "";

  // Fisik: gambar hanya node yang relevan dengan cakupan — mencegah node
  // lintas site digambar dengan koordinat basi di pojok kiri atas.
  const visible = n => {
    if (!n.rack) return topoIsConceptual(n) || n.type === "isp"; // referensi WAN + ISP; unplaced pakai kotak khusus
    if (currentRack !== "all" && n.rack !== currentRack) return false;
    if (!currentSite || currentSite === "__all__") return true;
    return String(n.site || "").toUpperCase() === String(currentSite).toUpperCase();
  };

  // edges fisik: bundle trunk antar rak + garis langsung ke eksternal + ISP/WAN edges
  svgEdges.length = 0;
  const bundles = new Map();
  edges.forEach(e => {
    if (e.kind === "isp" || e.kind === "wan") return; // digambar terpisah di bawah
    if (e.kind !== "data") return;
    const na = nodeMap[e.a], nb = nodeMap[e.b];
    if (!na || !nb || !visible(na) || !visible(nb)) return;
    if (na.rack && nb.rack && na.rack !== nb.rack) {
      // antar rak → dikumpulkan jadi satu trunk per pasangan rak
      const key = [na.rack, nb.rack].sort().join("⇔");
      let b = bundles.get(key);
      if (!b) { const [ra, rb] = key.split("⇔"); b = { ra, rb, items: [] }; bundles.set(key, b); }
      b.items.push({ label: e.label || "", from: na.name, to: nb.name });
      return;
    }
    // koneksi dalam rak tidak digambar di overview (lihat Rack Elevation);
    // edge ke node eksternal (tanpa rak) tetap digambar langsung
    if (!na.rack || !nb.rack) {
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", na.x); line.setAttribute("y1", na.y);
      line.setAttribute("x2", nb.x); line.setAttribute("y2", nb.y);
      line.setAttribute("class", "edge edge-data");
      svg.appendChild(line);
      svgEdges.push({ el: line, a: e.a, b: e.b, kind: e.kind });
    }
  });
  // ISP & WAN edges: garis putus-putus dari router ke ISP cloud / antar site
  edges.forEach(e => {
    if (e.kind !== "isp" && e.kind !== "wan") return;
    const na = nodeMap[e.a], nb = nodeMap[e.b];
    if (!na || !nb || !visible(na) || !visible(nb)) return;
    const isISP = e.kind === "isp";
    const cls = isISP ? "edge edge-isp" : "edge edge-wan";
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", na.x); line.setAttribute("y1", na.y);
    line.setAttribute("x2", nb.x); line.setAttribute("y2", nb.y);
    line.setAttribute("class", cls);
    if (isISP) line.setAttribute("stroke-dasharray", "6 3");
    else line.setAttribute("stroke-dasharray", "8 4");
    const tip = document.createElementNS(svgNS, "title");
    tip.textContent = (isISP ? "ISP Peering" : "WAN Link") + ": " + (e.label || e.a + " → " + e.b);
    line.appendChild(tip);
    svg.appendChild(line);
    svgEdges.push({ el: line, a: e.a, b: e.b, kind: e.kind });
  });
  // kartu rack (hanya mode fisik) — SEMUA rack site, termasuk kosong
  if (currentLayout === "physical") {
    rackBoxes.forEach(box => {
      if (currentRack !== "all" && box.rackId !== currentRack) return;
      const g = document.createElementNS(svgNS, "g");
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", box.x); rect.setAttribute("y", box.y);
      rect.setAttribute("width", box.w); rect.setAttribute("height", box.h);
      rect.setAttribute("rx", "12");
      rect.setAttribute("class", box.empty ? "rack-box rack-box-empty" : "rack-box");
      rect.dataset.rack = box.rackId;
      g.appendChild(rect);
      const title = document.createElementNS(svgNS, "text");
      title.setAttribute("x", box.x + PAD); title.setAttribute("y", box.y + 20);
      title.setAttribute("class", "rack-box-title");
      title.textContent = box.rackId + (box.zone ? " · " + box.zone : "");
      g.appendChild(title);
      // jumlah device di kanan atas
      const cnt = document.createElementNS(svgNS, "text");
      cnt.setAttribute("x", box.x + box.w - PAD); cnt.setAttribute("y", box.y + 20);
      cnt.setAttribute("text-anchor", "end"); cnt.setAttribute("class", "phys-count");
      cnt.textContent = (box.usedTotal) + " device";
      g.appendChild(cnt);

      if (box.empty) {
        const hint = document.createElementNS(svgNS, "text");
        hint.setAttribute("x", box.x + box.w / 2); hint.setAttribute("y", box.y + box.h / 2 - 4);
        hint.setAttribute("text-anchor", "middle"); hint.setAttribute("class", "phys-empty-title");
        hint.textContent = "Rak kosong";
        const hint2 = document.createElementNS(svgNS, "text");
        hint2.setAttribute("x", box.x + box.w / 2); hint2.setAttribute("y", box.y + box.h / 2 + 14);
        hint2.setAttribute("text-anchor", "middle"); hint2.setAttribute("class", "phys-hint");
        hint2.textContent = "klik dua kali untuk tempatkan perangkat";
        g.appendChild(hint); g.appendChild(hint2);
      } else {
        // mini rack silhouette (posisi U akurat dari RACK_LAYOUTS bila ada)
        const fx = box.x + PAD, fy = box.y + HEAD + 6;
        const fh = box.h - HEAD - 6 - PAD * 2;
        shape(g, "rect", { x: fx, y: fy, width: STRIP_W - 10, height: fh, rx: 4, class: "phys-frame" });
        const layout = (typeof RACK_LAYOUTS !== "undefined") ? RACK_LAYOUTS[box.rackId] : null;
        const hUnit = fh / (box.size || 42);
        if (layout && layout.length) {
          layout.forEach(d => {
            if (!d || d.type === "blank" || !d.start) return;
            const st = Math.min(d.start, d.end || d.start), en = Math.max(d.start, d.end || d.start);
            shape(g, "rect", {
              x: fx + 2, y: fy + (st - 1) * hUnit,
              width: STRIP_W - 14, height: Math.max(2, (en - st + 1) * hUnit - 1),
              rx: 1.5, fill: PHYS_TINTS[d.type] || "#8a8f98",
            });
          });
        } else {
          // fallback generik: device terdaftar (berwarna) + sisa snapshot totalDevices (netral)
          box.nodes.forEach((n, i) => {
            shape(g, "rect", {
              x: fx + 2, y: fy + fh - (i + 1) * hUnit,
              width: STRIP_W - 14, height: Math.max(2, hUnit - 1),
              rx: 1.5, fill: PHYS_TINTS[n.type] || "#8a8f98",
            });
          });
          const extra = Math.max(0, Math.min(box.size || 42, box.usedTotal) - box.nodes.length);
          for (let i = box.nodes.length; i < box.nodes.length + extra; i++) {
            shape(g, "rect", {
              x: fx + 2, y: fy + fh - (i + 1) * hUnit,
              width: STRIP_W - 14, height: Math.max(2, hUnit - 1),
              rx: 1.5, fill: "#8a8f98",
            });
          }
        }
        // bar utilisasi sederhana: device / size U
        const pct = Math.min(100, Math.round(box.usedTotal / (box.size || 42) * 100));
        shape(g, "rect", { x: fx, y: fy + fh + 5, width: STRIP_W - 10, height: 5, rx: 2.5, class: "phys-util-bg" });
        shape(g, "rect", { x: fx, y: fy + fh + 5, width: (STRIP_W - 10) * pct / 100, height: 5, rx: 2.5, fill: pct >= 80 ? "var(--danger)" : pct >= 50 ? "var(--warning)" : "var(--accent)" });

        // blok perangkat per kelompok layer (ala Rack Elevation)
        const bx0 = box.x + PAD + STRIP_W + 6;
        box.rows.forEach(row => {
          if (row.cap) {
            const cap = document.createElementNS(svgNS, "text");
            cap.setAttribute("x", bx0); cap.setAttribute("y", row.y + 8);
            cap.setAttribute("class", "phys-cap");
            cap.textContent = row.cap;
            g.appendChild(cap);
            return;
          }
          const n = row.dev;
          const gd = document.createElementNS(svgNS, "g");
          gd.setAttribute("class", "phys-dev");
          gd.dataset.id = n.id;
          gd.style.cursor = "pointer";
          shape(gd, "rect", { x: bx0, y: row.y + 3, width: PHYS_CONTENT_W, height: PHYS_ROW_H - 6, rx: 4, fill: PHYS_TINTS[n.type] || "#8a8f98" });
          const nm = document.createElementNS(svgNS, "text");
          nm.setAttribute("x", bx0 + 8); nm.setAttribute("y", row.y + 16);
          nm.setAttribute("class", "phys-dev-name");
          const dispName = n.name.length > 22 ? n.name.slice(0, 21) + "…" : n.name;
          nm.textContent = dispName;
          gd.appendChild(nm);
          const meta = document.createElementNS(svgNS, "text");
          meta.setAttribute("x", bx0 + PHYS_CONTENT_W - 8); meta.setAttribute("y", row.y + 16);
          meta.setAttribute("text-anchor", "end"); meta.setAttribute("class", "phys-dev-meta");
          const posTxt = n.posisiU ? "U" + n.posisiU : "";
          meta.textContent = [posTxt, n.ip].filter(Boolean).join(" · ");
          gd.appendChild(meta);
          const tip = document.createElementNS(svgNS, "title");
          tip.textContent = (n.model ? n.model + "\n" : "") + (n.ip || "");
          gd.appendChild(tip);
          gd.addEventListener("click", () => selectNode(n.id));
          g.appendChild(gd);
          svgNodes[n.id] = gd;
        });
      }

      g.addEventListener("dblclick", () => {
        window.location.href = "rack-elevation.html?rack=" + encodeURIComponent(box.rackId);
      });
      g.style.cursor = "pointer";
      svg.appendChild(g);
    });

    // ---- Trunk antar rak: satu jalur per pasangan rak, tebal = jumlah link ----
    bundles.forEach(b => {
      const ba = rackBoxes.find(x => x.rackId === b.ra);
      const bb = rackBoxes.find(x => x.rackId === b.rb);
      if (!ba || !bb) return;
      const a1 = cardAnchor(ba, bb.x + bb.w / 2, bb.y + bb.h / 2);
      const a2 = cardAnchor(bb, ba.x + ba.w / 2, ba.y + ba.h / 2);
      const midY = (a1.y + a2.y) / 2;
      const d = "M " + a1.x + " " + a1.y + " C " + a1.x + " " + midY + ", " + a2.x + " " + midY + ", " + a2.x + " " + a2.y;
      const count = b.items.length;
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", d);
      path.setAttribute("class", "trunk" + (activeTracePath ? " dim" : ""));
      path.setAttribute("stroke-width", Math.min(7, 2 + count * 0.55).toFixed(1));
      const tip = document.createElementNS(svgNS, "title");
      tip.textContent = "Trunk " + b.ra + " ⇄ " + b.rb + " (" + count + " link)\n"
        + b.items.map(i => (i.label ? i.label + ": " : "") + i.from + " → " + i.to).join("\n");
      path.appendChild(tip);
      svg.appendChild(path);

      // label jumlah link di titik tengah kurva
      const lx = (a1.x + a2.x) / 2, ly = midY;
      shape(svg, "rect", { x: lx - 16, y: ly - 9, width: 32, height: 16, rx: 8, class: "trunk-label-bg" });
      const lt = document.createElementNS(svgNS, "text");
      lt.setAttribute("x", lx); lt.setAttribute("y", ly + 3); lt.setAttribute("text-anchor", "middle");
      lt.setAttribute("class", "trunk-label"); lt.textContent = count + "×";
      svg.appendChild(lt);
    });

    // saat trace aktif: gambarkan hop antar rak sebagai garis terang individual
    if (activeTracePath && activeTracePath.length > 1) {
      for (let i = 0; i < activeTracePath.length - 1; i++) {
        const na = nodeMap[activeTracePath[i]], nb = nodeMap[activeTracePath[i + 1]];
        if (!na || !nb || !na.rack || !nb.rack || na.rack === nb.rack) continue;
        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", na.x); line.setAttribute("y1", na.y);
        line.setAttribute("x2", nb.x); line.setAttribute("y2", nb.y);
        line.setAttribute("class", "edge traced");
        line.setAttribute("stroke-width", "2.4");
        svg.appendChild(line);
      }
    }
  }

  // ISP cloud icons di band eksternal (fisik mode) — digambar sebagai node bundle
  if (currentLayout === "physical") {
    const isps = Object.values(nodeMap).filter(n => n.type === "isp" && n.x > 0 && n.y > 0);
    isps.forEach(n => {
      const g = document.createElementNS(svgNS, "g");
      g.dataset.id = n.id;
      g.style.cursor = "pointer";
      const col = typeColor.isp;
      drawNodeIcon(g, "isp", n.x, n.y, col);
      // label
      const nm = shape(g, "text", { x: n.x, y: n.y + 22, class: "phys-dev-name", "text-anchor": "middle" });
      nm.textContent = n.name.length > 18 ? n.name.slice(0, 17) + "…" : n.name;
      const sub = shape(g, "text", { x: n.x, y: n.y + 34, class: "phys-dev-meta", "text-anchor": "middle" });
      sub.textContent = n.model || n.ip || "ISP";
      const tip = document.createElementNS(svgNS, "title");
      tip.textContent = (n.model || "ISP Provider") + (n.ip ? "\n" + n.ip : "");
      g.appendChild(tip);
      g.addEventListener("click", () => selectNode(n.id));
      svg.appendChild(g);
      svgNodes[n.id] = g;
    });
  }

  // node — hanya mode Logis & Global (Fisik memakai blok per kelompok di kartu)
  if (currentLayout !== "physical") {
  Object.values(nodeMap).forEach(n => {
    if (!visible(n)) return;
    const g = document.createElementNS(svgNS, "g");
    g.dataset.id = n.id;
    g.style.cursor = "pointer";
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", n.x); circle.setAttribute("cy", n.y);
    circle.setAttribute("r", n.type === "router" || n.type === "external" ? 15 : 16);
    circle.setAttribute("fill", typeColor[n.type] || typeColor.external);
    circle.setAttribute("class", "node-circle");
    g.appendChild(circle);
    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", n.x); label.setAttribute("y", n.y + 30);
    label.setAttribute("class", "node-label");
    label.textContent = n.name.length > 16 ? n.name.slice(0, 15) + "…" : n.name;
    g.appendChild(label);
    const sub = document.createElementNS(svgNS, "text");
    sub.setAttribute("x", n.x); sub.setAttribute("y", n.y + 42);
    sub.setAttribute("class", "node-sub");
    sub.textContent = n.model || n.rack || "";
    g.appendChild(sub);
    g.addEventListener("click", () => selectNode(n.id));
    svg.appendChild(g);
    svgNodes[n.id] = g;
  });
  }

  // Kotak "Belum terpasang": perangkat nyata tanpa penempatan (bukan band eksternal)
  if (unplacedNodes.length) {
    const bw = 230, bh = 46 + unplacedNodes.length * 16;
    const bx = 12, by = svgViewBoxH() - bh - 12;
    const gu = document.createElementNS(svgNS, "g");
    shape(gu, "rect", { x: bx, y: by, width: bw, height: bh, rx: 10, class: "unplaced-box" });
    const t = document.createElementNS(svgNS, "text");
    t.setAttribute("x", bx + 12); t.setAttribute("y", by + 20);
    t.setAttribute("class", "phys-empty-title");
    t.textContent = "⚠ " + unplacedNodes.length + " perangkat belum terpasang";
    gu.appendChild(t);
    unplacedNodes.forEach((n, i) => {
      const ln = document.createElementNS(svgNS, "text");
      ln.setAttribute("x", bx + 12); ln.setAttribute("y", by + 38 + i * 16);
      ln.setAttribute("class", "phys-hint");
      ln.textContent = "• " + n.name + " (" + (TYPE_LABELS_TOPO[n.type] || n.type) + ")";
      gu.appendChild(ln);
    });
    gu.addEventListener("dblclick", () => {
      window.location.href = "asset-list.html";
    });
    svg.appendChild(gu);
  }

  // info bar
  updateInfo();
  updateLegend();
  updateISPSummary();
}

const TYPE_LABELS_TOPO = { server: "Server", switch: "Switch", pdu: "PDU", firewall: "Firewall", router: "Router", storage: "Storage", ups: "UPS", patch: "Patch Panel", isp: "ISP" };
function svgViewBoxH() {
  const vb = (svg.getAttribute("viewBox") || "0 0 0 400").split(/\s+/);
  return parseFloat(vb[3]) || 400;
}

// ---------- Legend dinamis per mode ----------
function legendItemsHTML(items) {
  return items.map(it => {
    if (it.line) {
      const dash = it.dashed ? ';border-top:2px dashed ' + it.color : '';
      return `<div class="legend-item"><span class="legend-swatch" style="background:${it.color};height:2px;width:16px;border-radius:0;${dash}"></span>${it.label}</div>`;
    }
    const border = it.outline ? ';border:1px dashed ' + (it.color || 'var(--text-muted)') : '';
    return `<div class="legend-item"><span class="legend-swatch" style="background:${it.fill}${border}"></span>${it.label}</div>`;
  }).join("");
}
function updateLegend() {
  const el = document.querySelector(".page-toolbar .legend");
  if (!el) return;
  let items;
  if (currentLayout === "logical" && currentSite === "__all__") {
    items = [
      { color: "var(--text-muted)", label: "Cloud WAN / Internet" },
      { color: "#E11D48", label: "ISP Provider" },
      { fill: "var(--accent-dim)", color: "var(--accent)", label: "Kartu Site (klik untuk buka)" },
      { color: "#E11D48", line: true, dashed: true, label: "ISP Peering" },
      { color: "var(--violet)", line: true, label: "Uplink site ke WAN" },
    ];
  } else if (currentLayout === "logical") {
    items = [
      { color: "var(--accent)", label: "Server / Storage" },
      { color: "var(--info)", label: "Switch" },
      { color: "#EC4899", label: "IDS/IPS" },
      { color: "#14B8A6", label: "Load Balancer" },
      { color: "var(--violet)", label: "Rack PDU / Power lane" },
      { color: "var(--warning)", label: "Firewall" },
      { color: "var(--text-muted)", label: "Router / Eksternal" },
      { color: "#E11D48", label: "ISP" },
      { outline: true, label: "Node referensi (belum ada di data)" },
    ];
  } else {
    items = [
      { color: "var(--accent)", label: "Server / Storage" },
      { color: "var(--info)", label: "Network Switch" },
      { color: "var(--violet)", label: "Rack PDU" },
      { color: "var(--warning)", label: "Firewall" },
      { color: "var(--text-muted)", label: "Router / Eksternal" },
      { color: "#E11D48", label: "ISP" },
      { color: "var(--accent)", line: true, label: "Link Data (antar perangkat)" },
      { color: "#E11D48", line: true, dashed: true, label: "ISP Peering" },
      { color: "var(--violet)", line: true, label: "WAN Link (antar site)" },
      { color: "var(--accent)", line: true, label: "Trunk antar rak (tebal = banyak link)" },
      { outline: true, label: "Rak kosong" },
    ];
  }
  el.innerHTML = legendItemsHTML(items);
}

// ---------- Global view (semua site → cloud WAN) ----------
const GLOBAL_CARD_W = 280, GLOBAL_CARD_H = 168, GLOBAL_GAP = 44;

function renderGlobalView() {
  const sites = topoSiteList();
  const isps = Object.values(nodeMap).filter(n => n.type === "isp");
  const stats = sites.map(s => {
    const devs = Object.values(nodeMap).filter(n => n.site === s.id && n.rack);
    const racks = [...new Set(devs.map(n => n.rack))];
    let sw = 0, srv = 0, pdu = 0, fw = 0, rt = 0;
    const layers = { core: 0, dist: 0, access: 0, mgmt: 0 };
    devs.forEach(n => {
      const L = deviceLayer(n);
      if (n.type === "switch") {
        sw++;
        if (L === 5) layers.core++; else if (L === 6) layers.dist++;
        else if (L === 7) layers.access++; else if (L === 8) layers.mgmt++;
      }
      else if (n.type === "pdu") pdu++;
      else if (n.type === "firewall") fw++;
      else if (n.type === "router") rt++;
      else srv++;
    });
    return { id: s.id, name: s.name, devCount: devs.length, rackCount: racks.length, sw, srv, fw, rt, pdu, layers };
  });

  const margin = 70;
  const totalW = Math.max(720, margin * 2 + stats.length * GLOBAL_CARD_W + Math.max(0, stats.length - 1) * GLOBAL_GAP);
  const totalH = isps.length ? 440 : 380;
  svg.setAttribute("viewBox", `0 0 ${totalW} ${totalH}`);
  svg.innerHTML = "";
  svgNodesClear();
  const cx = totalW / 2, cy = 84, rx = 130, ry = 42;

  // cloud WAN
  const gCloud = document.createElementNS(svgNS, "g");
  shape(gCloud, "ellipse", { cx, cy, rx, ry, class: "g-wan-cloud" });
  const t1 = document.createElementNS(svgNS, "text");
  t1.setAttribute("x", cx); t1.setAttribute("y", cy - 4); t1.setAttribute("text-anchor", "middle");
  t1.setAttribute("class", "g-wan-title"); t1.textContent = "INTERNET / WAN";
  const t2 = document.createElementNS(svgNS, "text");
  t2.setAttribute("x", cx); t2.setAttribute("y", cy + 14); t2.setAttribute("text-anchor", "middle");
  t2.setAttribute("class", "g-wan-sub"); t2.textContent = stats.length + " site terhubung";
  gCloud.appendChild(t1); gCloud.appendChild(t2);
  svg.appendChild(gCloud);

  // ISP clouds — positioned between Internet cloud and site cards
  const startY = 210;
  const ispY = 150;
  if (isps.length) {
    const ispGap = Math.min(140, (totalW - margin * 2) / isps.length);
    const ispStartX = cx - ((isps.length - 1) * ispGap) / 2;
    isps.forEach((n, i) => {
      const ix = ispStartX + i * ispGap;
      // edge from Internet cloud to ISP
      const lnCI = document.createElementNS(svgNS, "line");
      lnCI.setAttribute("x1", cx); lnCI.setAttribute("y1", cy + ry);
      lnCI.setAttribute("x2", ix); lnCI.setAttribute("y2", ispY - 14);
      lnCI.setAttribute("class", "edge edge-isp");
      lnCI.setAttribute("stroke-dasharray", "6 3");
      svg.appendChild(lnCI);

      const gISP = document.createElementNS(svgNS, "g");
      gISP.style.cursor = "pointer";
      gISP.dataset.id = n.id;
      drawNodeIcon(gISP, "isp", ix, ispY, typeColor.isp);
      const nm = shape(gISP, "text", { x: ix, y: ispY + 22, class: "tree-name", "text-anchor": "middle" });
      nm.textContent = n.name.length > 20 ? n.name.slice(0, 19) + "…" : n.name;
      const sub = shape(gISP, "text", { x: ix, y: ispY + 35, class: "tree-sub", "text-anchor": "middle" });
      sub.textContent = n.model || n.ip || "ISP";
      gISP.addEventListener("click", () => selectNode(n.id));
      svg.appendChild(gISP);
      svgNodes[n.id] = gISP;

      // edge from ISP to each site card
      stats.forEach((s, si) => {
        const w = GLOBAL_CARD_W;
        const x = margin + si * (w + GLOBAL_GAP) + Math.max(0, (totalW - margin * 2 - stats.length * w - (stats.length - 1) * GLOBAL_GAP) / 2);
        const ccx = x + w / 2;
        const ln = document.createElementNS(svgNS, "line");
        ln.setAttribute("x1", ix); ln.setAttribute("y1", ispY + 14);
        ln.setAttribute("x2", ccx); ln.setAttribute("y2", startY);
        ln.setAttribute("class", "edge edge-isp");
        ln.setAttribute("stroke-dasharray", "5 3");
        ln.setAttribute("stroke-width", "1.5");
        const tip = document.createElementNS(svgNS, "title");
        tip.textContent = n.name + " → " + s.name;
        ln.appendChild(tip);
        svg.appendChild(ln);
      });
    });
  }

  // WAN edges between sites (dashed, colored violet)
  const wanEdges = edges.filter(e => e.kind === "wan");
  if (wanEdges.length) {
    wanEdges.forEach(e => {
      const na = nodeMap[e.a], nb = nodeMap[e.b];
      if (!na || !nb) return;
      // find which sites these devices belong to
      const siteA = na.site, siteB = nb.site;
      if (!siteA || !siteB || siteA === siteB) return;
      const siA = stats.findIndex(s => s.id === siteA);
      const siB = stats.findIndex(s => s.id === siteB);
      if (siA < 0 || siB < 0) return;
      const w = GLOBAL_CARD_W;
      const xA = margin + siA * (w + GLOBAL_GAP) + Math.max(0, (totalW - margin * 2 - stats.length * w - (stats.length - 1) * GLOBAL_GAP) / 2);
      const xB = margin + siB * (w + GLOBAL_GAP) + Math.max(0, (totalW - margin * 2 - stats.length * w - (stats.length - 1) * GLOBAL_GAP) / 2);
      const ln = document.createElementNS(svgNS, "line");
      ln.setAttribute("x1", xA + w / 2); ln.setAttribute("y1", startY + GLOBAL_CARD_H);
      ln.setAttribute("x2", xB + w / 2); ln.setAttribute("y2", startY + GLOBAL_CARD_H);
      ln.setAttribute("class", "edge edge-wan");
      ln.setAttribute("stroke-dasharray", "8 4");
      ln.setAttribute("stroke-width", "2");
      const tip = document.createElementNS(svgNS, "title");
      tip.textContent = "WAN: " + (e.label || e.a + " → " + e.b);
      ln.appendChild(tip);
      svg.appendChild(ln);
    });
  }

  // kartu site
  stats.forEach((s, i) => {
    const w = GLOBAL_CARD_W, h = GLOBAL_CARD_H;
    const x = margin + i * (w + GLOBAL_GAP) + Math.max(0, (totalW - margin * 2 - stats.length * w - (stats.length - 1) * GLOBAL_GAP) / 2);
    const y = startY;
    const ccx = x + w / 2;
    // uplink line dari cloud ke kartu
    const ln = document.createElementNS(svgNS, "line");
    ln.setAttribute("x1", cx); ln.setAttribute("y1", cy + ry);
    ln.setAttribute("x2", ccx); ln.setAttribute("y2", y);
    ln.setAttribute("class", "edge edge-data g-uplink");
    svg.appendChild(ln);

    const g = document.createElementNS(svgNS, "g");
    g.setAttribute("class", "g-site-card");
    g.style.cursor = "pointer";
    g.dataset.site = s.id;
    shape(g, "rect", { x, y, width: w, height: h, rx: 12, class: "g-card-bg" });
    shape(g, "rect", { x, y, width: w, height: 30, rx: 12, class: "g-card-head" });
    shape(g, "rect", { x, y: y + 18, width: w, height: 12, class: "g-card-head" });
    const tt = document.createElementNS(svgNS, "text");
    tt.setAttribute("x", x + 14); tt.setAttribute("y", y + 20); tt.setAttribute("class", "g-card-title");
    tt.textContent = s.name;
    g.appendChild(tt);

    const lines = [
      ["Rack", s.rackCount], ["Device", s.devCount],
      ["Core / Dist / Acc / Mgmt", `${s.layers.core} / ${s.layers.dist} / ${s.layers.access} / ${s.layers.mgmt}`],
      ["Firewall · Router · PDU", `${s.fw} · ${s.rt} · ${s.pdu}`],
      ["Server / Storage / lainnya", s.srv],
    ];
    lines.forEach(([k, v], idx) => {
      const yy = y + 52 + idx * 22;
      const kEl = document.createElementNS(svgNS, "text");
      kEl.setAttribute("x", x + 14); kEl.setAttribute("y", yy); kEl.setAttribute("class", "g-k");
      kEl.textContent = k;
      const vEl = document.createElementNS(svgNS, "text");
      vEl.setAttribute("x", x + w - 14); vEl.setAttribute("y", yy); vEl.setAttribute("text-anchor", "end"); vEl.setAttribute("class", "g-v");
      vEl.textContent = String(v);
      g.appendChild(kEl); g.appendChild(vEl);
    });
    const hint = document.createElementNS(svgNS, "text");
    hint.setAttribute("x", x + w / 2); hint.setAttribute("y", y + h - 10); hint.setAttribute("text-anchor", "middle");
    hint.setAttribute("class", "g-hint"); hint.textContent = "klik untuk buka topologi site";
    g.appendChild(hint);

    g.addEventListener("click", () => {
      currentSite = s.id;
      currentRack = "all";
      topoScope.site = s.id;
      topoScope.rack = "";
      populateScopeSelects();
      render();
    });
    svg.appendChild(g);
  });
  updateInfo();
}

function svgNodesClear() {
  Object.keys(svgNodes).forEach(k => delete svgNodes[k]);
  svgEdges.length = 0;
}

function setLayout(layout) {
  currentLayout = layout;
  document.querySelectorAll("#layout-buttons .layout-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.layout === layout));
  // view Global hanya ada di Logis
  if (currentLayout !== "logical" && currentSite === "__all__") {
    const sites = topoSiteList();
    currentSite = sites.length ? sites[0].id : "";
  }
  updateModeVisibility();
  render();
}

function updateInfo() {
  const info = document.getElementById("topo-info");
  if (!info) return;
  const totalNodes = Object.keys(nodeMap).length;
  const rackCount = new Set(Object.values(nodeMap).map(n => n.rack).filter(Boolean)).size;
  const dataEdges = edges.filter(e => e.kind === "data").length;
  const powerEdges = edges.filter(e => e.kind === "power").length;
  const ispEdges = edges.filter(e => e.kind === "isp").length;
  const wanEdges = edges.filter(e => e.kind === "wan").length;
  const parts = [totalNodes + " device", rackCount + " rack", dataEdges + " link data", powerEdges + " link power"];
  if (ispEdges) parts.push(ispEdges + " ISP peering");
  if (wanEdges) parts.push(wanEdges + " WAN link");
  info.textContent = parts.join(" · ");
}
// ISP summary panel (kiri bawah topology, muncul bila ada ISP)
function updateISPSummary() {
  const old = document.getElementById("isp-summary-panel");
  if (old) old.remove();
  const isps = Object.values(nodeMap).filter(n => n.type === "isp");
  if (!isps.length) return;
  const viewport = document.querySelector(".topo-viewport");
  if (!viewport) return;
  const ispPeering = edges.filter(e => e.kind === "isp").length;
  const wanCount = edges.filter(e => e.kind === "wan").length;
  const ispNames = isps.map(n => n.name).join(", ");
  // ISP → site connectivity
  const siteMap = {};
  isps.forEach(isp => {
    const conns = edges.filter(e => (e.a === isp.id || e.b === isp.id) && e.kind === "isp");
    const sites = new Set();
    conns.forEach(e => {
      const other = nodeMap[e.a === isp.id ? e.b : e.a];
      if (other && other.site) sites.add(other.siteName || other.site);
      // also check connected router's site
      if (other && !other.site) {
        const routerConns = edges.filter(e2 => (e2.a === other.id || e2.b === other.id) && e2.kind === "data");
        routerConns.forEach(e2 => {
          const rn = nodeMap[e2.a === other.id ? e2.b : e2.a];
          if (rn && rn.site) sites.add(rn.siteName || rn.site);
        });
      }
    });
    siteMap[isp.name] = [...sites];
  });
  const siteLines = Object.entries(siteMap).filter(([,s]) => s.length).map(([name, sites]) =>
    `<span style="font-size:11px;color:var(--text-secondary);">☁ ${escA(name)} → ${sites.join(", ")}</span>`
  ).join("");
  const div = document.createElement("div");
  div.id = "isp-summary-panel";
  div.className = "isp-summary-panel";
  div.innerHTML = `<div style="font-size:11px;font-weight:600;color:#E11D48;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;"><i class="fa-solid fa-cloud"></i> ISP Summary</div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;">
      <div><span style="font-size:20px;font-weight:700;color:var(--text-primary);">${isps.length}</span><span style="font-size:11px;color:var(--text-muted);display:block;">ISP</span></div>
      <div><span style="font-size:20px;font-weight:700;color:var(--text-primary);">${ispPeering}</span><span style="font-size:11px;color:var(--text-muted);display:block;">Peering</span></div>
      <div><span style="font-size:20px;font-weight:700;color:var(--text-primary);">${wanCount}</span><span style="font-size:11px;color:var(--text-muted);display:block;">WAN Link</span></div>
    </div>
    ${siteLines ? '<div style="margin-top:6px;display:flex;flex-direction:column;gap:2px;">' + siteLines + '</div>' : ""}
    <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">${escA(ispNames)}</div>`;
  viewport.parentElement.appendChild(div);
}

// ---------- detail node ----------
function selectNode(id) {
  document.querySelectorAll(".node-circle").forEach(c => c.classList.remove("selected"));
  const g = svgNodes[id];
  if (g) {
    const c = g.querySelector(".node-circle");
    if (c) c.classList.add("selected");
  }
  const n = nodeMap[id];
  if (!n) return;
  const meta = typeMeta[n.type] || typeMeta.external;
  const conns = edges
    .filter(e => e.a === id || e.b === id)
    .map(e => ({ n: nodeMap[e.a === id ? e.b : e.a], kind: e.kind, e }));
  const panel = document.getElementById("detail-panel");

  const rackLink = n.rack
    ? `<div class="portmap-btn"><a class="srv-map-action" href="rack-elevation.html?rack=${encodeURIComponent(n.rack)}&device=${encodeURIComponent(n.name)}"><i class="fa-solid fa-location-dot"></i> Lokasi di Rack Elevation</a></div>`
    : "";
  const hasPorts = typeof PORT_DATA !== "undefined" && PORT_DATA[n.name];
  const portmapBtn = hasPorts ? `<div class="portmap-btn"><button class="btn primary" onclick="openPortMap('${n.name.replace(/'/g, "")}')"><i class="fa-solid fa-ethernet"></i>Lihat Port Map</button></div>` : "";
  const hasPower = typeof POWER_DATA !== "undefined" && POWER_DATA[n.name];
  const ownPdu = hasPower;
  const feedingPdu = hasPower && typeof POWER_DATA !== "undefined"
    ? Object.keys(POWER_DATA).filter(k => (POWER_DATA[k].rows || []).some(r => r.device === n.name)) : [];
  let powermapBtn = "";
  if (ownPdu) {
    powermapBtn = `<div class="portmap-btn"><button class="btn primary" onclick="openPowerMap('${n.name.replace(/'/g, "")}')"><i class="fa-solid fa-plug"></i>Lihat Power Map</button></div>`;
  } else if (feedingPdu.length) {
    powermapBtn = feedingPdu.slice(0, 3).map(k => `<div class="portmap-btn"><button class="btn primary" onclick="openPowerMap('${k.replace(/'/g, "")}')"><i class="fa-solid fa-plug"></i>Power Map · ${k}</button></div>`).join("");
  }
  const tagsHtml = (n.tags && n.tags.length) ? `<div class="tag-row">${n.tags.map(t => `<span class="tag-chip" style="background:color-mix(in srgb, ${tagColor(t)} 18%, transparent);color:${tagColor(t)}"><span class="tdot"></span>${t}</span>`).join("")}</div>` : "";
  const connHtml = conns.length
    ? `<div class="section-label">Terhubung ke (${conns.length})</div><div class="conn-list">${conns.map(({ n: c, kind }) => {
        const icon = kind === "power" ? "⚡" : kind === "isp" ? "☁" : kind === "wan" ? "🌍" : "⇄";
        const color = kind === "power" ? "var(--violet)" : kind === "isp" ? "#E11D48" : kind === "wan" ? "var(--violet)" : "var(--text-muted)";
        return `<div class="conn-item"><span class="dot" style="background:${typeColor[c.type] || typeColor.external}"></span>${c.name}<span class="mono" style="margin-left:auto;font-size:10px;color:${color};">${icon}</span></div>`;
      }).join("")}</div>`
    : `<div class="section-label">Tidak ada koneksi tercatat</div>`;

  // ISP-specific detail fields (fetched from DB)
  const ispDetailHtml = n.type === "isp" ? (function() {
    let data = {};
    try {
      const accs = JSON.parse(localStorage.getItem(ACC_STORAGE_KEY) || "[]");
      data = (Array.isArray(accs) ? accs : []).find(a => canonKey(a.name) === n.id && a.type === "isp") || {};
    } catch (e) {}
    const fields = [
      ["ASN", data.asn], ["Bandwidth", data.bandwidth], ["IP Ranges", data.ipRanges],
      ["Public IP", data.publicIp], ["Peering", data.peeringLocation],
      ["Contract", data.contract], ["SLA", data.sla],
      ["BGP Local ASN", data.bgpLocal], ["Routing", data.routing],
      ["NOC Phone", data.nocPhone], ["NOC Email", data.nocEmail],
    ].filter(([k, v]) => v);
    if (!fields.length) return "";
    return `<div class="section-label" style="margin-top:14px;"><i class="fa-solid fa-cloud" style="color:#E11D48;"></i> Detail ISP</div>
      <div class="field-grid">${fields.map(([k, v]) =>
        `<div class="field-item"><div class="k">${k}</div><div class="v" style="font-size:12px;">${escA(v)}</div></div>`
      ).join("")}</div>
      <div style="margin-top:8px;"><a href="isp-list.html?q=${encodeURIComponent(n.name)}" style="font-size:11.5px;color:var(--accent);"><i class="fa-solid fa-arrow-up-right-from-square"></i> Buka di ISP Management</a></div>`;
  })() : "";

  // WAN link info for ISP-connected nodes
  const wanHtml = (function() {
    const ispEdges = conns.filter(c => c.kind === "isp");
    if (!ispEdges.length) return "";
    return `<div class="section-label" style="margin-top:10px;"><i class="fa-solid fa-globe" style="color:#E11D48;"></i> ISP Peering</div>
      <div class="conn-list">${ispEdges.map(({ n: c, e }) => {
        const bgp = e.bgp || {};
        const bgpInfo = bgp.localAsn ? `BGP AS${bgp.localAsn}↔AS${bgp.remoteAsn || "?"}` : "";
        return `<div class="conn-item" style="flex-direction:column;align-items:flex-start;gap:2px;">
          <span style="display:flex;align-items:center;gap:6px;"><span class="dot" style="background:#E11D48;"></span><b>${escA(c.name)}</b><span class="mono" style="font-size:10px;color:var(--text-muted);">${escA(e.label || "")}</span></span>
          ${bgpInfo ? `<span class="mono" style="font-size:10.5px;color:var(--text-secondary);margin-left:16px;">${escA(bgpInfo)}</span>` : ""}
        </div>`;
      }).join("")}</div>`;
  })();

  panel.innerHTML = `<span class="detail-type-badge" style="background:${meta.badgeBg};color:${meta.badgeColor}">${meta.label}</span>
    <h2 class="detail-title">${n.name}</h2><p class="detail-sub">${n.model || (n.rack ? "Rack " + n.rack : (n.type === "isp" ? "Internet Service Provider" : "Eksternal"))}</p>
    ${tagsHtml}
    <div class="field-grid">
      ${n.type === "isp" ? "" : `<div class="field-item"><div class="k">Rack</div><div class="v">${n.rack || "—"}</div></div>
      <div class="field-item"><div class="k">Posisi</div><div class="v">${n.posisiU ? "U" + n.posisiU : "—"}</div></div>`}
      ${n.ip ? `<div class="field-item"><div class="k">IP Address</div><div class="v">${n.ip}</div></div>` : ""}
      ${n.siteName ? `<div class="field-item"><div class="k">Site</div><div class="v">${n.siteName}</div></div>` : ""}
    </div>
    ${ispDetailHtml}${connHtml}${wanHtml}${portmapBtn}${powermapBtn}${rackLink}`;
}

// ---------- path trace (BFS pada edge data) ----------
function buildAdjacency() {
  const adj = {};
  edges.forEach(e => {
    if (e.kind !== "data") return;
    (adj[e.a] = adj[e.a] || []).push(e.b);
    (adj[e.b] = adj[e.b] || []).push(e.a);
  });
  return adj;
}
function findPath(fromId, toId) {
  const adj = buildAdjacency();
  const queue = [[fromId]], visited = new Set([fromId]);
  while (queue.length) {
    const path = queue.shift(), last = path[path.length - 1];
    if (last === toId) return path;
    (adj[last] || []).forEach(next => {
      if (!visited.has(next)) { visited.add(next); queue.push([...path, next]); }
    });
  }
  return null;
}

function highlightTrace(path) {
  document.querySelectorAll(".edge").forEach(e => e.classList.remove("traced"));
  document.querySelectorAll(".node-circle").forEach(c => c.classList.remove("selected"));
  if (!path) return;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    svgEdges.forEach(({ el, a: ea, b: eb, kind }) => {
      if (kind === "data" && ((ea === a && eb === b) || (ea === b && eb === a))) el.classList.add("traced");
    });
  }
}

const traceFromSel = document.getElementById("trace-from");
const traceToSel = document.getElementById("trace-to");
function populateTrace() {
  const externalIds = Object.values(nodeMap).filter(n => n.type === "router" || n.type === "external" || n.type === "firewall").sort((a, b) => a.name.localeCompare(b.name));
  const serverIds = Object.values(nodeMap).filter(n => n.type === "server" || n.type === "storage" || n.type === "tower").sort((a, b) => a.name.localeCompare(b.name));
  traceFromSel.innerHTML = externalIds.map(n => `<option value="${n.id}">Dari: ${n.name}</option>`).join("") || '<option value="">Dari: (tidak ada node eksternal)</option>';
  traceToSel.innerHTML = serverIds.map(n => `<option value="${n.id}">Ke: ${n.name}</option>`).join("") || '<option value="">Ke: (tidak ada server)</option>';
}

document.getElementById("trace-btn").addEventListener("click", () => {
  const from = traceFromSel.value, to = traceToSel.value;
  if (!from || !to) return;
  const path = findPath(from, to);
  activeTracePath = path || null;
  highlightTrace(path);
  if (currentLayout === "physical") render();
  const panel = document.getElementById("detail-panel");
  if (!path) {
    panel.innerHTML = `<span class="detail-type-badge" style="background:var(--danger-dim);color:var(--danger)">Path Trace</span>
      <h2 class="detail-title">Tidak ada jalur</h2>
      <p class="detail-sub">${nodeMap[from] ? nodeMap[from].name : from} → ${nodeMap[to] ? nodeMap[to].name : to} tidak terhubung lewat edge data.</p>`;
    return;
  }
  panel.innerHTML = `<span class="detail-type-badge" style="background:var(--accent-dim);color:var(--accent-text)">Path Trace</span>
    <h2 class="detail-title" style="font-size:14px">${path.map(p => nodeMap[p].name).join(" → ")}</h2>
    <p class="detail-sub">${path.length - 1} hop · melewati ${path.filter(p => (nodeMap[p].type === "firewall")).length} firewall</p>
    <div class="section-label">Urutan Hop</div><div class="conn-list">${path.map(p => {
      const n = nodeMap[p];
      return `<div class="conn-item"><span class="dot" style="background:${typeColor[n.type] || typeColor.external}"></span>${n.name}${n.rack ? ' <span class="mono" style="font-size:10px;color:var(--text-muted);margin-left:auto;">' + n.rack + "</span>" : ""}</div>`;
    }).join("")}</div>`;
});
document.getElementById("clear-trace-btn").addEventListener("click", () => {
  activeTracePath = null;
  highlightTrace(null);
  if (currentLayout === "physical") render();
  document.getElementById("detail-panel").innerHTML = `<div class="detail-empty">Klik salah satu node pada topologi untuk melihat detail koneksi.</div>`;
});

// ---------- filter: scope site/rack + mode ----------
function wireFilters() {
  document.querySelectorAll("#layout-buttons .layout-btn").forEach(btn => {
    btn.addEventListener("click", () => setLayout(btn.dataset.layout));
  });
  const siteSel = document.getElementById("filter-site");
  if (siteSel) siteSel.addEventListener("change", () => {
    currentSite = siteSel.value;
    topoScope.site = currentSite === "__all__" ? "" : currentSite;
    topoScope.rack = "";
    fillRackOptions();
    // Global/WAN hanya di mode Logis — auto pindah bila perlu
    if (currentSite === "__all__") setLayout("logical");
    else { updateModeVisibility(); render(); }
  });
  const rackSel = document.getElementById("filter-rack");
  if (rackSel) rackSel.addEventListener("change", () => {
    currentRack = rackSel.value;
    topoScope.rack = currentRack === "all" ? "" : currentRack;
    updateModeVisibility();
    render();
  });
}

// ---------- zoom & pan ----------
let scale = 1, tx = 0, ty = 0, dragging = false, dragStart = null;
function applyTransform() {
  svg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  svg.style.transformOrigin = "0 0";
}
const viewport = svg.parentElement;
if (viewport) {
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const ns = Math.min(3, Math.max(0.4, scale * (e.deltaY < 0 ? 1.12 : 0.89)));
    const k = ns / scale;
    tx = mx - (mx - tx) * k;
    ty = my - (my - ty) * k;
    scale = ns;
    applyTransform();
  }, { passive: false });
  viewport.addEventListener("mousedown", (e) => {
    if (e.target === svg || e.target.classList.contains("rack-box") || e.target.classList.contains("edge")) {
      dragging = true; dragStart = { x: e.clientX, y: e.clientY, tx, ty };
    }
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    tx = dragStart.tx + (e.clientX - dragStart.x);
    ty = dragStart.ty + (e.clientY - dragStart.y);
    applyTransform();
  });
  window.addEventListener("mouseup", () => { dragging = false; });
}
document.getElementById("zoom-in-btn").addEventListener("click", () => {
  scale = Math.min(3, scale * 1.25); applyTransform();
});
document.getElementById("zoom-out-btn").addEventListener("click", () => {
  scale = Math.max(0.4, scale / 1.25); applyTransform();
});
document.getElementById("zoom-reset-btn").addEventListener("click", () => {
  scale = 1; tx = 0; ty = 0; applyTransform();
});

// ---------- search ----------
const searchInput = document.querySelector(".search input");
if (searchInput) {
  searchInput.addEventListener("input", () => {
    const q = (searchInput.value || "").trim().toLowerCase();
    if (!q) return;
    const hit = Object.values(nodeMap).find(n => n.name.toLowerCase().includes(q) || (n.ip && n.ip.toLowerCase().includes(q)));
    if (hit) {
      selectNode(hit.id);
      currentRack = "all";
      renderFilterUI();
      render();
      const g = svgNodes[hit.id];
      if (g) {
        const c = g.querySelector(".node-circle");
        if (c) c.classList.add("selected");
      }
    }
  });
}

// ---------- manager layer (assign manual perangkat ke layer) ----------
const TOPO_LAYERS = {
  wan:         { label: "WAN / Eksternal",     icon: "fa-cloud" },
  router:      { label: "Router / Gateway",    icon: "fa-signal" },
  firewall:    { label: "Firewall",            icon: "fa-shield-halved" },
  ids:         { label: "IDS / IPS",           icon: "fa-eye" },
  lb:          { label: "Load Balancer",       icon: "fa-scale-balanced" },
  core:        { label: "Core Switch",         icon: "fa-network-wired" },
  distribution:{ label: "Distribution Switch", icon: "fa-sitemap" },
  access:      { label: "Access Switch",       icon: "fa-diagram-project" },
  management:  { label: "Management",          icon: "fa-gears" },
  vlan11:      { label: "VLAN 11",             icon: "fa-tags" },
  vlan22:      { label: "VLAN 22",             icon: "fa-tags" },
  vlan33:      { label: "VLAN 33",             icon: "fa-tags" }
};
const TOPO_LAYER_ORDER = ["wan", "router", "firewall", "ids", "lb", "core", "distribution", "access", "management", "vlan11", "vlan22", "vlan33"];
const TOPO_LAYER_TYPES = {
  wan:          ["external"],
  router:       ["router", "external"],
  firewall:     ["firewall"],
  ids:          ["ids", "firewall"],
  lb:           ["lb"],
  core:         ["switch"],
  distribution: ["switch"],
  access:       ["switch"],
  management:   ["switch"],
  vlan11:       ["server", "storage", "tower", "patch"],
  vlan22:       ["server", "storage", "tower", "patch"],
  vlan33:       ["server", "storage", "tower", "patch"]
};
const TOPO_DEV_GROUPS = { switch: "Switch", firewall: "Firewall", router: "Router", ids: "IDS/IPS", lb: "Load Balancer", server: "Server", storage: "Storage", pdu: "Rack PDU", external: "Eksternal", other: "Lainnya" };
let editMode = false;
let activeLayerKey = "core";
const editbar = document.getElementById("topo-editbar");
const topoScope = { site: "", rack: "" };
let treeTotalW = 0;

function topoDeviceGroups(filterTypes) {
  const groups = {};
  Object.keys(TOPO_DEV_GROUPS).forEach(k => { groups[k] = []; });
  Object.values(nodeMap).forEach(n => {
    if (filterTypes && filterTypes.length && !filterTypes.includes(n.type)) return;
    if (topoScope.rack && n.rack !== topoScope.rack) return;
    if (!topoScope.rack && topoScope.site && n.site && n.site !== topoScope.site) return;
    if (!topoScope.rack && topoScope.site && !n.site && n.siteName && n.siteName !== topoScope.site) return;
    const key = groups[n.type] ? n.type : "other";
    groups[key].push(n);
  });
  Object.values(groups).forEach(list => list.sort((a, b) => a.name.localeCompare(b.name)));
  return groups;
}
function autoRoleFor(n) {
  return AUTO_LAYER_KEY[detectAutoLayer(n)] || null;
}
function drawRowPick(row, count) {
  const g = document.createElementNS(svgNS, "g");
  g.setAttribute("class", "row-pick");
  g.style.cursor = "pointer";
  const y = row.y - TREE_CARD_H / 2 - 28;
  const bandW = Math.max(0, treeTotalW - 32);
  shape(g, "rect", { x: 16, y, width: bandW, height: 24, rx: 12, class: "row-pick-bg" });
  shape(g, "rect", { x: 16, y, width: 236, height: 24, rx: 12, class: "row-pick-band" });
  const label = shape(g, "text", { x: 32, y: y + 16, class: "row-pick-label" });
  label.textContent = row.label;
  shape(g, "rect", { x: 226, y: y + 5, width: 22, height: 15, rx: 8, class: "row-pick-count-bg" });
  const cnt = shape(g, "text", { x: 237, y: y + 16, class: "row-pick-count", "text-anchor": "middle" });
  cnt.textContent = count;
  shape(g, "circle", { cx: treeTotalW - 34, cy: y + 12, r: 10, class: "row-pick-plus-bg" });
  const plus = shape(g, "text", { x: treeTotalW - 34, y: y + 17, class: "row-pick-plus", "text-anchor": "middle" });
  plus.textContent = "+";
  g.addEventListener("click", ev => openRowPicker(row.key, ev));
  svg.appendChild(g);
}
function drawVlanPick(grp) {
  const g = document.createElementNS(svgNS, "g");
  g.setAttribute("class", "row-pick");
  g.style.cursor = "pointer";
  shape(g, "circle", { cx: grp.x + grp.w - 16, cy: grp.y + 15, r: 9, class: "row-pick-plus-bg" });
  const plus = shape(g, "text", { x: grp.x + grp.w - 16, y: grp.y + 19, class: "row-pick-plus", "text-anchor": "middle" });
  plus.textContent = "+";
  g.addEventListener("click", ev => openRowPicker(grp.key, ev));
  svg.appendChild(g);
}
function openRowPicker(key, ev) {
  const old = document.getElementById("topo-row-picker");
  if (old) old.remove();
  const picker = document.createElement("div");
  picker.id = "topo-row-picker";
  picker.className = "topo-picker";
  const types = TOPO_LAYER_TYPES[key] || [];
  const groups = topoDeviceGroups(types);
  const body = Object.entries(groups).map(([gk, items]) => {
    if (!items.length) return "";
    const rows = items.map(n => {
      const assigned = topoLayers[n.id] === key;
      const auto = !assigned && autoRoleFor(n) === key;
      return `<label class="topo-dev-row"><input type="checkbox" data-id="${n.id}"${assigned ? " checked" : ""}>
        <span class="tdot" style="background:${typeColor[n.type] || typeColor.external}"></span>
        <span class="topo-dev-name">${n.name}</span>
        <span class="topo-dev-meta">${n.model || n.rack || ""}</span>
        ${auto ? '<span class="topo-badge auto">auto</span>' : ""}</label>`;
    }).join("");
    return `<div class="topo-cat">${TOPO_DEV_GROUPS[gk]}</div>${rows}`;
  }).join("");
  picker.innerHTML = `<div class="topo-picker-head"><b>${TOPO_LAYERS[key].label}</b><span class="topo-picker-note">berlaku langsung</span><button class="topo-picker-close" title="Tutup">&times;</button></div>
    <div class="topo-picker-list">${body || '<div class="topo-layer-empty">Tidak ada aset relevan untuk layer ini.</div>'}</div>`;
  document.body.appendChild(picker);
  const W = picker.offsetWidth || 320;
  const H = picker.offsetHeight || 300;
  picker.style.left = Math.max(8, Math.min(ev.clientX, window.innerWidth - W - 8)) + "px";
  picker.style.top = Math.max(8, Math.min(ev.clientY, window.innerHeight - H - 8)) + "px";
  picker.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.addEventListener("change", () => {
    const id = cb.dataset.id;
    if (cb.checked) topoLayers[id] = key;
    else if (topoLayers[id] === key) delete topoLayers[id];
    saveTopoLayers();
    render();
  }));
  const close = () => picker.remove();
  picker.querySelector(".topo-picker-close").addEventListener("click", close);
  document.addEventListener("click", function onDoc(ev2) {
    if (picker.contains(ev2.target)) return;
    document.removeEventListener("click", onDoc);
    picker.remove();
  });
}
function updateEditModeUI() {
  const btn = document.getElementById("topo-layers-btn");
  if (btn) {
    btn.innerHTML = editMode ? '<i class="fa-solid fa-check"></i> Selesai Atur' : '<i class="fa-solid fa-layer-group"></i> Atur Layer';
    btn.classList.toggle("active", editMode);
  }
  if (editbar) editbar.style.display = editMode ? "flex" : "none";
  // picker mengikuti Cakupan di toolbar utama; pastikan sinkron
  topoScope.site = currentSite;
  topoScope.rack = currentRack === "all" ? "" : currentRack;
}
const topoLayersBtn = document.getElementById("topo-layers-btn");
if (topoLayersBtn) topoLayersBtn.addEventListener("click", () => {
  editMode = !editMode;
  if (!editMode) { const p = document.getElementById("topo-row-picker"); if (p) p.remove(); }
  updateEditModeUI();
  render();
});
const editAutoBtn = document.getElementById("topo-edit-auto");
if (editAutoBtn) editAutoBtn.addEventListener("click", () => {
  Object.values(nodeMap).forEach(n => {
    const k = autoRoleFor(n);
    if (k) topoLayers[n.id] = k;
  });
  saveTopoLayers();
  render();
});
const editResetBtn = document.getElementById("topo-edit-reset");
if (editResetBtn) editResetBtn.addEventListener("click", () => {
  topoLayers = {};
  saveTopoLayers();
  render();
});

// ---------- WAN Link Manager ----------
function loadWANLinks() {
  try {
    const data = JSON.parse(localStorage.getItem(WAN_LINKS_KEY) || "[]");
    if (!Array.isArray(data)) return;
    data.forEach(w => {
      if (w.from && w.to) {
        ensureNode(w.from, { type: "router" });
        ensureNode(w.to, { type: "router" });
        addEdge(w.from, w.to, "wan", { label: w.label || "", bandwidth: w.bandwidth || "", port: w.port || "" });
      }
    });
  } catch (e) {}
}
function saveWANLinks() {
  const data = edges.filter(e => e.kind === "wan").map(e => ({
    from: nodeMap[e.a] ? nodeMap[e.a].name : e.a,
    to: nodeMap[e.b] ? nodeMap[e.b].name : e.b,
    label: e.label || "", bandwidth: e.bandwidth || "", port: e.port || ""
  }));
  try { localStorage.setItem(WAN_LINKS_KEY, JSON.stringify(data)); } catch (e) {}
}
function populateWANModalSites() {
  const sites = topoSiteList();
  ["wan-from-site", "wan-to-site"].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const val = sel.value;
    sel.innerHTML = '<option value="">Pilih site…</option>' + sites.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
    if (val) sel.value = val;
  });
}
function populateWANRouterDatalist() {
  const routers = Object.values(nodeMap).filter(n => n.type === "router" || n.type === "firewall");
  const items = routers.map(n => `<option value="${n.name}">`).join("");
  ["wan-router-list", "wan-router-list2"].forEach(id => {
    const dl = document.getElementById(id);
    if (dl) dl.innerHTML = items;
  });
}
function renderWANLinkList() {
  const el = document.getElementById("wan-link-list");
  if (!el) return;
  const wanEdges = edges.filter(e => e.kind === "wan");
  if (!wanEdges.length) {
    el.innerHTML = '<div style="font-size:12.5px;color:var(--text-muted);padding:12px 0;">Belum ada WAN link tercatat. Tambahkan link baru di bawah.</div>';
    return;
  }
  el.innerHTML = '<table style="width:100%;font-size:12.5px;"><thead><tr><th style="text-align:left;">Dari</th><th style="text-align:left;">Ke Site</th><th style="text-align:left;">Router Src</th><th style="text-align:left;">Router Dst</th><th style="text-align:left;">Label</th><th></th></tr></thead><tbody>'
    + wanEdges.map(e => {
      const na = nodeMap[e.a] || {}, nb = nodeMap[e.b] || {};
      const siteA = na.siteName || na.site || "—", siteB = nb.siteName || nb.site || "—";
      return `<tr style="border-bottom:1px solid var(--border-soft);">
        <td style="padding:6px 4px;color:var(--text-muted);">${escA(siteA)}</td>
        <td style="padding:6px 4px;">${escA(siteB)}</td>
        <td style="padding:6px 4px;font-family:var(--font-mono);font-size:11.5px;">${escA(na.name)}</td>
        <td style="padding:6px 4px;font-family:var(--font-mono);font-size:11.5px;">${escA(nb.name)}</td>
        <td style="padding:6px 4px;font-size:11.5px;">${escA(e.label || "—")}</td>
        <td style="padding:6px 4px;text-align:right;"><button class="btn ghost wan-del-btn" data-a="${e.a}" data-b="${e.b}" title="Hapus link" style="font-size:10px;padding:2px 6px;color:var(--danger);"><i class="fa-solid fa-trash"></i></button></td>
      </tr>`;
    }).join("")
    + '</tbody></table>';
  el.querySelectorAll(".wan-del-btn").forEach(btn => btn.addEventListener("click", () => {
    const a = btn.dataset.a, b = btn.dataset.b;
    const key = [a, b].sort().join("|") + "::wan";
    const idx = edges.findIndex(e => [e.a, e.b].sort().join("|") + "::" + e.kind === key);
    if (idx >= 0) edges.splice(idx, 1);
    saveWANLinks();
    renderWANLinkList();
    render();
  }));
}
function openWANModal() {
  const ov = document.getElementById("wan-modal-overlay");
  if (!ov) return;
  populateWANModalSites();
  populateWANRouterDatalist();
  renderWANLinkList();
  ov.classList.add("open");
}
function saveWANLink() {
  const fromSite = document.getElementById("wan-from-site").value;
  const toSite = document.getElementById("wan-to-site").value;
  const fromRouter = document.getElementById("wan-from-router").value.trim();
  const toRouter = document.getElementById("wan-to-router").value.trim();
  const label = document.getElementById("wan-label").value.trim();
  if (!fromRouter || !toRouter) { alert("Router source dan destination wajib diisi."); return; }
  ensureNode(fromRouter, { type: "router" });
  ensureNode(toRouter, { type: "router" });
  // try to assign sites from selects
  const rA = nodeMap[slugKey(fromRouter)], rB = nodeMap[slugKey(toRouter)];
  if (rA && fromSite && !rA.site) { const rk = Array.isArray(RACKS) ? RACKS.find(r => r.site === fromSite) : null; rA.site = fromSite; rA.siteName = rk ? rk.siteName : fromSite; }
  if (rB && toSite && !rB.site) { const rk = Array.isArray(RACKS) ? RACKS.find(r => r.site === toSite) : null; rB.site = toSite; rB.siteName = rk ? rk.siteName : toSite; }
  addEdge(fromRouter, toRouter, "wan", { label: label || (fromRouter + " → " + toRouter), bandwidth: document.getElementById("wan-bandwidth").value.trim(), port: document.getElementById("wan-port").value.trim() });
  saveWANLinks();
  // clear form
  ["wan-from-site", "wan-to-site", "wan-from-router", "wan-to-router", "wan-label", "wan-bandwidth", "wan-port"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  renderWANLinkList();
  render();
}
const wanLinksBtn = document.getElementById("wan-links-btn");
if (wanLinksBtn) wanLinksBtn.addEventListener("click", openWANModal);
const wanModalClose = document.getElementById("wan-modal-close");
if (wanModalClose) wanModalClose.addEventListener("click", () => {
  const ov = document.getElementById("wan-modal-overlay");
  if (ov) ov.classList.remove("open");
});
const wanModalOverlay = document.getElementById("wan-modal-overlay");
if (wanModalOverlay) wanModalOverlay.addEventListener("click", (ev) => {
  if (ev.target === wanModalOverlay) wanModalOverlay.classList.remove("open");
});
const wanSaveBtn = document.getElementById("wan-save-btn");
if (wanSaveBtn) wanSaveBtn.addEventListener("click", saveWANLink);

// ---------- init ----------
// Dijalankan pada event load agar semua modul data (port-data/pdu-data)
// sudah termuat — render pertama langsung punya edge & PDU lane.
window.addEventListener("load", () => {
  loadTopoLayers();
  loadWANLinks();
  populateScopeSelects();
  wireFilters();
  updateModeVisibility();
  populateTrace();
  render();
});