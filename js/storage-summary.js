/* ============================================
   RackView — Ringkasan Identitas Storage
   Dipakai bersama: storage-list.html (panel detail)
   Menampilkan semua isian form tambah storage:
   identitas, spesifikasi hardware, port & konektivitas,
   lokasi & rack mapping, status & monitoring, tagging,
   dan tabel controller.
   ============================================ */

const STG_COND_CLASS = { "Active": "online", "Standby": "maintenance", "Decommissioned": "offline", online: "online", degradasi: "maintenance", failed: "offline" };
const STG_DRIVE_STATUS = { online: "Online", degradasi: "Degradasi", failed: "Failed", rusak: "Failed" };
const STG_STATUS_CLS = { online: "st-st-online", degradasi: "st-st-degradasi", failed: "st-st-failed", rusak: "st-st-failed" };

function stgSumEsc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function stgSumCondClass(kondisi) {
  return STG_COND_CLASS[kondisi] || "disabled";
}

function stgSumTypeLabel(t) {
  if (typeof STORAGE_TYPE_LABELS !== "undefined" && STORAGE_TYPE_LABELS[t]) return STORAGE_TYPE_LABELS[t];
  return { san: "SAN Storage", nas: "NAS Storage", das: "DAS Storage", tape: "Tape Library", hci: "HCI (Hyperconverged)" }[t] || t || "Storage";
}

function stgSumKvRow(label, value) {
  if (value == null) return "";
  const v = String(value).trim();
  if (!v || v === "—" || v === "-" || v === "" || v === "undefined" || v === "null") return "";
  return `<div class="kv-row"><div class="kv-label">${label}</div><div class="kv-value">${v}</div></div>`;
}

function stgSumChips(list, cls) {
  if (!list || !list.length) return "";
  return `<div class="srv-chips">${list.map(x => `<span class="tag-chip ${cls || ""}">${stgSumEsc(x)}</span>`).join("")}</div>`;
}

// Link Port Map / Power Map yang bisa diklik (mirip srvSummaryMapLink di server)
function stgSumMapLink(kind, label, s) {
  const rawKey = s.hostname || s.deviceKey || s.id || "";
  if (!rawKey) return label;
  const key = String(rawKey).replace(/'/g, "");
  const isPower = kind === "power";
  const page = isPower ? "power-map.html" : "port-map.html";
  const title = isPower ? "Buka Power Map storage ini (popup)" : "Buka Port Map storage ini (popup)";
  const icon = `<i class="fa-solid fa-arrow-up-right-from-square"></i>`;
  const psu = Math.max(1, parseInt(s.psuCount, 10) || 2);
  if (isPower && typeof openPowerMap === "function") {
    return `<button type="button" class="srv-map-link" title="${title}" onclick="openPowerMap('${key}', false, ${psu});return false;">${label} ${icon}</button>`;
  }
  if (!isPower && typeof openPortMap === "function") {
    const form = String(s.formFactor || s.uHeight || "").replace(/'/g, "");
    return `<button type="button" class="srv-map-link" title="${title}" onclick="openPortMap('${key}', false, 0, { type: 'storage', formFactor: '${form}' });return false;">${label} ${icon}</button>`;
  }
  return `<a class="srv-map-link" href="${page}?device=${encodeURIComponent(rawKey)}" target="_blank" rel="noopener" title="${title}">${label} ${icon}</a>`;
}

function stgSumSlotGB(s) {
  const m = String((s && s.cap) || "").match(/^([\d.,]+)\s*(GB|TB|PB)?/i);
  if (!m) return 0;
  const v = parseFloat(String(m[1]).replace(",", ".")) || 0;
  const u = ((m[2] || "GB") + "").toUpperCase();
  return u === "TB" ? v * 1000 : u === "PB" ? v * 1e6 : v;
}

function stgSumFmtGB(gb) {
  if (!gb) return "";
  if (gb >= 1000000) return (gb / 1000000).toFixed(2).replace(/\.?0+$/, "").replace(/\.$/, "") + " PB";
  if (gb >= 1000) return (gb / 1000).toFixed(2).replace(/\.?0+$/, "").replace(/\.$/, "") + " TB";
  return Math.round(gb) + " GB";
}

function stgSumUsable(slots) {
  const list = (Array.isArray(slots) ? slots : []).filter(x => x && x.cap);
  const raw = list.reduce((a, x) => a + stgSumSlotGB(x), 0);
  const byRaid = {};
  list.forEach(x => { const r = x.raid || ""; (byRaid[r] = byRaid[r] || []).push(x); });
  let usable = 0;
  const groups = [];
  Object.keys(byRaid).forEach(r => {
    const drvs = byRaid[r];
    const sizes = drvs.map(d => stgSumSlotGB(d));
    const n = sizes.length;
    const min = Math.min(...sizes);
    const rawG = sizes.reduce((a, b) => a + b, 0);
    let f;
    if (r === "RAID 0") f = n;
    else if (r === "RAID 1" || r === "RAID 10") f = Math.max(0, Math.floor(n / 2));
    else if (r === "RAID 5") f = Math.max(0, n - 1);
    else if (r === "RAID 6") f = Math.max(0, n - 2);
    else f = n;
    const u = f * min;
    usable += u;
    if (r) groups.push({ raid: r, drives: n, per: rawG / n, usable: u });
  });
  return { raw, usable, groups, efficiency: raw ? usable / raw : 0 };
}

function stgSumMemory(s) {
  const slots = Array.isArray(s.dimmSlots) ? s.dimmSlots : null;
  if (slots && slots.length) {
    const ty = {}, br = {}, st = {};
    slots.forEach(x => {
      ty[x.type || "?"] = (ty[x.type || "?"] || 0) + 1;
      if (x.brand) br[x.brand] = (br[x.brand] || 0) + 1;
      const k = x.status; if (k) st[k] = (st[k] || 0) + 1;
    });
    const chips = [];
    Object.keys(ty).forEach(t => chips.push(`<span class="tag-chip st-chip">${stgSumEsc(t)} <b>${stgSumEsc(ty[t])}</b></span>`));
    Object.keys(br).forEach(b => chips.push(`<span class="tag-chip st-chip" title="Merek modul">${stgSumEsc(b)} <b>${stgSumEsc(br[b])}</b></span>`));
    Object.keys(st).forEach(k => chips.push(`<span class="tag-chip st-chip ${STG_STATUS_CLS[k] || ""}">${stgSumEsc(STG_DRIVE_STATUS[k] || k)} <b>${stgSumEsc(st[k])}</b></span>`));
    const bad = slots.filter(x => (x.status || "online") !== "online");
    const badNote = bad.length
      ? `<div class="kv-sub srv-bad">⚠ ${stgSumEsc(bad.length)} modul perlu perhatian (slot ${bad.map(x => stgSumEsc(x.slot)).join(", ")})</div>`
      : "";
    return stgSumKvRow("Memory (DIMM)", `<b>${stgSumEsc(slots.length)}</b> dari <b>${stgSumEsc(s.dimmTotal)}</b> slot terisi · Installed <b>${stgSumEsc(s.dimmInstalled)}</b><div class="srv-chips">${chips.join("")}</div>${badNote}`);
  }
  return stgSumKvRow("Memory (DIMM)", `${stgSumEsc(s.dimmTotal)} slot · ${stgSumEsc(s.dimmPerSlot)}/slot · <b>${stgSumEsc(s.dimmInstalled)} terpasang</b>`);
}

function stgSumStorage(s) {
  const slots = Array.isArray(s.storageSlots) ? s.storageSlots : null;
  const bays = s.storageBays || "—";
  const iface = s.storageIface || "";
  if (slots && slots.length) {
    const counts = {};
    slots.forEach(x => { counts[x.type || "?"] = (counts[x.type || "?"] || 0) + 1; });
    const chips = Object.keys(counts).map(t =>
      `<span class="tag-chip st-chip">${stgSumEsc(t)} <b>${stgSumEsc(counts[t])}</b></span>`).join("");
    const capRes = stgSumUsable(slots);
    const grpChips = capRes.groups.map(g =>
      `<span class="tag-chip st-chip" title="${stgSumEsc(g.raid)} · ${stgSumEsc(g.drives)} drive">${stgSumEsc(g.raid)} <b>${stgSumEsc(g.drives)}</b>×${stgSumFmtGB(g.per)} → ${stgSumFmtGB(g.usable)}</span>`).join("");
    const stCounts = {};
    slots.forEach(x => { const st = x.status; if (st) stCounts[st] = (stCounts[st] || 0) + 1; });
    const stChips = Object.keys(stCounts).map(st =>
      `<span class="tag-chip st-chip ${STG_STATUS_CLS[st] || ""}">${stgSumEsc(STG_DRIVE_STATUS[st] || st)} <b>${stgSumEsc(stCounts[st])}</b></span>`).join("");
    const brCounts = {};
    slots.forEach(x => { if (x.brand) brCounts[x.brand] = (brCounts[x.brand] || 0) + 1; });
    const brChips = Object.keys(brCounts).map(b =>
      `<span class="tag-chip st-chip" title="Merek drive">${stgSumEsc(b)} <b>${stgSumEsc(brCounts[b])}</b></span>`).join("");
    const bad = slots.filter(x => (x.status || "online") !== "online");
    const badNote = bad.length
      ? `<div class="kv-sub srv-bad">⚠ ${stgSumEsc(bad.length)} drive perlu perhatian (${bad.map(x => "bay " + stgSumEsc(x.bay)).join(", ")})</div>`
      : "";
    const cap = s.storageCap ? " · <b>" + stgSumEsc(s.storageCap) + "</b>" : "";
    const head = `${stgSumEsc(slots.length)} dari ${stgSumEsc(bays)} bay terisi${cap}`;
    const usb = capRes.usable
      ? `<div class="kv-sub">Usable <b>${stgSumFmtGB(capRes.usable)}</b> dari raw <b>${stgSumFmtGB(capRes.raw)}</b> · efisiensi ${Math.round(capRes.efficiency * 100)}%</div>`
      : "";
    return stgSumKvRow("Storage", `${head}${iface ? " · " + stgSumEsc(iface) : ""}<div class="srv-chips">${chips}${grpChips}${stChips}${brChips}</div>${usb}${badNote}`);
  }
  return stgSumKvRow("Storage", `${stgSumEsc(bays)} bay · ${stgSumEsc(s.storageCap)} · ${stgSumEsc(iface)}`);
}

function stgSumControllerPorts(c) {
  const parts = [];
  const lan = [c.lanRj45, c.lanSfp, c.lanQsfp].filter(Boolean).join("/");
  if (lan) parts.push("LAN " + lan + (c.lanSpeed ? " · " + c.lanSpeed : ""));
  if (c.fcPorts) parts.push((c.fcType || "FC") + " " + c.fcPorts + (c.fcSpeed ? " · " + c.fcSpeed : ""));
  if (c.mgmtPort) parts.push("Mgmt " + c.mgmtPort);
  if (c.consolePort === "Ya") parts.push("Console");
  return parts.join(" · ") || "—";
}

function stgSumControllerTable(s) {
  const ctrls = Array.isArray(s.controllers) ? s.controllers : null;
  if (!ctrls || !ctrls.length) return "";
  const rows = ctrls.map((c, i) => `<tr>
    <td class="mono">${stgSumEsc(c.slot ?? i + 1)}</td>
    <td class="strong">${stgSumEsc(c.name || "—")}${c.mgmtIp ? '<div class="mono" style="font-size:11px;color:var(--text-secondary)">' + stgSumEsc(c.mgmtIp) + "</div>" : ""}</td>
    <td>${stgSumEsc(c.firmware || c.processor || "—")}</td>
    <td>${stgSumEsc(c.coreThread || "—")}</td>
    <td>${stgSumEsc(c.dimmInstalled || "—")}</td>
    <td class="mono" style="font-size:11px;color:var(--text-secondary);">${stgSumEsc(stgSumControllerPorts(c))}</td>
    <td>${c.notes ? '<span title="' + stgSumEsc(c.notes) + '">' + stgSumEsc(c.notes) + "</span>" : "—"}</td>
    <td><span class="badge ${stgSumCondClass(c.kondisi)}"><span class="bdot"></span>${stgSumEsc(c.kondisi || "—")}</span></td>
  </tr>`).join("");
  return `<div class="kv-group">
    <div class="kv-group-title"><i class="fa-solid fa-server"></i> Controller <span class="tag-chip" style="margin-left:auto;">${ctrls.length} terpasang</span></div>
    <table class="table node-table">
      <thead><tr><th>Slot</th><th>Controller</th><th>Firmware / OS</th><th>Core / Thread</th><th>RAM</th><th>Port</th><th>Notes</th><th>Kondisi</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function stgSumMapActions(s) {
  const rawKey = s.hostname || s.deviceKey || s.id || "";
  if (!rawKey) return "";
  const key = String(rawKey).replace(/'/g, "");
  const form = String(s.formFactor || s.uHeight || "").replace(/'/g, "");
  const psu = Math.max(1, parseInt(s.psuCount, 10) || 2);
  const port = typeof openPortMap === "function"
    ? `<button type="button" class="srv-map-action" title="Buka Port Map" onclick="openPortMap('${key}', false, 0, { type: 'storage', formFactor: '${form}' });return false;"><i class="fa-solid fa-ethernet"></i> Port Map</button>`
    : `<a class="srv-map-action" href="port-map.html?device=${encodeURIComponent(rawKey)}" target="_blank" rel="noopener" title="Buka Port Map"><i class="fa-solid fa-ethernet"></i> Port Map</a>`;
  const power = typeof openPowerMap === "function"
    ? `<button type="button" class="srv-map-action" title="Buka Power Map" onclick="openPowerMap('${key}', false, ${psu});return false;"><i class="fa-solid fa-plug"></i> Power Map</button>`
    : `<a class="srv-map-action" href="power-map.html?device=${encodeURIComponent(rawKey)}" target="_blank" rel="noopener" title="Buka Power Map"><i class="fa-solid fa-plug"></i> Power Map</a>`;
  return `<div class="srv-map-actions">${port}${power}</div>`;
}

function buildStorageSummaryHTML(s) {
  if (!s) return "";
  const raidTxt = s.raid === "Ya" ? `<b>Ya</b> ${stgSumChips(s.raidTypes || [])}` : (s.raid ? stgSumEsc(s.raid) : "Tidak");
  const proc = [s.processorCount, s.processorType, s.coreThread].filter(Boolean).join(" · ");

  const hw = [
    proc ? stgSumKvRow("Processor", stgSumEsc(proc)) : "",
    stgSumKvRow("OS / Firmware", stgSumEsc(s.os || s.firmware)),
    stgSumMemory(s),
    stgSumStorage(s),
    stgSumKvRow("RAID Controller", raidTxt),
  ].join("");

  const conn = [
    stgSumKvRow("IP Address", `<span class="mono">${stgSumEsc(s.ip)}</span>`),
    stgSumMapLink("port", `LAN Port Map · ${stgSumEsc(s.lanRj45 ? "RJ-45 " + s.lanRj45 : "")}${s.lanSfp ? " · SFP " + stgSumEsc(s.lanSfp) : ""}${s.lanQsfp ? " · QSFP " + stgSumEsc(s.lanQsfp) : ""}${s.speed ? " · " + stgSumEsc(s.speed) : ""}`, s),
    stgSumKvRow("SAN / Host Port", `${stgSumEsc(s.fcType)} ${s.fcPorts ? stgSumEsc(s.fcPorts) + " port" : ""}${s.fcSpeed ? " · " + stgSumEsc(s.fcSpeed) : ""}`),
    stgSumKvRow("WWNN / Fabric", [s.wwnn, s.sanFabric].filter(Boolean).join(" · ")),
    stgSumKvRow("Management Port", stgSumEsc(s.mgmtPort)),
    stgSumMapLink("power", `Power Supply · ${stgSumEsc(s.psuCount)} PSU · ${stgSumEsc(s.psuWatt)}${s.powerRedundancy ? " · " + stgSumEsc(s.powerRedundancy) : ""}`, s),
  ].join("");

  const loc = [
    stgSumKvRow("Site", stgSumEsc(s.siteName || s.site)),
    stgSumKvRow("Rack / Posisi", `${stgSumEsc(s.rack)}${s.posisiU ? " · U " + stgSumEsc(s.posisiU) : ""}${s.uHeight ? " · " + stgSumEsc(s.uHeight) : ""}`),
    stgSumKvRow("Rack Color", s.rackColor ? `<span class="swatch" style="background:${stgSumEsc(s.rackColor)};display:inline-block;width:14px;height:14px;border-radius:4px;vertical-align:-2px;border:1px solid var(--border-soft);"></span> ${stgSumEsc(s.rackColor)}` : ""),
    stgSumKvRow("Network VLAN", stgSumEsc(s.vlan)),
    stgSumKvRow("Cable Management", stgSumEsc(s.cableManagement)),
  ].join("");

  const status = [
    stgSumKvRow("Kondisi", `<span class="badge ${stgSumCondClass(s.kondisi)}"><span class="bdot"></span>${stgSumEsc(s.kondisi)}</span>`),
    stgSumKvRow("Monitoring", stgSumChips((s.monitoring || []).map(m => ({ snmp: "SNMP", ipmi: "IPMI", dcim: "DCIM Integration" }[m] || m)))),
    stgSumKvRow("Airflow", stgSumEsc(s.airflow)),
    stgSumKvRow("Cooling (BTU/hr)", stgSumEsc(s.coolingBtu)),
  ].join("");

  const tagg = [
    stgSumKvRow("Asset Tag", `<span class="mono">${stgSumEsc(s.assetTag)}</span>`),
    stgSumKvRow("Serial Number", `<span class="mono">${stgSumEsc(s.serial)}</span>`),
    stgSumKvRow("Tahun Pembelian", stgSumEsc(s.tahunPembelian)),
    stgSumKvRow("Warranty", stgSumEsc(s.warranty)),
  ].join("");

  const group = (title, icon, body) => body.trim() ? `
    <div class="kv-group">
      <div class="kv-group-title"><i class="fa-solid ${icon}"></i> ${title}</div>
      ${body}
    </div>` : "";

  const headName = s.hostname || "—";
  return `
    <div class="srv-detail-head">
      <div class="mono" style="font-size:16px;font-weight:600;color:var(--text-primary);">${stgSumEsc(headName)}</div>
      <div class="mono" style="font-size:11.5px;color:var(--text-muted);">${stgSumEsc(s.serial || s.assetTag || "")}</div>
    </div>
    <div class="srv-meta-row">
      <span class="tag-chip">${stgSumEsc(stgSumTypeLabel(s.storageType))}</span>
      <span class="tag-chip">${stgSumEsc(s.formFactor || s.uHeight || "—")}</span>
      <span class="tag-chip">${stgSumEsc(s.vendor)} ${stgSumEsc(s.model)}</span>
      ${stgSumChips(s.tags || [])}
    </div>
    ${stgSumMapActions(s)}
    ${stgSumControllerTable(s)}
    ${group("Spesifikasi Hardware", "fa-microchip", hw)}
    ${group("Port &amp; Konektivitas", "fa-network-wired", conn)}
    ${group("Lokasi &amp; Rack Mapping", "fa-map-location-dot", loc)}
    ${group("Status &amp; Monitoring", "fa-heart-pulse", status)}
    ${group("Tagging", "fa-tags", tagg)}`;
}