/* ============================================
   RackView — Ringkasan Identitas Perangkat
   Dipakai bersama: server-list.html (panel detail)
   dan rack-elevation.html (tab Hardware).
   ============================================ */

const SRV_TYPE_LABEL = { rack: "Rack Server", blade: "Blade Server", cloud: "Cloud Server", tower: "Tower Server" };
const SRV_COND_CLASS = { "Active": "online", "Standby": "maintenance", "Decommissioned": "offline" };
const SRV_MON_LABEL = { snmp: "SNMP", ipmi: "IPMI", dcim: "DCIM Integration" };
const SRV_DRIVE_STATUS = { online: "Online", degradasi: "Degradasi", failed: "Failed", rusak: "Failed" };
const SRV_STATUS_CLS = { online: "st-st-online", degradasi: "st-st-degradasi", failed: "st-st-failed", rusak: "st-st-failed" };

function srvSummaryEsc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function srvSummaryCondClass(kondisi) {
  return SRV_COND_CLASS[kondisi] || "disabled";
}

function srvSummaryProblemCount(s) {
  if (!s) return 0;
  let n = 0;
  (Array.isArray(s.storageSlots) ? s.storageSlots : []).forEach(x => { if (x && x.status && x.status !== "online") n++; });
  (Array.isArray(s.dimmSlots) ? s.dimmSlots : []).forEach(x => { if (x && x.status && x.status !== "online") n++; });
  return n;
}

function srvSummaryTypeLabel(t) {
  return SRV_TYPE_LABEL[t] || t;
}

function srvSummaryKvRow(label, value) {
  if (!value || value === "—" || value === "-" || value === "") return "";
  return `<div class="kv-row"><div class="kv-label">${label}</div><div class="kv-value">${value}</div></div>`;
}

function srvSummaryMapLink(kind, label, s) {
  const key = encodeURIComponent(s.hostname || s.id || "");
  if (!key) return label;
  const isPower = kind === "power";
  const page = isPower ? "power-map.html" : "port-map.html";
  const title = isPower ? "Buka Power Map (power-map.html) server ini" : "Buka Port Map (port-map.html) server ini";
  return `<a class="srv-map-link" href="${page}?device=${key}" target="_blank" rel="noopener" title="${title}">${label} <i class="fa-solid fa-arrow-up-right-from-square"></i></a>`;
}

function srvSummaryChips(list, cls) {
  if (!list || !list.length) return "";
  return `<div class="srv-chips">${list.map(x => `<span class="tag-chip ${cls || ""}">${srvSummaryEsc(x)}</span>`).join("")}</div>`;
}

function srvSummarySlotGB(s) {
  const m = String((s && s.cap) || "").match(/^([\d.,]+)\s*(GB|TB|PB)?/i);
  if (!m) return 0;
  const v = parseFloat(String(m[1]).replace(",", ".")) || 0;
  const u = ((m[2] || "GB") + "").toUpperCase();
  return u === "TB" ? v * 1000 : u === "PB" ? v * 1e6 : v;
}

function srvSummaryFmtGB(gb) {
  if (!gb) return "";
  if (gb >= 1000000) return (gb / 1000000).toFixed(2).replace(/\.?0+$/, "").replace(/\.$/, "") + " PB";
  if (gb >= 1000) return (gb / 1000).toFixed(2).replace(/\.?0+$/, "").replace(/\.$/, "") + " TB";
  return Math.round(gb) + " GB";
}

function srvSummaryUsable(slots) {
  const list = (Array.isArray(slots) ? slots : []).filter(x => x && x.cap);
  const raw = list.reduce((a, x) => a + srvSummarySlotGB(x), 0);
  const byRaid = {};
  list.forEach(x => {
    const r = x.raid || "";
    (byRaid[r] = byRaid[r] || []).push(x);
  });
  let usable = 0;
  const groups = [];
  Object.keys(byRaid).forEach(r => {
    const drvs = byRaid[r];
    const sizes = drvs.map(d => srvSummarySlotGB(d));
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

function srvSummaryMemory(s) {
  const slots = Array.isArray(s.dimmSlots) ? s.dimmSlots : null;
  if (slots && slots.length) {
    const ty = {}, br = {}, st = {};
    slots.forEach(x => {
      ty[x.type || "?"] = (ty[x.type || "?"] || 0) + 1;
      if (x.brand) br[x.brand] = (br[x.brand] || 0) + 1;
      const k = x.status; if (k) st[k] = (st[k] || 0) + 1;
    });
    const chips = [];
    Object.keys(ty).forEach(t => chips.push(`<span class="tag-chip st-chip">${srvSummaryEsc(t)} <b>${srvSummaryEsc(ty[t])}</b></span>`));
    Object.keys(br).forEach(b => chips.push(`<span class="tag-chip st-chip" title="Merek modul">${srvSummaryEsc(b)} <b>${srvSummaryEsc(br[b])}</b></span>`));
    Object.keys(st).forEach(k => chips.push(`<span class="tag-chip st-chip ${SRV_STATUS_CLS[k] || ""}">${srvSummaryEsc(SRV_DRIVE_STATUS[k] || k)} <b>${srvSummaryEsc(st[k])}</b></span>`));
    const bad = slots.filter(x => (x.status || "online") !== "online");
    const badNote = bad.length
      ? `<div class="kv-sub srv-bad">⚠ ${srvSummaryEsc(bad.length)} modul perlu perhatian (slot ${bad.map(x => srvSummaryEsc(x.slot)).join(", ")})</div>`
      : "";
    return srvSummaryKvRow("Memory (DIMM)", `<b>${srvSummaryEsc(slots.length)}</b> dari <b>${srvSummaryEsc(s.dimmTotal)}</b> slot terisi · Installed <b>${srvSummaryEsc(s.dimmInstalled)}</b><div class="srv-chips">${chips.join("")}</div>${badNote}`);
  }
  return srvSummaryKvRow("Memory (DIMM)", `${srvSummaryEsc(s.dimmTotal)} slot · ${srvSummaryEsc(s.dimmPerSlot)}/slot · <b>${srvSummaryEsc(s.dimmInstalled)} terpasang</b>`);
}

function srvSummaryStorage(s) {
  const slots = Array.isArray(s.storageSlots) ? s.storageSlots : null;
  const bays = s.storageBays || "—";
  const iface = s.storageIface || "";
  if (slots && slots.length) {
    const counts = {};
    slots.forEach(x => { counts[x.type || "?"] = (counts[x.type || "?"] || 0) + 1; });
    const chips = Object.keys(counts).map(t =>
      `<span class="tag-chip st-chip">${srvSummaryEsc(t)} <b>${srvSummaryEsc(counts[t])}</b></span>`).join("");
    const capRes = srvSummaryUsable(slots);
    const grpChips = capRes.groups.map(g =>
      `<span class="tag-chip st-chip" title="${srvSummaryEsc(g.raid)} · ${srvSummaryEsc(g.drives)} drive">${srvSummaryEsc(g.raid)} <b>${srvSummaryEsc(g.drives)}</b>×${srvSummaryFmtGB(g.per)} → ${srvSummaryFmtGB(g.usable)}</span>`).join("");
    const stCounts = {};
    slots.forEach(x => { const st = x.status; if (st) stCounts[st] = (stCounts[st] || 0) + 1; });
    const stChips = Object.keys(stCounts).map(st =>
      `<span class="tag-chip st-chip ${SRV_STATUS_CLS[st] || ""}">${srvSummaryEsc(SRV_DRIVE_STATUS[st] || st)} <b>${srvSummaryEsc(stCounts[st])}</b></span>`).join("");
    const brCounts = {};
    slots.forEach(x => { if (x.brand) brCounts[x.brand] = (brCounts[x.brand] || 0) + 1; });
    const brChips = Object.keys(brCounts).map(b =>
      `<span class="tag-chip st-chip" title="Merek drive">${srvSummaryEsc(b)} <b>${srvSummaryEsc(brCounts[b])}</b></span>`).join("");
    const bad = slots.filter(x => (x.status || "online") !== "online");
    const badNote = bad.length
      ? `<div class="kv-sub srv-bad">⚠ ${srvSummaryEsc(bad.length)} drive perlu perhatian (${bad.map(x => "bay " + srvSummaryEsc(x.bay)).join(", ")})</div>`
      : "";
    const cap = s.storageCap ? " · <b>" + srvSummaryEsc(s.storageCap) + "</b>" : "";
    const head = `${srvSummaryEsc(slots.length)} dari ${srvSummaryEsc(bays)} bay terisi${cap}`;
    const usb = capRes.usable
      ? `<div class="kv-sub">Usable <b>${srvSummaryFmtGB(capRes.usable)}</b> dari raw <b>${srvSummaryFmtGB(capRes.raw)}</b> · efisiensi ${Math.round(capRes.efficiency * 100)}%</div>`
      : "";
    return srvSummaryKvRow("Storage", `${head}${iface ? " · " + srvSummaryEsc(iface) : ""}<div class="srv-chips">${chips}${grpChips}${stChips}${brChips}</div>${usb}${badNote}`);
  }
  return srvSummaryKvRow("Storage", `${srvSummaryEsc(bays)} bay · ${srvSummaryEsc(s.storageCap)} · ${srvSummaryEsc(iface)}`);
}

function buildServerSummaryHTML(s) {
  if (!s) return "";
  const raidTxt = s.raid === "Ya" ? `<b>Ya</b> ${srvSummaryChips(s.raidTypes || [])}` : "Tidak";
  const hw = [
    srvSummaryKvRow("Processor", `${s.processorCount === "dual" ? "Dual" : "Single"} · ${srvSummaryEsc(s.processorType)} (${srvSummaryEsc(s.coreThread)})`),
    srvSummaryMemory(s),
    srvSummaryStorage(s),
    srvSummaryKvRow("RAID Controller", raidTxt),
  ].join("");
  const conn = [
    srvSummaryKvRow("LAN Port Map", srvSummaryMapLink("port", `RJ-45 <b>${srvSummaryEsc(s.lanRj45)}</b> · SFP <b>${srvSummaryEsc(s.lanSfp)}</b> · QSFP <b>${srvSummaryEsc(s.lanQsfp)}</b> · <b>${srvSummaryEsc(s.speed)}</b>`, s)),
    srvSummaryKvRow("Management Port", srvSummaryEsc(s.mgmtPort)),
    srvSummaryKvRow("Expansion (PCIe)", `${srvSummaryEsc(s.pcieCount)} slot · ${srvSummaryEsc(s.pcieGen)}`),
    srvSummaryKvRow("Power", srvSummaryMapLink("power", `${srvSummaryEsc(s.psuCount)} PSU · ${srvSummaryEsc(s.psuWatt)} · <b>${srvSummaryEsc(s.powerRedundancy)}</b>`, s)),
  ].join("");
  const loc = [
    srvSummaryKvRow("Site", srvSummaryEsc(s.siteName || s.site)),
    srvSummaryKvRow("Rack / Posisi", `${srvSummaryEsc(s.rack)} · ${srvSummaryEsc(s.posisiU)}`),
    srvSummaryKvRow("Network VLAN", srvSummaryEsc(s.vlan)),
    srvSummaryKvRow("Cable Management", srvSummaryEsc(s.cableManagement)),
  ].join("");
  const status = [
    srvSummaryKvRow("OS / Hypervisor", srvSummaryEsc(s.hypervisor)),
    srvSummaryKvRow("Kondisi", `<span class="badge ${srvSummaryCondClass(s.kondisi)}"><span class="bdot"></span>${srvSummaryEsc(s.kondisi)}</span>`),
    srvSummaryKvRow("Fungsi Server", srvSummaryChips(s.fungsi || [])),
    srvSummaryKvRow("Monitoring", srvSummaryChips((s.monitoring || []).map(m => SRV_MON_LABEL[m] || m))),
  ].join("");
  const tagg = [
    srvSummaryKvRow("Asset Tag / QR", `<span class="mono">${srvSummaryEsc(s.assetTag)}</span>`),
    srvSummaryKvRow("Warranty", srvSummaryEsc(s.warranty)),
    srvSummaryKvRow("Tahun Pembelian", srvSummaryEsc(s.tahunPembelian)),
  ].join("");
  const nodeRows = (s.nodes || []).map(n => `<tr>
    <td class="mono">${srvSummaryEsc(n.slot ?? "")}</td>
    <td class="strong">${srvSummaryEsc(n.hostname || "—")}</td>
    <td>${srvSummaryEsc(n.processorType || "—")}</td>
    <td>${srvSummaryEsc(n.dimmInstalled || "—")}</td>
    <td>${srvSummaryEsc(n.hypervisor || "—")}</td>
    <td><span class="badge ${srvSummaryCondClass(n.kondisi)}"><span class="bdot"></span>${srvSummaryEsc(n.kondisi || "—")}</span></td>
  </tr>`).join("");
  const group = (title, icon, body) => body.trim() ? `
    <div class="kv-group">
      <div class="kv-group-title"><i class="fa-solid ${icon}"></i> ${title}</div>
      ${body}
    </div>` : "";
  const nodeGroup = nodeRows ? `
    <div class="kv-group">
      <div class="kv-group-title"><i class="fa-solid fa-server"></i> Node Server <span class="tag-chip" style="margin-left:auto;">${srvSummaryEsc(s.nodes.length)}/${srvSummaryEsc(s.nodeTotal || "—")} terisi</span></div>
      <table class="table node-table">
        <thead><tr><th>Node</th><th>Hostname</th><th>Processor</th><th>RAM</th><th>OS / Hypervisor</th><th>Kondisi</th></tr></thead>
        <tbody>${nodeRows}</tbody>
      </table>
    </div>` : "";
  const headName = s.hostname || (s.nodes && s.nodes.length ? `Chassis · ${s.nodes.length} node` : "—");
  return `
    <div class="srv-detail-head">
      <div class="mono" style="font-size:16px;font-weight:600;color:var(--text-primary);">${srvSummaryEsc(headName)}</div>
      <div class="mono" style="font-size:11.5px;color:var(--text-muted);">${srvSummaryEsc(s.assetTag || s.serial)}</div>
    </div>
    <div class="srv-meta-row">
      <span class="tag-chip">${srvSummaryEsc(srvSummaryTypeLabel(s.tipeServer))}</span>
      <span class="tag-chip">${srvSummaryEsc(s.formFactor)}</span>
      ${s.nodes ? `<span class="tag-chip">${srvSummaryEsc(s.nodes.length)}/${srvSummaryEsc(s.nodeTotal || "—")} node terisi</span>` : (s.nodeNumber || s.nodeTotal ? `<span class="tag-chip">Node ${srvSummaryEsc(s.nodeNumber || "—")} dari ${srvSummaryEsc(s.nodeTotal || "—")}</span>` : "")}
      <span class="tag-chip">${srvSummaryEsc(s.vendor)} ${srvSummaryEsc(s.model)}</span>
      ${srvSummaryChips(s.tags || [])}
    </div>
    ${nodeGroup}
    ${group("Spesifikasi Hardware", "fa-microchip", hw)}
    ${group("Port &amp; Konektivitas", "fa-network-wired", conn)}
    ${group("Lokasi &amp; Rack Mapping", "fa-map-location-dot", loc)}
    ${group("Status &amp; Monitoring", "fa-heart-pulse", status)}
    ${group("Tagging", "fa-tags", tagg)}`;
}
