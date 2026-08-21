
// ---- Sumber data sites & rack (konsisten dengan menu Sites & Site Racks) ----
// Sumber of truth: tabel `sites` di SQLite (GET /api/sites).
// Array ini digunakan sebagai fallback bila backend belum aktif.
// Selalu sync dengan data di database.
const RACK_SITES = [
  { id: "DC1", name: "DC1 - Cilandak",         loc: "Jakarta Selatan, DKI Jakarta", zone: "Zona A", prefix: "R1", rackCount: 12 },
  { id: "DC2", name: "DC2 - Cikupa",           loc: "Tangerang, Banten",            zone: "Zona B", prefix: "R2", rackCount: 18 },
  { id: "DC3", name: "DC3 - Surabaya",         loc: "Surabaya, Jawa Timur",         zone: "Zona C", prefix: "R3", rackCount: 8 },
  { id: "DC4", name: "DC4 - Bandung (Edge Site)", loc: "Bandung, Jawa Barat",       zone: "Zona D", prefix: "R4", rackCount: 6 },
  { id: "DC7", name: "DC7 - Pugeran Yogyakarta", loc: "",                           zone: "",       prefix: "R7", rackCount: 0 },
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
  "R1-A12": { server: 8, sw: 4, pdu: 3, firewall: 1, patch: 1, util: 84, status: "online" },
  "R4-A01": { server: 2, sw: 1, pdu: 1, firewall: 0, patch: 0, util: 15, status: "degraded" },
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
      const status = ov ? ov.status : rand() > 0.92 ? "degraded" : "online";
      list.push({ rackId, site: site.id, siteName: site.name, loc: site.loc, zone: site.zone, server, sw, pdu, firewall, patch, totalDevices, util, status });
    }
  });
  return list;
})();

const EXTRA_RACKS = [
  { rackId: "R1-A08", site: "DC1", siteName: "DC1 - Cilandak", loc: "Jakarta Selatan, DKI Jakarta", zone: "Zona A", size: 42, server: 8, sw: 2, pdu: 2, firewall: 1, patch: 1, totalDevices: 14, util: 84, status: "online" },
  { rackId: "R2-B05", site: "DC2", siteName: "DC2 - Cikupa", loc: "Tangerang, Banten", zone: "Zona B", size: 42, server: 1, sw: 1, pdu: 2, firewall: 0, patch: 1, totalDevices: 5, util: 30, status: "online" },
  { rackId: "R2-B14", site: "DC2", siteName: "DC2 - Cikupa", loc: "Tangerang, Banten", zone: "Zona B", size: 42, server: 3, sw: 1, pdu: 2, firewall: 1, patch: 0, totalDevices: 7, util: 22, status: "online" },
  { rackId: "R3-C05", site: "DC3", siteName: "DC3 - Surabaya", loc: "Surabaya, Jawa Timur", zone: "Zona C", size: 42, server: 2, sw: 1, pdu: 1, firewall: 0, patch: 0, totalDevices: 4, util: 15, status: "online" },
];
EXTRA_RACKS.forEach(r => { if (!RACKS.some(x => x.rackId === r.rackId)) RACKS.push(r); });

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
    { start: 19, end: 19, type: "server", name: "SVR1U", model: "Dell PowerEdge R650 1U", serial: "SVC-R650-0019", ip: "10.10.4.19", power: "290 W", back: "2x PSU · 2x 10GbE", tags: ["production", "application"], formFactor: "1U" },
    { start: 20, end: 20, type: "blank" },
    { start: 21, end: 21, type: "switch", name: "SW-ACC-03", model: "Cisco Catalyst 2960-X", serial: "SW-CAT-2960-077", ip: "10.10.0.23", power: "80 W", back: "24x RJ45 + 2x SFP", tags: ["production", "network-access"] },
    { start: 22, end: 25, type: "server", name: "SRV-BKP-01", model: "Dell PowerEdge R750xd", serial: "SVC-R750XD-1180", ip: "10.10.4.31", power: "540 W", back: "2x PSU · 2x 10GbE", tags: ["production", "backup"] },
    { start: 26, end: 26, type: "pdu", name: "PDU-B", model: "APC AP8941 Switched Rack PDU", serial: "PDU-APC-8941-07", ip: "10.10.9.2", power: "—", capacity: 32, draw: 3.1, phases: "1-phase, 230V", back: "Input C20 · 24 outlet", tags: ["production", "power"] },
    { start: 27, end: 36, type: "tower", name: "SRV-TWR-01", model: "Dell PowerEdge T550", serial: "SVC-T550-8801", ip: "10.10.5.11", power: "120 W", back: "1x PSU · 2x 1GbE", tags: ["production", "tower"], slot: "L", formFactor: "10U (Tower)" },
    { start: 31, end: 36, type: "tower", name: "SRV-TWR-02", model: "Dell PowerEdge T150", serial: "SVC-T150-8802", ip: "10.10.5.12", power: "70 W", back: "1x PSU · 1x 1GbE", tags: ["production", "tower"], slot: "R", formFactor: "6U (Tower)", rackColor: "#6A7FA6" },
    { start: 37, end: 37, type: "switch", name: "SW-MGMT-02", model: "Cisco Catalyst 2960-X", serial: "SW-CAT-2960-310", ip: "10.10.99.1", power: "45 W", back: "24x RJ45 + 2x SFP", tags: ["production", "network-mgmt"] },
    { start: 38, end: 38, type: "switch", name: "SW-BACKUP-02", model: "Cisco Catalyst 2960-X", serial: "SW-CAT-2960-410", ip: "10.10.0.25", power: "90 W", back: "24x RJ45 + 2x SFP", tags: ["production", "backup-network"] },
    { start: 39, end: 39, type: "server", name: "SRV-NAS-01", model: "Dell PowerEdge R750", serial: "SVC-R750-4475", ip: "10.10.4.40", power: "260 W", back: "2x PSU · 2x 10GbE", tags: ["production", "storage"] },
    { start: 40, end: 40, type: "server", name: "SRV-NAS-02", model: "Dell PowerEdge R750", serial: "SVC-R750-4476", ip: "10.10.4.41", power: "240 W", back: "2x PSU · 2x 10GbE", tags: ["production", "storage"] },
    { start: 41, end: 41, type: "server", name: "SRV-BACKUP-01", model: "Dell PowerEdge R750xd", serial: "SVC-R750XD-4450", ip: "10.10.4.50", power: "300 W", back: "2x PSU · 2x 10GbE", tags: ["production", "backup"] },
    { start: 42, end: 42, type: "pdu", name: "PDU-R1A-U42", model: "Raritan Dominion SX", serial: "PDU-RAR-DS-310", ip: "10.10.9.11", power: "—", capacity: 8, draw: 2.4, phases: "1-phase, 230V", back: "Input C20 · 8 outlet", tags: ["production", "power"] },
  ],
  "R2-B14": [
    { start: 1, end: 1, type: "pdu", name: "PDU-R2B-S01", model: "Vertiv Geist", serial: "PDU-VRT-GC-2201", ip: "10.10.9.21", power: "—", capacity: 36, draw: 6.2, phases: "3-phase, 400V", back: "Input 3x C19 · 36 outlet", tags: ["production", "power"] },
    { start: 2, end: 2, type: "firewall", name: "FW-EDGE-04", model: "Fortinet FortiGate 100F", serial: "FGT-100F-9940", ip: "10.10.0.204", power: "70 W", back: "2x WAN + 4x LAN 1GbE", tags: ["production", "security"] },
    { start: 3, end: 3, type: "switch", name: "SW-CORE-02", model: "Cisco Catalyst 9300-24P", serial: "SW-CAT-9300-219", ip: "10.10.0.2", power: "150 W", back: "24x RJ45 + 4x SFP+", tags: ["production", "network-core"] },
    { start: 4, end: 4, type: "pdu", name: "PDU-R2B-U01", model: "APC Basic PDU", serial: "PDU-APC-BAS-440", ip: "10.10.9.22", power: "—", capacity: 8, draw: 1.4, phases: "1-phase, 230V", back: "Input C20 · 8 outlet", tags: ["production", "power"] },
    { start: 5, end: 6, type: "server", name: "SRV-STOR-01", model: "Dell PowerEdge R750", serial: "SVC-R750-6610", ip: "10.10.4.60", power: "320 W", back: "2x PSU · 2x 10GbE", tags: ["production", "storage"] },
    { start: 7, end: 8, type: "server", name: "SRV-CLOUD-02", model: "Dell PowerEdge R750", serial: "SVC-R750-6620", ip: "10.10.4.61", power: "280 W", back: "2x PSU · 2x 10GbE", tags: ["production", "cloud"] },
    { start: 9, end: 10, type: "server", name: "SRV-COMP-03", model: "Dell PowerEdge R750", serial: "SVC-R750-6630", ip: "10.10.4.62", power: "410 W", back: "2x PSU · 2x 10GbE", tags: ["production", "compute"] },
    { start: 11, end: 42, type: "blank" },
  ],
  "R3-C05": [
    { start: 1, end: 1, type: "switch", name: "SW-DIST-02", model: "Cisco Catalyst 9300-24P", serial: "SW-CAT-9300-330", ip: "10.10.0.30", power: "85 W", back: "24x RJ45 + 4x SFP+", tags: ["production", "network-dist"] },
    { start: 2, end: 2, type: "server", name: "SRV-EDGE-11", model: "Dell PowerEdge R650", serial: "SVC-R650-6711", ip: "10.10.4.70", power: "190 W", back: "2x PSU · 2x 10GbE", tags: ["edge", "site"] },
    { start: 3, end: 3, type: "server", name: "SRV-EDGE-12", model: "Dell PowerEdge R650", serial: "SVC-R650-6712", ip: "10.10.4.71", power: "190 W", back: "2x PSU · 2x 10GbE", tags: ["edge", "site"] },
    { start: 4, end: 4, type: "blank" },
    { start: 5, end: 5, type: "pdu", name: "PDU-C", model: "Raritan PX2-1000", serial: "PDU-RAR-PX2-118", ip: "10.10.9.3", power: "—", capacity: 8, draw: 1.8, phases: "1-phase, 230V", back: "Input C20 · 8 outlet", tags: ["production", "power"] },
    { start: 6, end: 42, type: "blank" },
  ],
  "R4-A01": [
    { start: 1, end: 1, type: "switch", name: "SW-LAB-05", model: "Cisco Catalyst 2960-X", serial: "SW-CAT-2960-440", ip: "10.10.0.105", power: "60 W", back: "24x RJ45 + 2x SFP", tags: ["lab"] },
    { start: 2, end: 2, type: "server", name: "SRV-LAB-02", model: "Dell PowerEdge R650", serial: "SVC-R650-6802", ip: "10.10.4.80", power: "220 W", back: "2x PSU · 2x 10GbE", tags: ["lab"] },
    { start: 3, end: 3, type: "server", name: "SRV-TEST-01-01", model: "Dell PowerEdge R650", serial: "SVC-R650-4403", ip: "10.10.4.81", power: "180 W", back: "2x PSU · 2x 10GbE", tags: ["lab", "test"] },
    { start: 4, end: 9, type: "blank" },
    { start: 12, end: 12, type: "pdu", name: "PDU-DC4-E01", model: "APC AP8858", serial: "PDU-APC-8858-19", ip: "10.10.9.41", power: "—", capacity: 12, draw: 2.1, phases: "1-phase, 230V", back: "Input C20 · 12 outlet", tags: ["production", "power"] },
    { start: 13, end: 42, type: "blank" },
  ],
};

// ---- tinggi rack server (ukuran U) yang bisa dipilih saat tambah rack ----
const RACK_HEIGHTS = [24, 27, 32, 36, 42, 45, 47, 48, 52, 54];

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

// ---- Sinkronisasi registri rack ke SQLite (sekali per browser) ----
// Push RACKS statis (base + EXTRA) ke tabel `racks` bila ada rackId yang
// belum tercatat di SQLite, supaya DB menjadi sumber kebenaran (source of truth)
// untuk rackId/site/status dan tidak ada hardcode yang terlewat.
function apiSyncRacks(racks) {
  return apiRequest("POST", "/racks/sync", { racks });
}

function syncRacksToDb() {
  const GUARD_KEY = "rv_racks_synced_v1";
  try { if (localStorage.getItem(GUARD_KEY)) return; } catch (e) {}
  if (typeof apiGetRacks !== "function" || typeof apiSyncRacks !== "function") return;
  const db = apiGetRacks();
  if (!db) return;
  const inDb = {};
  db.forEach(r => { if (r && r.rackId) inDb[String(r.rackId).trim().toUpperCase()] = 1; });
  const missing = RACKS.filter(r => r && r.rackId && !inDb[String(r.rackId).trim().toUpperCase()]);
  let ok = true;
  if (missing.length) {
    const res = apiSyncRacks(missing);
    ok = !!res && res.ok;
  }
  if (ok) try { localStorage.setItem(GUARD_KEY, "1"); } catch (e) {}
}
try { syncRacksToDb(); } catch (e) { /* abaikan */ }

// Merge DB → RACKS. Bila DB punya rack dengan rackId sama, baris DB MENIMPA
// nilai hardcoded (status/site/zone/loc dari SQLite adalah otoritatif).
getCustomRacks().forEach(r => {
  if (!r || !r.rackId) return;
  const id = String(r.rackId).trim().toUpperCase();
  const i = RACKS.findIndex(x => String(x.rackId || "").trim().toUpperCase() === id);
  if (i >= 0) RACKS[i] = { ...RACKS[i], ...r };
  else RACKS.push(r);
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

// ---- Sinkronisasi lokasi device ke backend (sekali per browser) ----
// Push penempatan RACK_LAYOUTS statis → tabel devices (site + rackId).
// Device virtual (SRV-<rack>-NN dari custom racks) tidak didaftarkan.
// Dijalankan sekali saja (guard via localStorage) supaya tidak heavy di load berikutnya.
function syncDeviceLocations() {
  const GUARD_KEY = "rv_devloc_synced_v2";
  try { if (localStorage.getItem(GUARD_KEY)) return; } catch (e) {}
  const batch = [];
  RACKS.forEach(rack => {
    const site = rack.site;
    if (!site) return;
    const layout = RACK_LAYOUTS[rack.rackId];
    if (!layout) return;
    layout.forEach(dev => {
      if (!dev || !dev.name || dev.type === "blank") return;
      batch.push({ deviceKey: dev.name, type: dev.type, site, rackId: rack.rackId });
    });
  });
  if (batch.length && typeof apiSaveDeviceLocations === "function") {
    const res = apiSaveDeviceLocations(batch);
    if (res && res.ok) try { localStorage.setItem(GUARD_KEY, "1"); } catch (e) {}
  }
}
try { syncDeviceLocations(); } catch (e) { /* abaikan */ }
