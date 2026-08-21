/* ============================================
   RackView — Storage form (Identitas Perangkat)
   Dipakai di halaman storage-form.html (form penuh)
   DAN sebagai form inline di modal storage-list.html
   (id "storage-form-box" ada -> semua lookup discope).
   Data storage disimpan ke SQLite (POST /api/devices,
   type "storage" -> devices.data) dengan mirror
   localStorage (rv_storage) sebagai sumber full-data
   untuk daftar & edit.
   Memakai ulang editor dari server-form.js:
   initStorageEditor / initDimmEditor / collectStorageSlots /
   collectDimmSlots / populateRacks / tag-picker / dsb.
   Gambar perangkat (data-stgimg-*) ditangani sendiri
   (StgIMG) supaya tidak bentrok dengan DEVIMG server.
   ============================================ */

// ---- Scope: modal inline (storage-list.html) vs halaman penuh ----
const STORAGE_BOX = document.getElementById("storage-form-box");
const stg = {
  root: STORAGE_BOX || document,
  q(s) { return (STORAGE_BOX || document).querySelector(s); },
  qa(s) { return (STORAGE_BOX || document).querySelectorAll(s); },
};

// ---- Referensi data (lookups): dimuat dari SQLite via /api/refs ----
let STORAGE_FORM_FACTORS = {};
let STORAGE_TYPE_LABELS = {};
let STORAGE_FORM_IFACE = {};
let STORAGE_VENDORS = [];
let STORAGE_MODELS = [];

function storageRefsFromCache() {
  try {
    const raw = localStorage.getItem(STORAGE_REFS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function applyStorageRefs(refs) {
  if (!refs || !Object.keys(refs).length) return false;
  const setLabel = {};
  const setFF = {};
  const setIF = {};
  (refs.storage_types || []).forEach(t => { setLabel[t.key] = String(t.value || ""); });
  (refs.storage_form_factors || []).forEach(f => {
    try { setFF[f.key] = JSON.parse(String(f.value || "[]")); } catch (e) { setFF[f.key] = []; }
  });
  (refs.storage_ifaces || []).forEach(i => {
    const v = String(i.value || i.key || "");
    const short = v.replace(/^Interface\s+/i, "");
    setIF[i.key] = short || i.key;
  });
  STORAGE_TYPE_LABELS = setLabel;
  STORAGE_FORM_FACTORS = setFF;
  STORAGE_FORM_IFACE = setIF;
  STORAGE_VENDORS = (refs.storage_vendors || []).map(x => String(x.value || "")).filter(Boolean);
  STORAGE_MODELS = (refs.storage_models || []).map(x => String(x.value || "")).filter(Boolean);
  return true;
}

function loadStorageRefs() {
  let refs = null;
  if (typeof apiGetRefs === "function") {
    try { refs = apiGetRefs(); } catch (e) { refs = null; }
  }
  if (!refs || !applyStorageRefs(refs)) {
    refs = storageRefsFromCache();
    if (refs) applyStorageRefs(refs);
  }
  if (refs && Object.keys(refs).length) {
    try { localStorage.setItem(STORAGE_REFS_KEY, JSON.stringify(refs)); } catch (e) { /* abaikan */ }
  }
  populateStorageVendorModel();
  if (typeof populateStorageUHeight === "function") populateStorageUHeight();
}

function populateStorageVendorModel() {
  const vSel = stg.q('select[data-sf="vendor"]');
  if (vSel && STORAGE_VENDORS.length) {
    const current = vSel.value;
    vSel.innerHTML = STORAGE_VENDORS.map(v => '<option value="' + v.replace(/"/g, "&quot;") + '">' + v.replace(/</g, "&lt;") + "</option>").join("") + '<option value="Lainnya">Lainnya…</option>';
    if (current && [...vSel.options].some(o => o.value === current)) vSel.value = current;
  }
  const mList = stg.q("#storage-model-list");
  if (mList && STORAGE_MODELS.length) {
    mList.innerHTML = STORAGE_MODELS.map(m => '<option value="' + m.replace(/"/g, "&quot;") + '"></option>').join("");
  }
}

function storageGenId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return "sto-" + crypto.randomUUID();
  return "sto-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

// ---- Data layer: SQLite (devices) + mirror localStorage (rv_storage) ----
function readLocalStorages() {
  try {
    const raw = localStorage.getItem(STORAGE_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function getStorages() {
  return readLocalStorages();
}

function findStorage(id) {
  return readLocalStorages().find(s => s.id === id) || null;
}

// Bentuk record aksesori (rv_accessories) dari record storage supaya
// storage juga muncul di halaman Asset List ("Semua Asset").
function storageToAccessory(s) {
  return {
    name: s.hostname,
    type: "storage",
    brand: s.vendor,
    model: s.model,
    rack: s.rack,
    posisiU: s.posisiU,
    ip: s.ip,
    serial: s.serial,
    tags: Array.isArray(s.tags) ? s.tags.slice() : [],
    site: s.site || "DC1",
    lanRj45: s.lanRj45, lanSfp: s.lanSfp, lanQsfp: s.lanQsfp,
    speed: s.speed, psuCount: s.psuCount, psuWatt: s.psuWatt,
    powerRedundancy: s.powerRedundancy,
  };
}

function writeStorageMirror(entry) {
  try {
    const saved = readLocalStorages();
    const idx = saved.findIndex(s => s.id === entry.id);
    if (idx >= 0) saved[idx] = entry; else saved.unshift(entry);
    localStorage.setItem(STORAGE_STORAGE_KEY, JSON.stringify(saved));
  } catch (e) { /* abaikan */ }
  try {
    const acc = JSON.parse(localStorage.getItem(ACC_STORAGE_KEY) || "[]");
    const a = storageToAccessory(entry);
    const ai = acc.findIndex(x => x.name === a.name && x.type === "storage");
    if (ai >= 0) acc[ai] = a; else acc.unshift(a);
    localStorage.setItem(ACC_STORAGE_KEY, JSON.stringify(acc));
  } catch (e) { /* abaikan */ }
}

function saveStorage(rec) {
  const entry = { ...rec, id: storageGenId() };
  if (entry.hostname) entry.hostname = canonKey(entry.hostname);
  if (!entry.site && entry.rack) {
    const rackRow = typeof RACKS !== "undefined" && Array.isArray(RACKS)
      ? RACKS.find(r => String(r.rackId) === String(entry.rack) || String(r.rackId).toUpperCase() === String(entry.rack).toUpperCase())
      : null;
    if (rackRow && rackRow.site) entry.site = String(rackRow.site).trim();
  }
  try {
    if (typeof apiSaveDevice === "function") {
      const ok = apiSaveDevice({ deviceKey: entry.hostname, type: "storage", name: entry.hostname, data: entry });
      if (ok) console.info("[saveStorage] ✅ Berhasil kirim ke SQLite:", entry.hostname);
      else console.warn("[saveStorage] ⚠️ Gagal kirim ke SQLite:", entry.hostname);
    } else {
      console.warn("[saveStorage] apiSaveDevice belum tersedia — hanya localStorage.");
    }
  } catch (e) {
    console.error("[saveStorage] ❌ Gagal kirim ke SQLite:", e.message);
  }
  writeStorageMirror(entry);
  return true;
}

function updateStorage(id, rec) {
  if (!id) return false;
  const entry = { ...rec, id };
  if (entry.hostname) entry.hostname = canonKey(entry.hostname);
  if (!entry.site && entry.rack) {
    const rackRow = typeof RACKS !== "undefined" && Array.isArray(RACKS)
      ? RACKS.find(r => String(r.rackId) === String(entry.rack) || String(r.rackId).toUpperCase() === String(entry.rack).toUpperCase())
      : null;
    if (rackRow && rackRow.site) entry.site = String(rackRow.site).trim();
  }
  const prev = findStorage(id);
  const oldHost = prev && prev.hostname ? canonKey(prev.hostname) : "";
  if (oldHost && entry.hostname && oldHost !== entry.hostname) {
    if (typeof rekeyDeviceMaps === "function") rekeyDeviceMaps(oldHost, entry.hostname);
  }
  if (typeof apiSaveDevice === "function") {
    apiSaveDevice({ deviceKey: entry.hostname, type: "storage", name: entry.hostname, data: entry });
  }
  writeStorageMirror(entry);
  return true;
}

function deleteStorage(id) {
  const s = findStorage(id);
  try {
    localStorage.setItem(STORAGE_STORAGE_KEY, JSON.stringify(readLocalStorages().filter(x => x.id !== id)));
  } catch (e) { /* abaikan */ }
  try {
    if (s && s.hostname) {
      const acc = JSON.parse(localStorage.getItem(ACC_STORAGE_KEY) || "[]");
      localStorage.setItem(ACC_STORAGE_KEY, JSON.stringify(acc.filter(x => !(x.name === s.hostname && x.type === "storage"))));
    }
  } catch (e) { /* abaikan */ }
  if (s && s.hostname && typeof apiDeleteDevice === "function") apiDeleteDevice(s.hostname);
  return true;
}

// ---- Tinggi Rack (U): dropdown tunggal 1U-24U (mengganti Form Factor + input terpisah) ----
const stgRackU = STORAGE_BOX ? stg.q('[data-sf="uHeight"]') : document.querySelector('[data-sf="uHeight"]');

function populateStorageUHeight() {
  if (!stgRackU) return;
  const current = stgRackU.value;
  stgRackU.innerHTML = "";
  for (let i = 1; i <= 24; i++) {
    const o = document.createElement("option");
    o.value = i + "U";
    o.textContent = i + "U";
    if (o.value === current) o.selected = true;
    stgRackU.appendChild(o);
  }
  stgRackU.dispatchEvent(new Event("change"));
}

if (stgRackU) populateStorageUHeight();

// ---- RAID Controller: Ya/Tidak -> tampilkan tipe RAID (scoped ke storage) ----
const stgRaidToggle = STORAGE_BOX ? stg.q("#stg-raid-toggle-picker") : document.getElementById("raid-toggle-picker");
const stgRaidTypeField = STORAGE_BOX ? stg.q("#stg-raid-type-field") : document.getElementById("raid-type-field");

function stgSyncRaid() {
  if (!stgRaidToggle || !stgRaidTypeField) return;
  const yes = [...stgRaidToggle.querySelectorAll(".chip")].find(c => c.textContent.trim() === "Ya");
  stgRaidTypeField.style.display = yes && yes.classList.contains("active") ? "" : "none";
}

if (stgRaidToggle && stgRaidTypeField) {
  stgRaidToggle.addEventListener("click", stgSyncRaid);
  stgSyncRaid();
}

// ---- Background Color (Rack Elevation): scoped ke storage ----
const stgRackColorPicker = STORAGE_BOX ? stg.q("#stg-rack-color-picker") : document.getElementById("rack-color-picker");
const stgRackColorInput = STORAGE_BOX ? stg.q("#stg-rack-color-input") : document.getElementById("rack-color-input");
const stgRackColorValue = STORAGE_BOX ? stg.q("#stg-rack-color-value") : document.getElementById("rack-color-value");

if (stgRackColorPicker && stgRackColorInput && stgRackColorValue) {
  stgRackColorPicker.addEventListener("click", e => {
    const sw = e.target.closest(".swatch");
    if (!sw) return;
    stgRackColorPicker.querySelectorAll(".swatch").forEach(s => s.classList.remove("active"));
    sw.classList.add("active");
    stgRackColorValue.value = sw.dataset.color || "";
  });
  stgRackColorInput.addEventListener("input", () => {
    stgRackColorPicker.querySelectorAll(".swatch").forEach(s => s.classList.remove("active"));
    stgRackColorValue.value = stgRackColorInput.value;
  });
}

// ---- Upload gambar depan/belakang perangkat (Rack Elevation) ----
// Pakai atribut data-stgimg-* (bukan data-devimg-*) supaya tidak dibind
// oleh DEVIMG server-form.js. Slug = nama aset di form storage.
const StgIMG = {
  current: { front: null, back: null }, // {file?, url?, cleared?}
  slugOf() {
    const el = stg.q('[data-sf="hostname"]');
    return String(el ? el.value : "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  },
  msg(view, text, kind) {
    const el = stg.q(`[data-stgimg-msg="${view}"]`);
    if (!el) return;
    el.textContent = text || "";
    el.style.color = kind === "err" ? "var(--danger)" : "var(--text-secondary)";
  },
  async upload(view, slug, file) {
    try {
      const res = await fetch("/api/device-image/" + encodeURIComponent(slug) + "/" + view, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        StgIMG.msg(view, "Upload gagal: " + (err.error || res.status), "err");
        return;
      }
      const data = await res.json();
      StgIMG.current[view] = { url: data.url, name: data.name };
      StgIMG.showPreview(view, data.url);
      StgIMG.msg(view, "Gambar tampak " + (view === "front" ? "depan" : "belakang") + " terpasang.", "ok");
    } catch (e) {
      StgIMG.msg(view, "Upload gagal — pastikan server backend aktif.", "err");
    }
  },
  showPreview(view, url) {
    const img = stg.q(`[data-stgimg-preview="${view}"]`);
    const btn = stg.q(`[data-stgimg-clear="${view}"]`);
    if (img) { img.src = url; img.style.display = ""; }
    if (btn) btn.style.display = "";
  },
  loadExisting(s) {
    if (!s) return;
    ["front", "back"].forEach(view => {
      const slug = String(s.hostname || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      if (!slug) return;
      const url = s.image && s.image[view];
      if (url) {
        StgIMG.current[view] = { url };
        StgIMG.showPreview(view, url);
        StgIMG.msg(view, "");
        return;
      }
      const exts = ["jpg", "png", "jpeg", "webp"];
      let i = 0;
      const probe = () => {
        if (i >= exts.length) return;
        const cand = "/data/uploads/devices/" + slug + "-" + view + "." + exts[i++];
        const t = new Image();
        t.onload = () => {
          StgIMG.current[view] = { url: cand };
          StgIMG.showPreview(view, cand);
        };
        t.onerror = probe;
        t.src = cand;
      };
      probe();
    });
  },
  reset() {
    StgIMG.current = { front: null, back: null };
    ["front", "back"].forEach(view => {
      const img = stg.q(`[data-stgimg-preview="${view}"]`);
      if (img) { img.style.display = "none"; img.removeAttribute("src"); }
      const btn = stg.q(`[data-stgimg-clear="${view}"]`);
      if (btn) btn.style.display = "none";
      StgIMG.msg(view, "");
    });
  },
  init() {
    stg.qa("[data-stgimg-pick]").forEach(btn => {
      const view = btn.dataset.stgimgPick;
      const input = stg.q(`[data-stgimg-file="${view}"]`);
      btn.addEventListener("click", () => { if (input) input.click(); });
    });
    stg.qa("[data-stgimg-file]").forEach(input => {
      input.addEventListener("change", () => {
        const view = input.dataset.stgimgFile;
        const file = input.files && input.files[0];
        if (!file) return;
        if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
          StgIMG.msg(view, "Format tidak didukung — gunakan PNG/JPG/WEBP.", "err");
          return;
        }
        const slug = StgIMG.slugOf();
        if (!slug) {
          StgIMG.msg(view, "Isi Nama Aset / Hostname dulu sebelum upload gambar.", "err");
          return;
        }
        StgIMG.current[view] = { file };
        StgIMG.upload(view, slug, file);
      });
    });
    stg.qa("[data-stgimg-clear]").forEach(btn => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.stgimgClear;
        StgIMG.current[view] = { cleared: true };
        const img = stg.q(`[data-stgimg-preview="${view}"]`);
        if (img) { img.style.display = "none"; img.removeAttribute("src"); }
        btn.style.display = "none";
        StgIMG.msg(view, "Menghapus gambar…", "ok");
        const slug = StgIMG.slugOf();
        if (slug) {
          fetch("/api/device-image/" + encodeURIComponent(slug) + "/" + view, { method: "DELETE" })
            .then(r => { StgIMG.msg(view, r.ok ? "Gambar dihapus." : "Gagal menghapus (offline) — gambar tetap di server.", "ok"); })
            .catch(() => { StgIMG.msg(view, "Gagal menghapus (offline) — gambar tetap di server.", "ok"); });
        } else {
          StgIMG.msg(view, "Gambar akan dihapus saat storage disimpan.", "ok");
        }
      });
    });
  },
};
StgIMG.init();

// ---- Storage Controller: single / dual / multi (tiap controller punya port sendiri) ----
let CONTROLLERS = [];
let ctlEditingIdx = -1;
const cmOverlay = document.getElementById("cm-overlay");
const cmBody = document.getElementById("cm-body");
const cmTitle = document.getElementById("cm-title");

function nextCtlSlot() {
  return CONTROLLERS.reduce((m, c) => Math.max(m, parseInt(c.slot, 10) || 0), 0) + 1;
}

function ctlPortSummary(c) {
  const parts = [];
  const lan = [c.lanRj45, c.lanSfp, c.lanQsfp].filter(Boolean).join("/");
  if (lan) parts.push("LAN " + lan);
  if (c.fcPorts) parts.push((c.fcType || "FC") + " " + c.fcPorts);
  if (c.mgmtPort) parts.push("Mgmt " + c.mgmtPort);
  if (c.consolePort === "Ya") parts.push("Console");
  return parts.join(" · ") || "—";
}

function renderControllerList() {
  document.querySelectorAll("[data-ctl-tbody]").forEach(tbody => {
    if (!CONTROLLERS.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:18px;">Belum ada controller. Klik "Tambah Controller" — single, dual, atau multi controller.</td></tr>';
      return;
    }
    tbody.innerHTML = CONTROLLERS.map((c, i) => `
      <tr>
        <td class="mono">${escNode(c.slot ?? i + 1)}</td>
        <td class="strong">${escNode(c.name || "—")}${c.mgmtIp ? '<div class="mono" style="font-size:11px;color:var(--text-secondary)">' + escNode(c.mgmtIp) + "</div>" : ""}</td>
        <td>${escNode(c.processor || "—")}</td>
        <td>${escNode(c.dimmInstalled || "—")}</td>
        <td class="mono" style="font-size:11px;color:var(--text-secondary);">${escNode(ctlPortSummary(c))}</td>
        <td>${escNode(c.kondisi || "—")}</td>
        <td style="white-space:nowrap;">
          <button class="btn ghost btn-sm" type="button" data-ctl-edit="${i}" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="btn ghost btn-sm" type="button" data-ctl-del="${i}" title="Hapus"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`).join("");
  });
}

function controllerFormHtml() {
  return `
  <div class="form-grid">
    <div class="m-field">
      <label class="form-label">Nama Controller</label>
      <input class="form-input mono" type="text" placeholder="mis. CTRL-A" data-ctl="name">
    </div>
    <div class="m-field">
      <label class="form-label">Management IP</label>
      <input class="form-input mono" type="text" placeholder="mis. 10.10.4.11" data-ctl="mgmtIp">
    </div>
    <div class="m-field full">
      <label class="form-label">Firmware / OS Controller</label>
      <input class="form-input mono" type="text" placeholder="mis. ONTAP 9.14 · Unity OE 5.4 · VSP 7.x" data-ctl="firmware">
    </div>
    <div class="m-field">
      <label class="form-label">Processor</label>
      <input class="form-input" type="text" placeholder="Tipe, mis. Intel Xeon" data-ctl="processor">
    </div>
    <div class="m-field">
      <label class="form-label">Core / Thread</label>
      <input class="form-input" type="text" placeholder="mis. 16C / 32T" data-ctl="coreThread">
    </div>
    <div class="m-field full" data-dimm-editor>
      <label class="form-label">Slot Memory (DIMM) — Controller</label>
      <div class="form-row form-row-3">
        <input class="form-input" type="number" min="0" max="128" placeholder="Total slot, mis. 16" data-ctl="dimmTotal" data-dimm-slots>
        <input class="form-input" type="text" placeholder="Kapasitas default/slot, mis. 32 GB" data-sf="dimmPerSlot" title="Kapasitas default saat mengisi slot baru">
        <input class="form-input mono" type="text" placeholder="Terpasang (otomatis)" data-ctl="dimmInstalled" data-dimm-installed readonly>
      </div>
      <div class="storage-toolbar">
        <span class="form-hint">Klik slot = isi/panel · Slot kosong otomatis memakai kapasitas default.</span>
      </div>
      <div class="storage-legend"><i class="st-st-online"></i>Online<i class="st-st-degradasi"></i>Degradasi<i class="st-st-failed"></i>Failed</div>
      <div class="storage-grid" data-dimm-grid>
        <div class="form-hint" data-dimm-empty>Masukkan jumlah slot untuk membuat grid DIMM.</div>
      </div>
      <div class="storage-edit" data-dimm-edit style="display:none;">
        <span class="storage-edit-bay">Slot <b data-dimm-edit-slot>1</b></span>
        <select class="form-input" data-dimm-edit-type>
          <option value="DDR4">DDR4</option>
          <option value="DDR5">DDR5</option>
          <option value="DDR3">DDR3</option>
          <option value="LRDIMM">LRDIMM</option>
        </select>
        <input class="form-input mono" type="number" min="1" placeholder="Kapasitas" data-dimm-edit-cap>
        <select class="form-input" data-dimm-edit-unit>
          <option value="GB">GB</option>
          <option value="TB">TB</option>
        </select>
        <input class="form-input" list="ctl-dimm-brand-options" placeholder="Brand" title="Merek modul" data-dimm-edit-brand>
        <select class="form-input" data-dimm-edit-status title="Status modul">
          <option value="online">Online</option>
          <option value="degradasi">Degradasi</option>
          <option value="failed">Failed</option>
        </select>
        <input class="form-input" placeholder="Notes" title="Catatan modul" data-dimm-edit-notes>
        <button class="btn ghost btn-sm" type="button" data-dimm-empty-btn title="Kosongkan slot"><i class="fa-solid fa-ban"></i> Kosongkan</button>
      </div>
      <datalist id="ctl-dimm-brand-options">
        <option value="Samsung"></option>
        <option value="SK hynix"></option>
        <option value="Micron"></option>
        <option value="Crucial"></option>
        <option value="Kingston"></option>
        <option value="Nanya"></option>
        <option value="ADATA"></option>
      </datalist>
      <div class="storage-summary" data-dimm-summary style="display:none;"></div>
    </div>
    <div class="m-field full">
      <label class="form-label">LAN Port Map (Controller)</label>
      <div class="form-row form-row-3">
        <input class="form-input" type="text" placeholder="RJ-45, mis. 2" data-ctl="lanRj45">
        <input class="form-input" type="text" placeholder="SFP, mis. 4" data-ctl="lanSfp">
        <input class="form-input" type="text" placeholder="QSFP, mis. 2" data-ctl="lanQsfp">
      </div>
    </div>
    <div class="m-field">
      <label class="form-label">Kecepatan LAN Port</label>
      <div class="tag-picker" data-single data-sf-pick="lanSpeed">
        <div class="chip active">1G</div>
        <div class="chip">10G</div>
        <div class="chip">25G</div>
        <div class="chip">40G</div>
        <div class="chip">100G</div>
      </div>
    </div>
    <div class="m-field full">
      <label class="form-label">SAN / Host Port (per controller)</label>
      <div class="form-row form-row-3">
        <select class="form-input" data-ctl="fcType">
          <option value="fc">Fibre Channel</option>
          <option value="iscsi">iSCSI</option>
          <option value="sas">SAS</option>
          <option value="nvmeof">NVMe-oF</option>
        </select>
        <input class="form-input" type="text" placeholder="Jumlah port, mis. 4" data-ctl="fcPorts">
        <input class="form-input" type="text" placeholder="Speed, mis. 32 Gbps" data-ctl="fcSpeed">
      </div>
    </div>
    <div class="m-field">
      <label class="form-label">Management Port</label>
      <div class="tag-picker" data-single data-sf-pick="mgmtPort">
        <div class="chip active">Web GUI</div>
        <div class="chip">SSH/CLI</div>
        <div class="chip">IPMI</div>
      </div>
    </div>
    <div class="m-field">
      <label class="form-label">Console Port</label>
      <div class="tag-picker" data-single data-sf-pick="consolePort">
        <div class="chip">Tidak</div>
        <div class="chip active">Ya</div>
      </div>
    </div>
    <div class="m-field full">
      <label class="form-label">Kondisi Controller</label>
      <div class="tag-picker" data-single data-sf-pick="kondisi">
        <div class="chip active">online</div>
        <div class="chip">degradasi</div>
        <div class="chip">failed</div>
        <div class="chip">standby</div>
      </div>
    </div>
    <div class="m-field full">
      <label class="form-label">Notes</label>
      <textarea class="form-input" rows="2" placeholder="Catatan controller, mis. peran A/B, zona fabric" data-ctl="notes"></textarea>
    </div>
  </div>`;
}

function collectControllerForm() {
  if (!cmBody) return {};
  const c = {};
  cmBody.querySelectorAll("[data-ctl]").forEach(el => { c[el.dataset.ctl] = (el.value || "").trim(); });
  const dm = typeof collectDimmSlots === "function" ? collectDimmSlots(cmBody) : null;
  if (dm && dm.slots.length) {
    c.dimmSlots = dm.slots;
    c.dimmInstalled = (typeof fmtStorage === "function" ? fmtStorage(dm.installedGB) : "") || c.dimmInstalled;
  } else {
    c.dimmSlots = [];
  }
  cmBody.querySelectorAll("[data-sf-pick]").forEach(p => {
    const k = p.dataset.sfPick;
    const multi = p.dataset.multi != null;
    const active = [...p.querySelectorAll(".chip.active")];
    c[k] = multi ? active.map(x => x.textContent.trim()) : (active[0] ? active[0].textContent.trim() : "");
  });
  return c;
}

function openControllerModal(idx) {
  if (!cmOverlay || !cmBody) return;
  ctlEditingIdx = idx == null ? -1 : idx;
  cmBody.innerHTML = controllerFormHtml();
  cmTitle.textContent = ctlEditingIdx >= 0 ? "Edit Controller " + CONTROLLERS[ctlEditingIdx].slot : "Tambah Controller";
  const dmEd = cmBody.querySelector("[data-dimm-editor]");
  if (dmEd && typeof initDimmEditor === "function") initDimmEditor(dmEd);
  if (ctlEditingIdx >= 0) prefillControllerForm(CONTROLLERS[ctlEditingIdx]);
  cmOverlay.classList.add("open");
}

function closeControllerModal() {
  if (cmOverlay) cmOverlay.classList.remove("open");
}

function prefillControllerForm(c) {
  cmBody.querySelectorAll("[data-ctl]").forEach(el => { if (c[el.dataset.ctl] != null) el.value = c[el.dataset.ctl]; });
  const dmEd = cmBody.querySelector("[data-dimm-editor]");
  if (dmEd && typeof dmEd._setDimmSlots === "function") {
    dmEd._setDimmSlots(parseInt(c.dimmTotal || "0", 10) || 0, Array.isArray(c.dimmSlots) ? c.dimmSlots : []);
  }
  cmBody.querySelectorAll("[data-sf-pick]").forEach(p => {
    const k = p.dataset.sfPick;
    const v = c[k];
    if (v == null) return;
    const targets = Array.isArray(v) ? v : [v];
    p.querySelectorAll(".chip").forEach(ch => {
      if (ch.dataset.addChip) return;
      const hit = targets.some(x => String(x).trim().toLowerCase() === ch.textContent.trim().toLowerCase());
      ch.classList.toggle("active", hit);
    });
  });
}

function saveControllerModal() {
  if (!cmBody) return;
  const c = collectControllerForm();
  if (!c.name) {
    cmBody.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  c.slot = ctlEditingIdx >= 0 ? CONTROLLERS[ctlEditingIdx].slot : nextCtlSlot();
  if (ctlEditingIdx >= 0) CONTROLLERS[ctlEditingIdx] = c;
  else CONTROLLERS.push(c);
  renderControllerList();
  closeControllerModal();
}

if (cmOverlay) {
  document.addEventListener("click", e => {
    const editBtn = e.target.closest("[data-ctl-edit]");
    if (editBtn) { openControllerModal(parseInt(editBtn.dataset.ctlEdit, 10)); return; }
    const delBtn = e.target.closest("[data-ctl-del]");
    if (delBtn) { CONTROLLERS.splice(parseInt(delBtn.dataset.ctlDel, 10), 1); renderControllerList(); return; }
    const addBtn = e.target.closest("[data-ctl-add]");
    if (addBtn) { openControllerModal(-1); return; }
    if (e.target.closest("[data-ctl-cancel]") || e.target.closest("#cm-close")) { closeControllerModal(); return; }
    if (e.target.closest("[data-ctl-confirm]")) { saveControllerModal(); return; }
    if (e.target === cmOverlay) closeControllerModal();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && cmOverlay.classList.contains("open")) closeControllerModal();
  });
  cmBody.addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (chip && !chip.dataset.addChip) {
      const picker = chip.closest(".tag-picker");
      if (picker) {
        if (picker.dataset.single != null) {
          picker.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
          chip.classList.add("active");
        } else {
          chip.classList.toggle("active");
        }
      }
      return;
    }
  });
}

// ---- Kumpulkan isian form storage ----
const STORAGE_NORM = Object.assign({}, typeof NORM !== "undefined" ? NORM : {});

function collectStorageForm(root) {
  root = root || stg.root;
  const sf = key => {
    const el = root.querySelector(`[data-sf="${key}"]`);
    return el ? (el.value || "").trim() : "";
  };
  const sfText = key => {
    const el = root.querySelector(`[data-sf="${key}"]`);
    if (!el) return "";
    const opt = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
    return opt ? opt.textContent.trim() : (el.value || "").trim();
  };
  const pick = (key, multi) => {
    const p = root.querySelector(`[data-sf-pick="${key}"]`);
    if (!p) return multi ? [] : "";
    const active = [...p.querySelectorAll(".chip.active")];
    if (multi) return active.map(c => (STORAGE_NORM[key] || (t => t))(c.textContent.trim())).filter(Boolean);
    const c = p.querySelector(".chip.active") || p.querySelector(".brand-tile.selected");
    return c ? (STORAGE_NORM[key] || (t => t))(c.textContent.trim()) : "";
  };

  const core = sf("core"), thread = sf("thread");
  const coreThread = [core, thread].filter(Boolean).join(" / ") || sf("coreThread");
  const cable = [sf("cablePanel"), sf("cablePorts")].filter(Boolean).join(" · ") || sf("cableManagement");
  const st = typeof collectStorageSlots === "function" ? collectStorageSlots(root) : null;
  const dm = typeof collectDimmSlots === "function" ? collectDimmSlots(root) : null;

  const siteEl = root.querySelector('[data-sf="site"]');
  const site = sf("site");
  const siteName = siteEl && siteEl.selectedIndex >= 0 ? siteEl.options[siteEl.selectedIndex].textContent.trim() : "";
  const vendor = sf("vendor") === "Lainnya" ? (sf("vendorOther") || "Lainnya") : sf("vendor");
  const rack = sf("rack");
  let siteCode = site;
  if (!siteCode && rack) {
    const rackRow = typeof RACKS !== "undefined" && Array.isArray(RACKS)
      ? RACKS.find(r => String(r.rackId) === String(rack) || String(r.rackId).toUpperCase() === String(rack).toUpperCase())
      : null;
    if (rackRow && rackRow.site) siteCode = String(rackRow.site).trim();
  }

  return {
    hostname: sf("hostname"),
    storageType: sf("storageType") || "san",
    formFactor: sf("uHeight"),
    uHeight: sf("uHeight"),
    vendor,
    model: sf("model"),
    serial: sf("serial"),
    ip: sf("ip"),
    tahunPembelian: sf("tahunPembelian"),
    warranty: sf("warranty"),
    os: sf("os"),
    processorCount: sf("processorCount"),
    processorType: sf("processorType"),
    coreThread,
    dimmTotal: dm ? dm.total : sf("dimmTotal"),
    dimmPerSlot: sf("dimmPerSlot"),
    dimmInstalled: dm && dm.slots.length ? (fmtStorage(dm.installedGB) || sf("dimmInstalled")) : sf("dimmInstalled"),
    dimmSlots: dm ? dm.slots : undefined,
    storageBays: st ? st.bays : sf("storageBays"),
    storageCap: st ? (fmtStorage(storageTotalGB(st.slots)) || sf("storageCap")) : sf("storageCap"),
    storageIface: st ? (st.iface || sf("storageIface")) : (STORAGE_FORM_IFACE[sf("storageIface")] || sfText("storageIface")),
    storageSlots: st ? st.slots : undefined,
    raid: pick("raid", false),
    raidTypes: pick("raidTypes", true),
    lanRj45: sf("lanRj45"),
    lanSfp: sf("lanSfp"),
    lanQsfp: sf("lanQsfp"),
    speed: pick("speed", false),
    fcType: sf("fcType"),
    fcPorts: sf("fcPorts"),
    fcSpeed: sf("fcSpeed"),
    wwnn: sf("wwnn"),
    sanFabric: sf("sanFabric"),
    mgmtPort: pick("mgmtPort", false),
    psuCount: sf("psuCount") || "2",
    psuWatt: sf("psuWatt") || "800 W",
    powerRedundancy: pick("powerRedundancy", false),
    site: siteCode,
    siteName,
    rack,
    posisiU: sf("posisiU"),
    rackColor: sf("rackColor"),
    vlan: sf("vlan"),
    cableManagement: cable,
    coolingBtu: sf("coolingBtu"),
    airflow: sf("airflow"),
    kondisi: pick("kondisi", false),
    monitoring: pick("monitoring", true),
    assetTag: sf("assetTag"),
    tags: pick("tags", true),
    controllers: CONTROLLERS.map(c => ({ ...c })),
  };
}

function mergeStorageImages(rec) {
  const img = {};
  ["front", "back"].forEach(v => {
    const st = StgIMG.current[v];
    if (st && st.url) img[v] = st.url;
  });
  if (Object.keys(img).length) rec.image = img;
  return rec;
}

// ---- Prefill form untuk mode edit (full page / modal) ----
let storageEditingId = null;

function prefillStorageForm(s) {
  if (!s) return;
  storageEditingId = s.id;
  const root = stg.root;

  if (STORAGE_BOX) {
    const mt = document.getElementById("storage-modal-title");
    if (mt) mt.innerHTML = '<i class="fa-solid fa-pen" style="color:var(--accent);margin-right:8px;"></i> Edit Storage — ' + (typeof escNode === "function" ? escNode(s.hostname || s.id) : (s.hostname || s.id));
    const ms = document.getElementById("storage-modal-sub");
    if (ms) ms.textContent = "Ubah data lalu klik Simpan Perubahan.";
  } else {
    const h1 = document.getElementById("form-page-title");
    if (h1) h1.textContent = "Edit Storage — " + (s.hostname || s.id);
    const sub = document.querySelector(".topbar-sub");
    if (sub) sub.textContent = "Perbarui identitas & spesifikasi " + (s.hostname || s.id);
    const fh = document.querySelector(".form-head h2");
    if (fh) fh.textContent = "Edit Storage — " + (s.hostname || s.id);
    const fhs = document.querySelector(".form-head-sub");
    if (fhs) fhs.textContent = "Ubah data lalu klik Simpan Perubahan untuk memperbarui.";
    const saveBtn = document.getElementById("save-storage");
    if (saveBtn) saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan';
    const banner = document.getElementById("edit-banner");
    if (banner) {
      banner.style.display = "flex";
      banner.innerHTML = '<i class="fa-solid fa-pen"></i> Mode Edit: ' + (typeof escNode === "function" ? escNode(s.hostname || s.id) : (s.hostname || s.id));
    }
  }

// ---- Tinggi Rack (U) prefill ----
if (s.storageType) {
  const st = root.querySelector('[data-sf="storageType"]');
  if (st) st.value = s.storageType;
}
const uNorm = (v) => {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  // Normalkan ke format "XU" (misal "2" -> "2U", "2U" -> "2U")
  if (/^\d+$/.test(s)) return s + "U";
  if (/^\d+U$/i.test(s)) return s.toUpperCase();
  return s;
};
populateStorageUHeight();
const uVal = uNorm(s.uHeight) || uNorm(s.formFactor) || "";
if (uVal) {
  root.querySelectorAll('[data-sf="uHeight"]').forEach(el => {
    // Coba set value, jika tidak ada opsi yang cocok, tambahkan secara dinamis
    const found = [...el.options].some(o => o.value === uVal);
    if (!found && el.tagName === "SELECT") {
      const opt = document.createElement("option");
      opt.value = uVal;
      opt.textContent = uVal;
      el.appendChild(opt);
    }
    el.value = uVal;
  });
}

  root.querySelectorAll("[data-sf]").forEach(el => {
    const k = el.dataset.sf;
    if (!k || s[k] == null) return;
    el.value = s[k];
  });
  root.querySelectorAll('select[data-sf="psuCount"]').forEach(sel => {
    const v = s.psuCount == null ? "" : String(s.psuCount);
    if (v && ![...sel.options].some(o => o.value === v)) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v + " PSU";
      sel.appendChild(opt);
    }
    if (v) sel.value = v;
  });
  if (s.coreThread) {
    const parts = String(s.coreThread).split("/").map(x => x.trim());
    root.querySelectorAll('[data-sf="core"]').forEach(el => el.value = parts[0] || "");
    root.querySelectorAll('[data-sf="thread"]').forEach(el => el.value = parts[1] || "");
  }
  if (s.cableManagement && s.cableManagement !== "-") {
    const parts = String(s.cableManagement).split(" · ");
    const panelEl = root.querySelector('[data-sf="cablePanel"]');
    const portsEl = root.querySelector('[data-sf="cablePorts"]');
    if (panelEl) panelEl.value = parts[0] || "";
    if (portsEl) portsEl.value = parts.slice(1).join(" · ") || "";
  }

  root.querySelectorAll("[data-vendor-select]").forEach(sel => {
    const field = sel.closest(".m-field");
    const other = field ? field.querySelector("[data-vendor-other]") : null;
    if (!other || !s.vendor) return;
    const known = [...sel.options].some(o => o.value === s.vendor);
    if (known) sel.value = s.vendor;
    else {
      sel.value = "Lainnya";
      other.value = s.vendor;
    }
    other.style.display = sel.value === "Lainnya" ? "" : "none";
  });

  const IFC = { SATA: "sata", SAS: "sas", NVMe: "nvme", Mixed: "mixed" };
  const ifcEl = root.querySelector('[data-sf="storageIface"]');
  if (ifcEl && s.storageIface && IFC[String(s.storageIface).toUpperCase()]) {
    ifcEl.value = IFC[String(s.storageIface).toUpperCase()];
  }

  const stEd = root.querySelector("[data-storage-editor]");
  if (stEd) {
    const slots = Array.isArray(s.storageSlots) ? s.storageSlots : [];
    if (typeof stEd._setStorageSlots === "function") stEd._setStorageSlots(parseInt(s.storageBays || "0", 10) || 0, slots);
    if (!slots.length && s.storageCap) {
      const tEl = stEd.querySelector("[data-storage-total]");
      if (tEl) tEl.value = s.storageCap;
    }
  }
  const dmEd = root.querySelector("[data-dimm-editor]");
  if (dmEd && typeof dmEd._setDimmSlots === "function") {
    const dslots = Array.isArray(s.dimmSlots) ? s.dimmSlots : [];
    dmEd._setDimmSlots(parseInt(s.dimmTotal || "0", 10) || 0, dslots);
  }

  root.querySelectorAll("[data-sf-pick]").forEach(p => {
    const k = p.dataset.sfPick;
    const v = s[k];
    if (v == null) return;
    const targets = Array.isArray(v) ? v : [v];
    const matched = new Set();
    p.querySelectorAll(".chip").forEach(c => {
      if (c.dataset.addChip) return;
      const t = c.textContent.trim().toLowerCase();
      const hit = targets.some(x => String(x).trim().toLowerCase() === t);
      c.classList.toggle("active", hit);
      if (hit) matched.add(t);
    });
    const addChip = p.querySelector("[data-add-chip]");
    targets.forEach(x => {
      if (!matched.has(String(x).trim().toLowerCase()) && addChip) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip active";
        chip.textContent = x;
        addChip.before(chip);
      }
    });
  });

  stgSyncRaid();

  if (typeof siteSel !== "undefined" && siteSel && s.site) {
    siteSel.value = s.site;
    if (typeof populateRacks === "function") populateRacks();
    if (typeof rackSel !== "undefined" && rackSel && s.rack) rackSel.value = s.rack;
  }

  CONTROLLERS = Array.isArray(s.controllers) ? s.controllers.map(c => ({ ...c })) : [];
  renderControllerList();

  StgIMG.loadExisting(s);
}

const STORAGE_EDIT_ID = new URLSearchParams(location.search).get("edit");
if (STORAGE_EDIT_ID) {
  const s = findStorage(STORAGE_EDIT_ID);
  if (s) prefillStorageForm(s);
}

// ---- Simpan Storage ----
function submitStorageForm() {
  console.log("[submitStorageForm] dipanggil (klik Simpan Storage)");
  const msgEl = document.getElementById("storage-save-msg") || document.getElementById("save-msg");
  if (!msgEl) {
    console.error("[submitStorageForm] elemen pesan #storage-save-msg tidak ditemukan");
    return;
  }
  try {
    const rec = mergeStorageImages(collectStorageForm(stg.root));
    console.log("[submitStorageForm] data terkumpul:", rec);
    if (!rec.hostname) {
      msgEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Nama Aset / Hostname wajib diisi sebelum menyimpan.';
      msgEl.classList.add("show", "error");
      msgEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setTimeout(() => msgEl.classList.remove("show", "error"), 4000);
      return;
    }
    const ok = storageEditingId
      ? updateStorage(storageEditingId, rec)
      : saveStorage(rec);
    console.log("[submitStorageForm] hasil simpan:", ok);
    if (ok) {
      msgEl.innerHTML = storageEditingId
        ? '<i class="fa-solid fa-circle-check"></i> Perubahan berhasil disimpan.'
        : '<i class="fa-solid fa-circle-check"></i> Storage berhasil disimpan.';
      msgEl.classList.add("show");
      msgEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setTimeout(() => {
        if (STORAGE_BOX) {
          if (typeof window.closeStorageModal === "function") window.closeStorageModal();
          if (typeof window.reloadStorageList === "function") window.reloadStorageList();
        } else {
          window.location.href = "storage-list.html";
        }
      }, 500);
    } else {
      msgEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Gagal menyimpan storage (storage tidak tersedia).';
      msgEl.classList.add("show", "error");
      msgEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setTimeout(() => msgEl.classList.remove("show", "error"), 4000);
    }
  } catch (err) {
    console.error("[submitStorageForm] ERROR:", err);
    msgEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Error: ' + (err && err.message ? err.message : String(err));
    msgEl.classList.add("show", "error");
    msgEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

window.__saveStorage = submitStorageForm;

const storageSaveBtn = document.getElementById("save-storage-modal") || document.getElementById("save-storage");
if (storageSaveBtn) {
  storageSaveBtn.addEventListener("click", submitStorageForm);
} else {
  console.warn("[storage-form.js] Tombol simpan storage tidak ditemukan. ID yang dicari: save-storage-modal / save-storage");
}

// ---- Popup inline (storage-list.html): modal berisi form penuh ----
if (STORAGE_BOX) {
  const storageOverlay = document.getElementById("storage-modal-overlay");

  function resetStorageForm() {
    const root = STORAGE_BOX;
    root.querySelectorAll("input[data-sf]").forEach(i => { i.value = ""; });
    root.querySelectorAll("select[data-sf]").forEach(s => { s.selectedIndex = 0; });
    root.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    root.querySelectorAll("[data-add-input]").forEach(i => { i.value = ""; });
    root.querySelectorAll("[data-add-row]").forEach(r => { r.style.display = "none"; });
    CONTROLLERS = [];
    renderControllerList();
    if (typeof populateStorageUHeight === "function") populateStorageUHeight();
    if (typeof populateRacks === "function") populateRacks();
    const stEd = root.querySelector("[data-storage-editor]");
    if (stEd && typeof stEd._setStorageSlots === "function") stEd._setStorageSlots(0, []);
    const dmEd = root.querySelector("[data-dimm-editor]");
    if (dmEd && typeof dmEd._setDimmSlots === "function") dmEd._setDimmSlots(0, []);
    const pc = root.querySelector('[data-sf="psuCount"]');
    if (pc) pc.value = "2";
    const pw = root.querySelector('[data-sf="psuWatt"]');
    if (pw) pw.value = "800 W";
    if (stgRackColorPicker) {
      stgRackColorPicker.querySelectorAll(".swatch").forEach(s => s.classList.remove("active"));
      const auto = stgRackColorPicker.querySelector('.swatch[data-color=""]');
      if (auto) auto.classList.add("active");
    }
    if (stgRackColorValue) stgRackColorValue.value = "";
    const sm = document.getElementById("storage-save-msg") || root.querySelector("#storage-save-msg");
    if (sm) { sm.textContent = ""; sm.classList.remove("show", "error"); }
    StgIMG.reset();
  }

  function setStorageSaveLabel() {
    const b = document.getElementById("save-storage-modal");
    if (b) b.innerHTML = storageEditingId
      ? '<i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan'
      : '<i class="fa-solid fa-floppy-disk"></i> Simpan Storage';
  }

  window.openStorageModal = function (idOrObj) {
    let s = null;
    if (idOrObj && typeof idOrObj === "object") {
      s = idOrObj;
    } else {
      s = typeof getStorages === "function" ? getStorages().find(x => x.id === idOrObj) : null;
    }
    if (!s || !storageOverlay) return;
    resetStorageForm();
    storageEditingId = s.id;
    prefillStorageForm(s);
    setStorageSaveLabel();
    storageOverlay.classList.add("open");
  };

  window.openStorageAdd = function () {
    if (!storageOverlay) return;
    resetStorageForm();
    storageEditingId = null;
    const mt = document.getElementById("storage-modal-title");
    if (mt) mt.innerHTML = '<i class="fa-solid fa-plus" style="color:var(--accent);margin-right:8px;"></i> Tambah Storage';
    const ms = document.getElementById("storage-modal-sub");
    if (ms) ms.textContent = "Lengkapi identitas storage baru lalu klik Simpan Storage.";
    setStorageSaveLabel();
    storageOverlay.classList.add("open");
  };

  window.closeStorageModal = function () {
    if (storageOverlay) storageOverlay.classList.remove("open");
  };

  const closeBtn = document.getElementById("storage-modal-close");
  if (closeBtn) closeBtn.addEventListener("click", window.closeStorageModal);
  const cancelBtn = document.getElementById("storage-modal-cancel");
  if (cancelBtn) cancelBtn.addEventListener("click", window.closeStorageModal);
  if (storageOverlay) {
    storageOverlay.addEventListener("click", e => { if (e.target === storageOverlay) window.closeStorageModal(); });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && storageOverlay.classList.contains("open")) window.closeStorageModal();
    });
  }

  const saveModalBtn = document.getElementById("save-storage-modal");
  if (saveModalBtn) saveModalBtn.addEventListener("click", submitStorageForm);
}
