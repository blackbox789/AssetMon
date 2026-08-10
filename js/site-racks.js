

// ---- Racks per Site ----
// Menampilkan daftar rack untuk sebuah site/lokasi.
// Berbasis RACKS (rack-data.js) sehingga bekerja untuk site bawaan
// (DC1-DC4) maupun site baru yang dibuat lewat menu Sites.

const SITES = {
  DC1: { name: "DC1 — Cilandak", loc: "Jakarta Selatan, DKI Jakarta", rackCount: 12, prefix: "R1", zone: "Zona A" },
  DC2: { name: "DC2 — Cikupa",   loc: "Tangerang, Banten",           rackCount: 18, prefix: "R2", zone: "Zona B" },
  DC3: { name: "DC3 — Surabaya", loc: "Surabaya, Jawa Timur",        rackCount: 8,  prefix: "R3", zone: "Zona C" },
  DC4: { name: "DC4 — Bandung (Edge Site)", loc: "Bandung, Jawa Barat", rackCount: 6, prefix: "R4", zone: "Zona D" },
};

const params = new URLSearchParams(window.location.search);
const siteParam = (params.get("site") || "").trim();

let site = null;
if (SITES[siteParam]) {
  site = { ...SITES[siteParam], custom: false };
} else if (typeof RACKS !== "undefined") {
  const matches = RACKS.filter(r => r.site === siteParam || String(r.siteName || "").toLowerCase() === String(siteParam).toLowerCase());
  if (siteParam && matches.length) {
    const first = matches[0];
    site = {
      id: siteParam,
      name: first.siteName || siteParam,
      loc: (first.loc && first.loc !== first.site) ? first.loc : (first.siteName || siteParam),
      zone: first.zone || "Zona A",
      custom: true,
    };
  }
}
if (!site) {
  site = { id: "DC1", name: "DC1 — Cilandak", loc: "Jakarta Selatan, DKI Jakarta", zone: "Zona A", custom: false };
}

const siteRacks = (typeof RACKS !== "undefined")
  ? RACKS.filter(r => r.site === site.id || String(r.siteName || "").toLowerCase() === String(site.name).toLowerCase())
  : [];

document.getElementById("crumb-site").textContent = site.name;
document.getElementById("page-title").textContent = "Racks — " + site.name;
document.getElementById("page-sub").textContent = siteRacks.length + " rack di lokasi ini · " + site.loc;
document.title = "Racks — " + site.name;

function statusBadge(status) {
  if (status === "maintenance") return '<span class="badge maintenance"><span class="bdot"></span>Maintenance</span>';
  if (status === "degraded") return '<span class="badge error"><span class="bdot"></span>Degraded</span>';
  return '<span class="badge completed"><span class="bdot"></span>Online</span>';
}

const totalServer = siteRacks.reduce((s, r) => s + (r.server || 0), 0);
const totalSwitch = siteRacks.reduce((s, r) => s + (r.sw || 0), 0);
const totalPdu = siteRacks.reduce((s, r) => s + (r.pdu || 0), 0);
const totalFirewall = siteRacks.reduce((s, r) => s + (r.firewall || 0), 0);

document.getElementById("site-stat-cards").innerHTML = `
  <div class="card stat-card">
    <div class="stat-top"><span class="stat-label">Total Racks</span><div class="stat-icon" style="background:var(--accent-dim);color:var(--accent-text);"><i class="fa-solid fa-warehouse"></i></div></div>
    <div class="stat-value">${siteRacks.length}</div>
    <div class="stat-delta">di ${site.name}</div>
  </div>
  <div class="card stat-card">
    <div class="stat-top"><span class="stat-label">Total Server</span><div class="stat-icon" style="background:var(--accent-dim);color:var(--accent-text);"><i class="fa-solid fa-server"></i></div></div>
    <div class="stat-value">${totalServer}</div>
    <div class="stat-delta">unit</div>
  </div>
  <div class="card stat-card">
    <div class="stat-top"><span class="stat-label">Switch / PDU</span><div class="stat-icon" style="background:var(--info-dim);color:var(--info);"><i class="fa-solid fa-diagram-project"></i></div></div>
    <div class="stat-value">${totalSwitch}<span>/${totalPdu}</span></div>
    <div class="stat-delta">switch / PDU</div>
  </div>
  <div class="card stat-card">
    <div class="stat-top"><span class="stat-label">Firewall</span><div class="stat-icon" style="background:var(--warning-dim);color:var(--warning);"><i class="fa-solid fa-shield-halved"></i></div></div>
    <div class="stat-value">${totalFirewall}</div>
    <div class="stat-delta">unit</div>
  </div>
`;

const grid = document.getElementById("rack-grid");
grid.innerHTML = siteRacks.map(r => {
  let utilClass = "";
  if (r.util >= 90) utilClass = "crit"; else if (r.util >= 78) utilClass = "warn";
  return `
  <div class="card rack-card" onclick="location.href='rack-elevation.html?rack=${encodeURIComponent(r.rackId)}'">
    <div class="rack-card-head">
      <div><div class="rack-card-id">${r.rackId}</div><div class="rack-card-zone">${r.zone || site.zone} &middot; ${r.size || 42}U</div></div>
      ${statusBadge(r.status)}
    </div>
    <div class="rack-util-row"><span style="font-size:11px;color:var(--text-muted);width:52px;">Kapasitas</span><div class="util-bar"><div class="util-fill ${utilClass}" style="width:${r.util}%"></div></div><span class="pct">${r.util}%</span></div>
    <div class="device-breakdown">
      <div class="device-item server"><i class="fa-solid fa-server"></i><span class="dlabel">Server</span><span class="dcount">${r.server}</span></div>
      <div class="device-item switch"><i class="fa-solid fa-diagram-project"></i><span class="dlabel">Network Switch</span><span class="dcount">${r.sw}</span></div>
      <div class="device-item pdu"><i class="fa-solid fa-plug"></i><span class="dlabel">PDU</span><span class="dcount">${r.pdu}</span></div>
      <div class="device-item firewall"><i class="fa-solid fa-shield-halved"></i><span class="dlabel">Firewall</span><span class="dcount">${r.firewall}</span></div>
      <div class="device-item patch"><i class="fa-solid fa-ethernet"></i><span class="dlabel">Patch Panel</span><span class="dcount">${r.patch}</span></div>
    </div>
    <div class="rack-total-row"><span>Total perangkat</span><b>${r.totalDevices} unit</b></div>
  </div>`;
}).join("") || '<div class="form-hint">Belum ada rack untuk site ini.</div>';
