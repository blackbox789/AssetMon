
const overlay = document.getElementById("modal-overlay");

// Tabel asset = tbody PERTAMA yang TIDAK punya id (halaman asset/firewall/router/dll).
// Halaman dengan tabel khusus (mis. #storage-tbody di storage-list.html) dilewati,
// supaya baris/listener asset tidak nyasar ke tabel storage.
function assetTableBody() {
  const all = document.querySelectorAll("tbody");
  for (const t of all) {
    if (t.id) continue;
    if (t.hasAttribute("data-node-tbody") || t.hasAttribute("data-ctl-tbody")) continue;
    if (t.closest(".modal, .modal-overlay")) continue;
    return t;
  }
  return null;
}
const openAddAssetBtn = document.getElementById("open-add-asset");
// Preselect tipe asset sesuai halaman (filter-type): menu Switch -> Network Switch, dst.
function preselectAssetTypeFromFilter() {
  const title = document.querySelector("#modal-overlay .modal-title");
  if (!assetTypeSelect || !filterType) { if (title) title.textContent = pageTypeScope() ? "Tambah Aksesoris" : "Add Asset"; return; }
  const typeKey = String(filterType.value || "").toLowerCase();
  const opt = TYPE_TO_OPTION[typeKey];
  if (!opt) {
    if (title) title.textContent = pageTypeScope() ? "Tambah Aksesoris" : "Add Asset";
    return;
  }
  assetTypeSelect.value = opt;
  assetTypeSelect.dispatchEvent(new Event("change"));
  if (title) title.textContent = "Tambah " + opt;
}
if (openAddAssetBtn) {
  openAddAssetBtn.addEventListener("click", () => {
    if (openAddAssetBtn.dataset.storageAdd != null) return;
    preselectAssetTypeFromFilter();
    overlay.classList.add("open");
  });
}
const closeAddAssetBtn = document.getElementById("close-add-asset");
if (closeAddAssetBtn) closeAddAssetBtn.addEventListener("click", () => { overlay.classList.remove("open"); resetAddModal(); });
const cancelAddAssetBtn = document.getElementById("cancel-add-asset");
if (cancelAddAssetBtn) cancelAddAssetBtn.addEventListener("click", () => { overlay.classList.remove("open"); resetAddModal(); });
if (overlay) overlay.addEventListener("click", e => { if (e.target === overlay) { overlay.classList.remove("open"); resetAddModal(); } });
const tagPickerEl = document.getElementById("tag-picker");
if (tagPickerEl) {
  tagPickerEl.addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (!chip || chip.dataset.addChip) return;
    chip.classList.toggle("active");
  });
}

// ---- PDU outlet count field: show only when Tipe Asset = PDU ----
// ---- Custom category input: show only when Tipe Asset = Custom ----
const assetTypeSelect = document.getElementById("asset-type-select");
const pduOutletField = document.getElementById("pdu-outlet-field");
const outletCustomInput = document.getElementById("outlet-custom-input");
const assetTypeCustomInput = document.getElementById("asset-type-custom");

function toggleOutletField() {
  pduOutletField.style.display = assetTypeSelect.value === "PDU" ? "" : "none";
  assetTypeCustomInput.style.display = assetTypeSelect.value === "Custom" ? "" : "none";
  if (assetTypeSelect.value === "Custom") assetTypeCustomInput.focus();
}
assetTypeSelect.addEventListener("change", toggleOutletField);
toggleOutletField();

// ---- Server: tampilkan form Identitas Perangkat saat Tipe Asset = Server ----
const serverSection = document.getElementById("server-section");
function toggleServerSection() {
  serverSection.style.display = assetTypeSelect.value === "Server" ? "" : "none";
}
assetTypeSelect.addEventListener("change", toggleServerSection);
toggleServerSection();

// ---- Network Switch: brand/model manual + Jenis Switch saat Tipe Asset = Switch ----
const TYPE_TO_OPTION = {
  server: "Server", switch: "Switch", pdu: "PDU", firewall: "Firewall",
  router: "Router", ids: "IDS/IPS", lb: "Load Balancer", patch: "Patch Panel", ups: "UPS", storage: "Storage",
  "kvm-switch": "KVM Switch", "cable-management": "Cable Management",
  "cooling-fan": "Cooling Fan", "blanking-panel": "Blanking Panel",
  "monitoring-sensor": "Monitoring Sensor", custom: "Custom"
};
const OPTION_TO_TYPE = Object.fromEntries(Object.entries(TYPE_TO_OPTION).map(([k, v]) => [v, k]));
const TYPE_LABELS = {
  server: "Server", switch: "Network Switch", pdu: "Rack PDU", firewall: "Firewall",
  router: "Router", ids: "IDS/IPS", lb: "Load Balancer", patch: "Patch Panel", ups: "UPS", storage: "Storage",
  "kvm-switch": "KVM Switch", "cable-management": "Cable Management",
  "cooling-fan": "Cooling Fan", "blanking-panel": "Blanking Panel",
  "monitoring-sensor": "Monitoring Sensor", custom: "Custom"
};
const switchTypeField = document.getElementById("switch-type-field");
const switchTypeSel = document.getElementById("switch-type");
const brandManual = document.getElementById("brand-manual");
const modelManual = document.getElementById("model-manual");
const brandSelectEl = document.querySelector('[data-vendor-select]');
const modelSelectEl = document.querySelector('[data-sf="model"]');
const vendorOtherEl = document.querySelector('[data-vendor-other]');

function toggleSwitchFields() {
  const isSwitch = assetTypeSelect.value === "Switch";
  if (switchTypeField) switchTypeField.style.display = isSwitch ? "" : "none";
  if (brandManual) brandManual.style.display = isSwitch ? "" : "none";
  if (modelManual) modelManual.style.display = isSwitch ? "" : "none";
  if (brandSelectEl) brandSelectEl.style.display = isSwitch ? "none" : "";
  if (modelSelectEl) modelSelectEl.style.display = isSwitch ? "none" : "";
  if (vendorOtherEl) vendorOtherEl.style.display = "none";
  if (isSwitch && switchTypeSel) switchTypeSel.focus();
}
assetTypeSelect.addEventListener("change", toggleSwitchFields);
toggleSwitchFields();

// ---- Network Device (Switch/Firewall/Router/IDS-IPS/LB): field record + bagian form ----
const NETWORK_TYPES = ["switch", "firewall", "router", "ids", "lb"];
const NF_SELECT_DEFAULTS = { speed: "10G", stacking: "Tidak", powerRedundancy: "Redundant", haMode: "Standalone", stackRole: "" };
const NF_LABELS = {
  lanRj45: "Port RJ-45", lanSfp: "Port SFP", lanQsfp: "Port QSFP",
  speed: "Kecepatan Port", os: "Firmware / OS", role: "Peran / Segmentasi",
  vlan: "VLAN / Segment", throughput: "Throughput", maxConnections: "Max Sessions",
  vpnTunnels: "VPN Tunnels", gwRedundancy: "Redundansi Gateway", haMode: "High Availability", routingProtocol: "Routing Protocol",
  license: "Lisensi / Langganan", licenseExpiry: "Lisensi s.d.", haPeer: "Peer HA",
  idsMode: "Mode Deteksi", deployMode: "Metode Deploy", failOpen: "Fail-Safe", ruleset: "Ruleset / Signature",
  lbMode: "Mode Operasi", lbAlgorithm: "Algoritma Balancing", sslOffload: "SSL Offload", persistence: "Session Persistence",
  upsVA: "Kapasitas VA", upsWatt: "Kapasitas Watt", upsTopology: "Topologi", upsOutlets: "Jumlah / Tipe Outlet",
  upsRuntime: "Runtime", batteryReplaced: "Baterai Diganti", mgmtCard: "Kartu Manajemen",
  wanPorts: "WAN Port", stacking: "Stacking", stackRole: "Stack Role",
  psuCount: "PSU", psuWatt: "Watt", powerRedundancy: "Power Redundancy",
  tahunPembelian: "Tahun Pembelian", warranty: "Warranty", monitoring: "Monitoring",
};
const ASSET_PORT_MAP_TYPES = ["switch", "server", "firewall", "router", "ids", "lb", "patch", "ups", "storage"];
// Opsi Peran/Segmentasi per tipe (selaras baris layer Network Topology utk switch)
const ROLE_OPTIONS = {
  switch: ["Core", "Distribution", "Access", "Management"],
  router: ["WAN", "Gateway", "Core", "Branch", "Internal"],
  firewall: ["Edge", "Internal", "HA-Primary", "HA-Secondary"],
  ids: ["Edge", "Internal"],
  lb: ["Edge", "Internal"]
};
const networkSection = document.getElementById("network-section");
const upsSection = document.getElementById("ups-section");
function nfContainers() { return [networkSection, upsSection].filter(Boolean); }

function toggleNetworkSection() {
  const typeKey = OPTION_TO_TYPE[assetTypeSelect.value] || "";
  const isNet = NETWORK_TYPES.includes(typeKey);
  if (networkSection) networkSection.style.display = isNet ? "" : "none";
  if (upsSection) upsSection.style.display = typeKey === "ups" ? "" : "none";
  document.querySelectorAll("[data-nf-switch-only]").forEach(el => { el.style.display = typeKey === "switch" ? "" : "none"; });
  document.querySelectorAll("[data-nf-fw-only]").forEach(el => { el.style.display = typeKey === "firewall" ? "" : "none"; });
  document.querySelectorAll("[data-nf-router-only]").forEach(el => { el.style.display = typeKey === "router" ? "" : "none"; });
  document.querySelectorAll("[data-nf-ids-only]").forEach(el => { el.style.display = typeKey === "ids" ? "" : "none"; });
  document.querySelectorAll("[data-nf-lb-only]").forEach(el => { el.style.display = typeKey === "lb" ? "" : "none"; });
  // rebuild opsi Peran sesuai tipe; nilai non-standar yang sedang terpilih dipertahankan sbg opsi ekstra
  const roleSel = networkSection ? networkSection.querySelector('[data-nf="role"]') : null;
  if (roleSel && ROLE_OPTIONS[typeKey]) {
    const std = ROLE_OPTIONS[typeKey];
    const prev = roleSel.value;
    const extras = [...roleSel.options].map(o => o.value).filter(v => v && !std.includes(v));
    roleSel.innerHTML = '<option value="">— Pilih peran —</option>'
      + std.map(o => `<option>${o}</option>`).join("")
      + extras.map(e => `<option value="${escA(e)}">${escA(e)}</option>`).join("");
    if ([...roleSel.options].some(o => o.value === prev)) roleSel.value = prev;
  }
  if (isNet && networkSection) networkSection.scrollIntoView({ behavior: "smooth", block: "center" });
}
assetTypeSelect.addEventListener("change", toggleNetworkSection);
toggleNetworkSection();

// ---- Scope tipe per halaman (window.ASSET_TYPES_SCOPE) ----
// Halaman yang mendeklarasikan scope hanya menampilkan/menerima tipe di dalamnya;
// opsi di luar scope dinonaktifkan (abu-abu) di dropdown Tipe Asset.
function pageTypeScope() {
  const s = window.ASSET_TYPES_SCOPE;
  return Array.isArray(s) && s.length ? s.map(x => String(x).toLowerCase()) : null;
}
function applyModalTypeScope() {
  const scope = pageTypeScope();
  if (!scope || !assetTypeSelect) return;
  [...assetTypeSelect.options].forEach(o => {
    const key = OPTION_TO_TYPE[o.value] || "";
    o.disabled = Boolean(key) && !scope.includes(key); // Custom tanpa key selalu boleh
  });
  const sel = assetTypeSelect.selectedOptions && assetTypeSelect.selectedOptions[0];
  if (sel && sel.disabled) {
    const firstEnabled = [...assetTypeSelect.options].find(o => !o.disabled);
    if (firstEnabled) {
      assetTypeSelect.value = firstEnabled.value;
      assetTypeSelect.dispatchEvent(new Event("change"));
    }
  }
}
applyModalTypeScope();

function collectNetworkFields() {
  const typeKey = OPTION_TO_TYPE[assetTypeSelect.value] || "";
  if (!NETWORK_TYPES.includes(typeKey) && typeKey !== "ups") return {};
  const out = {};
  nfContainers().forEach(sec => {
    sec.querySelectorAll("[data-nf]").forEach(el => {
      const v = (el.value || "").trim();
      if (v) out[el.dataset.nf] = v;
    });
  });
  return out;
}

function networkPortCount(f) {
  const n = x => parseInt(x, 10) || 0;
  return n(f.lanRj45) + n(f.lanSfp) + n(f.lanQsfp) * 4;
}
function networkSfpCount(f) {
  const n = x => parseInt(x, 10) || 0;
  return n(f.lanSfp) + n(f.lanQsfp) * 4;
}
function hasNetworkPorts(f) {
  return Boolean(f && (f.lanRj45 || f.lanSfp || f.lanQsfp));
}

// Pertahankan port spesial kustom saat Port Data ditulis ulang (save/edit),
// supaya definisi tambahan user (mis. UPLINK/AUX) tidak ter-reset ke default.
function preserveSpecialPorts(name) {
  const prev = typeof PORT_DATA !== "undefined" ? PORT_DATA[name] : null;
  return prev && Array.isArray(prev.specials) ? prev.specials.map(s => ({ ...s })) : undefined;
}

// ---- Foto perangkat (Rack Elevation) di Ringkasan Identitas ----
// Rantai kandidat sama dengan rack-elevation: image record -> data/uploads -> img/devices.
const ASSET_IMG_EXT = ["png", "jpg", "jpeg", "webp"];
function assetDevImgCandidates(name, type, image, view) {
  const cands = [];
  if (image && image[view]) cands.push(image[view]);
  const slug = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (slug) ASSET_IMG_EXT.forEach(e => {
    cands.push(`data/uploads/devices/${slug}-${view}.${e}`);
    cands.push(`img/devices/${slug}-${view}.${e}`);
  });
  const t = String(type || "").toLowerCase();
  if (t) ASSET_IMG_EXT.forEach(e => cands.push(`img/devices/${t}-${view}.${e}`));
  return [...new Set(cands)];
}
function assetDevImgProbe(imgEl, name, type, image, view) {
  const cands = assetDevImgCandidates(name, type, image, view);
  let i = 0;
  imgEl.onerror = () => { if (i < cands.length) imgEl.src = cands[i++]; };
  imgEl.onload = () => {
    imgEl.style.display = "";
    imgEl.style.cursor = "zoom-in";
    imgEl.title = "Klik untuk perbesar";
    imgEl.onclick = () => window.open(imgEl.src, "_blank", "noopener");
    const cap = document.querySelector(`[data-devsum-cap="${view}"]`);
    if (cap) cap.textContent = "Tampak " + (view === "front" ? "depan" : "belakang");
  };
  if (cands.length) imgEl.src = cands[i++];
}

function networkSpecSummary(rec) {
  if (!rec) return "—";
  const n = x => parseInt(x, 10) || 0;
  const ports = [];
  if (n(rec.lanRj45)) ports.push(n(rec.lanRj45) + " RJ45");
  if (n(rec.lanSfp)) ports.push(n(rec.lanSfp) + " SFP");
  if (n(rec.lanQsfp)) ports.push(n(rec.lanQsfp) + " QSFP");
  const parts = [];
  if (ports.length) parts.push(ports.join(" · "));
  if (rec.speed) parts.push(rec.speed);
  if (rec.throughput) parts.push(rec.throughput);
  if (rec.routingProtocol) parts.push(rec.routingProtocol);
  if (n(rec.vpnTunnels)) parts.push(n(rec.vpnTunnels) + " VPN");
  if (rec.gwRedundancy) parts.push(rec.gwRedundancy);
  if (rec.licenseExpiry) parts.push("Lic " + rec.licenseExpiry);
  if (rec.idsMode) parts.push(rec.idsMode.split(" ")[0]);
  if (rec.lbMode) parts.push("LB-" + rec.lbMode.split(" ")[0]);
  if (rec.upsVA) parts.push(rec.upsVA);
  if (rec.upsTopology) parts.push(rec.upsTopology.split(" ")[0]);
  if (rec.role) parts.push(rec.role);
  if (rec.stacking === "Ya") parts.push("Stack");
  if (rec.haMode && rec.haMode !== "Standalone") parts.push(rec.haMode);
  if (n(rec.wanPorts)) parts.push(n(rec.wanPorts) + " WAN");
  if (n(rec.psuCount)) parts.push(n(rec.psuCount) + " PSU");
  return parts.join(" · ") || "—";
}

// ---- Model: combobox (datalist) per Brand untuk Server/Storage, manual utk tipe lain ----
const MODEL_CATALOG = {
  Dell: ["PowerEdge R750", "PowerEdge R750xd", "PowerEdge R650", "PowerEdge R740"],
  HPE: ["ProLiant DL360", "ProLiant DL380", "ProLiant ML350"],
  Lenovo: ["ThinkSystem BC2500", "ThinkSystem B4800", "ThinkSystem ST50", "ThinkSystem SR650"],
  Cisco: ["UCS C220 M6", "UCS C240 M6"],
  Supermicro: ["SYS-6029U-TR4", "SYS-1029U"],
  IBM: ["Power System S922"],
  Fujitsu: ["Primergy RX2530"],
  Huawei: ["FusionServer 2288H"],
  Inspur: ["NF5280M6"],
  ASUS: ["RS720A-E11"],
  Lainnya: [],
};
const CATALOG_TYPES = ["server", "storage"];
const modelListEl = document.getElementById("model-list");

function currentAssetTypeKey() {
  return OPTION_TO_TYPE[assetTypeSelect.value] || "";
}

function modelSuggestions(brand, typeKey) {
  if (!CATALOG_TYPES.includes(typeKey)) return [];
  const list = (MODEL_CATALOG[brand] || []).slice();
  if (typeof DEFAULT_SERVERS !== "undefined") {
    DEFAULT_SERVERS.forEach(s => {
      if (s.vendor === brand && s.model && !list.includes(s.model)) list.push(s.model);
    });
  }
  return list;
}

function populateModelList() {
  if (!modelListEl) return;
  const brand = brandSelectEl ? brandSelectEl.value : "Dell";
  const typeKey = currentAssetTypeKey();
  modelListEl.innerHTML = modelSuggestions(brand, typeKey)
    .map(m => `<option value="${escA(m)}">`)
    .join("");
  if (modelSelectEl) {
    modelSelectEl.placeholder = CATALOG_TYPES.includes(typeKey)
      ? `Pilih atau ketik model ${brand}…`
      : "Ketik model manual…";
  }
}

if (brandSelectEl) brandSelectEl.addEventListener("change", populateModelList);
assetTypeSelect.addEventListener("change", populateModelList);
populateModelList();

// ---- Network Switch: template Port Map per Jenis Switch + simpan ke localStorage ----
const SWITCH_TEMPLATES = {
  ethernet:   { ports: 24, sfp: 2 },
  san:        { ports: 24, sfp: 0 },
  fc:         { ports: 24, sfp: 0 },
  iscsi:      { ports: 24, sfp: 4 },
  infiniband: { ports: 8,  sfp: 0 },
  nvmeof:     { ports: 8,  sfp: 0 },
};

function readLocalSwitches() {
  try {
    const arr = JSON.parse(localStorage.getItem(SWITCH_STORAGE_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveLocalSwitch(sw) {
  try {
    const list = readLocalSwitches();
    const i = list.findIndex(s => canonKey(s.name) === canonKey(sw.name));
    if (i >= 0) list[i] = sw; else list.unshift(sw);
    localStorage.setItem(SWITCH_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch { return false; }
}

function escA(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function switchTagChips(tags) {
  const list = tags && tags.length ? tags : ["network-access"];
  return list.map(t => `<span class="tag-chip" style="background:color-mix(in srgb, var(--accent) 18%, transparent);color:var(--accent)"><span class="tdot"></span>${escA(t)}</span>`).join("");
}

function switchRowHTML(sw) {
  const brandModel = [sw.brand, sw.model].filter(Boolean).join(" ") || "-";
  return `
    <td><div class="strong">${escA(sw.name)}</div><div class="mono" style="font-size:11px;">${escA(sw.serial || "-")}</div><div style="margin-top:4px;">${switchTagChips(sw.tags)}</div></td>
    <td><span class="type-chip switch"><span class="dot"></span>Network Switch</span></td>
    <td>${escA(sw.rack || "-")}${sw.posisiU ? " · " + escA(sw.posisiU) : ""}</td>
    <td class="mono">${escA(sw.ip || "-")}</td>
    <td>${escA(brandModel)}</td>
    <td class="mono" style="font-size:11px;color:var(--text-secondary);">${escA(networkSpecSummary(sw))}</td>
    <td><span class="badge online"><span class="bdot"></span>Online</span></td>
    <td>Manual</td>`;
}

function addSwitchRow(sw) {
  const tbody = assetTableBody();
  if (!tbody) return;
  const tr = document.createElement("tr");
  tr.setAttribute("data-site", sw.site || "DC1");
  tr.setAttribute("data-type", "switch");
  tr.setAttribute("data-status", "online");
  tr.setAttribute("data-tags", (sw.tags || []).join(","));
  tr.innerHTML = switchRowHTML(sw);
  tbody.insertBefore(tr, tbody.firstChild);
  if (typeof allRows !== "undefined" && allRows) allRows.push(tr);
  assetCurrentPage = 1;
  applyFilters();
}

function collectSwitchAsset() {
  const name = document.getElementById("asset-name").value.trim();
  const type = switchTypeSel ? switchTypeSel.value : "ethernet";
  const brand = brandManual ? brandManual.value.trim() : "";
  const model = modelManual ? modelManual.value.trim() : "";
  const rackSel = document.querySelector('[data-sf="rack"]');
  const rack = rackSel ? rackSel.value : "";
  const posisiU = (document.querySelector('[data-sf="posisiU"]') || {}).value || "";
  const ip = document.getElementById("asset-ip").value.trim();
  const serial = (document.querySelector('[data-sf="serial"]') || {}).value || "";
  const tags = [...document.querySelectorAll("#tag-picker .chip.active")].map(c => c.textContent.trim());
  return { name, type, brand, model, rack, posisiU, ip, serial, tags, site: "DC1", ...collectNetworkFields() };
}

function saveSwitchAsset() {
  const sw = collectSwitchAsset();
  const nameField = document.getElementById("asset-name");
  if (!sw.name) {
    nameField.focus();
    nameField.closest(".m-field").style.outline = "1px solid var(--danger)";
    setTimeout(() => { nameField.closest(".m-field").style.outline = ""; }, 1600);
    return;
  }
  sw.name = canonKey(sw.name);
  if (typeof PORT_DATA !== "undefined") {
    const tpl = SWITCH_TEMPLATES[sw.type] || SWITCH_TEMPLATES.ethernet;
    PORT_DATA[sw.name] = {
      type: "switch",
      switchType: sw.type,
      ports: hasNetworkPorts(sw) ? networkPortCount(sw) : tpl.ports,
      sfp: hasNetworkPorts(sw) ? networkSfpCount(sw) : tpl.sfp,
      rows: [],
      specials: preserveSpecialPorts(sw.name),
    };
    if (typeof savePortMap === "function") savePortMap(sw.name);
  }
  if (typeof apiSaveDevice === "function") apiSaveDevice({ deviceKey: sw.name, type: "switch", name: sw.name, data: sw });
  saveLocalSwitch(sw);
  addSwitchRow(sw);
  overlay.classList.remove("open");
  if (typeof openPortMap === "function") openPortMap(sw.name, false, 0, { type: "switch", formFactor: "" });
}

function renderSavedSwitches() {
  readLocalSwitches().forEach(sw => addSwitchRow(sw));
}


// ---- Asset aksesori (KVM Switch, Patch Panel, Cable Management, Cooling Fan, dll) ----
// Aksesoris rack murni (semantik menu Accessories) vs jalur simpan teknis.
const RACK_ACCESSORY_TYPES = ["kvm-switch", "patch", "cable-management", "cooling-fan", "blanking-panel", "monitoring-sensor"];
const ASSET_SAVE_TYPES = [...RACK_ACCESSORY_TYPES, "firewall", "router", "ids", "lb", "ups", "pdu", "storage", "custom"];

function readLocalAccessories() {
  try {
    const arr = JSON.parse(localStorage.getItem(ACC_STORAGE_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveLocalAccessory(a) {
  try {
    const list = readLocalAccessories();
    const idx = list.findIndex(x => x.name === a.name && x.type === a.type);
    if (idx >= 0) list[idx] = a; else list.unshift(a);
    localStorage.setItem(ACC_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch { return false; }
}

function accessoryRowHTML(a) {
  const brandModel = [a.brand, a.model].filter(Boolean).join(" ") || "-";
  return `
    <td><div class="strong">${escA(a.name)}</div><div class="mono" style="font-size:11px;">${escA(a.serial || "-")}</div><div style="margin-top:4px;">${switchTagChips(a.tags)}</div></td>
    <td><span class="type-chip ${escA(a.type)}"><span class="dot"></span>${escA(TYPE_LABELS[a.type] || a.type)}</span></td>
    <td>${escA(a.rack || "-")}${a.posisiU ? " · " + escA(a.posisiU) : ""}</td>
    <td class="mono">${escA(a.ip || "-")}</td>
    <td>${escA(brandModel)}</td>
    <td class="mono" style="font-size:11px;color:var(--text-secondary);">${escA(networkSpecSummary(a))}</td>
    <td><span class="badge online"><span class="bdot"></span>Online</span></td>
    <td>Manual</td>`;
}

function addAccessoryRow(a) {
  const tbody = assetTableBody();
  if (!tbody) return;
  const tr = document.createElement("tr");
  tr.setAttribute("data-site", a.site || "DC1");
  tr.setAttribute("data-type", a.type);
  tr.setAttribute("data-status", "online");
  tr.setAttribute("data-tags", (a.tags || []).join(","));
  tr.innerHTML = accessoryRowHTML(a);
  tbody.insertBefore(tr, tbody.firstChild);
  if (typeof allRows !== "undefined" && allRows) allRows.push(tr);
  assetCurrentPage = 1;
  applyFilters();
}

function collectAccessoryAsset() {
  const type = OPTION_TO_TYPE[assetTypeSelect.value] || "custom";
  const name = document.getElementById("asset-name").value.trim();
  let brand = "", model = "";
  if (brandSelectEl) brand = brandSelectEl.value;
  if (brand === "Lainnya" && vendorOtherEl) brand = vendorOtherEl.value || "Lainnya";
  if (modelSelectEl) model = modelSelectEl.value;
  const rackSel = document.querySelector('[data-sf="rack"]');
  const rack = rackSel ? rackSel.value : "";
  const posisiU = (document.querySelector('[data-sf="posisiU"]') || {}).value || "";
  const ip = document.getElementById("asset-ip").value.trim();
  const serial = (document.querySelector('[data-sf="serial"]') || {}).value || "";
  const tags = [...document.querySelectorAll("#tag-picker .chip.active")].map(c => c.textContent.trim());
  return { name, type, brand, model, rack, posisiU, ip, serial, tags, site: "DC1", ...collectNetworkFields() };
}

function saveAccessoryAsset() {
  const a = collectAccessoryAsset();
  const nameField = document.getElementById("asset-name");
  if (!a.name) {
    nameField.focus();
    nameField.closest(".m-field").style.outline = "1px solid var(--danger)";
    setTimeout(() => { nameField.closest(".m-field").style.outline = ""; }, 1600);
    return;
  }
  a.name = canonKey(a.name);
  if (["patch", "firewall", "router", "ids", "lb", "ups"].includes(a.type) && typeof PORT_DATA !== "undefined") {
    PORT_DATA[a.name] = {
      type: a.type,
      ports: hasNetworkPorts(a) ? networkPortCount(a) : (a.type === "ups" ? 2 : 24),
      sfp: hasNetworkPorts(a) ? networkSfpCount(a) : 0,
      rows: [],
      specials: preserveSpecialPorts(a.name),
    };
    if (typeof savePortMap === "function") savePortMap(a.name);
  }
  if (a.type === "ups" && typeof POWER_DATA !== "undefined") {
    // UPS sebagai sumber daya: buat Power Map skeleton (jumlah outlet dari form)
    const nOutlet = parseInt(String(a.upsOutlets || "").replace(/[^0-9]/g, " ").trim().split(/\s+/)[0], 10) || 8;
    const prevPower = POWER_DATA[a.name];
    POWER_DATA[a.name] = {
      type: "ups",
      ports: prevPower && prevPower.ports ? prevPower.ports : nOutlet,
      rows: (prevPower && Array.isArray(prevPower.rows)) ? prevPower.rows : [],
    };
    if (typeof savePowerMap === "function") savePowerMap(a.name);
  }
  if (a.type === "pdu" && typeof POWER_DATA !== "undefined") {
    const active = document.querySelector("#outlet-picker .chip.active");
    const custom = outletCustomInput ? parseInt(outletCustomInput.value, 10) : 0;
    const outlets = active && active.dataset.outlet === "custom" ? (custom || 12) : (active ? parseInt(active.dataset.outlet || "12", 10) : 12);
    POWER_DATA[a.name] = { type: "pdu", ports: outlets, rows: [] };
    if (typeof savePowerMap === "function") savePowerMap(a.name);
  }
  saveLocalAccessory(a);
  if ((["switch", "firewall", "router", "ids", "lb"].includes(a.type) || a.type === "ups") && typeof apiSaveDevice === "function") {
    apiSaveDevice({ deviceKey: a.name, type: a.type, name: a.name, data: a });
  }
  addAccessoryRow(a);
  overlay.classList.remove("open");
  resetAddModal();
  if (a.type === "patch" && typeof openPortMap === "function") openPortMap(a.name, false, 0, { type: "patch", formFactor: "" });
  if (a.type === "pdu" && typeof openPowerMap === "function") openPowerMap(a.name);
}

function renderSavedAccessories() {
  const scope = pageTypeScope();
  readLocalAccessories().forEach(a => {
    if (scope && !scope.includes(a.type)) return; // halaman lain yang menampilkan tipe ini
    addAccessoryRow(a);
  });
}


// ---- View / Edit asset dari tabel "Semua Asset" ----
const viewOverlay = document.getElementById("view-overlay");
const viewPmBtn = document.getElementById("view-pm-btn");
const viewPwBtn = document.getElementById("view-pw-btn");
let viewPmName = null;
let viewPmType = null;


function readAssetRow(tr) {
  const cells = tr.querySelectorAll("td");
  const name = (cells[0]?.querySelector(".strong")?.textContent || "").trim();
  const serial = (cells[0]?.querySelector(".mono")?.textContent || "").trim();
  const tags = [...(cells[0]?.querySelectorAll(".tag-chip") || [])].map(c => c.textContent.trim());
  const type = tr.dataset.type || "";
  const rackText = (cells[2]?.textContent || "").trim();
  const [rack = "", posisiU = ""] = rackText.split("·").map(s => s.trim());
  const ip = (cells[3]?.textContent || "").trim();
  const brandModel = (cells[4]?.textContent || "").trim();
  const status = (cells[6]?.textContent || "").trim();
  const source = (cells[7]?.textContent || "").trim();
  return { name, serial, tags, type, rack, posisiU, ip, brandModel, status, source };
}

function deleteAssetRow(tr) {
  const a = readAssetRow(tr);
  const type = a.type || "custom";
  try {
    if (type === "switch") {
      localStorage.setItem(SWITCH_STORAGE_KEY, JSON.stringify(readLocalSwitches().filter(s => s.name !== a.name)));
    } else {
      localStorage.setItem(ACC_STORAGE_KEY, JSON.stringify(readLocalAccessories().filter(x => !(x.name === a.name && x.type === type))));
    }
  } catch (e) { /* abaikan */ }
  [PORT_STORAGE_KEY, POWER_STORAGE_KEY].forEach(storageKey => {
    try {
      const obj = JSON.parse(localStorage.getItem(storageKey) || "{}") || {};
      if (Object.prototype.hasOwnProperty.call(obj, a.name)) {
        delete obj[a.name];
        localStorage.setItem(storageKey, JSON.stringify(obj));
      }
    } catch (e) { /* abaikan */ }
  });
  if (typeof PORT_DATA !== "undefined") delete PORT_DATA[a.name];
  if (typeof POWER_DATA !== "undefined") delete POWER_DATA[a.name];
  if (NETWORK_TYPES.includes(type) || type === "ups") {
    if (typeof apiDeleteDevice === "function") apiDeleteDevice(a.name);
  } else {
    if (typeof apiDeleteMap === "function") apiDeleteMap("port", a.name);
    if (typeof apiDeleteMap === "function") apiDeleteMap("power", a.name);
  }
  tr.remove();
  const i = allRows.indexOf(tr);
  if (i >= 0) allRows.splice(i, 1);
  try {
    const base = typeof API_BASE !== "undefined" ? API_BASE : "/api";
    fetch(base + "/audit/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "device.delete", target: a.name, detail: "Dihapus dari tabel asset (type: " + type + ")" })
    });
  } catch (e) { /* abaikan */ }
  if (typeof showToast === "function") showToast("Asset " + a.name + " berhasil dihapus.", "success");
  if (selectedAssetRow === tr) clearAssetDetail();
  applyFilters();
}

function openViewAsset(tr) {
  const a = readAssetRow(tr);
  let rec = null;
  try {
    rec = a.type === "switch"
      ? readLocalSwitches().find(s => s.name === a.name) || null
      : readLocalAccessories().find(x => x.name === a.name) || null;
  } catch (e) { /* abaikan */ }
  viewPmName = a.name;
  viewPmType = a.type;
  document.getElementById("view-title").textContent = a.name;
  document.getElementById("view-sub").textContent = `${TYPE_LABELS[a.type] || a.type || "Asset"} · ${a.brandModel || "—"}`;
  const isPdu = a.type === "pdu";
  viewPmBtn.style.display = !isPdu && ASSET_PORT_MAP_TYPES.includes(a.type) ? "" : "none";
  viewPmBtn.innerHTML = '<i class="fa-solid fa-ethernet"></i> Port Map';
  if (viewPwBtn) {
    viewPwBtn.style.display = "";
    viewPwBtn.innerHTML = '<i class="fa-solid fa-plug"></i> Power Map';
  }
  const netItems = Object.keys(NF_LABELS)
    .map(f => ({ f, v: rec ? rec[f] : null }))
    .filter(x => x.v != null && String(x.v) !== "");
  const netHtml = netItems.length
    ? '<div style="border-top:1px solid var(--border-soft);margin-top:14px;padding-top:14px;"><div style="font-size:11.5px;font-weight:600;color:var(--accent-text);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;"><i class="fa-solid fa-diagram-project"></i> Spesifikasi Network Device</div><div class="field-grid">' +
      netItems.map(x => '<div class="field-item"><div class="k">' + escA(NF_LABELS[x.f]) + '</div><div class="v">' + escA(x.v) + '</div></div>').join("") +
      '</div></div>'
    : "";
  document.getElementById("view-body").innerHTML = `
    <div class="field-grid">
      <div class="field-item"><div class="k">Tipe</div><div class="v">${escA(TYPE_LABELS[a.type] || a.type || "—")}</div></div>
      <div class="field-item"><div class="k">Rack / Posisi</div><div class="v">${escA(a.rack || "—")}${a.posisiU ? " · " + escA(a.posisiU) : ""}</div></div>
      <div class="field-item"><div class="k">IP Address</div><div class="v">${escA(a.ip || "—")}</div></div>
      <div class="field-item"><div class="k">Brand / Model</div><div class="v">${escA(a.brandModel || "—")}</div></div>
      <div class="field-item"><div class="k">Serial Number</div><div class="v">${escA(a.serial || "—")}</div></div>
      <div class="field-item"><div class="k">Status</div><div class="v">${escA(a.status || "—")}</div></div>
      <div class="field-item"><div class="k">Discovery Source</div><div class="v">${escA(a.source || "—")}</div></div>
      <div class="field-item"><div class="k">Tags</div><div class="v">${a.tags.length ? a.tags.map(t => `<span class="tag-chip" style="background:color-mix(in srgb, var(--accent) 18%, transparent);color:var(--accent)"><span class="tdot"></span>${escA(t)}</span>`).join(" ") : "—"}</div></div>
    </div>${netHtml}`;
  viewOverlay.classList.add("open");
}

function closeView() {
  viewOverlay.classList.remove("open");
  viewPmName = null;
}

document.getElementById("view-close").addEventListener("click", closeView);
viewOverlay.addEventListener("click", e => { if (e.target === viewOverlay) closeView(); });
viewPmBtn.addEventListener("click", () => {
  const n = viewPmName, t = viewPmType;
  closeView();
  if (!n) return;
  if (typeof openPortMap === "function") openPortMap(n, false, 0, { type: t || "server", formFactor: "" });
});
if (viewPwBtn) viewPwBtn.addEventListener("click", () => {
  const n = viewPmName;
  closeView();
  if (n && typeof openPowerMap === "function") openPowerMap(n);
});

// ---- Ringkasan Identitas Perangkat: panel detail di bawah tabel (ala server-list.html) ----
let selectedAssetRow = null;

function assetSummaryKvRow(label, value) {
  if (value == null || String(value).trim() === "") return "";
  return `<div class="kv-row"><span class="kv-label">${escA(label)}</span><span class="kv-value">${escA(value)}</span></div>`;
}

function assetSummaryGroup(title, rowsHtml) {
  if (!rowsHtml.trim()) return "";
  return `<div class="kv-group"><div class="kv-group-title">${escA(title)}</div>${rowsHtml}</div>`;
}

function assetSummaryChip(text, accent) {
  const style = accent
    ? "background:color-mix(in srgb, var(--accent) 18%, transparent);color:var(--accent)"
    : "background:var(--bg-surface-3);color:var(--text-secondary)";
  return `<span class="tag-chip" style="${style}"><span class="tdot"></span>${escA(text)}</span>`;
}

function assetSummaryMapLink(rec, type) {
  const name = (rec && rec.name) || "";
  if (!name) return "";
  const buttons = [];
  if (typeof openPowerMap === "function") {
    const psu = Math.max(1, parseInt(rec.psuCount, 10) || 2);
    buttons.push(`<button type="button" class="srv-map-link" onclick="openPowerMap('${escA(name)}', false, ${psu});return false;">Buka Power Map <i class="fa-solid fa-plug"></i></button>`);
  }
  if (ASSET_PORT_MAP_TYPES.includes(type) && typeof openPortMap === "function") {
    buttons.push(`<button type="button" class="srv-map-link" onclick="openPortMap('${escA(name)}', false, 0, { type: '${escA(type)}', formFactor: '' });return false;">Buka Port Map <i class="fa-solid fa-ethernet"></i></button>`);
  }
  return buttons.join("");
}

const PURCHASE_FIELDS = ["tahunPembelian", "warranty", "monitoring"];

function assetLivePowerData(name) {
  const out = [];
  if (!name || typeof POWER_DATA === "undefined") return out;
  Object.keys(POWER_DATA).forEach(k => {
    (POWER_DATA[k].rows || []).forEach(r => {
      if (r && r.device === name) out.push({ pdu: k, psu: r.psu, watt: r.watt, label: r.label });
    });
  });
  return out;
}

function buildAssetSummaryHTML(rec, tr) {
  const rowInfo = tr ? readAssetRow(tr) : {};
  const src = Object.assign({}, rowInfo, rec || {});
  const type = src.type || "";
  const name = src.name || "";
  const brandModel = [src.brand, src.model].filter(Boolean).join(" ") || src.brandModel || "";
  const header = `
    <div class="srv-detail-head">
      <div class="strong" style="font-size:14px;">${escA(name)}</div>
      <div class="srv-meta-row" style="margin-top:6px;">
        ${assetSummaryChip(TYPE_LABELS[type] || "Asset", true)}
        ${brandModel ? assetSummaryChip(brandModel) : ""}
        ${(src.tags || []).map(t => assetSummaryChip(t)).join("")}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        ${["front", "back"].map(v => `
        <figure style="margin:0;flex:1;min-width:0;">
          <img data-devsum-img="${v}" alt="Tampak ${v === "front" ? "depan" : "belakang"}" style="display:none;width:100%;height:64px;object-fit:cover;border:1px solid var(--border);border-radius:8px;background:var(--bg-surface-3);">
          <figcaption class="form-hint" data-devsum-cap="${v}" style="margin-top:3px;">Belum ada foto tampak ${v === "front" ? "depan" : "belakang"}</figcaption>
        </figure>`).join("")}
      </div>
    </div>`;
  const identityRows =
    assetSummaryKvRow("Tipe", TYPE_LABELS[type] || type || "") +
    assetSummaryKvRow("Brand / Model", brandModel) +
    assetSummaryKvRow("Rack", src.rack) +
    assetSummaryKvRow("Posisi U", src.posisiU) +
    assetSummaryKvRow("IP Address", src.ip) +
    assetSummaryKvRow("Serial Number", src.serial) +
    assetSummaryKvRow("Site", src.site);
  const livePower = assetLivePowerData(name);
  const netRows = Object.keys(NF_LABELS)
    .filter(f => !PURCHASE_FIELDS.includes(f))
    .map(f => {
      if (f === "psuCount" && livePower.length) return assetSummaryKvRow("PSU", String(livePower.length));
      if (f === "psuWatt" && livePower.length) {
        const parts = livePower.map(r => `${r.psu} ${r.watt} W`);
        const total = livePower.reduce((s, r) => s + r.watt, 0);
        return assetSummaryKvRow("Watt", parts.join(" · ") + ` · Total ${total} W`);
      }
      const v = src[f];
      if (v == null || String(v) === "") return "";
      return assetSummaryKvRow(NF_LABELS[f], v);
    })
    .join("");
  const purchaseRows = PURCHASE_FIELDS
    .map(f => ({ f, v: src[f] }))
    .filter(x => x.v != null && String(x.v) !== "")
    .map(x => assetSummaryKvRow(NF_LABELS[x.f], x.v))
    .join("");
  const pmData = typeof PORT_DATA !== "undefined" ? PORT_DATA[name] : null;
  const specialList = pmData && Array.isArray(pmData.specials) ? pmData.specials.filter(Boolean) : [];
  const specialRows = specialList.length
    ? assetSummaryKvRow("Port Spesial", specialList.map(s => s.label || s.key).join(" · "))
    : "";
  return header +
    assetSummaryGroup("Identitas", identityRows) +
    assetSummaryGroup("Network & Daya", netRows + specialRows) +
    assetSummaryGroup("Pembelian", purchaseRows) +
    assetSummaryGroup("Pemetaan", assetSummaryMapLink(src, type));
}

function renderAssetDetail(tr) {
  if (selectedAssetRow) selectedAssetRow.classList.remove("row-selected");
  selectedAssetRow = tr;
  tr.classList.add("row-selected");
  const name = (tr.querySelector(".strong")?.textContent || "").trim();
  const type = tr.dataset.type || "";
  let rec = null;
  try {
    rec = type === "switch"
      ? readLocalSwitches().find(s => s.name === name) || null
      : readLocalAccessories().find(x => x.name === name) || null;
  } catch (e) { /* abaikan */ }
  const body = document.getElementById("asset-detail-body");
  if (body) body.innerHTML = buildAssetSummaryHTML(rec, tr);
  if (body) body.querySelectorAll("[data-devsum-img]").forEach(img => {
    const view = img.dataset.devsumImg;
    assetDevImgProbe(img, name, type, rec && rec.image, view);
  });
  const closeBtn = document.getElementById("asset-detail-close");
  if (closeBtn) closeBtn.style.display = "";
  const panel = document.getElementById("asset-detail");
  if (panel) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  updateAssetCtxBar(tr);
}

// ---- Contextual action bar (paritas dengan menu Server & Storage) ----
function assetCtxGoLocation(name, rack) {
  if (!rack) return;
  window.location.href = "rack-elevation.html?rack=" + encodeURIComponent(rack) + "&device=" + encodeURIComponent(name);
}

function buildAssetCtxBarHTML(a, rec) {
  const name = escA(a.name || "");
  const canPort = a.type !== "pdu" && ASSET_PORT_MAP_TYPES.includes(a.type);
  const locBtn = a.rack
    ? `<button type="button" class="ctx-btn" title="Lokasi di Rack Elevation" data-ctx-act="loc"><i class="fa-solid fa-location-dot"></i> Lokasi</button>`
    : `<button type="button" class="ctx-btn" title="Asset belum ditempatkan di rack" data-ctx-act="loc" disabled><i class="fa-solid fa-location-dot"></i> Lokasi</button>`;
  return `<div class="ctx-bar-info"><i class="fa-solid fa-caret-right"></i> <b>${name}</b></div>
    <div class="ctx-bar-actions">
      <button type="button" class="ctx-btn" title="Lihat ringkasan" data-ctx-act="view"><i class="fa-solid fa-eye"></i> Lihat</button>
      <button type="button" class="ctx-btn" title="Edit asset" data-ctx-act="edit"><i class="fa-solid fa-pen"></i> Edit</button>
      ${canPort ? `<button type="button" class="ctx-btn" title="Buka Port Map" data-ctx-act="port"><i class="fa-solid fa-ethernet"></i> Port Map</button>` : ""}
      <button type="button" class="ctx-btn" title="Buka Power Map" data-ctx-act="power"><i class="fa-solid fa-plug"></i> Power Map</button>
      ${locBtn}
      <button type="button" class="ctx-btn danger" title="Hapus asset" data-ctx-act="delete"><i class="fa-solid fa-trash"></i> Hapus</button>
      <button type="button" class="ctx-btn" title="Tutup" data-ctx-act="close"><i class="fa-solid fa-xmark"></i></button>
    </div>`;
}

function updateAssetCtxBar(tr) {
  const bar = document.getElementById("asset-ctx-bar");
  if (!bar) return;
  if (!tr || !tr.isConnected) { bar.hidden = true; bar.innerHTML = ""; return; }
  const a = readAssetRow(tr);
  let rec = null;
  try {
    rec = a.type === "switch"
      ? readLocalSwitches().find(s => s.name === a.name) || null
      : readLocalAccessories().find(x => x.name === a.name) || null;
  } catch (e) { /* abaikan */ }
  bar.hidden = false;
  bar.innerHTML = buildAssetCtxBarHTML(a, rec);
  bar.onclick = e => {
    const actBtn = e.target.closest("[data-ctx-act]");
    if (!actBtn) return;
    const act = actBtn.dataset.ctxAct;
    const row = selectedAssetRow && selectedAssetRow.isConnected ? selectedAssetRow : null;
    if (!row) { bar.hidden = true; return; }
    const info = readAssetRow(row);
    const psu = Math.max(1, parseInt((rec && rec.psuCount) || info.psuCount, 10) || 2);
    if (act === "close") { clearAssetDetail(); return; }
    if (act === "view") { openViewAsset(row); return; }
    if (act === "edit") { openEditAsset(row); return; }
    if (act === "port") {
      if (info.type === "pdu" && typeof openPowerMap === "function") openPowerMap(info.name);
      else if (typeof openPortMap === "function") openPortMap(info.name, false, 0, { type: info.type, formFactor: "" });
      return;
    }
    if (act === "power") {
      if (typeof openPowerMap === "function") openPowerMap(info.name, false, psu);
      return;
    }
    if (act === "loc") { assetCtxGoLocation(info.name, info.rack); return; }
    if (act === "delete") {
      const doubleOk = typeof window.confirmDoubleDelete === "function"
        ? window.confirmDoubleDelete(info.name)
        : (confirm(`Hapus ${info.name}?`) && confirm("Yakin ingin menghapus permanen? Data yang dihapus tidak dapat dikembalikan."));
      if (doubleOk) deleteAssetRow(row);
      return;
    }
  };
}

function refreshAssetRow(deviceKey) {
  if (!deviceKey) return;
  const tb = assetTableBody();
  if (!tb) return;
  tb.querySelectorAll("tr").forEach(tr => {
    const name = (tr.querySelector(".strong")?.textContent || "").trim();
    if (name !== deviceKey) return;
    const type = tr.dataset.type || "";
    const rec = type === "switch"
      ? (typeof readLocalSwitches === "function" ? readLocalSwitches().find(s => s.name === deviceKey) : null)
      : (typeof readLocalAccessories === "function" ? readLocalAccessories().find(x => x.name === deviceKey) : null);
    if (!rec) return;
    tr.innerHTML = type === "switch" ? switchRowHTML(rec) : accessoryRowHTML(rec);
    if (selectedAssetRow === tr && typeof renderAssetDetail === "function") renderAssetDetail(tr);
  });
}
window.reloadAssetRow = refreshAssetRow;

function clearAssetDetail() {
  if (selectedAssetRow) { selectedAssetRow.classList.remove("row-selected"); selectedAssetRow = null; }
  const body = document.getElementById("asset-detail-body");
  if (body) body.innerHTML = '<div class="form-hint">Klik baris pada tabel untuk melihat ringkasan identitas perangkat.</div>';
  const closeBtn = document.getElementById("asset-detail-close");
  if (closeBtn) closeBtn.style.display = "none";
  updateAssetCtxBar(null);
}

function refreshSelectedAssetDetail() {
  if (!selectedAssetRow) return;
  if (!selectedAssetRow.isConnected) { clearAssetDetail(); return; }
  renderAssetDetail(selectedAssetRow);
}

function initAssetDetailPanel() {
  if (document.getElementById("asset-detail")) return;
  if (document.getElementById("storage-detail") || document.getElementById("server-detail")) return;
  const assetTable = Array.from(document.querySelectorAll(".content table"))
    .find(t => (t.querySelector("thead th")?.textContent || "").trim() === "Asset");
  const anchor = assetTable ? assetTable.closest(".card") : null;
  if (!anchor) return;
  const ctxBar = document.createElement("div");
  ctxBar.className = "ctx-bar";
  ctxBar.id = "asset-ctx-bar";
  ctxBar.hidden = true;
  const layout = document.createElement("div");
  layout.className = "asset-detail-layout";
  const tableCol = document.createElement("div");
  tableCol.className = "asset-detail-table";
  anchor.before(ctxBar);
  ctxBar.after(layout);
  layout.appendChild(tableCol);
  tableCol.appendChild(anchor);
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="card detail-sticky" id="asset-detail">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;">
        <div>
          <div class="card-title"><i class="fa-solid fa-id-badge" style="color:var(--accent);margin-right:8px;"></i> Ringkasan Identitas Perangkat</div>
          <div class="card-title-sub">Ringkasan isian asset terpilih</div>
        </div>
        <button type="button" class="btn ghost" id="asset-detail-close" style="display:none;"><i class="fa-solid fa-xmark"></i> Tutup</button>
      </div>
      <div id="asset-detail-body"><div class="form-hint">Klik baris pada tabel untuk melihat ringkasan identitas perangkat.</div></div>
    </div>`;
  layout.appendChild(wrap.firstElementChild);
  document.getElementById("asset-detail-close").addEventListener("click", clearAssetDetail);
}

let editingAsset = null;

function setSelectValue(sel, value) {
  if (!sel) return;
  if (!sel.options) { sel.value = value || ""; return; }
  const opt = [...sel.options].find(o => o.value === value || o.textContent.trim() === value);
  if (opt) { sel.value = opt.value; return; }
  const o = document.createElement("option");
  o.value = value; o.textContent = value;
  sel.appendChild(o);
  sel.value = value;
}

function resetAddModal() {
  editingAsset = null;
  const t = document.querySelector("#modal-overlay .modal-title");
  const s = document.querySelector("#modal-overlay .modal-sub");
  if (t) t.textContent = pageTypeScope() ? "Tambah Aksesoris" : "Add Asset";
  if (s) s.textContent = "Tambahkan asset baru ke inventory";
  if (modalSaveBtn) modalSaveBtn.innerHTML = "Simpan Asset";
  nfContainers().forEach(sec => {
    sec.querySelectorAll("[data-nf]").forEach(el => {
      el.value = el.tagName === "SELECT"
        ? (NF_SELECT_DEFAULTS[el.dataset.nf] !== undefined ? NF_SELECT_DEFAULTS[el.dataset.nf] : (el.options[0] && el.options[0].value))
        : "";
    });
  });
  if (typeof DEVIMG !== "undefined") DEVIMG.reset(document.getElementById("modal-overlay"));
}

function openEditAsset(tr) {
  const a = readAssetRow(tr);
  const sw = a.type === "switch" ? readLocalSwitches().find(s => s.name === a.name) : null;
  const acc = !sw ? readLocalAccessories().find(x => x.name === a.name) : null;
  const rec = sw || acc;
  editingAsset = { tr, name: a.name, type: a.type, source: sw ? "switch" : "row" };

  document.querySelector("#modal-overlay .modal-title").textContent = "Edit Asset";
  document.querySelector("#modal-overlay .modal-sub").textContent = "Ubah data asset di inventory";
  modalSaveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Simpan Perubahan';

  document.getElementById("asset-name").value = a.name;
  assetTypeSelect.value = TYPE_TO_OPTION[a.type] || "Custom";
  assetTypeSelect.dispatchEvent(new Event("change"));

  if (sw) {
    switchTypeSel.value = sw.type || "ethernet";
    brandManual.value = sw.brand || "";
    modelManual.value = sw.model || "";
  } else {
    const parts = a.brandModel.split(" ");
    const brand = parts[0] || "";
    const model = parts.slice(1).join(" ");
    setSelectValue(brandSelectEl, brand);
    populateModelList();
    setSelectValue(modelSelectEl, model);
  }
  setSelectValue(document.querySelector('[data-sf="rack"]'), a.rack);
  document.querySelector('[data-sf="posisiU"]').value = a.posisiU;
  document.getElementById("asset-ip").value = a.ip === "—" ? "" : a.ip;
  document.querySelector('[data-sf="serial"]').value = a.serial === "—" ? "" : a.serial;
  if (nfContainers().length) {
    nfContainers().forEach(sec => {
      sec.querySelectorAll("[data-nf]").forEach(el => {
        const v = rec && rec[el.dataset.nf] != null ? String(rec[el.dataset.nf]) : "";
        if (el.tagName === "SELECT" && v && ![...el.options].some(o => o.value === v)) {
          const opt = document.createElement("option");
          opt.textContent = v;
          el.add(opt);
        }
        el.value = el.tagName === "SELECT"
          ? (v || (NF_SELECT_DEFAULTS[el.dataset.nf] !== undefined ? NF_SELECT_DEFAULTS[el.dataset.nf] : (el.options[0] && el.options[0].value)))
          : v;
      });
    });
  }
  document.querySelectorAll("#tag-picker .chip").forEach(c => c.classList.remove("active"));
  a.tags.forEach(t => {
    const chip = [...document.querySelectorAll("#tag-picker .chip")].find(c => c.textContent.trim() === t);
    if (chip) chip.classList.add("active");
  });
  if (typeof DEVIMG !== "undefined") DEVIMG.loadExisting({ hostname: a.name, image: rec && rec.image });
  overlay.classList.add("open");
}

function saveEditAsset() {
  const ed = editingAsset;
  if (!ed) return;
  const nameField = document.getElementById("asset-name");
  const name = nameField.value.trim();
  if (!name) {
    nameField.focus();
    nameField.closest(".m-field").style.outline = "1px solid var(--danger)";
    setTimeout(() => { nameField.closest(".m-field").style.outline = ""; }, 1600);
    return;
  }
  const type = OPTION_TO_TYPE[assetTypeSelect.value] || ed.type;
  const rack = document.querySelector('[data-sf="rack"]').value;
  const posisiU = document.querySelector('[data-sf="posisiU"]').value.trim();
  const ip = document.getElementById("asset-ip").value.trim();
  const serial = document.querySelector('[data-sf="serial"]').value.trim();
  const tags = [...document.querySelectorAll("#tag-picker .chip.active")].map(c => c.textContent.trim());
  let brand = "", model = "";
  if (type === "switch") {
    brand = brandManual ? brandManual.value.trim() : "";
    model = modelManual ? modelManual.value.trim() : "";
  } else {
    brand = brandSelectEl ? brandSelectEl.value : "";
    model = modelSelectEl ? modelSelectEl.value : "";
  }
  const brandModel = [brand, model].filter(Boolean).join(" ");

  if (ed.source === "switch") {
    const sw = collectSwitchAsset();
    sw.name = canonKey(sw.name);
    const list = readLocalSwitches();
    const idx = list.findIndex(s => s.name === ed.name);
    if (idx >= 0) list[idx] = sw; else list.unshift(sw);
    localStorage.setItem(SWITCH_STORAGE_KEY, JSON.stringify(list));
    const hasPorts = hasNetworkPorts(sw);
    if (ed.name !== sw.name) rekeyDeviceMaps(ed.name, sw.name);
    if (typeof PORT_DATA !== "undefined") {
      if (ed.name !== sw.name && PORT_DATA[ed.name]) {
        PORT_DATA[sw.name] = PORT_DATA[ed.name];
        delete PORT_DATA[ed.name];
      }
      const tpl = SWITCH_TEMPLATES[sw.type] || SWITCH_TEMPLATES.ethernet;
      const rows = (PORT_DATA[sw.name] && PORT_DATA[sw.name].rows) || [];
      PORT_DATA[sw.name] = { type: "switch", switchType: sw.type, ports: hasPorts ? networkPortCount(sw) : tpl.ports, sfp: hasPorts ? networkSfpCount(sw) : tpl.sfp, rows, specials: preserveSpecialPorts(sw.name) };
      if (typeof savePortMap === "function") savePortMap(sw.name);
    }
    if (typeof apiSaveDevice === "function") apiSaveDevice({ deviceKey: sw.name, type: "switch", name: sw.name, data: sw });
    ed.tr.remove();
    addSwitchRow(sw);
  } else {
    const nameCanon = canonKey(name);
    const prev = readLocalAccessories().find(x => x.name === ed.name) || {};
    const isNet = NETWORK_TYPES.includes(type);
    const updated = { ...prev, name: nameCanon, type, rack, posisiU, ip, serial, tags, ...collectNetworkFields() };
    if (!updated.site) updated.site = "DC1";
    if (ed.name !== nameCanon) rekeyDeviceMaps(ed.name, nameCanon);
    if (["patch", "firewall", "router", "ids", "lb", "ups"].includes(type) && typeof PORT_DATA !== "undefined") {
      if (ed.name !== nameCanon && PORT_DATA[ed.name]) {
        PORT_DATA[nameCanon] = PORT_DATA[ed.name];
        delete PORT_DATA[ed.name];
      }
      const rows = (PORT_DATA[nameCanon] && PORT_DATA[nameCanon].rows) || [];
      PORT_DATA[nameCanon] = {
        type,
        ports: hasNetworkPorts(updated) ? networkPortCount(updated) : (PORT_DATA[nameCanon] && PORT_DATA[nameCanon].ports) || (type === "ups" ? 2 : 24),
        sfp: hasNetworkPorts(updated) ? networkSfpCount(updated) : (PORT_DATA[nameCanon] && PORT_DATA[nameCanon].sfp) || 0,
        rows,
        specials: preserveSpecialPorts(nameCanon),
      };
      if (typeof savePortMap === "function") savePortMap(nameCanon);
    }
    if (type === "ups" && typeof POWER_DATA !== "undefined") {
      if (ed.name !== nameCanon && POWER_DATA[ed.name]) {
        POWER_DATA[nameCanon] = POWER_DATA[ed.name];
        delete POWER_DATA[ed.name];
      }
      const nOutlet = parseInt(String(updated.upsOutlets || "").replace(/[^0-9]/g, " ").trim().split(/\s+/)[0], 10);
      const prevUpdPower = POWER_DATA[nameCanon] || {};
      POWER_DATA[nameCanon] = {
        type: "ups",
        ports: (!prevUpdPower.ports && nOutlet) ? nOutlet : (prevUpdPower.ports || 8),
        rows: Array.isArray(prevUpdPower.rows) ? prevUpdPower.rows : [],
      };
      if (typeof savePowerMap === "function") savePowerMap(nameCanon);
    }
    if ((isNet || type === "ups") && typeof apiSaveDevice === "function") apiSaveDevice({ deviceKey: nameCanon, type, name: nameCanon, data: updated });
    saveLocalAccessory(updated);
    const cells = ed.tr.querySelectorAll("td");
    if (cells[0]) {
      cells[0].innerHTML = `<div class="strong">${escA(nameCanon)}</div><div class="mono" style="font-size:11px;">${escA(serial || "—")}</div><div style="margin-top:4px;">${switchTagChips(tags)}</div>`;
    }
    if (cells[1]) {
      const chipClass = ["server", "switch", "pdu", "firewall", "router", "ids", "lb", "patch", "storage", "ups", "kvm-switch", "cable-management", "cooling-fan", "blanking-panel", "monitoring-sensor", "custom"].includes(type) ? type : "custom";
      cells[1].innerHTML = `<span class="type-chip ${chipClass}"><span class="dot"></span>${escA(TYPE_LABELS[type] || assetTypeSelect.value)}</span>`;
    }
    if (cells[2]) cells[2].textContent = `${rack}${posisiU ? " · " + posisiU : ""}`;
    if (cells[3]) cells[3].textContent = ip || "—";
    if (cells[4]) cells[4].textContent = brandModel || "—";
    if (cells[5]) cells[5].textContent = networkSpecSummary(updated);
    ed.tr.setAttribute("data-type", type);
    ed.tr.setAttribute("data-tags", tags.join(","));
  }
  resetAddModal();
  overlay.classList.remove("open");
  refreshSelectedAssetDetail();
}


// ---- Simpan Asset: jika Server, simpan ke rv_servers (server-data.js) lalu buka Daftar Server ----
const modalSaveBtn = document.querySelector("#modal-overlay .modal-foot .btn.primary");
if (modalSaveBtn) {
  modalSaveBtn.addEventListener("click", () => {
    if (editingAsset) {
      saveEditAsset();
      return;
    }
    if (assetTypeSelect.value === "Switch") {
      saveSwitchAsset();
      return;
    }
    const accType = OPTION_TO_TYPE[assetTypeSelect.value];
    if (accType && ASSET_SAVE_TYPES.includes(accType)) {
      saveAccessoryAsset();
      return;
    }
    if (assetTypeSelect.value !== "Server") return;
    if (typeof collectServerForm !== "function" || typeof saveServer !== "function") return;
    const st = document.getElementById("server-type");
    const mode = (st && typeof FORM_MODE !== "undefined" && FORM_MODE[st.value]) || "rack";
    const server = mode === "blade" && typeof collectChassisForm === "function"
      ? collectChassisForm()
      : collectServerForm(document);
    if (mode !== "blade" && !server.hostname) {
      serverSection.scrollIntoView({ behavior: "smooth", block: "center" });
      serverSection.style.outline = "1px solid var(--danger)";
      setTimeout(() => { serverSection.style.outline = ""; }, 1600);
      return;
    }
    saveServer(server);
    window.location.href = "server-list.html";
  });
}

document.querySelectorAll("#outlet-picker .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#outlet-picker .chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    const isCustom = chip.dataset.outlet === "custom";
    outletCustomInput.style.display = isCustom ? "" : "none";
    if (isCustom) outletCustomInput.focus();
  });
});
outletCustomInput.addEventListener("input", () => {
  let v = parseInt(outletCustomInput.value, 10);
  if (v > 36) outletCustomInput.value = 36;
});

// ---- Site / Type / Status filters + Pagination (10/20/30/40/50 per halaman) ----
const filterSite = document.getElementById("filter-site");
const filterType = document.getElementById("filter-type");
const filterStatus = document.getElementById("filter-status");
const filterTag = document.getElementById("filter-tag");
const filterCount = document.getElementById("filter-count");
const assetTb = assetTableBody();
const allRows = assetTb ? Array.from(assetTb.querySelectorAll("tr[data-site]")) : [];
const totalRowCount = allRows.length;

const ASSET_PAGE_SIZES = [10, 20, 30, 40, 50];
let assetCurrentPage = 1;
let assetVisibleRows = [];

function getAssetPageSize() {
  const v = parseInt(localStorage.getItem(PAGE_SIZE_KEY) || "", 10);
  return ASSET_PAGE_SIZES.includes(v) ? v : 50;
}

function assetPaging(total, page, size) {
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, page), pages);
  const from = total === 0 ? 0 : (p - 1) * size;
  const to = Math.min(p * size, total);
  return { pages, page: p, from, to };
}

function applyFilters() {
  const site = filterSite.value;
  const type = filterType.value;
  const status = filterStatus.value;
  const tag = filterTag.value;
  assetVisibleRows = allRows.filter(row => {
    const rowTags = (row.dataset.tags || "").split(",").filter(Boolean);
    const matchSite = site === "all" || row.dataset.site === site;
    const matchType = type === "all" || (type === "accessories"
      ? RACK_ACCESSORY_TYPES.includes(row.dataset.type)
      : row.dataset.type === type);
    const matchStatus = status === "all" || row.dataset.status === status;
    const matchTag = tag === "all" || rowTags.includes(tag);
    return matchSite && matchType && matchStatus && matchTag;
  });
  renderRows();
}

function renderRows() {
  if (!assetTableBody()) return;
  const total = assetVisibleRows.length;
  const pg = assetPaging(total, assetCurrentPage, getAssetPageSize());
  assetCurrentPage = pg.page;
  allRows.forEach(row => { row.style.display = "none"; });
  assetVisibleRows.slice(pg.from, pg.to).forEach(row => { row.style.display = ""; });
  filterCount.innerHTML = total === 0
    ? "Tidak ada asset yang cocok dengan filter"
    : `Menampilkan <b>${pg.from + 1}–${pg.to}</b> dari <b>${total}</b> asset`;
  renderPagination(total, pg);
}

function assetPaginationWrap() {
  return document.querySelector(".asset-detail-table .table-footer")
      || document.querySelector(".content .table-footer");
}

function renderPagination(total, pg) {
  const wrap = assetPaginationWrap();
  if (!wrap) return;
  const size = getAssetPageSize();
  const btns = [];
  btns.push(`<select id="apg-size" class="pg-size-select" title="Jumlah asset per halaman">${
    ASSET_PAGE_SIZES.map(n => `<option value="${n}"${n === size ? " selected" : ""}>${n}/hlm</option>`).join("")
  }</select>`);
  btns.push(`<span class="pg-info">Hal <b>${pg.page}</b> / ${pg.pages}</span>`);
  btns.push(`<button type="button" data-pg="prev" ${pg.page === 1 ? "disabled" : ""}><i class="fa-solid fa-chevron-left"></i></button>`);
  const shown = new Set([1, pg.pages, pg.page, pg.page - 1, pg.page + 1].filter(p => p >= 1 && p <= pg.pages));
  let last = 0;
  [...shown].sort((a, b) => a - b).forEach(p => {
    if (p - last > 1) btns.push(`<span class="pg-info">…</span>`);
    btns.push(`<button type="button" data-pg="${p}" class="${p === pg.page ? "active" : ""}">${p}</button>`);
    last = p;
  });
  btns.push(`<button type="button" data-pg="next" ${pg.page === pg.pages ? "disabled" : ""}><i class="fa-solid fa-chevron-right"></i></button>`);
  wrap.innerHTML = `<div class="page-pager">${btns.join("")}</div>`;
  const sizeSelEl = document.getElementById("apg-size");
  if (sizeSelEl) sizeSelEl.addEventListener("change", () => {
    localStorage.setItem(PAGE_SIZE_KEY, String(parseInt(sizeSelEl.value, 10)));
    assetCurrentPage = 1;
    applyFilters();
  });
  wrap.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    const v = b.dataset.pg;
    goToAssetPage(v === "prev" ? assetCurrentPage - 1 : v === "next" ? assetCurrentPage + 1 : parseInt(v, 10));
  }));
}

function goToAssetPage(page) {
  const pg = assetPaging(assetVisibleRows.length, page, getAssetPageSize());
  assetCurrentPage = pg.page;
  renderRows();
}

function onFilterChange() {
  assetCurrentPage = 1;
  applyFilters();
}

[filterSite, filterType, filterStatus, filterTag].forEach(sel => sel.addEventListener("change", onFilterChange));

// pre-select site filter from ?site=DC1 query param (e.g. coming from sites.html)
const params = new URLSearchParams(window.location.search);
const siteParam = params.get("site");
if (siteParam && [...filterSite.options].some(o => o.value === siteParam)) {
  filterSite.value = siteParam;
}

// pre-select type filter from ?type=server (e.g. coming from nav Asset List submenu)
const typeParam = params.get("type");
if (typeParam) {
  const navLink = document.querySelector(`.nav-subitem[data-type="${typeParam}"], .nav-subitem2[data-type="${typeParam}"]`);
  if (navLink) {
    navLink.classList.add("active");
    const group = navLink.closest(".nav-submenu2");
    if (group) {
      const parent = document.querySelector(`[data-submenu2="${group.id}"]`);
      if (parent) parent.classList.add("open");
      group.classList.add("open");
    }
  }
  if ([...filterType.options].some(o => o.value === typeParam)) {
    filterType.value = typeParam;
  }
}

const assetTbody = assetTableBody();
assetTbody && assetTbody.addEventListener("click", e => {
  const btn = e.target.closest("button");
  const tr = btn ? btn.closest("tr") : e.target.closest("tr");
  if (!tr) return;
  if (btn) {
    if (btn.title === "Edit" && !btn.hasAttribute("onclick")) {
      openEditAsset(tr);
      return;
    }
    if (btn.title === "View") {
      openViewAsset(tr);
      return;
    }
    if (btn.title === "Hapus") {
      const nm = (tr.querySelector(".strong")?.textContent || "").trim();
      const doubleOk = typeof window.confirmDoubleDelete === "function"
        ? window.confirmDoubleDelete(nm)
        : (confirm(`Hapus ${nm}?`) && confirm("Yakin ingin menghapus permanen? Data yang dihapus tidak dapat dikembalikan."));
      if (doubleOk) {
        deleteAssetRow(tr);
      }
      return;
    }
    const pw = btn.hasAttribute("data-open-pw") ? btn : e.target.closest("[data-open-pw]");
    if (pw) {
      const name = pw.dataset.openPw;
      if (typeof openPowerMap === "function") openPowerMap(name);
      return;
    }
    const pm = btn.hasAttribute("data-open-pm") ? btn : e.target.closest("[data-open-pm]");
    if (pm) {
      const name = pm.dataset.openPm;
      const pmType = (pm.closest("tr") && pm.closest("tr").dataset.type) || "switch";
      if (pmType === "pdu" && typeof openPowerMap === "function") {
        openPowerMap(name);
        return;
      }
      if (typeof openPortMap === "function") openPortMap(name, false, 0, { type: pmType, formFactor: "" });
      return;
    }
  }
  renderAssetDetail(tr);
});

// Double-click baris → buka lokasi di Rack Elevation (paritas Server/Storage)
assetTbody && assetTbody.addEventListener("dblclick", e => {
  const tr = e.target.closest("tr[data-site]");
  if (!tr) return;
  if (e.target.closest("button, a")) return;
  const info = readAssetRow(tr);
  assetCtxGoLocation(info.name, info.rack);
});

// ---- Kolom Spesifikasi: baris statis (HTML lama) diberi sel spesifikasi ----
function normalizeSpecCells() {
  const tb = assetTableBody();
  if (!tb) return;
  tb.querySelectorAll("tr[data-site]").forEach(tr => {
    const cells = tr.querySelectorAll("td");
    if (cells.length !== 8) return;
    const td = document.createElement("td");
    td.className = "mono";
    td.style.cssText = "font-size:11px;color:var(--text-secondary);";
    td.textContent = "—";
    cells[4].insertAdjacentElement("afterend", td);
  });
}

// ---- Demo data network device (Switch/Firewall/Router) ----
const DEMO_NETWORK_DEVICES = [
  { type: "switch", name: "SW-CORE-01", brand: "Cisco", model: "Catalyst 9300", rack: "R1-A12", posisiU: "U4", ip: "10.10.0.1", serial: "SW-CAT-9300-118", tags: ["production", "network-core"], site: "DC1", subType: "ethernet", lanRj45: "48", lanSfp: "4", speed: "10G", os: "IOS-XE 17.9", role: "Core", vlan: "1,10-99", stacking: "Ya", stackRole: "Master", psuCount: "2", psuWatt: "715", powerRedundancy: "Redundant", tahunPembelian: "2021", warranty: "2026", monitoring: "SNMP v3" },
  { type: "switch", name: "SW-ACC-03", brand: "Cisco", model: "Catalyst 2960-X", rack: "R2-B14", posisiU: "U21", ip: "10.10.0.23", serial: "SW-CAT-2960-077", tags: ["production", "network-access"], site: "DC2", subType: "ethernet", lanRj45: "24", lanSfp: "2", speed: "1G", os: "IOS 15.2", role: "Access", vlan: "10-40", stacking: "Tidak", psuCount: "1", psuWatt: "300", powerRedundancy: "Single", tahunPembelian: "2019", warranty: "2024", monitoring: "SNMP v2c" },
  { type: "firewall", name: "FW-EDGE-02", brand: "Fortinet", model: "FortiGate 200F", rack: "R1-A12", posisiU: "U14", ip: "10.10.0.254", serial: "FGT-200F-9931", tags: ["production", "security"], site: "DC1", lanRj45: "18", lanSfp: "4", speed: "10G", os: "FortiOS 7.4", role: "Edge", throughput: "20 Gbps", maxConnections: "2M", vpnTunnels: "500", haMode: "Active-Passive", psuCount: "2", psuWatt: "150", powerRedundancy: "Redundant", tahunPembelian: "2022", warranty: "2027", monitoring: "SNMP v3" },
  { type: "router", name: "RT-EDGE-01", brand: "Cisco", model: "ISR 4451", rack: "R2-B14", posisiU: "U8", ip: "10.10.0.2", serial: "CSCO-ASR-2210", tags: ["production", "network-core"], site: "DC2", lanRj45: "6", lanSfp: "4", speed: "10G", os: "IOS-XE 17.6", role: "WAN", routingProtocol: "BGP", wanPorts: "2", psuCount: "2", psuWatt: "250", powerRedundancy: "Redundant", tahunPembelian: "2020", warranty: "2025", monitoring: "SNMP v3" },
];

// Seed data demo network device bila belum ada (merge by name), sinkron ke
// registri + Port Map, lalu ganti baris statis agar dirender dari data.
// Hanya sekali: setelah flag DEMO_SEED_KEY diset, hapus demo tidak akan
// memunculkannya lagi saat load berikutnya.
const DEMO_SEED_KEY = "rv_demo_network_seeded";
function seedNetworkDemoData() {
  let seeded = false;
  try { seeded = localStorage.getItem(DEMO_SEED_KEY) === "1"; } catch (e) { /* abaikan */ }
  if (seeded) return;
  DEMO_NETWORK_DEVICES.forEach(d => {
    const key = canonKey(d.name);
    const isSwitch = d.type === "switch";
    const exists = isSwitch
      ? readLocalSwitches().some(s => canonKey(s.name) === key)
      : readLocalAccessories().some(x => x.type === d.type && canonKey(x.name) === key);
    if (exists) return;
    if (typeof PORT_DATA !== "undefined") {
      PORT_DATA[key] = {
        type: d.type,
        switchType: isSwitch ? (d.subType || "ethernet") : undefined,
        ports: networkPortCount(d),
        sfp: networkSfpCount(d),
        rows: [],
      };
      if (typeof savePortMap === "function") savePortMap(key);
    }
    if (typeof apiSaveDevice === "function") apiSaveDevice({ deviceKey: key, type: d.type, name: key, data: d });
    if (isSwitch) saveLocalSwitch({ ...d, name: key, type: d.subType || "ethernet" }); else saveLocalAccessory({ ...d, name: key });
  });
  try { localStorage.setItem(DEMO_SEED_KEY, "1"); } catch (e) { /* abaikan */ }
}

// Baris statis network device yang sudah punya record data (demo/user) dibuang
// agar tidak dobel: baris datanya dirender dari localStorage dengan spesifikasi.
function removeStaticNetworkDuplicates() {
  const names = new Set();
  readLocalSwitches().forEach(s => names.add(canonKey(s.name)));
  readLocalAccessories().forEach(a => { if (NETWORK_TYPES.includes(a.type)) names.add(canonKey(a.name)); });
  for (let i = allRows.length - 1; i >= 0; i--) {
    const tr = allRows[i];
    if (!NETWORK_TYPES.includes(tr.dataset.type)) continue;
    const nm = (tr.querySelector(".strong")?.textContent || "").trim();
    if (names.has(canonKey(nm))) {
      tr.remove();
      allRows.splice(i, 1);
    }
  }
}

// ---- Hydrate record network device dari SQLite (DB = sumber utama) ----
// Prioritas: DB otoritatif → cache lokal ditimpa dengan versi DB (anti-stale).
// localStorage hanya fallback: dipakai untuk record yang dibuat saat offline
// (belum ada di DB) dan saat backend tidak dapat dihubungi.
async function hydrateDevicesFromDb() {
  if (typeof fetch !== "function") return;
  const base = typeof API_BASE !== "undefined" ? API_BASE : "/api";
  let list;
  try {
    const res = await fetch(base + "/devices");
    if (!res.ok || !res.json) return; // offline — biarkan render dari localStorage/statis
    list = await res.json();
  } catch (e) { return; }
  if (!Array.isArray(list)) return;

  const dbRecs = [];
  for (const d of list) {
    const key = canonKey(d.deviceKey || d.name || "");
    const type = String(d.type || "").toLowerCase();
    if (!key || (!NETWORK_TYPES.includes(type) && type !== "ups")) continue;
    let data = {};
    try { data = typeof d.data === "string" ? (JSON.parse(d.data) || {}) : (d.data || {}); } catch (e) { data = {}; }
    const rec = { ...data, name: key, type };
    if (!rec.site && d.site) rec.site = d.site;
    if (!rec.rack && d.rackId) rec.rack = d.rackId;
    dbRecs.push({ key, type, rec, hasContent: Object.keys(data).length > 0 });
  }
  if (!dbRecs.length) return;

  // 1) Sinkronkan cache lokal dengan DB (timpa versi lama/berbeda).
  //    Record DB "tipis" (tanpa data spesifikasi) tidak menimpa cache lokal
  //    yang lebih kaya; tampilannya justru memakai versi lokal yang kaya.
  const switches = readLocalSwitches();
  const accs = readLocalAccessories();
  for (const x of dbRecs) {
    if (!x.hasContent) continue;
    if (x.type === "switch") {
      const i = switches.findIndex(s => canonKey(s.name) === x.key);
      if (i >= 0) switches[i] = x.rec; else switches.unshift(x.rec);
    } else {
      const i = accs.findIndex(a => canonKey(a.name) === x.key && a.type === x.type);
      if (i >= 0) accs[i] = x.rec; else accs.unshift(x.rec);
    }
  }
  try {
    localStorage.setItem(SWITCH_STORAGE_KEY, JSON.stringify(switches));
    localStorage.setItem(ACC_STORAGE_KEY, JSON.stringify(accs));
  } catch (e) { /* storage tidak tersedia */ }

  // Untuk record DB tipis: pakai cache lokal yang lebih kaya (kalau ada)
  for (const x of dbRecs) {
    if (x.hasContent) continue;
    const ls = switches.find(s => canonKey(s.name) === x.key);
    if (ls) { x.rec = { ...ls, name: x.key, type: "switch" }; continue; }
    const la = accs.find(a => canonKey(a.name) === x.key && a.type === x.type);
    if (la) x.rec = { ...la };
  }

  // 2) Bangun ulang seluruh baris network/ups device murni dari hasil sinkronisasi
  const scope = pageTypeScope();
  clearAssetDetail();
  for (let i = allRows.length - 1; i >= 0; i--) {
    const tr = allRows[i];
    if (!NETWORK_TYPES.includes(tr.dataset.type) && tr.dataset.type !== "ups") continue;
    tr.remove();
    allRows.splice(i, 1);
  }
  const dbKeys = new Set(dbRecs.map(x => x.key));
  const inScope = t => (scope ? scope.includes(t) : true);
  const localOnlyAccs = accs.filter(a => !dbKeys.has(canonKey(a.name)) && NETWORK_TYPES.includes(a.type) && inScope(a.type));
  const localOnlySwitches = switches.filter(s => !dbKeys.has(canonKey(s.name)) && inScope("switch"));
  dbRecs.forEach(x => { if (!scope || scope.includes(x.type)) addAccessoryRow(x.rec); });
  localOnlyAccs.forEach(a => addAccessoryRow({ ...a }));
  localOnlySwitches.forEach(s => addAccessoryRow({ ...s, type: "switch" }));
}

window.addEventListener("load", () => {
  initAssetDetailPanel();
  normalizeSpecCells();
  seedNetworkDemoData();
  removeStaticNetworkDuplicates();
  renderSavedSwitches();
  renderSavedAccessories();
  applyFilters();
  hydrateDevicesFromDb();
});
    

