/* ============================================
   RackView — Storage list (storage-list.html)
   Menampilkan data storage dari localStorage (rv_storage)
   Setiap item data akan dirender sebagai <tr> terpisah.
   ============================================ */

function escStorage(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, c => {
    switch (c) {
      case "&": return "&";
      case "<": return "<";
      case ">": return ">";
      case '"': return '"';
      case "'": return "'";
    }
  });
}

function storageTagChips(tags) {
  const list = tags && tags.length ? tags : [];
  return list.map(t =>
    `<span class="tag-chip" style="background:color-mix(in srgb, var(--accent) 18%, transparent);color:var(--accent)"><span class="tdot"></span>${escStorage(t)}</span>`
  ).join("");
}

function storageTypeLabel(t) {
  return (typeof STORAGE_TYPE_LABELS !== "undefined" && STORAGE_TYPE_LABELS[t]) || "Storage";
}

function storageSpecSummary(s) {
  if (!s) return "—";
  const parts = [];
  if (Array.isArray(s.controllers) && s.controllers.length) parts.push(s.controllers.length + "× controller");
  if (s.storageBays) parts.push(s.storageBays + " bay");
  if (s.storageIface) parts.push(String(s.storageIface).toUpperCase());
  if (Array.isArray(s.raidTypes) && s.raidTypes.length) parts.push(s.raidTypes.join("/"));
  return parts.join(" · ") || "—";
}

function fmtStorageHost(s) {
  const host = s.hostname || "—";
  const sub = s.serial || (s.controllers && s.controllers.length ? s.controllers.length + " controller" : "");
  return `<div class="strong">${escStorage(host)}</div>${sub ? '<div class="mono" style="font-size:11px;color:var(--text-secondary);">' + escStorage(sub) + "</div>" : ""}`;
}

// Fungsi ini Mengembalikan STRING <tr> SEHAT penuh untuk SATU item
function storageRowHTML(item) {
  // Pastikan nilai defaults jika undefined/null
  const hostname = item.hostname || "-";
  const storageType = storageTypeLabel(item.storageType || item.tipe);
  const vendor = item.vendor || "-";
  const model = item.model || "-";
  const ip = item.ip || "-";
  const rack = item.rack || "-";
  const posisiU = item.posisiU || "-";
  const uHeight = item.uHeight || item.formFactor || "";
  const kondisi = item.kondisi || "Active";
  const source = item.source || item.discoverySource || "Manual";

  // Bangkitkan <tr> ... <td> ... </tr> — kolom mengikuti header tabel
  const isSel = String(item.deviceKey || item.hostname || "") === String(selectedStgKey || "");
  return `
    <tr data-device-key="${escStorage(item.deviceKey || hostname)}" class="${isSel ? "row-selected" : ""}">
      <td>${fmtStorageHost(item)}</td>
      <td>${escStorage(storageType)}</td>
      <td>${escStorage(rack)}${posisiU ? " · " + escStorage(posisiU) : ""}${uHeight ? ' <span class="tag-chip">' + escStorage(uHeight) + "</span>" : ""}</td>
      <td class="mono">${escStorage(ip)}</td>
      <td>${escStorage(vendor)} ${escStorage(model) ? "· " + escStorage(model) : ""}</td>
      <td>${escStorage(storageSpecSummary(item))}</td>
      <td><span class="status-badge ${kondisi.toLowerCase() === "active" ? "online" : kondisi.toLowerCase() === "standby" ? "warning" : "offline"}"><span class="bdot"></span>${escStorage(kondisi)}</span></td>
      <td>${escStorage(source)}</td>
    </tr>
  `;
}

// Gabungan data storage: record form (rv_storage) + storage dari rv_accessories
// (ditulis storage-form.js lewat storageToAccessory) supaya semua tampil seragam.
function getAllStorages() {
  let fromForm = [];
  try {
    if (typeof readLocalStorages === "function") fromForm = readLocalStorages();
    else fromForm = JSON.parse(localStorage.getItem(STORAGE_STORAGE_KEY) || "[]");
  } catch (e) { fromForm = []; }
  if (!Array.isArray(fromForm)) fromForm = [];
  let acc = [];
  try { acc = JSON.parse(localStorage.getItem(ACC_STORAGE_KEY) || "[]"); } catch (e) { acc = []; }
  if (!Array.isArray(acc)) acc = [];
  const known = new Set(fromForm.map(x => String(x.hostname || x.deviceKey || "").toLowerCase()));
  const extra = acc
    .filter(x => x && (x.type === "storage" || x.type === "custom") && x.name && !known.has(String(x.name).toLowerCase()))
    .map(a => ({ ...a, hostname: a.name, vendor: a.vendor || a.brand, deviceKey: a.deviceKey || a.name }));
  return fromForm.concat(extra);
}

function renderStorageList() {
  const tbody = document.getElementById('storage-tbody');
  const countText = document.getElementById('stg-count-text') || document.getElementById('filter-count');
  if (!tbody) return;

  // Ambil data dari localStorage (key rv_storage) + storage dari rv_accessories
  const data = getAllStorages();

  if (!Array.isArray(data)) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;">Data tidak valid.</td></tr>`;
    if (countText) countText.textContent = 'Error data';
    return;
  }

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;">Tidak ada data storage.</td></tr>`;
    if (countText) countText.textContent = 'Menampilkan 0 storage';
    return;
  }

  // --- INI YANG PERLUAN: .map membuat array <tr>, lalu .join('') sekalikan jadi string ---
  // Setiap item akan jadi <tr>...</tr>, lalu digabungkan tanpa pemisah antar baris.
  tbody.innerHTML = data.map(item => storageRowHTML(item)).join('');

  // Event delegation: klik baris → lihat ringkasan + tampilkan contextual action bar
  tbody.querySelectorAll("tr").forEach(tr => {
    tr.addEventListener("click", e => {
      if (e.target.closest("button, a")) return;
      selectedStgKey = tr.dataset.deviceKey;
      tbody.querySelectorAll("tr").forEach(r => r.classList.toggle("row-selected", r === tr));
      viewStorage(tr.dataset.deviceKey);
      updateStgCtxBar();
    });
    tr.addEventListener("dblclick", e => {
      if (e.target.closest("button, a")) return;
      gotoStorageLocation(tr.dataset.deviceKey);
    });
  });
  updateStgCtxBar();

  if (countText) countText.textContent = `Menampilkan ${data.length} storage`;
}

let selectedStgKey = null;

function buildStgCtxBarHTML(s) {
  const name = escStorage(s.hostname || s.deviceKey || "");
  const key = String(s.hostname || s.deviceKey || s.id || "").replace(/'/g, "");
  const form = String(s.formFactor || s.uHeight || "").replace(/'/g, "");
  const psu = Math.max(1, parseInt(s.psuCount, 10) || 2);
  const rack = s.rack && s.rack !== "-" ? s.rack : "";
  const loc = rack
    ? `<button type="button" class="ctx-btn" title="Lokasi di Rack Elevation" data-ctx-act="loc"><i class="fa-solid fa-location-dot"></i> Lokasi</button>`
    : `<button type="button" class="ctx-btn" title="Storage belum ditempatkan di rack" data-ctx-act="loc" disabled><i class="fa-solid fa-location-dot"></i> Lokasi</button>`;
  return `<div class="ctx-bar-info"><i class="fa-solid fa-caret-right"></i> <b>${name}</b></div>
    <div class="ctx-bar-actions">
      <button type="button" class="ctx-btn" title="Lihat ringkasan" data-ctx-act="view"><i class="fa-solid fa-eye"></i> Lihat</button>
      <button type="button" class="ctx-btn" title="Edit storage" data-ctx-act="edit"><i class="fa-solid fa-pen"></i> Edit</button>
      <button type="button" class="ctx-btn" title="Buka Port Map" data-ctx-act="port"><i class="fa-solid fa-ethernet"></i> Port Map</button>
      <button type="button" class="ctx-btn" title="Buka Power Map" data-ctx-act="power"><i class="fa-solid fa-plug"></i> Power Map</button>
      ${loc}
      <button type="button" class="ctx-btn danger" title="Hapus storage" data-ctx-act="delete"><i class="fa-solid fa-trash"></i> Hapus</button>
      <button type="button" class="ctx-btn" title="Tutup" data-ctx-act="close"><i class="fa-solid fa-xmark"></i></button>
    </div>`;
}

function updateStgCtxBar() {
  const bar = document.getElementById("stg-ctx-bar");
  if (!bar) return;
  const s = findStorageForAction(selectedStgKey);
  if (!s) { bar.hidden = true; return; }
  bar.hidden = false;
  bar.innerHTML = buildStgCtxBarHTML(s);
  const key = String(s.hostname || s.deviceKey || s.id || "").replace(/'/g, "");
  const form = String(s.formFactor || s.uHeight || "").replace(/'/g, "");
  const psu = Math.max(1, parseInt(s.psuCount, 10) || 2);
  bar.onclick = (e) => {
    const actBtn = e.target.closest("[data-ctx-act]");
    if (!actBtn) return;
    const act = actBtn.dataset.ctxAct;
    const sel = selectedStgKey;
    if (act === "close") { selectedStgKey = null; renderStorageList(); return; }
    if (act === "view") { viewStorage(sel); return; }
    if (act === "edit") { editStorage(sel); return; }
    if (act === "port") {
      if (typeof openPortMap === "function") openPortMap(key, false, 0, { type: "storage", formFactor: form });
      else window.open("port-map.html?device=" + encodeURIComponent(key), "_blank", "noopener");
      return;
    }
    if (act === "power") {
      if (typeof openPowerMap === "function") openPowerMap(key, false, psu);
      else window.open("power-map.html?device=" + encodeURIComponent(key), "_blank", "noopener");
      return;
    }
    if (act === "loc") { gotoStorageLocation(sel); return; }
    if (act === "delete") { deleteStorageRecord(sel); return; }
  };
}

// Fungsi bantu untuk mencari record storage berdasarkan deviceKey/hostname/id
function findStorageRecord(id) {
  const data = getAllStorages();
  if (!Array.isArray(data)) return null;
  const k = String(id || "").toLowerCase();
  return data.find(x => String(x.deviceKey || "").toLowerCase() === k
    || String(x.hostname || "").toLowerCase() === k
    || String(x.id || "").toLowerCase() === k) || null;
}

// Bantu cari record untuk aksi baris (rv_storage + rv_accessories type storage)
function findStorageForAction(key) {
  const s = findStorageRecord(key);
  if (s) return s;
  try {
    const acc = JSON.parse(localStorage.getItem(ACC_STORAGE_KEY) || "[]");
    const a = (Array.isArray(acc) ? acc : [])
      .find(x => (x.type === "storage" || x.type === "custom") && String(x.name || "").toLowerCase() === String(key || "").toLowerCase());
    if (a) return { ...a, hostname: a.name };
  } catch (e) { /* abaikan */ }
  return null;
}

function openStgPowerMap(key) {
  const s = findStorageForAction(key);
  const name = (s && (s.hostname || s.deviceKey)) || key;
  const psu = Math.max(1, parseInt((s && s.psuCount) || 2, 10) || 2);
  if (typeof openPowerMap === "function") {
    openPowerMap(name, false, psu);
  } else {
    window.open("power-map.html?device=" + encodeURIComponent(name), "_blank", "noopener");
  }
}

function openStgPortMap(key) {
  const s = findStorageForAction(key);
  const name = (s && (s.hostname || s.deviceKey)) || key;
  const form = String((s && (s.formFactor || s.uHeight)) || "").replace(/'/g, "");
  if (typeof openPortMap === "function") {
    openPortMap(name, false, 0, { type: "storage", formFactor: form });
  } else {
    window.open("port-map.html?device=" + encodeURIComponent(name), "_blank", "noopener");
  }
}

function postAudit(action, target, detail) {
  try {
    const base = typeof API_BASE !== "undefined" ? API_BASE : "/api";
    fetch(base + "/audit/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, target, detail })
    });
  } catch (e) { /* abaikan */ }
}

function gotoStorageLocation(key) {
  const s = findStorageForAction(key);
  const name = (s && (s.hostname || s.deviceKey)) || key;
  const rack = (s && s.rack && s.rack !== "-") ? s.rack : "";
  if (!rack) {
    if (typeof showToast === "function") showToast("Storage " + name + " belum ditempatkan di rack.", "warn");
    else alert("Storage " + name + " belum ditempatkan di rack.");
    return;
  }
  const params = new URLSearchParams({ rack });
  if (name) params.set("device", name);
  window.location.href = "rack-elevation.html?" + params.toString();
}

function deleteStorageRecord(key) {
  const s = findStorageForAction(key);
  const name = (s && (s.hostname || s.deviceKey)) || key;
  const doubleOk = typeof window.confirmDoubleDelete === "function"
    ? window.confirmDoubleDelete(name)
    : (confirm("Hapus " + name + "?") && confirm("Yakin ingin menghapus permanen? Data yang dihapus tidak dapat dikembalikan."));
  if (!doubleOk) return;
  const id = s && s.id;
  try {
    const cur = JSON.parse(localStorage.getItem(STORAGE_STORAGE_KEY) || "[]");
    localStorage.setItem(STORAGE_STORAGE_KEY, JSON.stringify((Array.isArray(cur) ? cur : []).filter(x =>
      id ? String(x.id) !== String(id) : !(x.hostname === name || x.deviceKey === name))));
  } catch (e) { /* abaikan */ }
  try {
    const acc = JSON.parse(localStorage.getItem(ACC_STORAGE_KEY) || "[]");
    localStorage.setItem(ACC_STORAGE_KEY, JSON.stringify((Array.isArray(acc) ? acc : []).filter(x =>
      !(String(x.name || "").toLowerCase() === String(name).toLowerCase() && (x.type === "storage" || x.type === "custom")))));
  } catch (e) { /* abaikan */ }
  if (name && typeof apiDeleteDevice === "function") apiDeleteDevice(name);
  [PORT_STORAGE_KEY, POWER_STORAGE_KEY].forEach(k => {
    try {
      const obj = JSON.parse(localStorage.getItem(k) || "{}") || {};
      if (obj && Object.prototype.hasOwnProperty.call(obj, name)) {
        delete obj[name];
        localStorage.setItem(k, JSON.stringify(obj));
      }
    } catch (e) { /* abaikan */ }
  });
  if (typeof PORT_DATA !== "undefined") delete PORT_DATA[name];
  if (typeof POWER_DATA !== "undefined") delete POWER_DATA[name];
  if (typeof apiDeleteMap === "function") { apiDeleteMap("port", name); apiDeleteMap("power", name); }
  postAudit("storage.delete", name, "Dihapus dari List Storage (double confirmation)");
  if (typeof showToast === "function") showToast("Storage " + name + " berhasil dihapus.", "success");
  selectedStgKey = null;
  renderStorageList();
  const detailPanel = document.getElementById("storage-detail");
  if (detailPanel) detailPanel.style.display = "none";
}

// Tampilkan detail "Ringkasan Identitas Perangkat" di panel
function viewStorage(id) {
  const detailPanel = document.getElementById("storage-detail");
  const detailBody = document.getElementById("stg-detail-body");
  if (!detailPanel || !detailBody) {
    alert('Lihat detail: ' + id);
    return;
  }
  const s = findStorageRecord(id) || (typeof getStorages === "function" ? getStorages().find(x => x.id === id) : null);
  if (!s) {
    detailBody.innerHTML = '<div class="form-hint">Data storage tidak ditemukan.</div>';
    detailPanel.style.display = "";
    return;
  }
  if (typeof buildStorageSummaryHTML === "function") {
    detailBody.innerHTML = buildStorageSummaryHTML(s);
  } else {
    detailBody.innerHTML = '<div class="form-hint">Modul ringkasan (storage-summary.js) belum termuat.</div>';
  }
  detailPanel.style.display = "";
  detailPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Edit storage: buka modal edit (reuse dari storage-form.js)
function editStorage(id) {
  const s = findStorageRecord(id) || (typeof getStorages === "function" ? getStorages().find(x => x.id === id) : null);
  if (!s) {
    alert('Storage tidak ditemukan: ' + id);
    return;
  }
  if (typeof window.openStorageModal === "function") {
    window.openStorageModal(s);
  } else {
    alert('Edit: ' + id + ' — modul storage-form.js belum termuat.');
  }
}

// ---- Hydrate storage dari SQLite (DB = sumber utama) ----
// Sumber: GET /api/devices/storage (tabel devices, type='storage', data JSON
// hasil saveStorage). Cache lokal (rv_storage + rv_accessories) ditimpa dengan
// versi DB; record lokal yang dibuat saat offline tetap ditampilkan.
async function hydrateStoragesFromDb() {
  if (typeof fetch !== "function") return;
  const base = typeof API_BASE !== "undefined" ? API_BASE : "/api";
  let json;
  try {
    const res = await fetch(base + "/devices/storage");
    if (!res.ok || !res.json) return; // offline — biarkan localStorage
    json = await res.json();
  } catch (e) { return; }
  const list = json && Array.isArray(json.devices) ? json.devices : [];
  if (!list.length) return;

  let fromForm = [];
  try {
    fromForm = typeof readLocalStorages === "function" ? readLocalStorages()
      : JSON.parse(localStorage.getItem(STORAGE_STORAGE_KEY) || "[]");
  } catch (e) { fromForm = []; }
  if (!Array.isArray(fromForm)) fromForm = [];
  let accs = [];
  try { accs = JSON.parse(localStorage.getItem(ACC_STORAGE_KEY) || "[]"); } catch (e) { accs = []; }
  if (!Array.isArray(accs)) accs = [];

  for (const d of list) {
    const key = String(d.deviceKey || "").trim().toUpperCase();
    if (!key) continue;
    const data = { ...d };
    delete data.deviceKey;
    delete data.ok;
    const hasContent = Object.keys(data).length > 0;
    if (!hasContent) continue;
    const rec = { ...data, hostname: key, deviceKey: key };
    // rv_storage: timpa entri dengan hostname sama, kalau tidak ada → tambah
    const i = fromForm.findIndex(x => String(x.hostname || x.deviceKey || "").toUpperCase() === key);
    if (i >= 0) rec.id = fromForm[i].id || rec.id || ("stg-" + Date.now().toString(36));
    else rec.id = rec.id || ("stg-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6));
    if (i >= 0) fromForm[i] = rec; else fromForm.unshift(rec);
    // rv_accessories: singkronkan juga mirror type storage/custom
    const j = accs.findIndex(x => (x.type === "storage" || x.type === "custom") && String(x.name || "").toUpperCase() === key);
    if (j >= 0) accs[j] = { ...rec, name: key, type: accs[j].type };
    else accs.unshift({ ...rec, name: key, type: "storage" });
  }

  try {
    localStorage.setItem(STORAGE_STORAGE_KEY, JSON.stringify(fromForm));
    localStorage.setItem(ACC_STORAGE_KEY, JSON.stringify(accs));
  } catch (e) { /* storage tidak tersedia */ }
  renderStorageList();
}

// Inisialisasi: jalankan render saat halaman dimuat
// dan pasang event listener untuk tombol "Tambah Storage"
(function initStorageList() {
  // Render tabel storage list
  renderStorageList();

  // DB = sumber utama: tarik record dari SQLite lalu render ulang
  hydrateStoragesFromDb();

  // Pasang click listener ke tombol "Tambah Storage"
  const openAddBtn = document.getElementById("open-add-asset");
  if (openAddBtn) {
    openAddBtn.addEventListener("click", () => {
      if (typeof window.openStorageAdd === "function") {
        window.openStorageAdd();
      } else {
        console.warn('openStorageAdd tidak tersedia. Pastikan storage-form.js ter-load.');
        // Fallback: coba panggil render manual
        if (typeof window.renderStorageList === "function") {
          window.renderStorageList();
        }
      }
    });
  }

  // Export fungsi agar bisa dipanggil manual jika diperlukan
  window.renderStorageList = renderStorageList;
  window.reloadStorageList = renderStorageList;
  window.viewStorage = viewStorage;
  window.editStorage = editStorage;
  window.findStorageRecord = findStorageRecord;
  window.deleteStorageRecord = deleteStorageRecord;
  window.openStgPowerMap = openStgPowerMap;
  window.openStgPortMap = openStgPortMap;

  // Tutup panel detail
  const detailClose = document.getElementById("stg-detail-close");
  if (detailClose) {
    detailClose.addEventListener("click", () => {
      const detailPanel = document.getElementById("storage-detail");
      if (detailPanel) detailPanel.style.display = "none";
    });
  }
})();