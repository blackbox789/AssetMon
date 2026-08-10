/* ============================================
   Port Map — halaman direktori port per perangkat.
   Daftar device dari: PORT_DATA (yang sudah ada
   datanya) + perangkat rack R1-A12 + server + PDU.
   Klik "Buka Port Map" → openPortMap (modal).
   ============================================ */

const PM_TYPE_META = {
  switch:   { label: "Switch",      icon: "fa-network-wired", color: "var(--info)",        bg: "var(--info-dim)" },
  firewall: { label: "Firewall",    icon: "fa-shield-halved", color: "var(--warning)",     bg: "var(--warning-dim)" },
  router:   { label: "Router",      icon: "fa-tower-broadcast", color: "#E5A13D",          bg: "rgba(229,161,61,.14)" },
  server:   { label: "Server",      icon: "fa-server",        color: "var(--accent-text)", bg: "var(--accent-dim)" },
  pdu:      { label: "Rack PDU",    icon: "fa-plug",          color: "var(--violet)",      bg: "var(--violet-dim)" },
  patch:    { label: "Patch Panel", icon: "fa-angles-right",  color: "var(--text-secondary)", bg: "var(--bg-surface-3)" },
  ups:      { label: "UPS",         icon: "fa-plug-circle-bolt", color: "var(--warning)", bg: "var(--warning-dim)" },
};

const PM_DEFAULT_BY_TYPE = {
  switch:   { ports: 24, sfp: 2 },
  firewall: { ports: 6, sfp: 0 },
  router:   { ports: 4, sfp: 0 },
  server:   { ports: 4, sfp: 0 },
  pdu:      { ports: 1, sfp: 0 },
  patch:    { ports: 24, sfp: 0 },
  ups:      { ports: 2, sfp: 0 },
};

// Perangkat bernama di rack utama R1-A12 (bukan hanya yang sudah ada PORT_DATA)
const PM_R1_DEVICES = [
  { name: "PP-24-CAT6", type: "patch", model: "Patch Panel 24-port CAT6", ip: "—", rack: "R1-A12" },
  { name: "SW-CORE-01", type: "switch", model: "Cisco Catalyst 9300-48P", ip: "10.10.0.1", rack: "R1-A12" },
  { name: "SRV-APP-04", type: "server", model: "Dell PowerEdge R750", ip: "10.10.4.14", rack: "R1-A12" },
  { name: "PDU-A", type: "pdu", model: "APC AP8941 Switched Rack PDU", ip: "10.10.9.1", rack: "R1-A12" },
  { name: "SRV-DB-17", type: "server", model: "Dell PowerEdge R750", ip: "10.10.4.17", rack: "R1-A12" },
  { name: "FW-EDGE-02", type: "firewall", model: "Fortinet FortiGate 200F", ip: "10.10.0.254", rack: "R1-A12" },
  { name: "SRV-WEB-02", type: "server", model: "HPE ProLiant DL380", ip: "10.10.4.22", rack: "R1-A12" },
  { name: "SW-ACC-03", type: "switch", model: "Cisco Catalyst 2960-X", ip: "10.10.0.23", rack: "R1-A12" },
  { name: "SRV-BKP-01", type: "server", model: "Dell PowerEdge R750xd", ip: "10.10.4.31", rack: "R1-A12" },
  { name: "PDU-B", type: "pdu", model: "APC AP8941 Switched Rack PDU", ip: "10.10.9.2", rack: "R1-A12" },
];

function pmCollectDevices() {
  const map = new Map();
  const add = (name, meta) => {
    if (!name) return;
    const cur = map.get(name);
    map.set(name, cur ? Object.assign({}, cur, meta, { name }) : Object.assign({ name }, meta));
  };
  Object.keys(PORT_DATA).forEach(k => {
    const d = PORT_DATA[k];
    add(k, { type: d.type, model: d.model || "", ports: d.ports, sfp: d.sfp, used: Array.isArray(d.rows) ? d.rows.length : 0, hasData: true });
  });
  PM_R1_DEVICES.forEach(d => add(d.name, { type: d.type, model: d.model, ip: d.ip, rack: d.rack }));
  if (typeof getServers === "function") {
    try {
      getServers().forEach(s => {
        if (s && s.hostname) {
          add(s.hostname, {
            type: "server",
            model: [s.vendor, s.model].filter(Boolean).join(" ") || "",
            rack: s.rack || s.siteName || "",
            ip: s.ip || "",
            formFactor: s.formFactor || "",
          });
        }
      });
    } catch (e) { /* abaikan */ }
  }
  PDU_DATA.forEach(p => {
    add(p.name, { type: "pdu", model: [p.brand, p.model].filter(Boolean).join(" "), rack: p.rack, ip: p.ip, status: p.status });
  });
  try {
    const swList = JSON.parse(localStorage.getItem("rv_switches") || "[]");
    if (Array.isArray(swList)) {
      swList.forEach(sw => {
        if (sw && sw.name) {
          add(sw.name, {
            type: "switch",
            model: [sw.brand, sw.model].filter(Boolean).join(" "),
            rack: sw.rack || "",
            ip: sw.ip || "",
            switchType: sw.type || "",
          });
        }
      });
    }
  } catch (e) { /* abaikan */ }
  return [...map.values()].map(d => {
    if (!d.hasData) {
      const def = PM_DEFAULT_BY_TYPE[d.type] || PM_DEFAULT_BY_TYPE.server;
      d.ports = def.ports; d.sfp = def.sfp; d.used = 0;
    }
    return d;
  });
}

let PM_DEVICES = [];
let PM_CABLES = [];
let PM_TAB = "devices";

function pmTypeBadge(type) {
  const m = PM_TYPE_META[type] || PM_TYPE_META.server;
  return `<span class="device-type-chip" style="color:${m.color};background:${m.bg};"><i class="fa-solid ${m.icon}"></i>${m.label}</span>`;
}

function pmRenderTable() {
  const q = (document.getElementById("top-search").value || "").trim().toLowerCase();
  const type = document.getElementById("filter-type").value;
  const rows = PM_DEVICES.filter(d => {
    const mt = type === "all" || d.type === type;
    const mq = !q || [d.name, d.model, d.ip, d.rack].join(" ").toLowerCase().includes(q);
    return mt && mq;
  });

  document.getElementById("pm-tbody").innerHTML = rows.map(d => {
    const pct = d.ports ? Math.round(d.used / d.ports * 100) : 0;
    const cls = pct >= 90 ? "crit" : pct >= 75 ? "warn" : "";
    return `<tr data-pm-name="${escPM(d.name)}" data-type="${d.type}">
      <td><div class="strong">${escPM(d.name)}</div><div class="mono" style="font-size:11px;">${escPM(d.model) || "&nbsp;"}</div></td>
      <td>${pmTypeBadge(d.type)}</td>
      <td><div class="outlet-cell"><span class="outlet-nums">${d.used}/${d.ports} terpakai${d.sfp ? ` + ${d.sfp} SFP` : ""}</span><div class="outlet-bar"><div class="outlet-fill ${cls}" style="width:${Math.min(100, pct)}%"></div></div></div></td>
      <td class="mono">${d.sfp || "—"}</td>
      <td class="mono">${escPM(d.rack || "—")}</td>
      <td class="mono">${escPM(d.ip || "—")}</td>
      <td><button class="btn primary pm-open-btn" style="padding:7px 12px;font-size:12px;" data-name="${escPM(d.name)}" data-type="${d.type}"><i class="fa-solid fa-ethernet"></i> Buka Port Map</button></td>
    </tr>`;
  }).join("");

  const filtered = rows.length === PM_DEVICES.length;
  document.getElementById("filter-count").textContent = `Menampilkan ${rows.length} dari ${PM_DEVICES.length} perangkat${filtered ? "" : " (setelah filter)"}`;
  pmUpdateStats(rows);
}

function pmUpdateStats(filtered) {
  const all = PM_DEVICES;
  document.getElementById("stat-total").textContent = all.length;
  document.getElementById("stat-mapped").textContent = all.filter(d => d.hasData).length;
  document.getElementById("stat-used").textContent = all.reduce((s, d) => s + (d.used || 0), 0);
  document.getElementById("stat-cap").textContent = all.reduce((s, d) => s + (d.ports || 0), 0);
  void filtered;
}

// ---- Tab Koneksi Kabel: semua koneksi port dari seluruh perangkat ----
function pmCableRows() {
  const meta = new Map((PM_DEVICES || []).map(d => [d.name, d]));
  const rows = [];
  Object.keys(PORT_DATA).forEach(k => {
    const d = PORT_DATA[k];
    if (!Array.isArray(d.rows)) return;
    d.rows.forEach(r => {
      const m = meta.get(k) || {};
      rows.push({
        src: k,
        srcType: d.type || m.type || "server",
        model: m.model || "",
        port: String(r.port != null ? r.port : ""),
        label: r.label || "",
        media: r.media || "Cat6",
        vlan: r.vlan || "—",
        destPort: r.destPort || "—",
        dest: r.dest || "—",
        ip: r.ip || "—",
      });
    });
  });
  return rows;
}

function pmRenderCables(q) {
  const rows = PM_CABLES.filter(c => {
    if (!q) return true;
    return [c.src, c.port, c.media, c.vlan, c.label, c.destPort, c.dest, c.ip].join(" ").toLowerCase().includes(q);
  });
  document.getElementById("cable-tbody").innerHTML = rows.map(c => `
    <tr data-cable-src="${escPM(c.src)}" data-cable-port="${escPM(c.port)}" data-cable-type="${escPM(c.srcType)}" style="cursor:pointer;" title="Klik untuk edit kabel ${escPM(c.src)} → ${escPM(c.dest)}">
      <td><div class="strong">${escPM(c.src)}</div><div class="mono" style="font-size:11px;">${escPM(c.model) || "&nbsp;"}</div></td>
      <td class="mono strong">${escPM(c.port) || "—"}</td>
      <td><span class="vlan-tag" style="background:${mediaColor(c.media)}">${escPM(c.media)}</span></td>
      <td><span class="vlan-tag" style="background:${vlanColor(c.vlan)}">${escPM(c.vlan)}</span></td>
      <td class="mono" style="color:var(--text-muted);">${escPM(c.label) || "—"}</td>
      <td class="mono">${escPM(c.destPort)}</td>
      <td class="strong">${escPM(c.dest)}</td>
      <td class="mono">${escPM(c.ip)}</td>
    </tr>`).join("");
  document.getElementById("filter-count").textContent = `Menampilkan ${rows.length} dari ${PM_CABLES.length} koneksi kabel${rows.length === PM_CABLES.length ? "" : " (setelah filter)"}`;
}

function pmRender() {
  const tabDevices = document.getElementById("tab-devices");
  const tabCables = document.getElementById("tab-cables");
  if (tabDevices) tabDevices.style.display = PM_TAB === "devices" ? "" : "none";
  if (tabCables) tabCables.style.display = PM_TAB === "cables" ? "" : "none";
  const typeSel = document.getElementById("filter-type");
  if (typeSel) typeSel.style.display = PM_TAB === "devices" ? "" : "none";
  if (PM_TAB === "cables") {
    pmRenderCables((document.getElementById("top-search").value || "").trim().toLowerCase());
    return;
  }
  pmRenderTable();
}

["top-search", "filter-type"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", pmRender);
});

document.querySelectorAll(".tab-pill").forEach(pill => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".tab-pill").forEach(p => p.classList.toggle("active", p === pill));
    PM_TAB = pill.dataset.tab;
    pmRender();
  });
});

document.getElementById("pm-tbody").addEventListener("click", e => {
  const btn = e.target.closest(".pm-open-btn");
  if (!btn) return;
  const name = btn.dataset.name;
  openPortMap(name, false, 0, { type: btn.dataset.type, formFactor: "" });
});

document.getElementById("cable-tbody").addEventListener("click", e => {
  const tr = e.target.closest("[data-cable-src]");
  if (!tr) return;
  const src = tr.dataset.cableSrc;
  const port = tr.dataset.cablePort;
  if (typeof openPortMap === "function") {
    openPortMap(src, false, 0, { type: tr.dataset.cableType || "server", formFactor: "" });
    if (port && typeof openPortEditor === "function") openPortEditor(port);
  }
});

PM_DEVICES = pmCollectDevices();
PM_CABLES = pmCableRows();
pmRender();

// ---- Deep-link: port-map.html?device=KEY → buka Port Map perangkat itu ----
(function pmOpenFromQuery() {
  const dev = new URLSearchParams(location.search).get("device");
  if (!dev) return;
  const d = PM_DEVICES.find(x => (x.name || "").toLowerCase() === dev.toLowerCase());
  if (!d) return;
  const searchEl = document.getElementById("top-search");
  if (searchEl) { searchEl.value = d.name; pmRender(); }
  openPortMap(d.name, false, 0, { type: d.type, formFactor: d.formFactor || "" });
})();
