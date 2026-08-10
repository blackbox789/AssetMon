
const tbody = document.getElementById("pdu-tbody");
const countEl = document.getElementById("filter-count");

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

  tbody.innerHTML = rows.map(p => `
    <tr data-pdu-name="${escHtml(p.name)}" data-site="${p.site}" data-type="${p.type}" data-status="${p.status}">
      <td><div class="strong">${p.name}</div><div class="mono" style="font-size:11px;">${p.serial || ""}</div></td>
      <td><span class="pdu-type-chip ${p.type}"><span class="dot"></span>${p.type === "vertical" ? "Vertikal" : "Horizontal"}</span></td>
      <td>${p.rack} · ${p.pos}</td>
      <td><div class="outlet-cell"><span class="outlet-nums">${p.used}/${p.ports} terpakai</span><div class="outlet-bar"><div class="outlet-fill ${outletClass(p.used, p.ports)}" style="width:${p.ports ? Math.round(p.used / p.ports * 100) : 0}%"></div></div></div></td>
      <td class="mono">${p.ip}</td>
      <td>${p.brand} ${p.model}</td>
      <td>${statusBadge(p.status)}</td>
      <td><div class="row-actions">
        <button title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button title="View"><i class="fa-solid fa-eye"></i></button>
        <button title="Port Map"><i class="fa-solid fa-ethernet"></i></button>
        <button title="Power Map"><i class="fa-solid fa-plug"></i></button>
      </div></td>
    </tr>`).join("");

  countEl.textContent = rows.length === PDU_DATA.length
    ? `Menampilkan ${rows.length} dari ${PDU_DATA.length} PDU`
    : `Menampilkan ${rows.length} dari ${PDU_DATA.length} PDU (setelah filter)`;
  updateStats();
}

function updateStats() {
  document.getElementById("stat-total").textContent = PDU_DATA.length;
  document.getElementById("stat-vert").textContent = PDU_DATA.filter(p => p.type === "vertical").length;
  document.getElementById("stat-horz").textContent = PDU_DATA.filter(p => p.type === "horizontal").length;
  document.getElementById("stat-outlets").textContent = PDU_DATA.reduce((s, p) => s + p.ports, 0);
}

["top-search", "filter-site", "filter-type", "filter-status"].forEach(id => {
  document.getElementById(id).addEventListener("input", renderTable);
});

// ---- Add/Edit PDU modal ----
const addModal = document.getElementById("add-pdu-modal");
const openAdd = document.getElementById("open-add-pdu");
const closeAdd = document.getElementById("close-add-pdu");
const cancelAdd = document.getElementById("cancel-add-pdu");
let editingPdu = null;
let viewPduName = null;

function setAddTitle(mode) {
  document.getElementById("add-pdu-title").textContent = mode === "edit" ? "Edit PDU" : "Add PDU";
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
  ["pdu-name", "pdu-model", "pdu-ip", "pdu-u", "pdu-serial"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("pdu-site").value = "DC1";
  document.getElementById("pdu-rack").value = "R1-A12";
  document.getElementById("pdu-side").value = "Sisi A";
  document.getElementById("pdu-brand").value = "APC";
  document.getElementById("pdu-status").value = "online";
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
  };
  if (editingPdu) {
    const idx = PDU_DATA.findIndex(x => x.name === editingPdu);
    const old = idx >= 0 ? PDU_DATA[idx] : null;
    if (old) {
      entry.used = old.used || 0;
      PDU_DATA[idx] = entry;
      if (old.name !== name && POWER_DATA[old.name]) {
        if (typeof apiRenameDevice === "function") apiRenameDevice(old.name, name);
        POWER_DATA[name] = POWER_DATA[old.name];
        delete POWER_DATA[old.name];
      }
      if (POWER_DATA[name]) POWER_DATA[name].ports = ports;
      else POWER_DATA[name] = { ports, rows: [] };
    }
    editingPdu = null;
  } else {
    PDU_DATA.unshift(entry);
    POWER_DATA[name] = { ports, rows: [] };
  }
  if (typeof apiSaveDevice === "function") apiSaveDevice({ deviceKey: name, type: "pdu", name });
  if (typeof savePowerMap === "function") savePowerMap(name);
  setAddTitle("add");
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

// ---- Delegasi tombol aksi baris (Edit / View / Power Map) ----
tbody.addEventListener("click", e => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const row = e.target.closest("tr[data-pdu-name]");
  if (!row) return;
  const name = row.dataset.pduName;
  if (btn.title === "Edit") openEdit(name);
  else if (btn.title === "View") openView(name);
  else if (btn.title === "Port Map") openPortMap(name, false, 0, { type: "pdu" });
  else if (btn.title === "Power Map") openPowerMap(name);
});

renderTable();
