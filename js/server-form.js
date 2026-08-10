/* ============================================
   RackView — Server form (Identitas Perangkat)
   Conditional form-fields + chip pickers + save.
   Dipakai di halaman server-form.html (form penuh)
   dan di modal Add Asset (asset-list.html) saat
   Tipe Asset = Server. Semua lookup di-guard agar
   aman dipakai di kedua halaman.
   ============================================ */

// ---- Form Factor (U) mengikuti tipe server ----
const FORM_FACTORS = {
  rack:  ["1U", "2U", "3U", "4U"],
  blade: ["3U", "4U", "6U", "8U", "10U", "12U", "16U (Blade Chassis)"],
  cloud: ["1U", "2U", "3U", "4U"],
  tower: ["Tower / Desktop (non-U)"],
};

const serverType = document.getElementById("server-type");
const formFactor = document.getElementById("form-factor");

if (serverType && formFactor) {
  function populateFormFactor() {
    formFactor.innerHTML = "";
    FORM_FACTORS[serverType.value].forEach(f => {
      const o = document.createElement("option");
      o.value = f;
      o.textContent = f;
      formFactor.appendChild(o);
    });
  }
  serverType.addEventListener("change", populateFormFactor);
  populateFormFactor();
}

// ---- Chassis mode (Blade/Cloud): form + modal node server ----
const FORM_MODE = { rack: "rack", tower: "rack", blade: "blade", cloud: "blade" };
let formMode = "rack";
let NODES = [];
let nodeEditingIdx = -1;

if (serverType) {
  function toggleChassisMode() {
    formMode = FORM_MODE[serverType.value] || "rack";
    const isChassis = formMode === "blade";
    document.querySelectorAll("[data-node-only]").forEach(el => {
      el.style.display = isChassis ? "none" : "";
    });
    document.querySelectorAll("[data-chassis-only]").forEach(el => {
      el.style.display = isChassis ? "" : "none";
    });
    if (isChassis) renderNodeList();
  }
  serverType.addEventListener("change", toggleChassisMode);
  toggleChassisMode();
}

// ---- Node manager: tabel node dalam kartu Node Server ----
function escNode(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function nextNodeSlot() {
  return NODES.reduce((m, n) => Math.max(m, parseInt(n.slot, 10) || 0), 0) + 1;
}

function renderNodeList() {
  document.querySelectorAll("[data-node-tbody]").forEach(tbody => {
    if (!NODES.length) {
      tbody.innerHTML = '<tr><td colspan="99" style="text-align:center;color:var(--text-muted);padding:18px;">Belum ada node. Klik "Tambah Node" untuk menambahkan node server.</td></tr>';
      return;
    }
    tbody.innerHTML = NODES.map((n, i) => `
      <tr>
        <td class="mono">${escNode(n.slot ?? i + 1)}</td>
        <td class="strong">${escNode(n.hostname || "—")}</td>
        <td>${escNode(n.processorType || "—")}</td>
        <td>${escNode(n.dimmInstalled || "—")}</td>
        <td>${escNode(n.hypervisor || "—")}</td>
        <td>${escNode(n.kondisi || "—")}</td>
        <td style="white-space:nowrap;">
          <button class="btn ghost btn-sm" type="button" data-node-edit="${i}" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="btn ghost btn-sm" type="button" data-node-del="${i}" title="Hapus"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`).join("");
  });
}

// ---- Node modal: form node server (field-set sama seperti rack) ----
const nmOverlay = document.getElementById("nm-overlay");
const nmBody = document.getElementById("nm-body");
const nmTitle = document.getElementById("nm-title");

function nodeFormHtml() {
  return `
  <div class="form-grid">
    <div class="m-field">
      <label class="form-label">Nama Aset / Hostname</label>
      <input class="form-input mono" type="text" placeholder="mis. SRV-APP-09-01" data-sf="hostname">
    </div>
    <div class="m-field">
      <label class="form-label">Vendor</label>
      <select class="form-input" data-sf="vendor" data-vendor-select>
        <option value="Dell" selected>Dell</option>
        <option value="HPE">HPE</option>
        <option value="Lenovo">Lenovo</option>
        <option value="Cisco">Cisco</option>
        <option value="Supermicro">Supermicro</option>
        <option value="IBM">IBM</option>
        <option value="Fujitsu">Fujitsu</option>
        <option value="Huawei">Huawei</option>
        <option value="Inspur">Inspur</option>
        <option value="ASUS">ASUS</option>
        <option value="Lainnya">Lainnya…</option>
      </select>
      <input class="form-input" type="text" data-sf="vendorOther" data-vendor-other placeholder="Nama vendor / brand lain" style="display:none;margin-top:8px;">
    </div>
    <div class="m-field">
      <label class="form-label">Model</label>
      <input class="form-input" type="text" placeholder="mis. M640" data-sf="model">
    </div>
    <div class="m-field">
      <label class="form-label">Serial Number</label>
      <input class="form-input mono" type="text" placeholder="mis. SVC-M640-XXXX" data-sf="serial">
    </div>
    <div class="m-field full">
      <label class="form-label">Processor</label>
      <div class="form-row">
        <select class="form-input" data-sf="processorCount">
          <option value="single">Single Processor</option>
          <option value="dual">Dual Processor</option>
        </select>
        <input class="form-input" type="text" placeholder="Tipe, mis. Intel Xeon / AMD EPYC" data-sf="processorType">
      </div>
    </div>
    <div class="m-field full">
      <label class="form-label">Jumlah Core / Thread</label>
      <div class="form-row">
        <input class="form-input" type="text" placeholder="Core, mis. 16C" data-sf="core">
        <input class="form-input" type="text" placeholder="Thread, mis. 32T" data-sf="thread">
      </div>
    </div>
    <div class="m-field full" data-dimm-editor>
      <label class="form-label">Slot Memory (DIMM)</label>
      <div class="form-row form-row-3">
        <input class="form-input" type="number" min="0" max="128" placeholder="Total slot, mis. 16" data-sf="dimmTotal" data-dimm-slots>
        <input class="form-input" type="text" placeholder="Kapasitas default/slot, mis. 32 GB" data-sf="dimmPerSlot" title="Kapasitas default saat mengisi slot baru">
        <input class="form-input mono" type="text" placeholder="Terpasang (otomatis)" data-sf="dimmInstalled" data-dimm-installed readonly>
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
        <input class="form-input" list="dimm-brand-options" placeholder="Brand" title="Merek modul" data-dimm-edit-brand>
        <select class="form-input" data-dimm-edit-status title="Status modul">
          <option value="online">Online</option>
          <option value="degradasi">Degradasi</option>
          <option value="failed">Failed</option>
        </select>
        <input class="form-input" placeholder="Notes" title="Catatan modul" data-dimm-edit-notes>
        <button class="btn ghost btn-sm" type="button" data-dimm-empty-btn title="Kosongkan slot"><i class="fa-solid fa-ban"></i> Kosongkan</button>
      </div>
      <datalist id="dimm-brand-options">
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
    <div class="m-field full" data-storage-editor>
      <label class="form-label">Storage Slot (HDD/SSD)</label>
      <div class="form-row form-row-3">
        <input class="form-input" type="number" min="0" max="36" placeholder="Jumlah bay, mis. 4" data-sf="storageBays" data-storage-bays>
        <input class="form-input mono" type="text" placeholder="Total terisi (otomatis)" data-sf="storageCap" data-storage-total readonly>
        <select class="form-input" data-sf="storageIface">
          <option value="sata">Interface SATA</option>
          <option value="sas">Interface SAS</option>
          <option value="nvme">Interface NVMe</option>
          <option value="mixed">Mixed</option>
        </select>
      </div>
      <div class="storage-toolbar">
        <span class="form-hint">Klik = isi/panel bay · Ctrl+klik = pilih banyak · Shift+klik = pilih rentang.</span>
        <label class="storage-multiselect-toggle"><input type="checkbox" data-storage-multiselect><i class="fa-solid fa-object-group"></i> Pilih Banyak</label>
      </div>
      <div class="storage-legend"><i class="st-st-online"></i>Online<i class="st-st-degradasi"></i>Degradasi<i class="st-st-failed"></i>Failed</div>
      <div class="storage-grid" data-storage-grid>
        <div class="form-hint" data-storage-empty>Masukkan jumlah bay untuk membuat grid slot.</div>
      </div>
      <div class="storage-edit" data-storage-edit style="display:none;">
        <span class="storage-edit-bay">Bay <b data-storage-edit-bay>1</b></span>
        <select class="form-input" data-storage-edit-type>
          <option value="SSD">SSD</option>
          <option value="HDD">HDD</option>
          <option value="NVMe">NVMe</option>
        </select>
        <input class="form-input mono" type="number" min="1" placeholder="Kapasitas" data-storage-edit-cap>
        <select class="form-input" data-storage-edit-unit>
          <option value="GB">GB</option>
          <option value="TB">TB</option>
        </select>
        <input class="form-input" list="storage-brand-options" placeholder="Brand" title="Merek drive" data-storage-edit-brand>
        <select class="form-input" data-storage-edit-status title="Status drive">
          <option value="online">Online</option>
          <option value="degradasi">Degradasi</option>
          <option value="failed">Failed</option>
        </select>
        <input class="form-input" placeholder="Notes" title="Catatan drive" data-storage-edit-notes>
        <button class="btn ghost btn-sm" type="button" data-storage-empty-btn title="Kosongkan slot"><i class="fa-solid fa-ban"></i> Kosongkan</button>
      </div>
      <datalist id="storage-brand-options">
        <option value="Seagate"></option>
        <option value="WD"></option>
        <option value="Samsung"></option>
        <option value="Intel"></option>
        <option value="Kingston"></option>
        <option value="Toshiba"></option>
        <option value="HGST"></option>
        <option value="Micron"></option>
        <option value="Crucial"></option>
        <option value="SanDisk"></option>
      </datalist>
      <div class="storage-edit storage-edit-group" data-storage-edit-group style="display:none;">
        <span class="storage-edit-bay">Grup <b data-storage-edit-count>2</b> drive</span>
        <select class="form-input" data-storage-edit-group-raid>
          <option value="">RAID -</option>
          <option value="RAID 0">RAID 0</option>
          <option value="RAID 1">RAID 1</option>
          <option value="RAID 5">RAID 5</option>
          <option value="RAID 6">RAID 6</option>
          <option value="RAID 10">RAID 10</option>
        </select>
        <span class="storage-group-preview" data-storage-group-preview></span>
        <button class="btn ghost btn-sm" type="button" data-storage-group-clear>Batal</button>
        <button class="btn primary btn-sm" type="button" data-storage-group-apply><i class="fa-solid fa-check"></i> Terapkan</button>
      </div>
      <div class="storage-summary" data-storage-summary style="display:none;"></div>
    </div>
    <div class="m-field">
      <label class="form-label">RAID Controller</label>
      <div class="tag-picker" data-single data-sf-pick="raid">
        <div class="chip active">Ya</div>
        <div class="chip">Tidak</div>
      </div>
    </div>
    <div class="m-field" data-node-raid-types>
      <label class="form-label">Tipe RAID Support</label>
      <div class="tag-picker" data-multi data-sf-pick="raidTypes">
        <div class="chip active">RAID 0</div>
        <div class="chip active">RAID 1</div>
        <div class="chip active">RAID 10</div>
        <div class="chip">RAID 5</div>
        <div class="chip">RAID 6</div>
        <div class="chip">RAID 50</div>
        <div class="chip">RAID 60</div>
      </div>
    </div>
    <div class="m-field full">
      <label class="form-label">LAN Port Map</label>
      <div class="form-row form-row-3">
        <input class="form-input" type="text" placeholder="RJ-45, mis. 2" data-sf="lanRj45">
        <input class="form-input" type="text" placeholder="SFP, mis. 2" data-sf="lanSfp">
        <input class="form-input" type="text" placeholder="QSFP, mis. 0" data-sf="lanQsfp">
      </div>
    </div>
    <div class="m-field">
      <label class="form-label">Kecepatan Port</label>
      <div class="tag-picker" data-single data-sf-pick="speed">
        <div class="chip active">1G</div>
        <div class="chip">10G</div>
        <div class="chip">25G</div>
        <div class="chip">40G</div>
      </div>
    </div>
    <div class="m-field">
      <label class="form-label">Management Port</label>
      <div class="tag-picker" data-single data-sf-pick="mgmtPort">
        <div class="chip active">iDRAC</div>
        <div class="chip">iLO</div>
        <div class="chip">IPMI</div>
      </div>
    </div>
    <div class="m-field full">
      <label class="form-label">Expansion Slot (PCIe)</label>
      <div class="form-row">
        <input class="form-input" type="text" placeholder="Jumlah, mis. 2" data-sf="pcieCount">
        <input class="form-input" type="text" placeholder="Versi, mis. Gen4" data-sf="pcieGen">
      </div>
    </div>
    <div class="m-field full">
      <label class="form-label">Power Port Map</label>
      <div class="form-row">
        <input class="form-input" type="text" placeholder="PSU, mis. 2" data-sf="psuCount">
        <input class="form-input" type="text" placeholder="Watt, mis. 750 W" data-sf="psuWatt">
      </div>
    </div>
    <div class="m-field">
      <label class="form-label">OS / Hypervisor</label>
      <select class="form-input" data-sf="hypervisor">
        <option value="windows-server">Windows Server</option>
        <option value="linux">Linux</option>
        <option value="esxi">VMware ESXi</option>
        <option value="other">Lainnya</option>
      </select>
    </div>
    <div class="m-field">
      <label class="form-label">Kondisi</label>
      <div class="tag-picker" data-single data-sf-pick="kondisi">
        <div class="chip active">Active</div>
        <div class="chip">Standby</div>
        <div class="chip">Decommissioned</div>
      </div>
    </div>
    <div class="m-field full">
      <label class="form-label">Fungsi Server</label>
      <div class="tag-picker" data-multi data-sf-pick="fungsi">
        <div class="chip active">Web</div>
        <div class="chip">Database</div>
        <div class="chip">Virtualization</div>
        <div class="chip">Backup</div>
        <button class="chip chip-add" type="button" data-add-chip title="Tambah fungsi lainnya"><i class="fa-solid fa-plus"></i></button>
      </div>
      <div class="chip-add-row" data-add-row style="display:none;">
        <input class="form-input" type="text" data-add-input placeholder="Fungsi lain, mis. Monitoring">
        <button class="btn primary btn-sm" type="button" data-add-confirm title="Tambah"><i class="fa-solid fa-check"></i></button>
        <button class="btn ghost btn-sm" type="button" data-add-cancel title="Batal"><i class="fa-solid fa-xmark"></i></button>
      </div>
    </div>
    <div class="m-field full">
      <label class="form-label">Monitoring</label>
      <div class="tag-picker" data-multi data-sf-pick="monitoring">
        <div class="chip active" data-mon="snmp">SNMP</div>
        <div class="chip active" data-mon="ipmi">IPMI</div>
        <div class="chip" data-mon="dcim">DCIM Integration</div>
      </div>
    </div>
    <div class="m-field">
      <label class="form-label">Asset Tag / QR Code</label>
      <input class="form-input mono" type="text" placeholder="mis. ASET-RV-000123" data-sf="assetTag">
    </div>
    <div class="m-field full">
      <label class="form-label">Tag</label>
      <div class="tag-picker" data-multi data-sf-pick="tags">
        <div class="chip">production</div>
        <div class="chip">staging</div>
        <div class="chip">development</div>
        <div class="chip">database</div>
        <div class="chip">web</div>
        <div class="chip">application</div>
        <div class="chip">backup</div>
        <div class="chip">security</div>
        <button class="chip chip-add" type="button" data-add-chip title="Tambah tag lainnya"><i class="fa-solid fa-plus"></i></button>
      </div>
      <div class="chip-add-row" data-add-row style="display:none;">
        <input class="form-input" type="text" data-add-input placeholder="Tag lain, mis. monitoring">
        <button class="btn primary btn-sm" type="button" data-add-confirm title="Tambah"><i class="fa-solid fa-check"></i></button>
        <button class="btn ghost btn-sm" type="button" data-add-cancel title="Batal"><i class="fa-solid fa-xmark"></i></button>
      </div>
    </div>
  </div>`;
}

function openNodeModal(idx) {
  if (!nmOverlay || !nmBody) return;
  nodeEditingIdx = idx == null ? -1 : idx;
  nmBody.innerHTML = nodeFormHtml();
  nmTitle.textContent = nodeEditingIdx >= 0 ? `Edit Node ${NODES[nodeEditingIdx].slot}` : "Node Baru";
  initStorageEditor(nmBody.querySelector("[data-storage-editor]"));
  initDimmEditor(nmBody.querySelector("[data-dimm-editor]"));
  if (nodeEditingIdx >= 0) prefillNodeForm(NODES[nodeEditingIdx]);
  syncNodeRaid();
  nmOverlay.classList.add("open");
}

function closeNodeModal() {
  if (nmOverlay) nmOverlay.classList.remove("open");
}

function prefillNodeForm(n) {
  nmBody.querySelectorAll("[data-sf]").forEach(el => {
    const k = el.dataset.sf;
    if (k && n[k] != null) el.value = n[k];
  });
  nmBody.querySelectorAll("[data-sf-pick]").forEach(p => {
    const k = p.dataset.sfPick;
    const v = n[k];
    if (v == null) return;
    const targets = Array.isArray(v) ? v : [v];
    p.querySelectorAll(".chip").forEach(c => {
      if (c.dataset.addChip) return;
      const match = targets.some(t => String(t).toLowerCase() === c.textContent.trim().toLowerCase());
      c.classList.toggle("active", match);
    });
  });
  const stEd = nmBody.querySelector("[data-storage-editor]");
  if (stEd) {
    const slots = Array.isArray(n.storageSlots) ? n.storageSlots : [];
    if (typeof stEd._setStorageSlots === "function") stEd._setStorageSlots(parseInt(n.storageBays || "0", 10) || 0, slots);
    if (!slots.length && n.storageCap) {
      const tEl = stEd.querySelector("[data-storage-total]");
      if (tEl) tEl.value = n.storageCap;
    }
  }
  const dmEd = nmBody.querySelector("[data-dimm-editor]");
  if (dmEd && typeof dmEd._setDimmSlots === "function") {
    dmEd._setDimmSlots(parseInt(n.dimmTotal || "0", 10) || 0, Array.isArray(n.dimmSlots) ? n.dimmSlots : []);
  }
}

function syncNodeRaid() {
  if (!nmBody) return;
  const picker = nmBody.querySelector('[data-sf-pick="raid"]');
  const typeWrap = nmBody.querySelector("[data-node-raid-types]");
  if (!picker || !typeWrap) return;
  const yes = [...picker.querySelectorAll(".chip")].find(c => c.textContent.trim() === "Ya");
  typeWrap.style.display = yes && yes.classList.contains("active") ? "" : "none";
}

function buildNodeFromCollect(c) {
  return {
    slot: null,
    hostname: c.hostname,
    vendor: c.vendor,
    model: c.model,
    serial: c.serial,
    processorCount: c.processorCount,
    processorType: c.processorType,
    coreThread: c.coreThread,
    dimmTotal: c.dimmTotal,
    dimmPerSlot: c.dimmPerSlot,
    dimmInstalled: c.dimmInstalled,
    dimmSlots: c.dimmSlots,
    storageBays: c.storageBays,
    storageCap: c.storageCap,
    storageIface: c.storageIface,
    storageSlots: c.storageSlots,
    raid: c.raid,
    raidTypes: c.raidTypes,
    lanRj45: c.lanRj45,
    lanSfp: c.lanSfp,
    lanQsfp: c.lanQsfp,
    speed: c.speed,
    mgmtPort: c.mgmtPort,
    pcieCount: c.pcieCount,
    pcieGen: c.pcieGen,
    psuCount: c.psuCount,
    psuWatt: c.psuWatt,
    hypervisor: c.hypervisor,
    fungsi: c.fungsi,
    monitoring: c.monitoring,
    kondisi: c.kondisi,
    assetTag: c.assetTag,
    tags: c.tags,
  };
}

function saveNodeModal() {
  if (!nmBody) return;
  const node = buildNodeFromCollect(collectServerForm(nmBody));
  if (!node.hostname) {
    nmBody.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  node.slot = nodeEditingIdx >= 0 ? NODES[nodeEditingIdx].slot : nextNodeSlot();
  if (nodeEditingIdx >= 0) NODES[nodeEditingIdx] = node;
  else NODES.push(node);
  renderNodeList();
  closeNodeModal();
}

if (nmOverlay) {
  document.addEventListener("click", e => {
    const editBtn = e.target.closest("[data-node-edit]");
    if (editBtn) { openNodeModal(parseInt(editBtn.dataset.nodeEdit, 10)); return; }
    const delBtn = e.target.closest("[data-node-del]");
    if (delBtn) {
      NODES.splice(parseInt(delBtn.dataset.nodeDel, 10), 1);
      renderNodeList();
      return;
    }
    const addBtn = e.target.closest("[data-node-add]");
    if (addBtn) { openNodeModal(-1); return; }
    if (e.target.closest("[data-node-cancel]") || e.target.closest("#nm-close")) { closeNodeModal(); return; }
    if (e.target.closest("[data-node-confirm]")) { saveNodeModal(); return; }
    if (e.target === nmOverlay) closeNodeModal();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && nmOverlay.classList.contains("open")) closeNodeModal();
  });

  nmBody.addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (chip && !chip.dataset.addChip) {
      const picker = chip.closest(".tag-picker");
      if (picker) {
        if (picker.dataset.single != null) {
          picker.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
          chip.classList.add("active");
          if (picker.dataset.sfPick === "raid") syncNodeRaid();
        } else {
          chip.classList.toggle("active");
        }
      }
      return;
    }
    const addChip = e.target.closest("[data-add-chip]");
    if (addChip) {
      const row = addChip.closest(".m-field").querySelector("[data-add-row]");
      if (row) { row.style.display = ""; row.querySelector("[data-add-input]").focus(); }
      return;
    }
    const confirm = e.target.closest("[data-add-confirm]");
    if (confirm) {
      const field = confirm.closest(".m-field");
      const input = field.querySelector("[data-add-input]");
      const v = input.value.trim();
      if (v) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip active";
        chip.textContent = v;
        field.querySelector("[data-add-chip]").before(chip);
      }
      input.value = "";
      field.querySelector("[data-add-row]").style.display = "none";
      return;
    }
    const cancel = e.target.closest("[data-add-cancel]");
    if (cancel) {
      const row = cancel.closest("[data-add-row]");
      row.style.display = "none";
      row.querySelector("[data-add-input]").value = "";
    }
  });
  nmBody.addEventListener("change", e => {
    if (e.target.matches("[data-vendor-select]")) {
      const field = e.target.closest(".m-field");
      const other = field ? field.querySelector("[data-vendor-other]") : null;
      const isOther = e.target.value === "Lainnya";
      if (other) { other.style.display = isOther ? "" : "none"; if (isOther) other.focus(); }
    }
  });
  nmBody.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.matches("[data-add-input]")) {
      e.preventDefault();
      e.target.closest(".m-field").querySelector("[data-add-confirm]").click();
    }
  });
}

// ---- Simpan chassis (blade/cloud): gabungkan field chassis + nodes ----
function collectChassisForm() {
  const c = collectServerForm(document);
  return {
    ...c,
    hostname: "",
    nodeNumber: "",
    nodes: NODES.map(n => ({ ...n })),
  };
}

// ---- Chip pickers: single-select (data-single) & multi-select (data-multi) ----
document.querySelectorAll(".tag-picker[data-single]").forEach(picker => {
  picker.addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (!chip || chip.dataset.addChip) return;
    picker.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
  });
});
document.querySelectorAll(".tag-picker[data-multi]").forEach(picker => {
  picker.addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (!chip || chip.dataset.addChip) return;
    chip.classList.toggle("active");
  });
});

// ---- Chip add: tombol (+) untuk input manual lainnya (fungsi / tag / dll) ----
document.querySelectorAll("[data-add-chip]").forEach(btn => {
  const field = btn.closest(".m-field");
  if (!field) return;
  const row = field.querySelector("[data-add-row]");
  const input = field.querySelector("[data-add-input]");
  const confirmBtn = field.querySelector("[data-add-confirm]");
  const cancelBtn = field.querySelector("[data-add-cancel]");
  if (!row || !input || !confirmBtn || !cancelBtn) return;
  const close = () => { row.style.display = "none"; input.value = ""; };
  btn.addEventListener("click", () => { row.style.display = ""; input.focus(); });
  confirmBtn.addEventListener("click", () => {
    const v = input.value.trim();
    if (!v) return;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip active";
    chip.textContent = v;
    btn.before(chip);
    close();
  });
  cancelBtn.addEventListener("click", close);
  input.addEventListener("keydown", e => { if (e.key === "Enter") confirmBtn.click(); });
});

// ---- RAID Controller: Ya/Tidak -> tampilkan tipe RAID ----
const raidToggle = document.getElementById("raid-toggle-picker");
const raidTypeField = document.getElementById("raid-type-field");
if (raidToggle && raidTypeField) {
  function syncRaidField() {
    const yes = document.getElementById("raid-yes");
    raidTypeField.style.display = yes && yes.classList.contains("active") ? "" : "none";
  }
  raidToggle.addEventListener("click", syncRaidField);
  syncRaidField();
}

// ---- Vendor dropdown: pilih "Lainnya…" -> tampilkan input manual ----
document.querySelectorAll("[data-vendor-select]").forEach(sel => {
  const field = sel.closest(".m-field");
  const other = field ? field.querySelector("[data-vendor-other]") : null;
  if (!other) return;
  const sync = () => {
    const isOther = sel.value === "Lainnya";
    other.style.display = isOther ? "" : "none";
    if (isOther) other.focus();
  };
  sel.addEventListener("change", sync);
  sync();
});

// ---- Site -> Rack cascade (data dari rack-data.js) ----
const siteSel = document.getElementById("form-site");
const rackSel = document.getElementById("form-rack");
if (siteSel && rackSel && typeof RACK_SITES !== "undefined" && typeof RACKS !== "undefined") {
  RACK_SITES.forEach(s => {
    const o = document.createElement("option");
    o.value = s.id;
    o.textContent = s.name;
    siteSel.appendChild(o);
  });

  function populateRacks() {
    rackSel.innerHTML = "";
    RACKS.filter(r => r.site === siteSel.value)
      .sort((a, b) => a.rackId.localeCompare(b.rackId))
      .forEach(r => {
        const o = document.createElement("option");
        o.value = r.rackId;
        o.textContent = r.rackId;
        rackSel.appendChild(o);
      });
  }
  siteSel.addEventListener("change", populateRacks);
  populateRacks();
}

// ---- Background Color (Rack Elevation): swatch + custom color input ----
const rackColorPicker = document.getElementById("rack-color-picker");
const rackColorInput = document.getElementById("rack-color-input");
const rackColorValue = document.getElementById("rack-color-value");
if (rackColorPicker && rackColorInput && rackColorValue) {
  rackColorPicker.addEventListener("click", e => {
    const sw = e.target.closest(".swatch");
    if (!sw) return;
    rackColorPicker.querySelectorAll(".swatch").forEach(s => s.classList.remove("active"));
    sw.classList.add("active");
    rackColorValue.value = sw.dataset.color || "";
  });
  rackColorInput.addEventListener("input", () => {
    rackColorPicker.querySelectorAll(".swatch").forEach(s => s.classList.remove("active"));
    rackColorValue.value = rackColorInput.value;
  });
}

// ---- Mode edit: server-form.html?edit=<id> atau popup di server-list.html ----
const EDIT_ID = new URLSearchParams(location.search).get("edit");
const IN_EDIT_MODAL = !!document.getElementById("edit-server-overlay");
let editingId = null;

function prefillServerForm(s) {
  if (!s) return;
  editingId = s.id;
  if (IN_EDIT_MODAL) {
    const mt = document.getElementById("edit-server-title");
    if (mt) mt.textContent = "Edit Server — " + (s.hostname || s.id);
    const ms = document.getElementById("edit-server-sub");
    if (ms) ms.textContent = "Ubah data lalu klik Simpan Perubahan.";
  } else {
    const h1 = document.getElementById("form-page-title");
    if (h1) h1.textContent = "Edit Server";
    const sub = document.querySelector(".topbar-sub");
    if (sub) sub.textContent = "Perbarui identitas & spesifikasi " + (s.hostname || s.id);
    const fh = document.querySelector(".form-head h2");
    if (fh) fh.textContent = "Edit Server — " + (s.hostname || s.id);
    const fhs = document.querySelector(".form-head-sub");
    if (fhs) fhs.textContent = "Ubah data lalu klik Simpan Perubahan untuk memperbarui.";
    const saveBtn = document.getElementById("save-server");
    if (saveBtn) saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan';
    const backLink = document.querySelector('.form-actions a[href="asset-list.html"]');
    if (backLink) backLink.setAttribute("href", "server-list.html");
    const banner = document.getElementById("edit-banner");
    if (banner) {
      banner.style.display = "flex";
      banner.innerHTML = '<i class="fa-solid fa-pen"></i> Mode Edit: ' + escNode(s.hostname || s.id);
    }
  }

  if (serverType) {
    serverType.value = s.tipeServer || "rack";
    NODES = Array.isArray(s.nodes) ? s.nodes.map(n => ({ ...n })) : [];
    serverType.dispatchEvent(new Event("change"));
  }
  if (formFactor && s.formFactor) formFactor.value = s.formFactor;

  document.querySelectorAll("[data-sf]").forEach(el => {
    const k = el.dataset.sf;
    if (!k || s[k] == null) return;
    el.value = s[k];
  });
  if (s.coreThread) {
    const parts = String(s.coreThread).split("/").map(x => x.trim());
    document.querySelectorAll('[data-sf="core"]').forEach(el => el.value = parts[0] || "");
    document.querySelectorAll('[data-sf="thread"]').forEach(el => el.value = parts[1] || "");
  }
  if (s.cableManagement && s.cableManagement !== "-") {
    const parts = String(s.cableManagement).split(" · ");
    const panelEl = document.querySelector('[data-sf="cablePanel"]');
    const portsEl = document.querySelector('[data-sf="cablePorts"]');
    if (panelEl) panelEl.value = parts[0] || "";
    if (portsEl) portsEl.value = parts.slice(1).join(" · ") || "";
  }

  const setSelectByText = (selector, label) => {
    const el = document.querySelector(selector);
    if (!el || !label) return;
    const opt = [...el.options].find(o => o.textContent.trim().toLowerCase() === String(label).trim().toLowerCase());
    if (opt) el.value = opt.value;
  };
  setSelectByText('[data-sf="os"]', s.os);
  setSelectByText('[data-sf="hypervisor"]', s.hypervisor);
  const IFC = { SATA: "sata", SAS: "sas", NVMe: "nvme", Mixed: "mixed" };
  const ifcEl = document.querySelector('[data-sf="storageIface"]');
  if (ifcEl && s.storageIface && IFC[String(s.storageIface).toUpperCase()]) {
    ifcEl.value = IFC[String(s.storageIface).toUpperCase()];
  }

  const stEd = document.querySelector("[data-storage-editor]");
  if (stEd) {
    const slots = Array.isArray(s.storageSlots) ? s.storageSlots : [];
    if (typeof stEd._setStorageSlots === "function") stEd._setStorageSlots(parseInt(s.storageBays || "0", 10) || 0, slots);
    if (!slots.length && s.storageCap) {
      const tEl = stEd.querySelector("[data-storage-total]");
      if (tEl) tEl.value = s.storageCap;
    }
  }

  const dmEd = document.querySelector("[data-dimm-editor]");
  if (dmEd && typeof dmEd._setDimmSlots === "function") {
    const dslots = Array.isArray(s.dimmSlots) ? s.dimmSlots : [];
    dmEd._setDimmSlots(parseInt(s.dimmTotal || "0", 10) || 0, dslots);
  }

  document.querySelectorAll("[data-vendor-select]").forEach(sel => {
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

  document.querySelectorAll("[data-sf-pick]").forEach(p => {
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

  if (typeof syncRaidField === "function") syncRaidField();
  if (siteSel && s.site) {
    siteSel.value = s.site;
    if (typeof populateRacks === "function") populateRacks();
    if (rackSel && s.rack) rackSel.value = s.rack;
  }
}

if (EDIT_ID && typeof getServers === "function") {
  const s = getServers().find(x => x.id === EDIT_ID);
  if (s) prefillServerForm(s);
} else if (!IN_EDIT_MODAL) {
  document.querySelectorAll('[data-sf="psuCount"]').forEach(el => { if (!el.value) el.value = "2"; });
  document.querySelectorAll('[data-sf="psuWatt"]').forEach(el => { if (!el.value) el.value = "750 W"; });
}

// ---- Popup Edit Server (server-list.html): modal berisi form penuh ----
if (IN_EDIT_MODAL) {
  const editOverlay = document.getElementById("edit-server-overlay");
  const editFormBox = document.getElementById("edit-server-form");

  function resetEditServerForm() {
    if (!editFormBox) return;
    editFormBox.querySelectorAll("input[data-sf]").forEach(i => { i.value = ""; });
    editFormBox.querySelectorAll("select[data-sf]").forEach(s => { s.selectedIndex = 0; });
    editFormBox.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    editFormBox.querySelectorAll("[data-add-input]").forEach(i => { i.value = ""; });
    editFormBox.querySelectorAll("[data-add-row]").forEach(r => { r.style.display = "none"; });
    NODES = [];
    if (serverType) serverType.dispatchEvent(new Event("change"));
    if (typeof populateRacks === "function") populateRacks();
    const stEd = editFormBox.querySelector("[data-storage-editor]");
    if (stEd && typeof stEd._setStorageSlots === "function") stEd._setStorageSlots(0, []);
    const dmEd = editFormBox.querySelector("[data-dimm-editor]");
    if (dmEd && typeof dmEd._setDimmSlots === "function") dmEd._setDimmSlots(0, []);
    const pc = editFormBox.querySelector('[data-sf="psuCount"]');
    if (pc) pc.value = "2";
    const pw = editFormBox.querySelector('[data-sf="psuWatt"]');
    if (pw) pw.value = "750 W";
  }

  function setEditSaveLabel() {
    const b = document.getElementById("save-server-edit");
    if (b) b.innerHTML = editingId
      ? '<i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan'
      : '<i class="fa-solid fa-floppy-disk"></i> Simpan Server';
  }

  window.openServerEdit = function (id) {
    const s = typeof getServers === "function" ? getServers().find(x => x.id === id) : null;
    if (!s || !editOverlay) return;
    resetEditServerForm();
    editingId = s.id;
    prefillServerForm(s);
    setEditSaveLabel();
    editOverlay.classList.add("open");
  };
  window.openServerAdd = function () {
    if (!editOverlay) return;
    resetEditServerForm();
    editingId = null;
    const mt = document.getElementById("edit-server-title");
    if (mt) mt.textContent = "Tambah Server";
    const ms = document.getElementById("edit-server-sub");
    if (ms) ms.textContent = "Lengkapi identitas server baru lalu klik Simpan Server.";
    setEditSaveLabel();
    editOverlay.classList.add("open");
  };
  window.closeServerEdit = function () {
    if (editOverlay) editOverlay.classList.remove("open");
  };

  const closeBtn = document.getElementById("edit-server-close");
  if (closeBtn) closeBtn.addEventListener("click", window.closeServerEdit);
  const cancelBtn = document.getElementById("edit-server-cancel");
  if (cancelBtn) cancelBtn.addEventListener("click", window.closeServerEdit);
  if (editOverlay) editOverlay.addEventListener("click", e => { if (e.target === editOverlay) window.closeServerEdit(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && editOverlay && editOverlay.classList.contains("open")) window.closeServerEdit();
  });

  const editSaveBtn = document.getElementById("save-server-edit");
  if (editSaveBtn) {
    editSaveBtn.addEventListener("click", () => {
      const mode = FORM_MODE[(serverType && serverType.value) || "rack"] || "rack";
      const server = mode === "blade" ? collectChassisForm() : collectServerForm();
      if (mode !== "blade" && !server.hostname) {
        if (saveMsg) {
          saveMsg.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Nama Aset / Hostname wajib diisi sebelum menyimpan.';
          saveMsg.classList.add("show", "error");
          saveMsg.scrollIntoView({ behavior: "smooth", block: "nearest" });
          setTimeout(() => saveMsg.classList.remove("show", "error"), 4000);
        }
        return;
      }
      const ok = editingId
        ? (typeof updateServer === "function" ? updateServer(editingId, server) : false)
        : (typeof saveServer === "function" ? saveServer(server) : false);
      if (ok) {
        window.closeServerEdit();
        if (typeof window.reloadServerList === "function") window.reloadServerList();
      } else if (saveMsg) {
        saveMsg.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Gagal menyimpan perubahan (storage tidak tersedia).';
        saveMsg.classList.add("show", "error");
        saveMsg.scrollIntoView({ behavior: "smooth", block: "nearest" });
        setTimeout(() => saveMsg.classList.remove("show", "error"), 4000);
      }
    });
  }
}

// ---- Storage slot grid: per-bay HDD/SSD/NVMe (data per slot, satuan GB/TB) ----
const STORAGE_TYPES = ["SSD", "HDD", "NVMe"];
const STORAGE_IFACE = { SSD: "sata", HDD: "sata", NVMe: "nvme" };
const DRIVE_STATUS = { online: "Online", degradasi: "Degradasi", failed: "Failed" };
const statusClsOf = st => ("st-st-" + String(st || "online").toLowerCase().replace(/[^a-z0-9]/g, ""));

function storageTotalGB(slots) {
  let gb = 0;
  (Array.isArray(slots) ? slots : []).forEach(s => {
    const m = String(s.cap || "").match(/^([\d.,]+)\s*(GB|TB|PB)?/i);
    if (!m) return;
    const v = parseFloat(String(m[1]).replace(",", ".")) || 0;
    const u = ((m[2] || "GB") + "").toUpperCase();
    gb += u === "TB" ? v * 1000 : u === "PB" ? v * 1e6 : v;
  });
  return gb;
}

function fmtStorage(gb) {
  if (!gb) return "";
  if (gb >= 1000000) return (gb / 1000000).toFixed(2).replace(/\.?0+$/, "").replace(/\.$/, "") + " PB";
  if (gb >= 1000) return (gb / 1000).toFixed(2).replace(/\.?0+$/, "").replace(/\.$/, "") + " TB";
  return Math.round(gb) + " GB";
}

const RAID_OPTIONS = ["", "RAID 0", "RAID 1", "RAID 5", "RAID 6", "RAID 10"];

function raidUsableFactor(raid, n) {
  if (raid === "RAID 0") return n;
  if (raid === "RAID 1" || raid === "RAID 10") return Math.max(0, Math.floor(n / 2));
  if (raid === "RAID 5") return Math.max(0, n - 1);
  if (raid === "RAID 6") return Math.max(0, n - 2);
  return n;
}

function raidGroupWarning(raid, n) {
  if (!raid || n < 2) return "";
  if ((raid === "RAID 1" || raid === "RAID 10") && n % 2 !== 0) return raid + " butuh jumlah drive genap.";
  if (raid === "RAID 5" && n < 3) return "RAID 5 butuh minimal 3 drive.";
  if (raid === "RAID 6" && n < 4) return "RAID 6 butuh minimal 4 drive.";
  return "";
}

function computeUsableCapacity(slots) {
  const list = (Array.isArray(slots) ? slots : []).filter(s => s && s.cap);
  const raw = storageTotalGB(list);
  const byRaid = {};
  list.forEach(s => {
    const r = s.raid || "";
    (byRaid[r] = byRaid[r] || []).push(s);
  });
  let usable = 0;
  const groups = [];
  Object.keys(byRaid).forEach(r => {
    const drvs = byRaid[r];
    const sizes = drvs.map(d => storageTotalGB([d]));
    const n = sizes.length;
    const min = Math.min(...sizes);
    const rawG = sizes.reduce((a, b) => a + b, 0);
    const u = raidUsableFactor(r, n) * min;
    usable += u;
    if (r) groups.push({ raid: r, drives: n, per: rawG / n, usable: u });
  });
  return { raw, usable, groups, efficiency: raw ? usable / raw : 0 };
}

function collectStorageSlots(root) {
  const editor = root && root.querySelector
    ? (root.matches && root.matches("[data-storage-editor]") ? root : root.querySelector("[data-storage-editor]"))
    : null;
  if (!editor) return null;
  const baysEl = editor.querySelector("[data-storage-bays]");
  const bays = Math.max(0, parseInt(baysEl ? baysEl.value : "0", 10) || 0);
  const slots = [];
  editor.querySelectorAll("[data-storage-tile]").forEach(t => {
    if (!t.dataset.type) return;
    const cap = t.dataset.cap || "";
    const slot = {
      bay: parseInt(t.dataset.bay, 10),
      type: t.dataset.type,
      cap: cap ? cap + " " + (t.dataset.unit || "GB") : "",
      status: cap ? (t.dataset.status || "online") : "",
    };
    if (t.dataset.raid) slot.raid = t.dataset.raid;
    if (t.dataset.brand) slot.brand = t.dataset.brand;
    if (t.dataset.notes) slot.notes = t.dataset.notes;
    slots.push(slot);
  });
  slots.sort((a, b) => a.bay - b.bay);
  let iface = "";
  if (slots.length) {
    const types = new Set(slots.map(s => s.type));
    if (types.size === 1) iface = STORAGE_IFACE[slots[0].type] || "";
  }
  return { bays: String(bays), slots, iface };
}

function initStorageEditor(editor) {
  if (!editor) return;
  const baysEl = editor.querySelector("[data-storage-bays]");
  const grid = editor.querySelector("[data-storage-grid]");
  const panel = editor.querySelector("[data-storage-edit]");
  if (!baysEl || !grid) return;
  const groupPanel = editor.querySelector("[data-storage-edit-group]");
  const groupRaidSel = groupPanel ? groupPanel.querySelector("[data-storage-edit-group-raid]") : null;
  const groupPreviewEl = groupPanel ? groupPanel.querySelector("[data-storage-group-preview]") : null;
  const groupCountEl = groupPanel ? groupPanel.querySelector("[data-storage-edit-count]") : null;
  const multiToggle = editor.querySelector("[data-storage-multiselect]");
  let selectedBay = null;
  let multiMode = !!(multiToggle && multiToggle.checked);
  const selected = new Set();
  let anchorBay = null;
  let liveMap = {};

  const slotMapOf = () => {
    const map = {};
    grid.querySelectorAll("[data-storage-tile]").forEach(t => {
      if (t.dataset.type) map[parseInt(t.dataset.bay, 10)] = {
        type: t.dataset.type, cap: t.dataset.cap || "", unit: t.dataset.unit || "GB", raid: t.dataset.raid || "",
        brand: t.dataset.brand || "", status: t.dataset.status || "", notes: t.dataset.notes || "",
      };
    });
    return map;
  };

  const tileOf = bay => grid.querySelector(`[data-storage-tile][data-bay="${bay}"]`);

  const raidTileClass = raid => raid ? "raid-" + raid.replace(/^RAID\s+/i, "").toLowerCase() : "";
  const applyRaidClass = tile => {
    ["raid-0", "raid-1", "raid-5", "raid-6", "raid-10"].forEach(c => tile.classList.toggle(c, c === raidTileClass(tile.dataset.raid)));
  };

  const renderGrid = (slotMap) => {
    if (slotMap && Object.keys(slotMap).length) liveMap = slotMap;
    slotMap = liveMap;
    const n = Math.max(0, parseInt(baysEl.value, 10) || 0);
    if (n <= 0) {
      grid.innerHTML = '<div class="form-hint" data-storage-empty>Masukkan jumlah bay untuk membuat grid slot.</div>';
      if (panel) panel.style.display = "none";
      if (groupPanel) groupPanel.style.display = "none";
      selected.clear();
      anchorBay = null;
      selectedBay = null;
      return;
    }
    let html = "";
    for (let i = 1; i <= n; i++) {
      const sl = slotMap[i];
      const cls = (sl && sl.type ? "storage-tile filled" : "storage-tile") +
        (sl && sl.type && sl.raid ? " " + raidTileClass(sl.raid) : "") +
        (selected.has(i) ? " selected-group" : "");
      if (sl && sl.type) {
        const stCls = statusClsOf(sl.status);
        html += `<button type="button" class="${cls}" data-storage-tile data-bay="${i}" data-type="${escNode(sl.type)}" data-cap="${escNode(sl.cap)}" data-unit="${escNode(sl.unit)}" data-raid="${escNode(sl.raid)}" data-brand="${escNode(sl.brand || "")}" data-status="${escNode(sl.status || "")}" data-notes="${escNode(sl.notes || "")}">
          <span class="st-num">${i}</span>${sl.cap ? `<span class="st-status ${stCls}" title="${escNode(DRIVE_STATUS[sl.status || "online"] || sl.status || "Online")}"></span>` : ""}<span class="st-type">${escNode(sl.type)}</span>${sl.raid ? `<span class="st-raid">${escNode(sl.raid)}</span>` : ""}${sl.cap ? `<span class="st-cap">${escNode(sl.cap)}${escNode(sl.unit)}</span>` : ""}${sl.brand ? `<span class="st-brand" title="${escNode(sl.brand)}">${escNode(sl.brand)}</span>` : ""}</button>`;
      } else {
        html += `<button type="button" class="${cls}" data-storage-tile data-bay="${i}" data-type="" data-cap="" data-unit="GB" data-raid="" data-brand="" data-status="" data-notes="">
          <span class="st-num">${i}</span></button>`;
      }
    }
    grid.innerHTML = html;
    if (panel) panel.style.display = "none";
    if (groupPanel) groupPanel.style.display = "none";
    selectedBay = null;
    for (const b of [...selected]) if (b > n) selected.delete(b);
    if (selected.size) updateGroupUI();
  };

  const refreshTile = (tile) => {
    if (!tile) return;
    const filled = !!tile.dataset.type;
    const bay = parseInt(tile.dataset.bay, 10);
    if (filled) liveMap[bay] = {
      type: tile.dataset.type, cap: tile.dataset.cap || "", unit: tile.dataset.unit || "GB", raid: tile.dataset.raid || "",
      brand: tile.dataset.brand || "", status: tile.dataset.status || "", notes: tile.dataset.notes || "",
    };
    else delete liveMap[bay];
    tile.classList.toggle("filled", filled);
    applyRaidClass(tile);
    const st = (tile.dataset.status || "online").toLowerCase();
    tile.innerHTML = `<span class="st-num">${escNode(tile.dataset.bay)}</span>` +
      (filled && tile.dataset.cap ? `<span class="st-status ${statusClsOf(st)}" title="${escNode(DRIVE_STATUS[st] || st)}"></span>` : "") +
      (filled ? `<span class="st-type">${escNode(tile.dataset.type)}</span>` : "") +
      (filled && tile.dataset.raid ? `<span class="st-raid">${escNode(tile.dataset.raid)}</span>` : "") +
      (filled && tile.dataset.cap ? `<span class="st-cap">${escNode(tile.dataset.cap)}${escNode(tile.dataset.unit || "")}</span>` : "") +
      (filled && tile.dataset.brand ? `<span class="st-brand" title="${escNode(tile.dataset.brand)}">${escNode(tile.dataset.brand)}</span>` : "");
  };

  const markGroupTiles = () => {
    grid.querySelectorAll("[data-storage-tile]").forEach(t => {
      t.classList.toggle("selected-group", selected.has(parseInt(t.dataset.bay, 10)));
    });
  };

  const selectedSlots = () => {
    const out = [];
    selected.forEach(b => {
      const t = tileOf(b);
      if (t && t.dataset.type) out.push({
        bay: b, type: t.dataset.type,
        cap: t.dataset.cap ? t.dataset.cap + " " + (t.dataset.unit || "GB") : "",
        raid: t.dataset.raid || "",
      });
    });
    return out;
  };

  const updateGroupUI = () => {
    if (!groupPanel) return;
    const n = selected.size;
    if (n < 1) { groupPanel.style.display = "none"; return; }
    const raid = groupRaidSel ? groupRaidSel.value : "";
    if (groupCountEl) groupCountEl.textContent = n;
    groupPanel.style.display = "flex";
    const slots = selectedSlots().map(s => ({ ...s, raid }));
    const res = computeUsableCapacity(slots);
    const warns = [];
    if (raidGroupWarning(raid, slots.length)) warns.push(raidGroupWarning(raid, slots.length));
    if (slots.length > 1 && new Set(slots.map(s => s.type)).size > 1) warns.push("Tipe drive bercampur (HDD/SSD) dalam satu group.");
    if (slots.length > 1 && new Set(slots.map(s => s.cap)).size > 1) warns.push("Ukuran drive bercampur — usable dihitung dari drive terkecil.");
    if (groupPreviewEl) {
      groupPreviewEl.innerHTML = `${slots.length} drive · ${raid || "RAID -"} → usable <b>${fmtStorage(res.usable)}</b> dari raw <b>${fmtStorage(res.raw)}</b>${warns.length ? `<span class="storage-warn"> ${warns.join(" · ")}</span>` : ""}`;
    }
  };

  const selectTile = (tile) => {
    grid.querySelectorAll("[data-storage-tile]").forEach(t => t.classList.remove("selected"));
    selected.clear();
    anchorBay = null;
    markGroupTiles();
    if (groupPanel) groupPanel.style.display = "none";
    if (!tile || !panel) return;
    tile.classList.add("selected");
    selectedBay = parseInt(tile.dataset.bay, 10);
    panel.querySelector("[data-storage-edit-bay]").textContent = selectedBay;
    panel.querySelector("[data-storage-edit-type]").value = tile.dataset.type || STORAGE_TYPES[0];
    panel.querySelector("[data-storage-edit-cap]").value = tile.dataset.cap || "";
    panel.querySelector("[data-storage-edit-unit]").value = tile.dataset.unit || "GB";
    const brandEl = panel.querySelector("[data-storage-edit-brand]");
    if (brandEl) brandEl.value = tile.dataset.brand || "";
    const statusEl = panel.querySelector("[data-storage-edit-status]");
    if (statusEl) statusEl.value = tile.dataset.status || "";
    const notesEl = panel.querySelector("[data-storage-edit-notes]");
    if (notesEl) notesEl.value = tile.dataset.notes || "";
    panel.style.display = "flex";
  };

  const refreshTotals = () => {
    const st = collectStorageSlots(editor);
    const totalEl = editor.querySelector("[data-storage-total]");
    if (totalEl) totalEl.value = fmtStorage(storageTotalGB(st.slots));
    const ifaceEl = editor.querySelector('[data-sf="storageIface"]');
    if (ifaceEl && st.iface) ifaceEl.value = st.iface;
    const summaryEl = editor.querySelector("[data-storage-summary]");
    if (summaryEl) {
      if (!st.slots.length) { summaryEl.style.display = "none"; return; }
      const res = computeUsableCapacity(st.slots);
      const chips = res.groups.map(g =>
        `<span class="st-chip">${escNode(g.raid)} <b>${g.drives}</b>×${fmtStorage(g.per)} → <b>${fmtStorage(g.usable)}</b></span>`).join("");
      summaryEl.innerHTML = `<span class="kv-sub">Usable <b>${fmtStorage(res.usable)}</b> dari raw <b>${fmtStorage(res.raw)}</b> · efisiensi ${Math.round(res.efficiency * 100)}%</span>` +
        (chips ? `<span class="srv-chips">${chips}</span>` : "");
      summaryEl.style.display = "flex";
    }
  };

  grid.addEventListener("click", e => {
    const tile = e.target.closest("[data-storage-tile]");
    if (!tile) return;
    const bay = parseInt(tile.dataset.bay, 10);
    const isMod = e.ctrlKey || e.metaKey || e.shiftKey || multiMode;
    if (isMod) {
      e.preventDefault();
      if (e.shiftKey && anchorBay != null && anchorBay !== bay) {
        const lo = Math.min(anchorBay, bay), hi = Math.max(anchorBay, bay);
        for (let i = lo; i <= hi; i++) { const t = tileOf(i); if (t && t.dataset.type) selected.add(i); }
      } else {
        if (!tile.dataset.type) return;
        if (selected.has(bay)) selected.delete(bay); else selected.add(bay);
        anchorBay = bay;
      }
      markGroupTiles();
      updateGroupUI();
      return;
    }
    if (!tile.dataset.type) {
      tile.dataset.type = STORAGE_TYPES[0];
      tile.dataset.cap = "";
      tile.dataset.unit = "GB";
      tile.dataset.raid = "";
      tile.dataset.brand = "";
      tile.dataset.status = "";
      tile.dataset.notes = "";
      refreshTile(tile);
    }
    selectTile(tile);
  });

  if (panel) {
    panel.addEventListener("input", () => {
      const tile = tileOf(selectedBay);
      if (!tile) return;
      tile.dataset.type = panel.querySelector("[data-storage-edit-type]").value;
      tile.dataset.cap = panel.querySelector("[data-storage-edit-cap]").value.trim();
      tile.dataset.unit = panel.querySelector("[data-storage-edit-unit]").value;
      const brandEl = panel.querySelector("[data-storage-edit-brand]");
      if (brandEl) tile.dataset.brand = brandEl.value.trim();
      const statusEl = panel.querySelector("[data-storage-edit-status]");
      if (statusEl) tile.dataset.status = tile.dataset.cap ? (statusEl.value || "online") : "";
      const notesEl = panel.querySelector("[data-storage-edit-notes]");
      if (notesEl) tile.dataset.notes = notesEl.value.trim();
      refreshTile(tile);
      refreshTotals();
    });
    panel.addEventListener("click", e => {
      if (!e.target.closest("[data-storage-empty-btn]")) return;
      const tile = tileOf(selectedBay);
      if (tile) {
        tile.dataset.type = "";
        tile.dataset.cap = "";
        tile.dataset.unit = "GB";
        tile.dataset.raid = "";
        tile.dataset.brand = "";
        tile.dataset.status = "";
        tile.dataset.notes = "";
        refreshTile(tile);
        refreshTotals();
        selectTile(tile);
      }
    });
  }

  if (groupPanel && groupRaidSel) {
    groupRaidSel.addEventListener("input", updateGroupUI);
    groupPanel.addEventListener("click", e => {
      if (e.target.closest("[data-storage-group-apply]")) {
        const raid = groupRaidSel.value;
        selected.forEach(b => {
          const t = tileOf(b);
          if (t) { t.dataset.raid = raid; refreshTile(t); }
        });
        selected.clear();
        anchorBay = null;
        markGroupTiles();
        groupPanel.style.display = "none";
        refreshTotals();
        return;
      }
      if (e.target.closest("[data-storage-group-clear]")) {
        selected.clear();
        anchorBay = null;
        markGroupTiles();
        groupPanel.style.display = "none";
      }
    });
  }

  if (multiToggle) {
    multiToggle.addEventListener("change", () => {
      multiMode = multiToggle.checked;
      if (!multiMode) {
        selected.clear();
        anchorBay = null;
        markGroupTiles();
        if (groupPanel) groupPanel.style.display = "none";
      }
    });
  }

  const reRender = () => { renderGrid(slotMapOf()); refreshTotals(); };
  baysEl.addEventListener("input", reRender);
  baysEl.addEventListener("change", reRender);

  editor._setStorageSlots = function (bays, slots) {
    baysEl.value = bays;
    liveMap = {};
    const map = {};
    (slots || []).forEach(s => {
      const capM = String(s.cap || "").match(/^([\d.,]+)\s*(GB|TB|PB)?/i);
      map[s.bay] = {
        type: s.type || "",
        cap: capM ? String(capM[1]).replace(",", ".") : "",
        unit: capM ? ((capM[2] || "GB") + "").toUpperCase() : "GB",
        raid: s.raid || "",
        brand: s.brand || "",
        status: s.status || "online",
        notes: s.notes || "",
      };
    });
    Object.assign(liveMap, map);
    renderGrid(map);
    refreshTotals();
  };

  renderGrid(slotMapOf());
  refreshTotals();
}

// ---- Memory slot grid: per-slot DIMM (tipe, kapasitas, brand, status, notes; tanpa RAID) ----
const DIMM_TYPES = ["DDR4", "DDR5", "DDR3", "LRDIMM"];
const DIMM_BRANDS = ["Samsung", "SK hynix", "Micron", "Crucial", "Kingston", "Nanya", "ADATA"];

function dimmTotalGB(slots) {
  let gb = 0;
  (Array.isArray(slots) ? slots : []).forEach(s => {
    const m = String(s.cap || "").match(/^([\d.,]+)\s*(GB|TB|PB)?/i);
    if (!m) return;
    const v = parseFloat(String(m[1]).replace(",", ".")) || 0;
    const u = ((m[2] || "GB") + "").toUpperCase();
    gb += u === "TB" ? v * 1000 : u === "PB" ? v * 1e6 : v;
  });
  return gb;
}

function collectDimmSlots(root) {
  const editor = root && root.querySelector
    ? (root.matches && root.matches("[data-dimm-editor]") ? root : root.querySelector("[data-dimm-editor]"))
    : null;
  if (!editor) return null;
  const totalEl = editor.querySelector("[data-dimm-slots]");
  const total = Math.max(0, parseInt(totalEl ? totalEl.value : "0", 10) || 0);
  const slots = [];
  editor.querySelectorAll("[data-dimm-tile]").forEach(t => {
    if (!t.dataset.type) return;
    const cap = t.dataset.cap || "";
    const slot = {
      slot: parseInt(t.dataset.slot, 10),
      type: t.dataset.type,
      cap: cap ? cap + " " + (t.dataset.unit || "GB") : "",
      status: cap ? (t.dataset.status || "online") : "",
    };
    if (t.dataset.brand) slot.brand = t.dataset.brand;
    if (t.dataset.notes) slot.notes = t.dataset.notes;
    slots.push(slot);
  });
  slots.sort((a, b) => a.slot - b.slot);
  return { total: String(total), slots, installedGB: dimmTotalGB(slots) };
}

function initDimmEditor(editor) {
  if (!editor) return;
  const slotsEl = editor.querySelector("[data-dimm-slots]");
  const grid = editor.querySelector("[data-dimm-grid]");
  const panel = editor.querySelector("[data-dimm-edit]");
  const summaryEl = editor.querySelector("[data-dimm-summary]");
  const installedEl = editor.querySelector("[data-dimm-installed]");
  const perSlotEl = editor.querySelector('[data-sf="dimmPerSlot"]');
  let dimmLiveMap = {};
  let selectedSlot = null;

  const tileOf = s => grid.querySelector(`[data-dimm-tile][data-slot="${s}"]`);

  const refreshTile = (tile) => {
    if (!tile) return;
    const filled = !!tile.dataset.type;
    const slot = parseInt(tile.dataset.slot, 10);
    if (filled) dimmLiveMap[slot] = {
      type: tile.dataset.type, cap: tile.dataset.cap || "", unit: tile.dataset.unit || "GB",
      brand: tile.dataset.brand || "", status: tile.dataset.status || "", notes: tile.dataset.notes || "",
    };
    else delete dimmLiveMap[slot];
    tile.classList.toggle("filled", filled);
    tile.classList.remove("st-st-online", "st-st-degradasi", "st-st-failed");
    const hasCap = filled && tile.dataset.cap;
    if (hasCap) tile.classList.add(statusClsOf(tile.dataset.status || "online"));
    const st = (tile.dataset.status || "online").toLowerCase();
    tile.innerHTML = `<span class="st-num">${escNode(tile.dataset.slot)}</span>` +
      (hasCap ? `<span class="st-status ${statusClsOf(st)}" title="${escNode(DRIVE_STATUS[st] || st)}"></span>` : "") +
      (filled ? `<span class="st-type">${escNode(tile.dataset.type)}</span>` : "") +
      (filled && tile.dataset.cap ? `<span class="st-cap">${escNode(tile.dataset.cap)}${escNode(tile.dataset.unit || "")}</span>` : "") +
      (filled && tile.dataset.brand ? `<span class="st-brand" title="${escNode(tile.dataset.brand)}">${escNode(tile.dataset.brand)}</span>` : "");
  };

  const refreshTotals = () => {
    const st = collectDimmSlots(editor);
    if (installedEl && st.slots.length) installedEl.value = fmtStorage(st.installedGB);
    if (!summaryEl) return;
    if (!st.slots.length) { summaryEl.style.display = "none"; return; }
    const tyCounts = {}, brCounts = {}, stCounts = {};
    st.slots.forEach(x => {
      tyCounts[x.type || "?"] = (tyCounts[x.type || "?"] || 0) + 1;
      if (x.brand) brCounts[x.brand] = (brCounts[x.brand] || 0) + 1;
      if (x.status) stCounts[x.status] = (stCounts[x.status] || 0) + 1;
    });
    const chips = [];
    Object.keys(tyCounts).forEach(t => chips.push(`<span class="st-chip">${escNode(t)} <b>${tyCounts[t]}</b></span>`));
    Object.keys(brCounts).forEach(b => chips.push(`<span class="st-chip" title="Merek modul">${escNode(b)} <b>${brCounts[b]}</b></span>`));
    Object.keys(stCounts).forEach(s => chips.push(`<span class="st-chip ${statusClsOf(s)}">${escNode(DRIVE_STATUS[s] || s)} <b>${stCounts[s]}</b></span>`));
    const bad = st.slots.filter(x => (x.status || "online") !== "online");
    const badNote = bad.length
      ? `<span class="srv-bad">⚠ ${bad.length} modul perlu perhatian (slot ${bad.map(x => x.slot).join(", ")})</span>`
      : "";
    summaryEl.innerHTML = `<span class="kv-sub"><b>${st.slots.length}</b> dari <b>${st.total}</b> slot terisi · Installed <b>${fmtStorage(st.installedGB)}</b></span>` +
      (chips.length ? `<span class="srv-chips">${chips.join("")}</span>` : "") +
      (badNote ? `<span class="srv-chips">${badNote}</span>` : "");
    summaryEl.style.display = "flex";
  };

  const renderGrid = (map) => {
    if (map && Object.keys(map).length) dimmLiveMap = map;
    map = dimmLiveMap;
    const n = Math.max(0, parseInt(slotsEl ? slotsEl.value : "0", 10) || 0);
    if (n <= 0) {
      grid.innerHTML = '<div class="form-hint" data-dimm-empty>Masukkan jumlah slot untuk membuat grid DIMM.</div>';
      if (panel) panel.style.display = "none";
      selectedSlot = null;
      refreshTotals();
      return;
    }
    let html = "";
    for (let i = 1; i <= n; i++) {
      const sl = map[i];
      if (sl && sl.type) {
        const stCls = statusClsOf(sl.status);
        html += `<button type="button" class="storage-tile dimm-tile" data-dimm-tile data-slot="${i}" data-type="${escNode(sl.type)}" data-cap="${escNode(sl.cap)}" data-unit="${escNode(sl.unit)}" data-brand="${escNode(sl.brand || "")}" data-status="${escNode(sl.status || "")}" data-notes="${escNode(sl.notes || "")}">
          <span class="st-num">${i}</span>${sl.cap ? `<span class="st-status ${stCls}" title="${escNode(DRIVE_STATUS[sl.status || "online"] || sl.status || "Online")}"></span>` : ""}<span class="st-type">${escNode(sl.type)}</span>${sl.cap ? `<span class="st-cap">${escNode(sl.cap)}${escNode(sl.unit)}</span>` : ""}${sl.brand ? `<span class="st-brand" title="${escNode(sl.brand)}">${escNode(sl.brand)}</span>` : ""}</button>`;
      } else {
        html += `<button type="button" class="storage-tile dimm-tile" data-dimm-tile data-slot="${i}" data-type="" data-cap="" data-unit="GB" data-brand="" data-status="" data-notes="">
          <span class="st-num">${i}</span></button>`;
      }
    }
    grid.innerHTML = html;
    if (panel) panel.style.display = "none";
    selectedSlot = null;
    refreshTotals();
  };

  const slotMapOf = () => {
    const map = {};
    grid.querySelectorAll("[data-dimm-tile]").forEach(t => {
      if (!t.dataset.type) return;
      map[parseInt(t.dataset.slot, 10)] = {
        type: t.dataset.type, cap: t.dataset.cap || "", unit: t.dataset.unit || "GB",
        brand: t.dataset.brand || "", status: t.dataset.status || "", notes: t.dataset.notes || "",
      };
    });
    return map;
  };

  const selectTile = (tile) => {
    grid.querySelectorAll("[data-dimm-tile]").forEach(t => t.classList.remove("selected"));
    if (!tile || !panel) return;
    tile.classList.add("selected");
    selectedSlot = parseInt(tile.dataset.slot, 10);
    panel.querySelector("[data-dimm-edit-slot]").textContent = selectedSlot;
    panel.querySelector("[data-dimm-edit-type]").value = tile.dataset.type || DIMM_TYPES[0];
    panel.querySelector("[data-dimm-edit-cap]").value = tile.dataset.cap || "";
    panel.querySelector("[data-dimm-edit-unit]").value = tile.dataset.unit || "GB";
    const brandEl = panel.querySelector("[data-dimm-edit-brand]");
    if (brandEl) brandEl.value = tile.dataset.brand || "";
    const statusEl = panel.querySelector("[data-dimm-edit-status]");
    if (statusEl) statusEl.value = tile.dataset.status || "";
    const notesEl = panel.querySelector("[data-dimm-edit-notes]");
    if (notesEl) notesEl.value = tile.dataset.notes || "";
    panel.style.display = "flex";
  };

  grid.addEventListener("click", e => {
    const tile = e.target.closest("[data-dimm-tile]");
    if (!tile) return;
    if (!tile.dataset.type) {
      tile.dataset.type = DIMM_TYPES[0];
      tile.dataset.cap = "";
      tile.dataset.unit = "GB";
      tile.dataset.brand = "";
      tile.dataset.status = "";
      tile.dataset.notes = "";
      if (perSlotEl) {
        const m = String(perSlotEl.value || "").match(/^([\d.,]+)\s*(GB|TB|PB)?/i);
        if (m) { tile.dataset.cap = String(m[1]).replace(",", "."); tile.dataset.unit = ((m[2] || "GB") + "").toUpperCase(); }
      }
      if (tile.dataset.cap) tile.dataset.status = "online";
      refreshTile(tile);
    }
    selectTile(tile);
  });

  if (panel) {
    panel.addEventListener("input", () => {
      const tile = tileOf(selectedSlot);
      if (!tile) return;
      tile.dataset.type = panel.querySelector("[data-dimm-edit-type]").value;
      tile.dataset.cap = panel.querySelector("[data-dimm-edit-cap]").value.trim();
      tile.dataset.unit = panel.querySelector("[data-dimm-edit-unit]").value;
      const brandEl = panel.querySelector("[data-dimm-edit-brand]");
      if (brandEl) tile.dataset.brand = brandEl.value.trim();
      const statusEl = panel.querySelector("[data-dimm-edit-status]");
      if (statusEl) tile.dataset.status = tile.dataset.cap ? (statusEl.value || "online") : "";
      const notesEl = panel.querySelector("[data-dimm-edit-notes]");
      if (notesEl) tile.dataset.notes = notesEl.value.trim();
      refreshTile(tile);
      refreshTotals();
    });
    panel.addEventListener("click", e => {
      if (!e.target.closest("[data-dimm-empty-btn]")) return;
      const tile = tileOf(selectedSlot);
      if (tile) {
        tile.dataset.type = ""; tile.dataset.cap = ""; tile.dataset.unit = "GB";
        tile.dataset.brand = ""; tile.dataset.status = ""; tile.dataset.notes = "";
        refreshTile(tile);
        refreshTotals();
        selectTile(tile);
      }
    });
  }

  if (slotsEl) {
    slotsEl.addEventListener("input", () => { renderGrid(dimmLiveMap); });
    slotsEl.addEventListener("change", () => { renderGrid(dimmLiveMap); });
  }

  editor._setDimmSlots = function (total, slots) {
    if (slotsEl) slotsEl.value = total;
    dimmLiveMap = {};
    const map = {};
    (slots || []).forEach(s => {
      const capM = String(s.cap || "").match(/^([\d.,]+)\s*(GB|TB|PB)?/i);
      map[s.slot] = {
        type: s.type || "",
        cap: capM ? String(capM[1]).replace(",", ".") : "",
        unit: capM ? ((capM[2] || "GB") + "").toUpperCase() : "GB",
        brand: s.brand || "",
        status: s.status || "online",
        notes: s.notes || "",
      };
    });
    Object.assign(dimmLiveMap, map);
    renderGrid(map);
  };

  renderGrid(slotMapOf());
}

document.querySelectorAll("[data-dimm-editor]").forEach(initDimmEditor);

document.querySelectorAll("[data-storage-editor]").forEach(initStorageEditor);

// ---- Simpan Server: kumpulkan isian form lalu simpan ke localStorage (server-data.js) ----
const NORM = {
  vendor: t => (t === "Lainnya" ? "Lainnya" : t),
  fungsi: t => ({ Web: "web", Database: "database", Virtualization: "virtualization", Backup: "backup" }[t] || t),
  monitoring: t => ({ SNMP: "snmp", IPMI: "ipmi", DCIM: "dcim", "DCIM Integration": "dcim" }[t] || t),
  kondisi: t => t,
  speed: t => t,
  mgmtPort: t => t,
  powerRedundancy: t => t,
  raid: t => t,
  raidTypes: t => t,
  tags: t => t.toLowerCase(),
};

function collectServerForm(root) {
  root = root || document;
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
    if (multi) return active.map(c => (NORM[key] || (t => t))(c.textContent.trim())).filter(Boolean);
    const c = p.querySelector(".chip.active") || p.querySelector(".brand-tile.selected");
    return c ? (NORM[key] || (t => t))(c.textContent.trim()) : "";
  };

  const core = sf("core"), thread = sf("thread");
  const coreThread = [core, thread].filter(Boolean).join(" / ") || sf("coreThread");
  const cable = [sf("cablePanel"), sf("cablePorts")].filter(Boolean).join(" · ") || sf("cableManagement");
  const st = collectStorageSlots(root);
  const dm = collectDimmSlots(root);

  const siteSel = root.querySelector('[data-sf="site"]');
  const site = sf("site");
  const siteName = siteSel && siteSel.selectedIndex >= 0 ? siteSel.options[siteSel.selectedIndex].textContent.trim() : "";

  const vendor = sf("vendor") === "Lainnya" ? (sf("vendorOther") || "Lainnya") : sf("vendor");

  const rack = sf("rack");
  let siteCode = site;
  if (!siteCode && rack) {
    const m = rack.match(/^R(\d)/);
    if (m) siteCode = "DC" + m[1];
  }

  return {
    hostname: sf("hostname"),
    tipeServer: sf("tipeServer") || "rack",
    formFactor: sf("formFactor"),
    nodeNumber: sf("nodeNumber"),
    nodeTotal: sf("nodeTotal"),
    vendor,
    model: sf("model"),
    serial: sf("serial"),
    tahunPembelian: sf("tahunPembelian"),
    warranty: sf("warranty"),
    os: sfText("os"),
    processorCount: sf("processorCount"),
    processorType: sf("processorType"),
    coreThread,
    dimmTotal: dm ? dm.total : sf("dimmTotal"),
    dimmPerSlot: sf("dimmPerSlot"),
    dimmInstalled: dm && dm.slots.length ? (fmtStorage(dm.installedGB) || sf("dimmInstalled")) : sf("dimmInstalled"),
    dimmSlots: dm ? dm.slots : undefined,
    storageBays: st ? st.bays : sf("storageBays"),
    storageCap: st ? (fmtStorage(storageTotalGB(st.slots)) || sf("storageCap")) : sf("storageCap"),
    storageIface: st ? (st.iface || sf("storageIface")) : ({ sata: "SATA", sas: "SAS", nvme: "NVMe", mixed: "Mixed" }[sf("storageIface")] || sfText("storageIface")),
    storageSlots: st ? st.slots : undefined,
    raid: pick("raid", false),
    raidTypes: pick("raidTypes", true),
    lanRj45: sf("lanRj45"),
    lanSfp: sf("lanSfp"),
    lanQsfp: sf("lanQsfp"),
    speed: pick("speed", false),
    mgmtPort: pick("mgmtPort", false),
    pcieCount: sf("pcieCount"),
    pcieGen: sf("pcieGen"),
    psuCount: sf("psuCount") || "2",
    psuWatt: sf("psuWatt") || "750 W",
    powerRedundancy: pick("powerRedundancy", false),
    site: siteCode,
    siteName,
    rack,
    posisiU: sf("posisiU"),
    vlan: sf("vlan"),
    cableManagement: cable,
    hypervisor: sfText("hypervisor"),
    fungsi: pick("fungsi", true),
    monitoring: pick("monitoring", true),
    kondisi: pick("kondisi", false),
    assetTag: sf("assetTag"),
    rackColor: sf("rackColor"),
    tags: pick("tags", true),
  };
}

const saveBtn = document.getElementById("save-server");
const saveMsg = document.getElementById("save-msg");
if (saveBtn && saveMsg) {
  saveBtn.addEventListener("click", () => {
    const mode = FORM_MODE[(serverType && serverType.value) || "rack"] || "rack";
    const server = mode === "blade" ? collectChassisForm() : collectServerForm();
    if (mode !== "blade" && !server.hostname) {
      saveMsg.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Nama Aset / Hostname wajib diisi sebelum menyimpan.';
      saveMsg.classList.add("show", "error");
      saveMsg.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setTimeout(() => saveMsg.classList.remove("show", "error"), 4000);
      return;
    }
    const ok = editingId
      ? (typeof updateServer === "function" ? updateServer(editingId, server) : false)
      : (typeof saveServer === "function" ? saveServer(server) : false);
    if (ok) {
      saveMsg.innerHTML = editingId
        ? '<i class="fa-solid fa-circle-check"></i> Perubahan berhasil disimpan — membuka Daftar Server…'
        : '<i class="fa-solid fa-circle-check"></i> Server berhasil disimpan — membuka Daftar Server…';
      saveMsg.classList.add("show");
      saveMsg.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setTimeout(() => { window.location.href = "server-list.html"; }, 900);
    } else {
      saveMsg.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Gagal menyimpan server (storage tidak tersedia).';
      saveMsg.classList.add("show", "error");
      saveMsg.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setTimeout(() => saveMsg.classList.remove("show", "error"), 4000);
    }
  });
}

