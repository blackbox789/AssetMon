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
    nodeMap[id] = { id, name: key, type: "external", model: "", ip: "", rack: null, site: null, siteName: "", tags: [], posisiU: "", x: 0, y: 0 };
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
    });
  });
}

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
  ids: "#EC4899", lb: "#14B8A6",
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
  external: { label: "Eksternal",     badgeBg: "var(--bg-surface-3)", badgeColor: "var(--text-secondary)" }
};
const typeOrder = { switch: 0, router: 1, firewall: 2, server: 3, storage: 3, pdu: 4, patch: 5, tower: 6, external: 7 };

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
  if (name.startsWith("FW-") || t === "firewall") return 2;
  if (/IDS|IPS/.test(name) || t === "ids") return 3;
  if (/^LB-|LOAD\s*BAL/.test(name) || t === "lb") return 4;
  if (/^SW[- ]/.test(name) || t === "switch") {
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
const LAYER_TYPE_ORDER = { router: 0, firewall: 1, switch: 2, server: 3, storage: 3, tower: 3, pdu: 4, patch: 5, external: 6 };

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
    const L = deviceLayer(n);
    if (n.type === "pdu") byType.pdu.push(n);
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

  // lane power
  if (treePduLane.nodes.length) {
    drawTreeCaption(18, treePduLane.y - TREE_CARD_H / 2 - 12, "POWER DISTRIBUTION");
    treePduLane.nodes.forEach(drawTreeCard);
    // edge power nyata
    if (currentLayer === "power" || currentLayer === "all") {
      const pos = {};
      treeRows.forEach(r => r.nodes.forEach(p => { pos[p.n.id] = p; }));
      treeVlanGroups.forEach(g => { pos[g.l3.n.id] = g.l3; g.leaves.forEach(p => { pos[p.n.id] = p; }); });
      treePduLane.nodes.forEach(p => { pos[p.n.id] = p; });
      edges.forEach(e => {
        if (e.kind !== "power") return;
        const a = pos[e.a], b = pos[e.b];
        if (!a || !b) return;
        const line = shape(svg, "line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "edge edge-power" });
        line.setAttribute("stroke-dasharray", "5 4");
        line.setAttribute("stroke-width", "1.6");
        svgEdges.push({ el: line, a: e.a, b: e.b, kind: "power" });
      });
    }
  }

  updateInfo();
}

// ---------- layout: kotak rack + grid device + band eksternal ----------
const CELL_W = 150, CELL_H = 48, PAD = 16, HEAD = 30, RACK_COLS = 3, GAP = 26;
const rackBoxes = [];

function layoutNodes() {
  const rackGroups = {};
  const externalNodes = [];
  Object.values(nodeMap).forEach(n => {
    if (n.rack) (rackGroups[n.rack] = rackGroups[n.rack] || []).push(n);
    else externalNodes.push(n);
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
  const boxW = PAD * 2 + RACK_COLS * CELL_W;
  const boxH = (list) => PAD * 2 + HEAD + Math.ceil(list.length / RACK_COLS) * CELL_H;

  let cursorX = 0, cursorY = extH + 26, rowHeight = 0;
  rackBoxes.length = 0;
  rackIds.forEach((rackId, i) => {
    const col = i % RACK_COLS;
    if (col === 0 && i > 0) { cursorY += rowHeight + 24; cursorX = 0; rowHeight = 0; }
    const list = rackGroups[rackId];
    const h = boxH(list);
    const box = { rackId, x: cursorX, y: cursorY, w: boxW, h, nodes: list };
    rackBoxes.push(box);
    const rack = Array.isArray(RACKS) && RACKS.find(r => r.rackId === rackId);
    box.siteName = rack && rack.siteName;
    box.site = rack && rack.site;
    list.forEach((n, j) => {
      n.x = cursorX + PAD + (j % RACK_COLS) * CELL_W + CELL_W / 2;
      n.y = cursorY + HEAD + Math.floor(j / RACK_COLS) * CELL_H + CELL_H / 2;
    });
    rowHeight = Math.max(rowHeight, h);
    cursorX += boxW + GAP;
  });

  let totalW = Math.max(400, rackBoxes.length ? Math.min(RACK_COLS, rackBoxes.length) * boxW + (Math.min(RACK_COLS, rackBoxes.length) - 1) * GAP : externalNodes.length * 150);
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
let currentLayer = "data";   // data | power | all
let currentRack = "all";
let currentLayout = "logical"; // logical | physical

function render() {
  if (currentLayout === "logical") { renderLogicalTree(); return; }
  const dim = layoutNodes();
  svg.setAttribute("viewBox", "0 0 " + dim.totalW + " " + dim.totalH);
  svg.innerHTML = "";

  const visible = n => currentRack === "all" || n.rack === currentRack || !n.rack;

  // edges (di bawah node)
  svgEdges.length = 0;
  edges.forEach(e => {
    const na = nodeMap[e.a], nb = nodeMap[e.b];
    if (!na || !nb || !visible(na) || !visible(nb)) return;
    if (currentLayer === "data" && e.kind !== "data") return;
    if (currentLayer === "power" && e.kind !== "power") return;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", na.x); line.setAttribute("y1", na.y);
    line.setAttribute("x2", nb.x); line.setAttribute("y2", nb.y);
    line.setAttribute("class", "edge edge-" + e.kind);
    line.dataset.a = e.a; line.dataset.b = e.b; line.dataset.kind = e.kind;
    if (e.kind === "power") {
      line.setAttribute("stroke-dasharray", "5 4");
      line.setAttribute("stroke-width", "1.6");
    }
    svg.appendChild(line);
    svgEdges.push({ el: line, a: e.a, b: e.b, kind: e.kind });
  });

  // kotak rack (hanya mode fisik)
  if (currentLayout === "physical") {
    rackBoxes.forEach(box => {
      if (currentRack !== "all" && box.rackId !== currentRack) return;
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", box.x); rect.setAttribute("y", box.y);
      rect.setAttribute("width", box.w); rect.setAttribute("height", box.h);
      rect.setAttribute("rx", "12");
      rect.setAttribute("class", "rack-box");
      rect.dataset.rack = box.rackId;
      svg.appendChild(rect);
      const title = document.createElementNS(svgNS, "text");
      title.setAttribute("x", box.x + 12); title.setAttribute("y", box.y + 20);
      title.setAttribute("class", "rack-box-title");
      title.textContent = box.rackId + " · " + (box.siteName || box.site || "") + " · " + box.nodes.length + " device";
      svg.appendChild(title);
    });
  }

  // node
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

  // info bar
  updateInfo();
}

function updateInfo() {
  const info = document.getElementById("topo-info");
  if (!info) return;
  const totalNodes = Object.keys(nodeMap).length;
  const rackCount = new Set(Object.values(nodeMap).map(n => n.rack).filter(Boolean)).size;
  const dataEdges = edges.filter(e => e.kind === "data").length;
  const powerEdges = edges.filter(e => e.kind === "power").length;
  info.textContent = totalNodes + " device · " + rackCount + " rack · " + dataEdges + " link data · " + powerEdges + " link power";
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
    ? `<div class="section-label">Terhubung ke (${conns.length})</div><div class="conn-list">${conns.map(({ n: c, kind }) =>
        `<div class="conn-item"><span class="dot" style="background:${typeColor[c.type] || typeColor.external}"></span>${c.name}<span class="mono" style="margin-left:auto;font-size:10px;color:${kind === "power" ? "var(--violet)" : "var(--text-muted)"};">${kind === "power" ? "⚡" : "⇄"}</span></div>`).join("")}</div>`
    : `<div class="section-label">Tidak ada koneksi tercatat</div>`;

  panel.innerHTML = `<span class="detail-type-badge" style="background:${meta.badgeBg};color:${meta.badgeColor}">${meta.label}</span>
    <h2 class="detail-title">${n.name}</h2><p class="detail-sub">${n.model || (n.rack ? "Rack " + n.rack : "Eksternal")}</p>
    ${tagsHtml}
    <div class="field-grid">
      <div class="field-item"><div class="k">Rack</div><div class="v">${n.rack || "—"}</div></div>
      <div class="field-item"><div class="k">Posisi</div><div class="v">${n.posisiU ? "U" + n.posisiU : "—"}</div></div>
      ${n.ip ? `<div class="field-item"><div class="k">IP Address</div><div class="v">${n.ip}</div></div>` : ""}
      ${n.siteName ? `<div class="field-item"><div class="k">Site</div><div class="v">${n.siteName}</div></div>` : ""}
    </div>
    ${connHtml}${portmapBtn}${powermapBtn}${rackLink}`;
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
  highlightTrace(path);
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
  highlightTrace(null);
  document.getElementById("detail-panel").innerHTML = `<div class="detail-empty">Klik salah satu node pada topologi untuk melihat detail koneksi.</div>`;
});

// ---------- filter: layer & rack ----------
function renderFilterUI() {
  const sel = document.getElementById("filter-rack");
  if (!sel) return;
  const rackIds = Object.keys(nodeMap).reduce((acc, id) => { const r = nodeMap[id].rack; if (r && !acc.includes(r)) acc.push(r); return acc; }, []).sort();
  sel.innerHTML = `<option value="all">Semua Rack</option>` + rackIds.map(r => `<option value="${r}">${r}</option>`).join("");
}
function wireFilters() {
  document.querySelectorAll("#layout-buttons .layout-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#layout-buttons .layout-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentLayout = btn.dataset.layout;
      render();
    });
  });
  document.querySelectorAll("#layer-buttons .layer-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#layer-buttons .layer-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentLayer = btn.dataset.layer;
      render();
    });
  });
  const sel = document.getElementById("filter-rack");
  if (sel) sel.addEventListener("change", () => { currentRack = sel.value; render(); });
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
function initTopoScope() {
  const siteSel = document.getElementById("topo-site-sel");
  const rackSel = document.getElementById("topo-rack-sel");
  if (!siteSel || !rackSel) return;
  let sites = [];
  if (typeof RACKS !== "undefined" && Array.isArray(RACKS)) {
    RACKS.forEach(r => {
      if (r.site && !sites.find(s => s.id === r.site)) sites.push({ id: r.site, name: r.siteName || r.site });
    });
  }
  sites = sites.length ? sites : Object.values(nodeMap).reduce((acc, n) => {
    const s = n.site || n.siteName;
    if (s && !acc.includes(s)) acc.push(s);
    return acc;
  }, []).map(id => ({ id, name: id }));
  siteSel.innerHTML = sites.map(s => `<option value="${s.id}">${s.name}</option>`).join("") || '<option value="">—</option>';
  if (!topoScope.site || !sites.find(s => s.id === topoScope.site)) topoScope.site = sites.length ? sites[0].id : "";
  fillTopoRacks();
}
function fillTopoRacks() {
  const rackSel = document.getElementById("topo-rack-sel");
  if (!rackSel) return;
  let racks = [];
  if (typeof RACKS !== "undefined" && Array.isArray(RACKS)) {
    racks = RACKS.filter(r => r.site === topoScope.site).map(r => r.rackId).sort();
  }
  if (!racks.length) {
    racks = Object.values(nodeMap).reduce((acc, n) => {
      if (n.rack && (n.site === topoScope.site || n.siteName === topoScope.site) && !acc.includes(n.rack)) acc.push(n.rack);
      return acc;
    }, []).sort();
  }
  rackSel.innerHTML = racks.map(r => `<option value="${r}">${r}</option>`).join("") || '<option value="">—</option>';
  if (!racks.includes(topoScope.rack)) topoScope.rack = racks.length ? racks[0] : "";
  rackSel.value = topoScope.rack;
  siteSelValue();
}
function siteSelValue() {
  const siteSel = document.getElementById("topo-site-sel");
  if (siteSel) siteSel.value = topoScope.site;
}
function updateEditModeUI() {
  const btn = document.getElementById("topo-layers-btn");
  if (btn) {
    btn.innerHTML = editMode ? '<i class="fa-solid fa-check"></i> Selesai Atur' : '<i class="fa-solid fa-layer-group"></i> Atur Layer';
    btn.classList.toggle("active", editMode);
  }
  if (editbar) editbar.style.display = editMode ? "flex" : "none";
  if (editMode) initTopoScope();
}
const topoLayersBtn = document.getElementById("topo-layers-btn");
if (topoLayersBtn) topoLayersBtn.addEventListener("click", () => {
  editMode = !editMode;
  if (!editMode) { const p = document.getElementById("topo-row-picker"); if (p) p.remove(); }
  updateEditModeUI();
  render();
});
const topoSiteSel = document.getElementById("topo-site-sel");
if (topoSiteSel) topoSiteSel.addEventListener("change", () => {
  topoScope.site = topoSiteSel.value;
  topoScope.rack = "";
  fillTopoRacks();
});
const topoRackSel = document.getElementById("topo-rack-sel");
if (topoRackSel) topoRackSel.addEventListener("change", () => {
  topoScope.rack = topoRackSel.value;
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

// ---------- init ----------
loadTopoLayers();
renderFilterUI();
wireFilters();
populateTrace();
render();