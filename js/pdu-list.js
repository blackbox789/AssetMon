
const tbody = document.getElementById("pdu-tbody");
const countEl = document.getElementById("filter-count");

// ---- Pagination (10/20/30/40/50 per halaman, berbagi rv_page_size) ----
const PDU_PAGE_SIZES = [10, 20, 30, 40, 50];
let pduPage = 1;
let pduVisibleRows = [];
function getPduPageSize() {
  const v = parseInt(localStorage.getItem(PAGE_SIZE_KEY) || "", 10);
  return PDU_PAGE_SIZES.includes(v) ? v : 50;
}
function pduPaging(total, page, size) {
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, page), pages);
  const from = total === 0 ? 0 : (p - 1) * size;
  const to = Math.min(p * size, total);
  return { pages, page: p, from, to };
}
function renderPduPagination(total, pg) {
  const wrap = document.querySelector(".table-footer");
  if (!wrap) return;
  const size = getPduPageSize();
  const btns = [];
  btns.push(`<select id="ppg-size" class="pg-size-select" title="Jumlah PDU per halaman">${
    PDU_PAGE_SIZES.map(n => `<option value="${n}"${n === size ? " selected" : ""}>${n}/hlm</option>`).join("")
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
  const sizeSelEl = document.getElementById("ppg-size");
  if (sizeSelEl) sizeSelEl.addEventListener("change", () => {
    localStorage.setItem(PAGE_SIZE_KEY, String(parseInt(sizeSelEl.value, 10)));
    pduPage = 1;
    renderTable();
  });
  wrap.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    const v = b.dataset.pg;
    const next = v === "prev" ? pduPage - 1 : v === "next" ? pduPage + 1 : parseInt(v, 10);
    const pg2 = pduPaging(pduVisibleRows.length, next, getPduPageSize());
    pduPage = pg2.page;
    renderTable();
  }));
}

const STATUS_BADGE = {
  online: '<span class="badge online"><span class="bdot"></span>Online</span>',
  offline: '<span class="badge offline"><span class="bdot"></span>Offline</span>',
  maintenance: '<span class="badge maintenance"><span class="bdot"></span>Maintenance</span>',
};

function statusBadge(status) {
  return STATUS_BADGE[status] || STATUS_BADGE.online;
}

function outletClass(used, ports) {
  const pct = ports ? used / ports : 0;
  if (pct >= 0.9) return "crit";
  if (pct >= 0.75) return "warn";
  return "";
}

function escHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderTable() {
  const q = document.getElementById("top-search").value.trim().toLowerCase();
  const site = document.getElementById("filter-site").value;
  const type = document.getElementById("filter-type").value;
  const status = document.getElementById("filter-status").value;

  const rows = PDU_DATA.filter(p => {
    const matchSite = site === "all" || p.site === site;
    const matchType = type === "all" || p.type === type;
    const matchStatus = status === "all" || p.status === status;
    const matchQ = !q || [p.name, p.rack, p.ip, p.brand, p.model].join(" ").toLowerCase().includes(q);
    return matchSite && matchType && matchStatus && matchQ;
  });
  pduVisibleRows = rows;
  const pg = pduPaging(rows.length, pduPage, getPduPageSize());
  pduPage = pg.page;

  tbody.innerHTML = rows.slice(pg.from, pg.to).map(p => `
    <tr data-pdu-name="${escHtml(p.name)}" data-site="${p.site}" data-type="${p.type}" data-status="${p.status}">
      <td><div class="strong">${p.name}</div><div class="mono" style="font-size:11px;">${p.serial || ""}</div></td>
      <td><span class="pdu-type-chip ${p.type}"><span class="dot"></span>${p.type === "vertical" ? "Vertikal" : "Horizontal"}</span></td>
      <td>${p.rack} · ${p.pos}</td>
      <td><div class="outlet-cell"><span class="outlet-nums">${p.used}/${p.ports} terpakai</span><div class="outlet-bar"><div class="outlet-fill ${outletClass(p.used, p.ports)}" style="width:${p.ports ? Math.round(p.used / p.ports * 100) : 0}%"></div></div></div></td>
      <td class="mono">${p.ip}</td>
      <td>${p.brand} ${p.model}</td>
      <td>${statusBadge(p.status)}</td>
    </tr>`).join("");

  countEl.innerHTML = rows.length === 0
    ? "Tidak ada PDU yang cocok dengan filter"
    : `Menampilkan <b>${pg.from + 1}–${pg.to}</b> dari <b>${rows.length}</b> PDU`;
  renderPduPagination(rows.length, pg);
  updateStats();
}

function updateStats() {
  document.getElementById("stat-total").textContent = PDU_DATA.length;
  document.getElementById("stat-vert").textContent = PDU_DATA.filter(p => p.type === "vertical").length;
  document.getElementById("stat-horz").textContent = PDU_DATA.filter(p => p.type === "horizontal").length;
  document.getElementById("stat-outlets").textContent = PDU_DATA.reduce((s, p) => s + p.ports, 0);
}

["top-search", "filter-site", "filter-type", "filter-status"].forEach(id => {
  document.getElementById(id).addEventListener("input", () => { pduPage = 1; renderTable(); });
});

// ---- Add/Edit PDU modal ----
const addModal = document.getElementById("add-pdu-modal");
const openAdd = document.getElementById("open-add-pdu");
const closeAdd = document.getElementById("close-add-pdu");
const cancelAdd = document.getElementById("cancel-add-pdu");
let editingPdu = null;
let viewPduName = null;

function setAddTitle(mode) {
  document.getElementById("add-pdu-title").textContent = mode === "edit" ? "Edit PDU" : "Tambah PDU";
  document.getElementById("add-pdu-sub").textContent = mode === "edit"
    ? "Ubah data Power Distribution Unit ini."
    : "Tambahkan Power Distribution Unit baru ke inventory";
  const saveBtn = document.getElementById("save-add-pdu");
  saveBtn.innerHTML = mode === "edit" ? '<i class="fa-solid fa-check"></i> Simpan Perubahan' : '<i class="fa-solid fa-check"></i> Simpan PDU';
}

function closeModal() {
  addModal.classList.remove("open");
  resetForm();
}
openAdd.addEventListener("click", () => {
  editingPdu = null;
  resetForm();
  setAddTitle("add");
  addModal.classList.add("open");
});
closeAdd.addEventListener("click", closeModal);
cancelAdd.addEventListener("click", closeModal);
addModal.addEventListener("click", e => { if (e.target === addModal) closeModal(); });

function openEdit(name) {
  const p = PDU_DATA.find(x => x.name === name);
  if (!p) return;
  editingPdu = name;
  setType(p.type);
  pduType = p.type;
  if (p.type === "vertical") {
    const chip = [...portPicker].find(c => c.dataset.outlet === String(p.ports));
    portPicker.forEach(c => c.classList.remove("active"));
    if (chip) {
      chip.classList.add("active");
      customPortInput.style.display = "none";
      selectedPorts = p.ports;
    } else {
      [...portPicker].find(c => c.dataset.outlet === "custom")?.classList.add("active");
      customPortInput.style.display = "";
      customPortInput.value = p.ports;
      selectedPorts = p.ports;
    }
  }
  document.getElementById("pdu-name").value = p.name;
  document.getElementById("pdu-serial").value = p.serial || "";
  document.getElementById("pdu-site").value = p.site;
  document.getElementById("pdu-rack").value = p.rack;
  document.getElementById("pdu-side").value = p.pos;
  document.getElementById("pdu-u").value = p.pos;
  document.getElementById("pdu-brand").value = p.brand;
  document.getElementById("pdu-model").value = p.model || "";
  document.getElementById("pdu-ip").value = p.ip || "";
  document.getElementById("pdu-status").value = p.status;
  const rI = document.getElementById("pdu-rating"); if (rI) rI.value = p.rating || "";
  const pI = document.getElementById("pdu-plug"); if (pI) pI.value = p.plug || "";
  const vI = document.getElementById("pdu-volt"); if (vI) vI.value = p.volt || "";
  const mI = document.getElementById("pdu-metering"); if (mI) mI.value = p.metering || "";
  setAddTitle("edit");
  addModal.classList.add("open");
}

// ---- Type toggle: vertical (≤36) vs horizontal (fixed 8, 1U) ----
const typeOptions = document.querySelectorAll("#pdu-type-options .type-option");
let pduType = "vertical";
let selectedPorts = 36;

function setType(type) {
  pduType = type;
  typeOptions.forEach(o => o.classList.toggle("active", o.dataset.type === type));
  const isVert = type === "vertical";
  document.getElementById("port-field-vertical").style.display = isVert ? "" : "none";
  document.getElementById("port-field-horizontal").style.display = isVert ? "none" : "";
  document.getElementById("pdu-pos-vertical").style.display = isVert ? "" : "none";
  document.getElementById("pdu-pos-horizontal").style.display = isVert ? "none" : "";
  if (isVert) {
    const activeChip = [...portPicker].find(c => c.classList.contains("active"));
    if (activeChip && activeChip.dataset.outlet === "custom") {
      customPortInput.style.display = "";
      selectedPorts = parseInt(customPortInput.value, 10) || 36;
    } else if (activeChip) {
      customPortInput.style.display = "none";
      selectedPorts = parseInt(activeChip.dataset.outlet, 10);
    }
  } else {
    selectedPorts = 8;
    customPortInput.style.display = "none";
  }
}

typeOptions.forEach(o => o.addEventListener("click", () => setType(o.dataset.type)));

// ---- Port picker (vertical) ----
const portPicker = document.querySelectorAll("#pdu-port-picker .chip");
const customPortInput = document.getElementById("pdu-port-custom");

portPicker.forEach(chip => {
  chip.addEventListener("click", () => {
    portPicker.forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    const isCustom = chip.dataset.outlet === "custom";
    customPortInput.style.display = isCustom ? "" : "none";
    if (isCustom) {
      customPortInput.focus();
    } else {
      selectedPorts = parseInt(chip.dataset.outlet, 10);
    }
  });
});
customPortInput.addEventListener("input", () => {
  let v = parseInt(customPortInput.value, 10);
  if (v > 36) customPortInput.value = 36;
  if (v >= 1) selectedPorts = v;
});

function resetForm() {
  pduType = "vertical";
  selectedPorts = 36;
  setType("vertical");
  portPicker.forEach(c => c.classList.remove("active"));
  portPicker.forEach(c => { if (c.dataset.outlet === "36") c.classList.add("active"); });
  customPortInput.style.display = "none";
  customPortInput.value = "";
  ["pdu-name", "pdu-model", "pdu-ip", "pdu-u", "pdu-serial", "pdu-rating", "pdu-plug", "pdu-volt"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("pdu-site").value = "DC1";
  document.getElementById("pdu-rack").value = "R1-A12";
  document.getElementById("pdu-side").value = "Sisi A";
  document.getElementById("pdu-brand").value = "APC";
  document.getElementById("pdu-status").value = "online";
  const mtr = document.getElementById("pdu-metering");
  if (mtr) mtr.value = "";
}

// ---- Save (Add / Edit) ----
document.getElementById("save-add-pdu").addEventListener("click", () => {
  const name = canonKey(document.getElementById("pdu-name").value.trim());
  if (!name) {
    document.getElementById("pdu-name").focus();
    return;
  }
  const ports = pduType === "horizontal" ? 8 : selectedPorts;
  const pos = pduType === "vertical"
    ? document.getElementById("pdu-side").value
    : document.getElementById("pdu-u").value.trim() || "U?";
  const entry = {
    name,
    serial: document.getElementById("pdu-serial").value.trim(),
    type: pduType,
    ports,
    used: 0,
    site: document.getElementById("pdu-site").value,
    rack: document.getElementById("pdu-rack").value,
    pos,
    brand: document.getElementById("pdu-brand").value,
    model: document.getElementById("pdu-model").value.trim(),
    ip: document.getElementById("pdu-ip").value.trim(),
    status: document.getElementById("pdu-status").value,
    rating: document.getElementById("pdu-rating") ? document.getElementById("pdu-rating").value.trim() : "",
    plug: document.getElementById("pdu-plug") ? document.getElementById("pdu-plug").value.trim() : "",
    volt: document.getElementById("pdu-volt") ? document.getElementById("pdu-volt").value.trim() : "",
    metering: document.getElementById("pdu-metering") ? document.getElementById("pdu-metering").value : "",
  };
  if (editingPdu) {
    const idx = PDU_DATA.findIndex(x => x.name === editingPdu);
    const old = idx >= 0 ? PDU_DATA[idx] : null;
    if (old) {
      entry.used = old.used || 0;
      PDU_DATA[idx] = entry;
      if (old.name !== name) {
        if (POWER_DATA[old.name]) {
          POWER_DATA[name] = POWER_DATA[old.name];
          delete POWER_DATA[old.name];
        }
        rekeyDeviceMaps(old.name, name);
      }
      if (POWER_DATA[name]) POWER_DATA[name].ports = ports;
      else POWER_DATA[name] = { ports, rows: [] };
      upsertPduOverride(entry);
    }
    editingPdu = null;
  } else {
    PDU_DATA.unshift(entry);
    POWER_DATA[name] = { ports, rows: [] };
    upsertPduOverride(entry);
  }
  // Skeleton Port Map PDU (port manajemen) — tersinkron ke SQLite via savePortMap
  if (typeof PORT_DATA !== "undefined") {
    const prevPort = PORT_DATA[name];
    PORT_DATA[name] = {
      type: "pdu",
      ports: (prevPort && prevPort.ports) || 1,
      sfp: (prevPort && prevPort.sfp) || 0,
      qsfp: (prevPort && prevPort.qsfp) || 0,
      rows: (prevPort && Array.isArray(prevPort.rows)) ? prevPort.rows : [],
      specials: prevPort && Array.isArray(prevPort.specials) ? prevPort.specials.map(s => ({ ...s })) : undefined,
    };
  }
  if (typeof apiSaveDevice === "function") apiSaveDevice({ deviceKey: name, type: "pdu", name, data: entry });
  if (typeof savePowerMap === "function") savePowerMap(name);
  if (typeof savePortMap === "function" && typeof PORT_DATA !== "undefined" && PORT_DATA[name]) savePortMap(name);
  setAddTitle("add");
  pduPage = 1;
  renderTable();
  closeModal();
});

// ---- View PDU detail ----
function openView(name) {
  const p = PDU_DATA.find(x => x.name === name);
  if (!p) return;
  const pw = POWER_DATA[p.name];
  const used = pw && Array.isArray(pw.rows) ? pw.rows.length : (p.used || 0);
  viewPduName = name;
  document.getElementById("view-pdu-title").textContent = p.name;
  document.getElementById("view-pdu-sub").textContent = `${p.brand} ${p.model || ""} — ${p.type === "vertical" ? "Vertikal (0U)" : "Horizontal (1U)"}`;
  document.getElementById("view-pdu-body").innerHTML = `
    <div class="field-grid">
      <div class="field-item"><div class="k">Tipe</div><div class="v">${p.type === "vertical" ? "Vertikal (0U)" : "Horizontal (1U)"}</div></div>
      <div class="field-item"><div class="k">Rack / Posisi</div><div class="v">${escHtml(p.rack)} · ${escHtml(p.pos)}</div></div>
      <div class="field-item"><div class="k">Outlet</div><div class="v">${used}/${p.ports} terpakai</div></div>
      <div class="field-item"><div class="k">IP Address</div><div class="v mono">${escHtml(p.ip || "—")}</div></div>
      <div class="field-item"><div class="k">Brand / Model</div><div class="v">${escHtml(p.brand)} ${escHtml(p.model || "")}</div></div>
      <div class="field-item"><div class="k">Serial Number</div><div class="v mono">${escHtml(p.serial || "—")}</div></div>
      <div class="field-item"><div class="k">Site</div><div class="v">${escHtml(p.site)}</div></div>
      <div class="field-item"><div class="k">Status</div><div class="v">${statusBadge(p.status)}</div></div>
    </div>`;
  document.getElementById("view-pdu-modal").classList.add("open");
}

const viewModal = document.getElementById("view-pdu-modal");
document.getElementById("close-view-pdu").addEventListener("click", () => viewModal.classList.remove("open"));
viewModal.addEventListener("click", e => { if (e.target === viewModal) viewModal.classList.remove("open"); });
document.getElementById("view-pdu-powermap").addEventListener("click", () => {
  viewModal.classList.remove("open");
  if (viewPduName) openPowerMap(viewPduName);
});

// ---- Persistensi PDU (overrides lokal) + hydrate dari SQLite (DB = sumber utama) ----
// PDU_DATA dasar adalah seed konstan; penambahan/edit user disimpan ke
// rv_pdu_overrides agar tidak hilang saat reload. Saat backend hidup, record
// type=pdu dari tabel devices (data JSON) menimpa versi lokal yang sama nama.
const PDU_OVERRIDES_KEY = "rv_pdu_overrides";
function readPduOverrides() {
  try { const a = JSON.parse(localStorage.getItem(PDU_OVERRIDES_KEY) || "[]"); return Array.isArray(a) ? a : []; }
  catch { return []; }
}
function writePduOverrides(list) {
  try { localStorage.setItem(PDU_OVERRIDES_KEY, JSON.stringify(list)); } catch (e) { /* penuh */ }
}
function upsertPduOverride(entry) {
  const list = readPduOverrides();
  const i = list.findIndex(x => x.name === entry.name);
  if (i >= 0) list[i] = entry; else list.unshift(entry);
  writePduOverrides(list);
}
function applyPduOverrides() {
  readPduOverrides().forEach(o => {
    const i = PDU_DATA.findIndex(x => x.name === o.name);
    if (i >= 0) PDU_DATA[i] = o; else PDU_DATA.unshift(o);
  });
}

async function hydratePduFromDb() {
  if (typeof fetch !== "function") return;
  const base = typeof API_BASE !== "undefined" ? API_BASE : "/api";
  let list;
  try {
    const res = await fetch(base + "/devices");
    if (!res.ok || !res.json) return;
    list = await res.json();
  } catch (e) { return; }
  if (!Array.isArray(list)) return;
  let changed = false;
  for (const d of list) {
    if (String(d.type || "").toLowerCase() !== "pdu") continue;
    const key = canonKey(d.deviceKey || d.name || "");
    if (!key) continue;
    let data = {};
    try { data = typeof d.data === "string" ? (JSON.parse(d.data) || {}) : (d.data || {}); } catch (e) { data = {}; }
    delete data.ok;
    if (!Object.keys(data).length) continue; // record tipis: jangan timpa
    const rec = { ...data, name: key, type: data.type === "horizontal" ? "horizontal" : "vertical" };
    const i = PDU_DATA.findIndex(x => x.name === key);
    if (i >= 0) { PDU_DATA[i] = rec; } else { PDU_DATA.unshift(rec); }
    upsertPduOverride(rec);
    changed = true;
  }
  if (changed) renderTable();
}

// ---- Detail panel + contextual bar (paritas menu lain) ----
let selectedPduRow = null;

function pduKv(label, value) {
  if (value == null || String(value).trim() === "" || String(value).trim() === "—") return "";
  return `<div class="kv-row"><span class="kv-label">${escHtml(label)}</span><span class="kv-value">${escHtml(value)}</span></div>`;
}

function buildPduDetailHTML(p) {
  const pw = typeof POWER_DATA !== "undefined" ? POWER_DATA[p.name] : null;
  const used = pw && Array.isArray(pw.rows) ? pw.rows.length : (p.used || 0);
  const header = `
    <div class="srv-detail-head">
      <div class="strong" style="font-size:14px;">${escHtml(p.name)}</div>
      <div class="srv-meta-row" style="margin-top:6px;">
        <span class="tag-chip" style="background:color-mix(in srgb, var(--violet) 18%, transparent);color:var(--violet)"><span class="tdot"></span>${p.type === "vertical" ? "Vertikal (0U)" : "Horizontal (1U)"}</span>
        ${p.brand ? `<span class="tag-chip" style="background:var(--bg-surface-3);color:var(--text-secondary)"><span class="tdot"></span>${escHtml([p.brand, p.model].filter(Boolean).join(" "))}</span>` : ""}
      </div>
    </div>`;
  return header +
    `<div class="kv-group"><div class="kv-group-title">Identitas</div>` +
      pduKv("Brand / Model", [p.brand, p.model].filter(Boolean).join(" ")) +
      pduKv("Serial Number", p.serial) +
      pduKv("IP Address", p.ip) +
      pduKv("Site", p.site) +
      pduKv("Rack / Posisi", [p.rack, p.pos].filter(Boolean).join(" · ")) +
      pduKv("Status", p.status) +
    `</div>` +
    `<div class="kv-group"><div class="kv-group-title">Daya</div>` +
      pduKv("Outlet Terpakai", `${used}/${p.ports}`) +
      pduKv("Rating Input", p.rating) +
      pduKv("Tipe Plug", p.plug) +
      pduKv("Voltase", p.volt) +
      pduKv("Metering per-Outlet", p.metering) +
    `</div>`;
}

function clearPduDetail() {
  if (selectedPduRow) { selectedPduRow.classList.remove("row-selected"); selectedPduRow = null; }
  const body = document.getElementById("pdu-detail-body");
  if (body) body.innerHTML = '<div class="form-hint">Klik baris pada tabel untuk melihat ringkasan identitas perangkat.</div>';
  const closeBtn = document.getElementById("pdu-detail-close");
  if (closeBtn) closeBtn.style.display = "none";
  const bar = document.getElementById("pdu-ctx-bar");
  if (bar) bar.hidden = true;
}

function renderPduDetail(tr) {
  if (selectedPduRow) selectedPduRow.classList.remove("row-selected");
  selectedPduRow = tr;
  tr.classList.add("row-selected");
  const name = tr.dataset.pduName;
  const p = PDU_DATA.find(x => x.name === name);
  const body = document.getElementById("pdu-detail-body");
  if (body && p) body.innerHTML = buildPduDetailHTML(p);
  const closeBtn = document.getElementById("pdu-detail-close");
  if (closeBtn) closeBtn.style.display = "";
  updatePduCtxBar(name);
}

function pduGoLocation(name, rack) {
  if (!rack) return;
  window.location.href = "rack-elevation.html?rack=" + encodeURIComponent(rack) + "&device=" + encodeURIComponent(name);
}

function updatePduCtxBar(name) {
  const bar = document.getElementById("pdu-ctx-bar");
  if (!bar) return;
  const p = name ? PDU_DATA.find(x => x.name === name) : null;
  if (!p) { bar.hidden = true; bar.innerHTML = ""; return; }
  bar.hidden = false;
  bar.innerHTML = `<div class="ctx-bar-info"><i class="fa-solid fa-caret-right"></i> <b>${escHtml(p.name)}</b></div>
    <div class="ctx-bar-actions">
      <button type="button" class="ctx-btn" title="Lihat ringkasan" data-act="view"><i class="fa-solid fa-eye"></i> Lihat</button>
      <button type="button" class="ctx-btn" title="Edit PDU" data-act="edit"><i class="fa-solid fa-pen"></i> Edit</button>
      <button type="button" class="ctx-btn" title="Buka Port Map" data-act="port"><i class="fa-solid fa-ethernet"></i> Port Map</button>
      <button type="button" class="ctx-btn" title="Buka Power Map" data-act="power"><i class="fa-solid fa-plug"></i> Power Map</button>
      ${p.rack ? `<button type="button" class="ctx-btn" title="Lokasi di Rack Elevation" data-act="loc"><i class="fa-solid fa-location-dot"></i> Lokasi</button>` : ""}
      <button type="button" class="ctx-btn danger" title="Hapus PDU" data-act="delete"><i class="fa-solid fa-trash"></i> Hapus</button>
      <button type="button" class="ctx-btn" title="Tutup" data-act="close"><i class="fa-solid fa-xmark"></i></button>
    </div>`;
  bar.onclick = e => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === "close") { clearPduDetail(); return; }
    if (act === "view") { openView(name); return; }
    if (act === "edit") { openEdit(name); return; }
    if (act === "port") { openPortMap(name, false, 0, { type: "pdu" }); return; }
    if (act === "power") { openPowerMap(name); return; }
    if (act === "loc") { const p = PDU_DATA.find(x => x.name === name); if (p) pduGoLocation(name, p.rack); return; }
    if (act === "delete") { deletePduRecord(name); return; }
  };
}

function deletePduRecord(name) {
  const doubleOk = typeof window.confirmDoubleDelete === "function"
    ? window.confirmDoubleDelete(name)
    : (confirm(`Hapus ${name}?`) && confirm("Yakin ingin menghapus permanen? Data yang dihapus tidak dapat dikembalikan."));
  if (!doubleOk) return;
  try { if (typeof apiDeleteDevice === "function") apiDeleteDevice(name); } catch (e) { /* offline */ }
  // bersihkan map lokal + storage
  [PORT_STORAGE_KEY, POWER_STORAGE_KEY].forEach(sk => {
    try {
      const obj = JSON.parse(localStorage.getItem(sk) || "{}") || {};
      if (Object.prototype.hasOwnProperty.call(obj, name)) {
        delete obj[name];
        localStorage.setItem(sk, JSON.stringify(obj));
      }
    } catch (e) { /* abaikan */ }
  });
  if (typeof PORT_DATA !== "undefined") delete PORT_DATA[name];
  if (typeof POWER_DATA !== "undefined") delete POWER_DATA[name];
  const i = PDU_DATA.findIndex(x => x.name === name);
  if (i >= 0) PDU_DATA.splice(i, 1);
  writePduOverrides(readPduOverrides().filter(x => x.name !== name));
  try {
    const base = typeof API_BASE !== "undefined" ? API_BASE : "/api";
    fetch(base + "/audit/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "device.delete", target: name, detail: "Dihapus dari Daftar PDU (type: pdu)" })
    });
  } catch (e) { /* abaikan */ }
  if (typeof showToast === "function") showToast("PDU " + name + " berhasil dihapus.", "success");
  clearPduDetail();
  renderTable();
}



// ---- Delegasi baris: klik tombol aksi / klik baris / double-click lokasi ----
tbody.addEventListener("click", e => {
  const btn = e.target.closest("button");
  const row = (btn ? btn.closest("tr") : e.target.closest("tr[data-pdu-name]"));
  if (!row || !row.dataset.pduName) return;
  const name = row.dataset.pduName;
  if (btn) {
    if (btn.title === "Edit") openEdit(name);
    else if (btn.title === "View") openView(name);
    else if (btn.title === "Port Map") openPortMap(name, false, 0, { type: "pdu" });
    else if (btn.title === "Power Map") openPowerMap(name);
    return;
  }
  renderPduDetail(row);
});
tbody.addEventListener("dblclick", e => {
  if (e.target.closest("button, a")) return;
  const row = e.target.closest("tr[data-pdu-name]");
  if (!row) return;
  const p = PDU_DATA.find(x => x.name === row.dataset.pduName);
  if (p) pduGoLocation(p.name, p.rack);
});
const pduDetailCloseBtn = document.getElementById("pdu-detail-close");
if (pduDetailCloseBtn) pduDetailCloseBtn.addEventListener("click", clearPduDetail);

// ---- Init: overrides lokal lalu render; DB otoritatif menyusul (async) ----
applyPduOverrides();
renderTable();
hydratePduFromDb();
