
// ---- Sumber data sites & rack (konsisten dengan menu Sites & Site Racks) ----
const RACK_SITES = [
  { id: "DC1", name: "DC1 — Cilandak",         loc: "Jakarta Selatan, DKI Jakarta", zone: "Zona A", prefix: "R1", rackCount: 12 },
  { id: "DC2", name: "DC2 — Cikupa",           loc: "Tangerang, Banten",            zone: "Zona B", prefix: "R2", rackCount: 18 },
  { id: "DC3", name: "DC3 — Surabaya",         loc: "Surabaya, Jawa Timur",         zone: "Zona C", prefix: "R3", rackCount: 8 },
  { id: "DC4", name: "DC4 — Bandung (Edge Site)", loc: "Bandung, Jawa Barat",       zone: "Zona D", prefix: "R4", rackCount: 6 },
];

function rackSeededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return function () {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
}

const RACK_OVERRIDES = {
  "R1-A12": { server: 4, sw: 2, pdu: 2, firewall: 1, patch: 1, util: 84, status: "online" },
};

const RACKS = (() => {
  const list = [];
  RACK_SITES.forEach(site => {
    for (let i = 1; i <= site.rackCount; i++) {
      const row = String.fromCharCode(65 + Math.floor((i - 1) / 6));
      const rackId = site.id === "DC1" && i === 12 ? "R1-A12" : site.prefix + "-" + row + String(i).padStart(2, "0");
      const rand = rackSeededRandom(rackId);
      const ov = RACK_OVERRIDES[rackId];
      const server = ov ? ov.server : 6 + Math.floor(rand() * 12);
      const sw = ov ? ov.sw : 1 + Math.floor(rand() * 3);
      const pdu = ov ? ov.pdu : 1 + Math.floor(rand() * 2);
      const firewall = ov ? ov.firewall : rand() > 0.6 ? 1 : 0;
      const patch = ov ? ov.patch : rand() > 0.5 ? 1 : 0;
      const totalDevices = server + sw + pdu + firewall + patch;
      const util = ov ? ov.util : Math.min(97, Math.round((totalDevices / 24) * 100 + rand() * 8));
      const status = ov ? ov.status : rackId === "R3-C03" ? "maintenance" : rand() > 0.92 ? "degraded" : "online";
      list.push({ rackId, site: site.id, siteName: site.name, loc: site.loc, zone: site.zone, server, sw, pdu, firewall, patch, totalDevices, util, status });
    }
  });
  return list;
})();

// ---- tinggi rack server (ukuran U) & layout perangkat eksplisit per rack ----
const RACK_SIZE = 42;

const RACK_LAYOUTS = {
  "R1-A12": [
    { start: 1, end: 2, type: "blank" },
    { start: 3, end: 3, type: "patch", name: "PP-24-CAT6", model: "Patch Panel 24-port CAT6", serial: "PP-2026-0031", ip: "—", power: "0 W", back: "24x RJ45", tags: ["production"] },
    { start: 4, end: 4, type: "switch", name: "SW-CORE-01", model: "Cisco Catalyst 9300-48P", serial: "SW-CAT-9300-118", ip: "10.10.0.1", power: "150 W", back: "48x RJ45 + 4x SFP+", tags: ["production", "network-core"] },
    { start: 5, end: 8, type: "server", name: "SRV-APP-04", model: "Dell PowerEdge R750", serial: "SVC-R750-4471", ip: "10.10.4.14", power: "480 W", back: "2x PSU · 2x 10GbE", tags: ["production", "application"] },
    { start: 9, end: 9, type: "pdu", name: "PDU-A", model: "APC AP8941 Switched Rack PDU", serial: "PDU-APC-8941-02", ip: "10.10.9.1", power: "—", capacity: 32, draw: 4.3, phases: "1-phase, 230V", back: "Input C20 · 24 outlet", tags: ["production", "power"] },
    { start: 10, end: 13, type: "server", name: "SRV-DB-17", model: "Dell PowerEdge R750", serial: "SVC-R750-5502", ip: "10.10.4.17", power: "520 W", back: "2x PSU · 2x 10GbE", tags: ["production", "database"] },
    { start: 14, end: 14, type: "firewall", name: "FW-EDGE-02", model: "Fortinet FortiGate 200F", serial: "FGT-200F-9931", ip: "10.10.0.254", power: "65 W", back: "6x GbE WAN/LAN", tags: ["production", "security"],
      zones: [ { name: "WAN / Untrusted", tag: "untrusted" }, { name: "DMZ", tag: "dmz" }, { name: "Internal LAN", tag: "trusted" }, { name: "Management VLAN", tag: "trusted" } ] },
    { start: 15, end: 18, type: "server", name: "SRV-WEB-02", model: "HPE ProLiant DL380", serial: "SVC-DL380-2290", ip: "10.10.4.22", power: "410 W", back: "2x PSU · 2x 1GbE", tags: ["development", "web"] },
    { start: 19, end: 20, type: "blank" },
    { start: 21, end: 21, type: "switch", name: "SW-ACC-03", model: "Cisco Catalyst 2960-X", serial: "SW-CAT-2960-077", ip: "10.10.0.23", power: "80 W", back: "24x RJ45 + 2x SFP", tags: ["production", "network-access"] },
    { start: 22, end: 25, type: "server", name: "SRV-BKP-01", model: "Dell PowerEdge R750xd", serial: "SVC-R750XD-1180", ip: "10.10.4.31", power: "540 W", back: "2x PSU · 2x 10GbE", tags: ["production", "backup"] },
    { start: 26, end: 26, type: "pdu", name: "PDU-B", model: "APC AP8941 Switched Rack PDU", serial: "PDU-APC-8941-03", ip: "10.10.9.2", power: "—", capacity: 32, draw: 3.1, phases: "1-phase, 230V", back: "Input C20 · 24 outlet", tags: ["production", "power"] },
    { start: 27, end: 42, type: "blank" },
  ],
};

// ---- tinggi rack server (ukuran U) yang bisa dipilih saat tambah rack ----
const RACK_HEIGHTS = [24, 27, 32, 36, 42, 45, 47, 48, 52, 54];
const RACK_STORAGE_KEY = "rv_custom_racks";

function readLocalRacks() {
  try {
    const raw = localStorage.getItem(RACK_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeLocalRacks(list) {
  localStorage.setItem(RACK_STORAGE_KEY, JSON.stringify(list));
}

function getCustomRacks() {
  if (typeof apiGetRacks === "function") {
    const db = apiGetRacks();
    if (db) {
      const ls = readLocalRacks();
      if (!db.length && ls.length && typeof apiSaveRack === "function") {
        ls.forEach(r => apiSaveRack(r));
        return ls;
      }
      return db;
    }
  }
  return readLocalRacks();
}

getCustomRacks().forEach(r => {
  if (r && r.rackId && !RACKS.some(x => x.rackId === r.rackId)) RACKS.push(r);
});

function saveRack(rack) {
  const entry = {
    ...rack,
    rackId: String(rack.rackId || "").trim().toUpperCase(),
    size: parseInt(rack.size, 10) || 42,
    server: parseInt(rack.server, 10) || 0,
    sw: parseInt(rack.sw, 10) || 0,
    pdu: parseInt(rack.pdu, 10) || 0,
    firewall: parseInt(rack.firewall, 10) || 0,
    patch: parseInt(rack.patch, 10) || 0,
    util: Math.min(100, Math.max(0, parseInt(rack.util, 10) || 0)),
    status: rack.status || "online",
  };
  entry.totalDevices = entry.server + entry.sw + entry.pdu + entry.firewall + entry.patch;
  if (typeof apiSaveRack === "function" && apiSaveRack(entry)) {
    if (!RACKS.some(r => r.rackId === entry.rackId)) RACKS.push(entry);
    return entry;
  }
  try {
    const list = readLocalRacks();
    list.push(entry);
    writeLocalRacks(list);
  } catch {
    return false;
  }
  if (!RACKS.some(r => r.rackId === entry.rackId)) RACKS.push(entry);
  return entry;
}

function deleteRack(rackId) {
  const id = String(rackId || "").trim().toUpperCase();
  let ok = false;
  if (typeof apiDeleteRack === "function") {
    ok = !!apiDeleteRack(id);
  }
  try {
    const list = readLocalRacks();
    const next = list.filter(r => r.rackId !== id);
    if (next.length !== list.length) {
      writeLocalRacks(next);
      ok = true;
    }
  } catch (e) { /* ignore */ }
  if (ok) {
    const i = RACKS.findIndex(r => r.rackId === id);
    if (i >= 0) RACKS.splice(i, 1);
    return true;
  }
  return false;
}

// ---- record server per rack (sinkron dengan Rack Elevation) ----
// generateLayout() di rack-elevation.js membuat server virtual per rack
// (SRV-<rackId>-NN). Agar List Server menampilkan perangkat yang sama,
// bangkitkan record server deterministik yang sama persis (seed + urutan U).
function rackServerBase(rack, hostname, model, serial, start, end) {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const size = hi - lo + 1;
  const rackId = rack.rackId || "";
  return {
    id: "rack-" + rackId.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + hostname.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    hostname,
    tipeServer: "rack",
    formFactor: size + "U",
    vendor: "Dell",
    model: model || "Dell PowerEdge R750",
    serial,
    tahunPembelian: "2024",
    warranty: "ProSupport Plus s.d. 2029",
    os: "Linux",
    processorCount: "dual",
    processorType: "Intel Xeon Gold 6338",
    coreThread: "32C / 64T",
    dimmTotal: "16",
    dimmPerSlot: "32 GB",
    dimmInstalled: "256 GB",
    storageBays: "8",
    storageCap: "4 TB",
    storageIface: "SAS",
    raid: "Ya",
    raidTypes: ["RAID 1"],
    lanRj45: "4", lanSfp: "2", lanQsfp: "0", speed: "10G", mgmtPort: "iDRAC",
    pcieCount: "3", pcieGen: "Gen4", psuCount: "2", psuWatt: "750 W", powerRedundancy: "Redundant",
    site: rack.site, siteName: rack.siteName, rack: rackId,
    posisiU: lo === hi ? "U" + lo : "U" + lo + "–U" + hi,
    vlan: "VLAN 700 — Rack " + rackId,
    cableManagement: "PP-" + rackId + " · P1–P4",
    hypervisor: "Linux",
    fungsi: ["Web"],
    monitoring: ["SNMP", "IPMI"],
    kondisi: "Active",
    assetTag: "ASET-RACK-" + rackId + "-" + hostname,
    tags: ["production", "rack"],
    rackSource: true,
  };
}

function buildRackServers() {
  const out = [];
  RACKS.forEach(rack => {
    const rackId = rack.rackId || "";
    const layout = RACK_LAYOUTS[rackId];
    if (layout) {
      layout.forEach(d => {
        if (d.type !== "server" || !d.name) return;
        out.push(rackServerBase(rack, d.name, d.model, d.serial, d.start, d.end));
      });
      return;
    }
    const rand = rackSeededRandom(rackId);
    const devices = [];
    let u = rack.size || RACK_SIZE;
    const oneU = (d) => {
      if (u < 1) return;
      d.start = u; d.end = u; u--;
      devices.push(d);
    };
    if (rack.patch) oneU({ type: "patch" });
    if (rack.firewall) oneU({ type: "firewall" });
    for (let i = 1; i <= (rack.sw || 0); i++) oneU({ type: "switch" });
    if ((rack.pdu || 0) >= 1) oneU({ type: "pdu" });
    let srv = 0;
    while (srv < (rack.server || 0) && u >= 1) {
      const size = Math.min(u, 1 + Math.floor(rand() * 4));
      const end = u - size + 1;
      srv++;
      devices.push({ start: u, end, type: "server" });
      u = end - 1;
    }
    devices.filter(d => d.type === "server").forEach((d, i) => {
      const nn = String(i + 1).padStart(2, "0");
      const hostname = "SRV-" + rackId + "-" + nn;
      const serial = "SVC-" + rackId + "-" + nn;
      out.push(rackServerBase(rack, hostname, "Dell PowerEdge R750", serial, d.start, d.end));
    });
  });
  return out;
}
