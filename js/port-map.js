
document.getElementById("powermap-close").addEventListener("click", () => document.getElementById("powermap-overlay").classList.remove("open"));
document.getElementById("powermap-overlay").addEventListener("click", e => { if (e.target.id === "powermap-overlay") e.currentTarget.classList.remove("open"); });

function openPowerMapEditPanel() {
  if (!currentPduKey) return;
  const data = POWER_DATA[currentPduKey];
  const panel = document.getElementById("powermap-edit-panel");
  if (!data) { panel.style.display = "none"; return; }
  const picker = document.getElementById("powermap-outlet-picker");
  const customInput = document.getElementById("powermap-outlet-custom");
  const warning = document.getElementById("powermap-edit-warning");
  warning.style.display = "none";
  picker.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
  const presetMatch = picker.querySelector(`.chip[data-outlet="${data.ports}"]`);
  if (presetMatch) {
    presetMatch.classList.add("active");
    customInput.style.display = "none";
  } else {
    picker.querySelector('.chip[data-outlet="custom"]').classList.add("active");
    customInput.style.display = "";
    customInput.value = data.ports;
  }
  panel.style.display = "";
}

document.getElementById("powermap-edit-btn").addEventListener("click", () => {
  const panel = document.getElementById("powermap-edit-panel");
  if (panel.style.display === "none") openPowerMapEditPanel();
  else panel.style.display = "none";
});

document.querySelectorAll("#powermap-outlet-picker .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#powermap-outlet-picker .chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    const isCustom = chip.dataset.outlet === "custom";
    document.getElementById("powermap-outlet-custom").style.display = isCustom ? "" : "none";
    if (isCustom) document.getElementById("powermap-outlet-custom").focus();
  });
});

document.getElementById("powermap-outlet-custom").addEventListener("input", function () {
  if (parseInt(this.value, 10) > 36) this.value = 36;
});

document.getElementById("powermap-edit-cancel").addEventListener("click", () => {
  document.getElementById("powermap-edit-panel").style.display = "none";
});

document.getElementById("powermap-edit-save").addEventListener("click", () => {
  if (!currentPduKey) return;
  const data = POWER_DATA[currentPduKey];
  const activeChip = document.querySelector("#powermap-outlet-picker .chip.active");
  let newPorts = data.ports;
  if (activeChip) {
    if (activeChip.dataset.outlet === "custom") {
      const v = parseInt(document.getElementById("powermap-outlet-custom").value, 10);
      if (v) newPorts = Math.min(36, Math.max(1, v));
    } else {
      newPorts = parseInt(activeChip.dataset.outlet, 10);
    }
  }
  const warning = document.getElementById("powermap-edit-warning");
  if (newPorts < data.rows.length) {
    warning.style.display = "block";
    warning.textContent = `Tidak bisa: ${data.rows.length} outlet sedang terpakai, minimal harus ${data.rows.length}.`;
    return;
  }
  data.ports = newPorts;
  document.getElementById("powermap-edit-panel").style.display = "none";
  savePowerMap(currentPduKey);
  openPowerMap(currentPduKey);
  if (typeof buildPduStrip === "function" && typeof PDU_STRIP_MAP !== "undefined" && PDU_STRIP_MAP[currentPduKey]) {
    const s = PDU_STRIP_MAP[currentPduKey];
    buildPduStrip(s.elId, newPorts, data.rows.length, s.label, currentPduKey);
  }
});

// ---- Editor data outlet (klik kotak / nomor outlet di PDU Power Map) ----
function ensureOutletEditor() {
  if (document.getElementById("powermap-outlet-overlay")) return;
  document.body.insertAdjacentHTML("beforeend", `
  <div class="modal-overlay" id="powermap-outlet-overlay" style="z-index:60;">
    <div class="modal" style="max-width:480px;">
      <div class="modal-head">
        <div><div class="modal-title" id="powermap-outlet-title">Outlet — Power Map</div><div class="modal-sub" id="powermap-outlet-sub"></div></div>
        <div class="modal-close" id="powermap-outlet-close"><i class="fa-solid fa-xmark"></i></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 18px;">
        <div style="margin-bottom:14px;"><label class="form-label">Label ID</label><input class="form-input mono" type="text" id="powermap-outlet-label" placeholder="mis. CBL-2013"></div>
        <div style="margin-bottom:14px;"><label class="form-label">Perangkat Terhubung</label><input class="form-input" type="text" id="powermap-outlet-device" placeholder="mis. SRV-APP-04"></div>
        <div style="margin-bottom:14px;"><label class="form-label">PSU Tujuan</label><select class="form-input" id="powermap-outlet-psu"><option value="PSU-A">PSU-A</option><option value="PSU-B">PSU-B</option><option value="Single PSU">Single PSU</option></select></div>
        <div style="margin-bottom:14px;"><label class="form-label">Beban (W)</label><input class="form-input mono" type="number" id="powermap-outlet-watt" min="0" placeholder="mis. 240"></div>
      </div>
      <div class="modal-foot" style="justify-content:space-between;">
        <button class="btn ghost" id="powermap-outlet-delete" style="color:var(--danger);"><i class="fa-solid fa-trash"></i> Kosongkan Outlet</button>
        <div style="display:flex;gap:8px;">
          <button class="btn ghost" id="powermap-outlet-cancel">Batal</button>
          <button class="btn primary" id="powermap-outlet-save"><i class="fa-solid fa-check"></i> Simpan</button>
        </div>
      </div>
    </div>
  </div>`);
}

let editingOutlet = null;

function refreshPduStrip() {
  if (typeof buildPduStrip === "function" && typeof PDU_STRIP_MAP !== "undefined" && PDU_STRIP_MAP[currentPduKey]) {
    const s = PDU_STRIP_MAP[currentPduKey];
    buildPduStrip(s.elId, POWER_DATA[currentPduKey].ports, POWER_DATA[currentPduKey].rows.length, s.label, currentPduKey);
  }
}

function openOutletEditor(outletNo) {
  if (!currentPduKey) return;
  const data = POWER_DATA[currentPduKey];
  if (!data) return;
  editingOutlet = outletNo;
  const row = data.rows.find(r => r.outlet === outletNo);
  document.getElementById("powermap-outlet-title").textContent = `Outlet ${outletNo} — ${currentPduKey}`;
  document.getElementById("powermap-outlet-sub").textContent = row ? "Edit data perangkat yang terhubung ke outlet ini." : "Outlet kosong — isi data perangkat yang terhubung.";
  document.getElementById("powermap-outlet-label").value = row?.label || "";
  document.getElementById("powermap-outlet-device").value = row?.device || "";
  document.getElementById("powermap-outlet-psu").value = row?.psu || "PSU-A";
  document.getElementById("powermap-outlet-watt").value = row ? String(row.watt) : "";
  document.getElementById("powermap-outlet-delete").style.visibility = row ? "visible" : "hidden";
  document.getElementById("powermap-outlet-overlay").classList.add("open");
}

ensureOutletEditor();
document.getElementById("powermap-outlet-overlay").addEventListener("click", e => {
  if (e.target === document.getElementById("powermap-outlet-overlay")) document.getElementById("powermap-outlet-overlay").classList.remove("open");
});
document.getElementById("powermap-outlet-close").addEventListener("click", () => document.getElementById("powermap-outlet-overlay").classList.remove("open"));
document.getElementById("powermap-outlet-cancel").addEventListener("click", () => document.getElementById("powermap-outlet-overlay").classList.remove("open"));
document.getElementById("powermap-outlet-save").addEventListener("click", () => {
  if (!currentPduKey || editingOutlet == null) return;
  const data = POWER_DATA[currentPduKey];
  const device = document.getElementById("powermap-outlet-device").value.trim();
  const label = document.getElementById("powermap-outlet-label").value.trim();
  const psu = document.getElementById("powermap-outlet-psu").value;
  const watt = Math.max(0, parseInt(document.getElementById("powermap-outlet-watt").value, 10) || 0);
  const row = { outlet: editingOutlet, device: device || "—", psu, watt, label: label || "" };
  const idx = data.rows.findIndex(r => r.outlet === editingOutlet);
  if (idx >= 0) data.rows[idx] = row; else data.rows.push(row);
  document.getElementById("powermap-outlet-overlay").classList.remove("open");
  savePowerMap(currentPduKey);
  openPowerMap(currentPduKey);
  refreshPduStrip();
});
document.getElementById("powermap-outlet-delete").addEventListener("click", () => {
  if (!currentPduKey || editingOutlet == null) return;
  const data = POWER_DATA[currentPduKey];
  data.rows = data.rows.filter(r => r.outlet !== editingOutlet);
  document.getElementById("powermap-outlet-overlay").classList.remove("open");
  savePowerMap(currentPduKey);
  openPowerMap(currentPduKey);
  refreshPduStrip();
});

document.getElementById("powermap-body").addEventListener("click", e => {
  const el = e.target.closest("[data-outlet-edit]");
  if (el) openOutletEditor(parseInt(el.dataset.outletEdit, 10));
});

// ---- Editor PSU perangkat (tambah / edit / hapus koneksi PSU di tampilan perangkat) ----
let editingDeviceKey = null;
let editingDevicePsu = null; // { pdu, outlet } — referensi koneksi yang sedang diedit

function pduOptionKeys() {
  const set = new Set();
  PDU_DATA.forEach(p => set.add(p.name));
  Object.keys(POWER_DATA).forEach(k => set.add(k));
  return [...set];
}

function pduPortsOf(pdu) {
  if (POWER_DATA[pdu] && POWER_DATA[pdu].ports) return POWER_DATA[pdu].ports;
  const p = PDU_DATA.find(x => x.name === pdu);
  return p ? p.ports : 24;
}

function pduFreeOutlets(pdu) {
  const used = new Set(
    (POWER_DATA[pdu] && Array.isArray(POWER_DATA[pdu].rows) ? POWER_DATA[pdu].rows : [])
      .map(r => r.outlet)
  );
  const free = [];
  for (let o = 1; o <= pduPortsOf(pdu); o++) if (!used.has(o)) free.push(o);
  return free;
}

function ensureDevicePsuEditor() {
  if (document.getElementById("powermap-devpsu-overlay")) return;
  document.body.insertAdjacentHTML("beforeend", `
  <div class="modal-overlay" id="powermap-devpsu-overlay" style="z-index:65;">
    <div class="modal" style="max-width:480px;">
      <div class="modal-head">
        <div><div class="modal-title" id="powermap-devpsu-title">PSU — Power Map</div><div class="modal-sub" id="powermap-devpsu-sub"></div></div>
        <div class="modal-close" id="powermap-devpsu-close"><i class="fa-solid fa-xmark"></i></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 18px;">
        <div style="margin-bottom:14px;"><label class="form-label">PDU Sumber</label><select class="form-input" id="powermap-devpsu-pdu"></select></div>
        <div style="margin-bottom:14px;"><label class="form-label">Outlet (kosong)</label><select class="form-input" id="powermap-devpsu-outlet"></select></div>
        <div style="margin-bottom:14px;"><label class="form-label">PSU Tujuan</label><select class="form-input" id="powermap-devpsu-psu"><option value="PSU-A">PSU-A</option><option value="PSU-B">PSU-B</option><option value="Single PSU">Single PSU</option></select></div>
        <div style="margin-bottom:14px;"><label class="form-label">Beban (W)</label><input class="form-input mono" type="number" id="powermap-devpsu-watt" min="0" placeholder="mis. 240"></div>
        <div style="margin-bottom:14px;grid-column:1 / -1;"><label class="form-label">Label ID</label><input class="form-input mono" type="text" id="powermap-devpsu-label" placeholder="mis. CBL-2007"></div>
      </div>
      <div class="form-hint" id="powermap-devpsu-hint">Koneksi PSU disimpan di data PDU sumber dan tampil di Power Map perangkat ini.</div>
      <div class="modal-foot" style="justify-content:space-between;">
        <button class="btn ghost" id="powermap-devpsu-delete" style="color:var(--danger);"><i class="fa-solid fa-trash"></i> Hapus PSU</button>
        <div style="display:flex;gap:8px;">
          <button class="btn ghost" id="powermap-devpsu-cancel">Batal</button>
          <button class="btn primary" id="powermap-devpsu-save"><i class="fa-solid fa-check"></i> Simpan</button>
        </div>
      </div>
    </div>
  </div>`);
  const close = () => document.getElementById("powermap-devpsu-overlay").classList.remove("open");
  document.getElementById("powermap-devpsu-close").addEventListener("click", close);
  document.getElementById("powermap-devpsu-cancel").addEventListener("click", close);
  document.getElementById("powermap-devpsu-overlay").addEventListener("click", e => {
    if (e.target.id === "powermap-devpsu-overlay") close();
  });
  document.getElementById("powermap-devpsu-pdu").addEventListener("change", () => refreshDevicePsuOutlets());
  document.getElementById("powermap-devpsu-save").addEventListener("click", () => {
    const device = editingDeviceKey;
    if (!device) return close();
    const pdu = document.getElementById("powermap-devpsu-pdu").value;
    const outlet = parseInt(document.getElementById("powermap-devpsu-outlet").value, 10);
    if (!pdu || !outlet) return;
    if (!POWER_DATA[pdu]) POWER_DATA[pdu] = { ports: pduPortsOf(pdu), rows: [] };
    const isSame = editingDevicePsu && editingDevicePsu.pdu === pdu && editingDevicePsu.outlet === outlet;
    if (!isSame && (POWER_DATA[pdu].rows || []).some(r => r.outlet === outlet)) return;
    const row = {
      outlet,
      device,
      psu: document.getElementById("powermap-devpsu-psu").value,
      watt: Math.max(0, parseInt(document.getElementById("powermap-devpsu-watt").value, 10) || 0),
      label: document.getElementById("powermap-devpsu-label").value.trim(),
    };
    const oldPdu = editingDevicePsu ? editingDevicePsu.pdu : null;
    if (editingDevicePsu && !isSame) {
      const oldRows = POWER_DATA[oldPdu].rows || [];
      POWER_DATA[oldPdu].rows = oldRows.filter(r => !(r.outlet === editingDevicePsu.outlet && r.device === device));
    }
    const rows = POWER_DATA[pdu].rows || (POWER_DATA[pdu].rows = []);
    if (isSame) {
      const idx = rows.findIndex(r => r.outlet === outlet && r.device === device);
      if (idx >= 0) rows[idx] = row; else rows.push(row);
    } else {
      rows.push(row);
    }
    close();
    savePowerMap(pdu);
    if (oldPdu && oldPdu !== pdu) savePowerMap(oldPdu);
    openPowerMap(device, false, 2);
    if (typeof pwRefresh === "function") pwRefresh();
  });
  document.getElementById("powermap-devpsu-delete").addEventListener("click", () => {
    const device = editingDeviceKey;
    const ref = editingDevicePsu;
    if (!device || !ref) return close();
    if (POWER_DATA[ref.pdu]) {
      POWER_DATA[ref.pdu].rows = (POWER_DATA[ref.pdu].rows || []).filter(r => !(r.outlet === ref.outlet && r.device === device));
    }
    close();
    savePowerMap(ref.pdu);
    openPowerMap(device, false, 2);
    if (typeof pwRefresh === "function") pwRefresh();
  });
}

function refreshDevicePsuOutlets() {
  const pdu = document.getElementById("powermap-devpsu-pdu").value;
  const sel = document.getElementById("powermap-devpsu-outlet");
  const opts = pduFreeOutlets(pdu);
  if (editingDevicePsu && editingDevicePsu.pdu === pdu) opts.push(editingDevicePsu.outlet);
  opts.sort((a, b) => a - b);
  sel.innerHTML = opts.map(o => `<option value="${o}">Outlet ${o}</option>`).join("");
  if (editingDevicePsu && editingDevicePsu.pdu === pdu) sel.value = String(editingDevicePsu.outlet);
}

function openDevicePsuEditor(deviceKey, ref) {
  ensureDevicePsuEditor();
  editingDeviceKey = deviceKey;
  editingDevicePsu = ref ? { pdu: ref.pdu, outlet: ref.outlet } : null;
  const keys = pduOptionKeys();
  const pduSel = document.getElementById("powermap-devpsu-pdu");
  const current = ref ? ref.pdu : (keys.find(k => pduFreeOutlets(k).length) || keys[0]);
  pduSel.innerHTML = keys.map(k => `<option value="${k}">${k} (${pduPortsOf(k)} outlet)</option>`).join("");
  pduSel.value = current;
  const row = ref && POWER_DATA[ref.pdu] ? (POWER_DATA[ref.pdu].rows || []).find(r => r.outlet === ref.outlet && r.device === deviceKey) : null;
  document.getElementById("powermap-devpsu-title").textContent = `PSU — ${deviceKey}`;
  document.getElementById("powermap-devpsu-sub").textContent = row ? "Edit koneksi PSU perangkat ini." : "Hubungkan perangkat ini ke outlet PDU yang tersedia.";
  document.getElementById("powermap-devpsu-psu").value = row ? row.psu : "PSU-A";
  document.getElementById("powermap-devpsu-watt").value = row ? String(row.watt) : "";
  document.getElementById("powermap-devpsu-label").value = row?.label || "";
  document.getElementById("powermap-devpsu-delete").style.visibility = row ? "visible" : "hidden";
  refreshDevicePsuOutlets();
  document.getElementById("powermap-devpsu-overlay").classList.add("open");
}


// ---- Editor data port (klik nomor port / sel visual / SFP di Port Map) ----
function ensurePortEditor() {
  if (document.getElementById("portmap-port-overlay")) return;
  document.body.insertAdjacentHTML("beforeend", `
  <div class="modal-overlay" id="portmap-port-overlay" style="z-index:70;">
    <div class="modal" style="max-width:480px;">
      <div class="modal-head">
        <div><div class="modal-title" id="portmap-port-title">Port — Port Map</div><div class="modal-sub" id="portmap-port-sub"></div></div>
        <div class="modal-close" id="portmap-port-close"><i class="fa-solid fa-xmark"></i></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 18px;">
        <div style="margin-bottom:14px;"><label class="form-label">Port</label><input class="form-input mono" type="text" id="portmap-port-no" placeholder="mis. eth0 / MGMT / 1"></div>
        <div style="margin-bottom:14px;"><label class="form-label">Label ID</label><input class="form-input mono" type="text" id="portmap-port-label" placeholder="mis. CBL-1032"></div>
        <div style="margin-bottom:14px;"><label class="form-label">Tipe Media</label>
          <select class="form-input" id="portmap-port-media">
            <option value="Cat6">Cat6 (standar)</option>
            <optgroup label="Copper (RJ45)">
              <option value="Cat5e">Cat5e</option>
              <option value="Cat6">Cat6</option>
              <option value="Cat6A">Cat6A</option>
              <option value="Cat7">Cat7</option>
              <option value="Cat8">Cat8</option>
            </optgroup>
            <optgroup label="Fiber">
              <option value="LC MM">LC Fiber (MM · OM3/OM4/OM5)</option>
              <option value="LC SM">LC Fiber (SM · OS2)</option>
              <option value="SC SM">SC Fiber (SM)</option>
              <option value="MPO">MPO / MTP</option>
            </optgroup>
            <optgroup label="Direct Attach / Transceiver">
              <option value="SFP+ DAC">SFP+ DAC (10G)</option>
              <option value="QSFP">QSFP DAC / AOC</option>
            </optgroup>
            <optgroup label="Storage">
              <option value="SAS">SAS</option>
              <option value="SATA">SATA</option>
              <option value="FC">Fibre Channel (FC)</option>
            </optgroup>
            <optgroup label="Management / Lainnya">
              <option value="Console">Console (RJ45)</option>
              <option value="USB">USB</option>
            </optgroup>
            <option value="custom">Lainnya (custom)…</option>
          </select>
          <input class="form-input mono" type="text" id="portmap-port-media-custom" style="display:none;margin-top:8px;" placeholder="mis. HDMI, Omni, Twinax…">
        </div>
        <div style="margin-bottom:14px;"><label class="form-label">VLAN</label><input class="form-input mono" type="text" id="portmap-port-vlan" placeholder="mis. v10 / TRUNK"></div>
        <div style="margin-bottom:14px;"><label class="form-label">Port Tujuan</label><input class="form-input mono" type="text" id="portmap-port-destport" placeholder="mis. 3"></div>
        <div style="margin-bottom:14px;"><label class="form-label">Perangkat Tujuan</label><input class="form-input" type="text" id="portmap-port-dest" placeholder="mis. SW-ACC-03"></div>
        <div style="margin-bottom:14px;"><label class="form-label">IP Address</label><input class="form-input mono" type="text" id="portmap-port-ip" placeholder="mis. 10.10.99.14"></div>
      </div>
      <div class="modal-foot" style="justify-content:space-between;">
        <button class="btn ghost" id="portmap-port-delete" style="color:var(--danger);"><i class="fa-solid fa-trash"></i> Kosongkan Port</button>
        <div style="display:flex;gap:8px;">
          <button class="btn ghost" id="portmap-port-cancel">Batal</button>
          <button class="btn primary" id="portmap-port-save"><i class="fa-solid fa-check"></i> Simpan</button>
        </div>
      </div>
    </div>
  </div>`);
}

let editingPort = null;

function openPortEditor(portNo) {
  if (!currentPortKey) return;
  const key = currentPortKey;
  let data = PORT_DATA[key];
  if (!data) data = { type: lastPortMeta.type, ports: lastPortMeta.ports, sfp: lastPortMeta.sfp, rows: [] };
  editingPort = portNo;
  let row = data.rows.find(r => String(r.port) === String(portNo));
  if (!row && data.ports === 1 && data.rows.length) row = data.rows[0];
  document.getElementById("portmap-port-title").textContent = `Port ${row ? row.port : portNo} — ${key}`;
  document.getElementById("portmap-port-sub").textContent = row ? "Edit koneksi pada port ini." : "Port kosong — isi data koneksi.";
  document.getElementById("portmap-port-no").value = row ? String(row.port) : String(portNo);
  document.getElementById("portmap-port-label").value = row?.label || "";
  document.getElementById("portmap-port-vlan").value = row?.vlan || "";
  document.getElementById("portmap-port-destport").value = row?.destPort || "";
  document.getElementById("portmap-port-dest").value = row?.dest || "";
  document.getElementById("portmap-port-ip").value = row?.ip || "";
  const mediaSel = document.getElementById("portmap-port-media");
  const mediaInput = document.getElementById("portmap-port-media-custom");
  const spec = (Array.isArray(data.specials) ? data.specials : []).find(s => String(s.key) === String(portNo));
  const mediaVal = row?.media || (spec && spec.media) || "Cat6";
  const mediaOpt = mediaSel.querySelector(`option[value="${mediaVal}"]`);
  if (mediaOpt) {
    mediaSel.value = mediaVal;
    mediaInput.style.display = "none";
  } else {
    mediaSel.value = "custom";
    mediaInput.style.display = "";
    mediaInput.value = mediaVal;
  }
  document.getElementById("portmap-port-delete").style.visibility = row ? "visible" : "hidden";
  document.getElementById("portmap-port-overlay").classList.add("open");
}

ensurePortEditor();
document.getElementById("portmap-port-overlay").addEventListener("click", e => {
  if (e.target === document.getElementById("portmap-port-overlay")) document.getElementById("portmap-port-overlay").classList.remove("open");
});
document.getElementById("portmap-port-close").addEventListener("click", () => document.getElementById("portmap-port-overlay").classList.remove("open"));
document.getElementById("portmap-port-cancel").addEventListener("click", () => document.getElementById("portmap-port-overlay").classList.remove("open"));
document.getElementById("portmap-port-media").addEventListener("change", e => {
  const isCustom = e.target.value === "custom";
  document.getElementById("portmap-port-media-custom").style.display = isCustom ? "" : "none";
  if (isCustom) document.getElementById("portmap-port-media-custom").focus();
});
document.getElementById("portmap-port-save").addEventListener("click", () => {
  if (!currentPortKey || editingPort == null) return;
  const key = currentPortKey;
  if (!PORT_DATA[key]) PORT_DATA[key] = { type: lastPortMeta.type, ports: lastPortMeta.ports, sfp: lastPortMeta.sfp, rows: [] };
  const data = PORT_DATA[key];
  const portNo = document.getElementById("portmap-port-no").value.trim() || String(editingPort);
  let media = document.getElementById("portmap-port-media").value;
  if (media === "custom") media = document.getElementById("portmap-port-media-custom").value.trim() || "Cat6";
  if (!media) media = "Cat6";
  const row = {
    port: portNo,
    label: document.getElementById("portmap-port-label").value.trim(),
    media,
    vlan: document.getElementById("portmap-port-vlan").value.trim() || "—",
    destPort: document.getElementById("portmap-port-destport").value.trim() || "—",
    dest: document.getElementById("portmap-port-dest").value.trim() || "—",
    ip: document.getElementById("portmap-port-ip").value.trim() || "—",
  };
  const idx = data.rows.findIndex(r => String(r.port) === String(portNo));
  if (idx >= 0) data.rows[idx] = row; else data.rows.push(row);
  document.getElementById("portmap-port-overlay").classList.remove("open");
  savePortMap(key);
  openPortMap(key, false, 0, { type: data.type, formFactor: "" });
});
document.getElementById("portmap-port-delete").addEventListener("click", () => {
  if (!currentPortKey || editingPort == null) return;
  const data = PORT_DATA[currentPortKey];
  const p = document.getElementById("portmap-port-no").value.trim() || String(editingPort);
  data.rows = data.rows.filter(r => String(r.port) !== String(p));
  document.getElementById("portmap-port-overlay").classList.remove("open");
  savePortMap(currentPortKey);
  openPortMap(currentPortKey, false, 0, { type: data.type, formFactor: "" });
});

let specialEditorReady = false;
function ensureSpecialEditor() {
  if (specialEditorReady) return;
  specialEditorReady = true;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-overlay" id="portmap-special-overlay" style="z-index:80;">
      <div class="modal" style="max-width:460px;">
        <div class="modal-head">
          <div><div class="modal-title">Tambah Port Spesial</div><div class="modal-sub" id="portmap-special-sub">mis. Uplink, AUX, Out-of-Band</div></div>
          <div class="modal-close" id="portmap-special-close"><i class="fa-solid fa-xmark"></i></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 18px;">
          <div style="margin-bottom:14px;"><label class="form-label">Label</label><input class="form-input" type="text" id="portmap-special-label" placeholder="mis. Uplink 1"></div>
          <div style="margin-bottom:14px;"><label class="form-label">Kode Port</label><input class="form-input mono" type="text" id="portmap-special-key" placeholder="mis. UPLINK1"></div>
        </div>
        <div style="margin-bottom:6px;"><label class="form-label">Tipe Media</label><input class="form-input mono" type="text" id="portmap-special-media" placeholder="mis. SFP+ DAC / Cat6A / LC MM"></div>
        <div class="form-hint">Kode ditulis otomatis huruf besar & harus unik. Klik kotak port-nya nanti untuk mengisi koneksi.</div>
        <div class="form-hint" id="portmap-special-error" style="color:var(--danger);display:none;"></div>
        <div class="modal-foot" style="justify-content:flex-end;">
          <button class="btn ghost" id="portmap-special-cancel">Batal</button>
          <button class="btn primary" id="portmap-special-save"><i class="fa-solid fa-check"></i> Tambah</button>
        </div>
      </div>
    </div>`);
  const close = () => document.getElementById("portmap-special-overlay").classList.remove("open");
  document.getElementById("portmap-special-close").addEventListener("click", close);
  document.getElementById("portmap-special-cancel").addEventListener("click", close);
  document.getElementById("portmap-special-overlay").addEventListener("click", e => {
    if (e.target.id === "portmap-special-overlay") close();
  });
  document.getElementById("portmap-special-save").addEventListener("click", () => {
    const errEl = document.getElementById("portmap-special-error");
    errEl.style.display = "none";
    if (!currentPortKey) return close();
    const data = PORT_DATA[currentPortKey];
    if (!data) return close();
    const label = document.getElementById("portmap-special-label").value.trim();
    const key = document.getElementById("portmap-special-key").value.trim().toUpperCase().replace(/\s+/g, "_");
    const media = document.getElementById("portmap-special-media").value.trim() || "Cat6";
    if (!label || !key) { errEl.textContent = "Label dan Kode Port wajib diisi."; errEl.style.display = "block"; return; }
    if ((data.specials || []).some(s => String(s.key).toUpperCase() === key)) {
      errEl.textContent = `Kode "${key}" sudah dipakai pada perangkat ini.`; errEl.style.display = "block"; return;
    }
    if (!Array.isArray(data.specials)) data.specials = [];
    data.specials.push({ key, label, media, hint: "" });
    close();
    savePortMap(currentPortKey);
    openPortMap(currentPortKey, false, 0, { type: data.type, formFactor: "" });
  });
}

function openSpecialAdd() {
  ensureSpecialEditor();
  document.getElementById("portmap-special-label").value = "";
  document.getElementById("portmap-special-key").value = "";
  document.getElementById("portmap-special-media").value = "";
  document.getElementById("portmap-special-error").style.display = "none";
  document.getElementById("portmap-special-sub").textContent = currentPortKey
    ? `Tambahkan port spesial untuk ${currentPortKey} — mis. Uplink, AUX, Out-of-Band.`
    : "mis. Uplink, AUX, Out-of-Band";
  document.getElementById("portmap-special-overlay").classList.add("open");
  document.getElementById("portmap-special-label").focus();
}

function removeSpecialPort(key) {
  if (!currentPortKey) return;
  const data = PORT_DATA[currentPortKey];
  if (!data) return;
  const spec = (Array.isArray(data.specials) ? data.specials : []).find(s => String(s.key) === String(key));
  if (!spec) return;
  if (typeof confirm === "function" && !confirm(`Hapus port spesial "${spec.label}" (${spec.key})? Koneksi pada port ini juga akan dihapus.`)) return;
  data.specials = data.specials.filter(s => String(s.key) !== String(key));
  data.rows = data.rows.filter(r => String(r.port) !== String(key));
  savePortMap(currentPortKey);
  openPortMap(currentPortKey, false, 0, { type: data.type, formFactor: "" });
}

const portmapBodyEl = document.getElementById("portmap-body");
if (portmapBodyEl) {
  portmapBodyEl.addEventListener("click", e => {
    const rm = e.target.closest("[data-remove-special]");
    if (rm) { removeSpecialPort(rm.dataset.removeSpecial); return; }
    const add = e.target.closest("[data-add-special]");
    if (add) { openSpecialAdd(); return; }
    const el = e.target.closest("[data-port-edit]");
    if (el) openPortEditor(el.dataset.portEdit);
  });
}
    

