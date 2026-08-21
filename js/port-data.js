
const DEFAULT_PORT_DATA = {
  "SW-CORE-01": { type: "switch", ports: 24, sfp: 2, rows: [
    { port: 1, vlan: "UPLINK", dest: "FW-EDGE-02", destPort: "WAN", ip: "10.10.0.254", label: "CBL-1001", media: "Cat6" },
    { port: 2, vlan: "TRUNK", dest: "SW-ACC-03", destPort: "Uplink", ip: "10.10.0.23", label: "CBL-1002", media: "SFP+ DAC" },
    { port: 3, vlan: "TRUNK", dest: "SW-ACC-04", destPort: "Uplink", ip: "10.10.0.24", label: "CBL-1003", media: "LC MM" },
    { port: "MGMT", vlan: "v99", dest: "SW-MGMT-02", destPort: "1", ip: "10.10.99.1", label: "CBL-1004", media: "Cat6" },
  ]},
  "SW-ACC-03": { type: "switch", ports: 24, sfp: 2, rows: [
    { port: 1, vlan: "TRUNK", dest: "SW-CORE-01", destPort: "2", ip: "10.10.0.1", label: "CBL-1010", media: "SFP+ DAC" },
    { port: 2, vlan: "v10", dest: "SRV-APP-04", destPort: "eth0", ip: "10.10.4.14", label: "CBL-1011", media: "Cat6A" },
    { port: 3, vlan: "v99", dest: "SRV-APP-04", destPort: "eth1 (mgmt)", ip: "10.10.99.14", label: "CBL-1012", media: "Cat6" },
    { port: 4, vlan: "v20", dest: "SRV-DB-17", destPort: "eth0", ip: "10.10.4.17", label: "CBL-1013", media: "Cat6A" },
    { port: 5, vlan: "v99", dest: "SRV-DB-17", destPort: "eth1 (mgmt)", ip: "10.10.99.17", label: "CBL-1014", media: "Cat6" },
    { port: 6, vlan: "v10", dest: "SRV-WEB-02", destPort: "eth0", ip: "10.10.4.22", label: "CBL-1015", media: "Cat6" },
    { port: 7, vlan: "v99", dest: "SRV-WEB-02", destPort: "eth1 (mgmt)", ip: "10.10.99.22", label: "CBL-1016", media: "Cat6" },
    { port: 8, vlan: "v10", dest: "SVR1U", destPort: "eth0", ip: "10.10.4.19", label: "CBL-1060", media: "Cat6A" },
    { port: 9, vlan: "v99", dest: "SVR1U", destPort: "eth1 (mgmt)", ip: "10.10.99.19", label: "CBL-1061", media: "Cat6" },
    { port: 12, vlan: "v30", dest: "SW-BACKUP-02", destPort: "5", ip: "10.10.0.25", label: "CBL-1062", media: "LC MM" },
    { port: "MGMT", vlan: "v99", dest: "SW-MGMT-02", destPort: "2", ip: "10.10.99.23", label: "CBL-1017", media: "Cat6" },
  ]},
  "FW-EDGE-02": { type: "firewall", ports: 6, sfp: 0, rows: [
    { port: 1, vlan: "WAN", dest: "ISP Upstream", destPort: "—", ip: "203.0.113.1", label: "CBL-1020", media: "LC SM" },
    { port: 2, vlan: "TRUNK", dest: "SW-CORE-01", destPort: "1", ip: "10.10.0.1", label: "CBL-1021", media: "Cat6" },
    { port: 3, vlan: "DMZ", dest: "DMZ Segment", destPort: "—", ip: "10.10.50.1", label: "CBL-1022", media: "LC MM" },
    { port: "MGMT", vlan: "v99", dest: "SW-MGMT-02", destPort: "3", ip: "10.10.99.254", label: "CBL-1023", media: "Cat6" },
  ]},
  "SRV-APP-04": { type: "server", ports: 2, sfp: 0, rows: [
    { port: "eth0", vlan: "v10", dest: "SW-ACC-03", destPort: "2", ip: "10.10.4.14", label: "CBL-1030", media: "Cat6A" },
    { port: "eth1 (mgmt)", vlan: "v99", dest: "SW-ACC-03", destPort: "3", ip: "10.10.99.14", label: "CBL-1031", media: "Cat6" },
  ]},
  "SRV-DB-17": { type: "server", ports: 2, sfp: 0, rows: [
    { port: "eth0", vlan: "v20", dest: "SW-ACC-03", destPort: "4", ip: "10.10.4.17", label: "CBL-1040", media: "Cat6A" },
    { port: "eth1 (mgmt)", vlan: "v99", dest: "SW-ACC-03", destPort: "5", ip: "10.10.99.17", label: "CBL-1041", media: "Cat6" },
    { port: "SAS-HBA", vlan: "—", dest: "JBOD-ENCL-01", destPort: "Exp", ip: "—", label: "CBL-1042", media: "SAS" },
  ]},
  "SRV-WEB-02": { type: "server", ports: 2, sfp: 0, rows: [
    { port: "eth0", vlan: "v10", dest: "SW-ACC-03", destPort: "6", ip: "10.10.4.22", label: "CBL-1050", media: "Cat6A" },
    { port: "eth1 (mgmt)", vlan: "v99", dest: "SW-ACC-03", destPort: "7", ip: "10.10.99.22", label: "CBL-1051", media: "Cat6" },
  ]},
  "SVR1U": { type: "server", ports: 2, sfp: 0, rows: [
    { port: "eth0", vlan: "v10", dest: "SW-ACC-03", destPort: "8", ip: "10.10.4.19", label: "CBL-1063", media: "Cat6A" },
    { port: "eth1 (mgmt)", vlan: "v99", dest: "SW-ACC-03", destPort: "9", ip: "10.10.99.19", label: "CBL-1064", media: "Cat6" },
  ]},
  "SRV-BKP-01": { type: "server", ports: 2, sfp: 0, rows: [
    { port: "eth0", vlan: "v30", dest: "SW-BACKUP-02", destPort: "1", ip: "10.10.4.31", label: "CBL-1065", media: "Cat6A" },
    { port: "eth1 (mgmt)", vlan: "v99", dest: "SW-MGMT-02", destPort: "5", ip: "10.10.99.31", label: "CBL-1066", media: "Cat6" },
  ]},
  "SRV-NAS-01": { type: "server", ports: 2, sfp: 0, rows: [
    { port: "eth0", vlan: "v30", dest: "SW-BACKUP-02", destPort: "2", ip: "10.10.4.40", label: "CBL-1090", media: "Cat6A" },
    { port: "eth1 (mgmt)", vlan: "v99", dest: "SW-MGMT-02", destPort: "6", ip: "10.10.99.40", label: "CBL-1091", media: "Cat6" },
  ]},
  "SRV-NAS-02": { type: "server", ports: 2, sfp: 0, rows: [
    { port: "eth0", vlan: "v30", dest: "SW-BACKUP-02", destPort: "3", ip: "10.10.4.41", label: "CBL-1092", media: "Cat6A" },
    { port: "eth1 (mgmt)", vlan: "v99", dest: "SW-MGMT-02", destPort: "7", ip: "10.10.99.41", label: "CBL-1093", media: "Cat6" },
  ]},
  "SRV-BACKUP-01": { type: "server", ports: 2, sfp: 0, rows: [
    { port: "eth0", vlan: "v30", dest: "SW-BACKUP-02", destPort: "4", ip: "10.10.4.50", label: "CBL-1094", media: "Cat6A" },
    { port: "eth1 (mgmt)", vlan: "v99", dest: "SW-MGMT-02", destPort: "8", ip: "10.10.99.50", label: "CBL-1095", media: "Cat6" },
  ]},
  "SW-MGMT-02": { type: "switch", ports: 24, sfp: 2, rows: [
    { port: 1, vlan: "v99", dest: "SW-CORE-01", destPort: "MGMT", ip: "10.10.99.1", label: "CBL-1080", media: "Cat6" },
    { port: 2, vlan: "v99", dest: "SW-ACC-03", destPort: "MGMT", ip: "10.10.99.23", label: "CBL-1081", media: "Cat6" },
    { port: 3, vlan: "v99", dest: "FW-EDGE-02", destPort: "MGMT", ip: "10.10.99.254", label: "CBL-1082", media: "Cat6" },
    { port: 4, vlan: "v99", dest: "SW-BACKUP-02", destPort: "MGMT", ip: "10.10.99.25", label: "CBL-1083", media: "Cat6" },
    { port: 5, vlan: "v99", dest: "SRV-BKP-01", destPort: "eth1 (mgmt)", ip: "10.10.99.31", label: "CBL-1084", media: "Cat6" },
    { port: 6, vlan: "v99", dest: "SRV-NAS-01", destPort: "eth1 (mgmt)", ip: "10.10.99.40", label: "CBL-1085", media: "Cat6" },
    { port: 7, vlan: "v99", dest: "SRV-NAS-02", destPort: "eth1 (mgmt)", ip: "10.10.99.41", label: "CBL-1086", media: "Cat6" },
    { port: 8, vlan: "v99", dest: "SRV-BACKUP-01", destPort: "eth1 (mgmt)", ip: "10.10.99.50", label: "CBL-1087", media: "Cat6" },
  ]},
  "SW-BACKUP-02": { type: "switch", ports: 24, sfp: 2, rows: [
    { port: 1, vlan: "v30", dest: "SRV-BKP-01", destPort: "eth0", ip: "10.10.4.31", label: "CBL-1070", media: "Cat6A" },
    { port: 2, vlan: "v30", dest: "SRV-NAS-01", destPort: "eth0", ip: "10.10.4.40", label: "CBL-1071", media: "Cat6A" },
    { port: 3, vlan: "v30", dest: "SRV-NAS-02", destPort: "eth0", ip: "10.10.4.41", label: "CBL-1072", media: "Cat6A" },
    { port: 4, vlan: "v30", dest: "SRV-BACKUP-01", destPort: "eth0", ip: "10.10.4.50", label: "CBL-1073", media: "Cat6A" },
    { port: 5, vlan: "v30", dest: "SW-ACC-03", destPort: "12", ip: "10.10.0.23", label: "CBL-1074", media: "LC MM" },
    { port: "MGMT", vlan: "v99", dest: "SW-MGMT-02", destPort: "4", ip: "10.10.99.25", label: "CBL-1075", media: "Cat6" },
  ]},
  "PDU-A": { type: "pdu", ports: 1, sfp: 0, rows: [
    { port: "MGMT", vlan: "v99", dest: "SW-ACC-03", destPort: "15", ip: "10.10.9.1", label: "CBL-2015", media: "Cat6" },
  ]},
  "PDU-B": { type: "pdu", ports: 1, sfp: 0, rows: [
    { port: "MGMT", vlan: "v99", dest: "SW-ACC-03", destPort: "16", ip: "10.10.9.2", label: "CBL-2016", media: "Cat6" },
  ]},
};

const TAG_COLORS = {
  "production": "var(--danger)",
  "staging": "var(--warning)",
  "development": "var(--info)",
  "database": "var(--violet)",
  "security": "var(--warning)",
  "network-core": "var(--accent)",
  "network-access": "var(--accent)",
  "application": "var(--info)",
  "web": "var(--accent)",
  "backup": "var(--text-muted)",
  "power": "var(--violet)",
};
function tagColor(tag) {
  if (TAG_COLORS[tag]) return TAG_COLORS[tag];
  const palette = ["var(--accent)", "var(--info)", "var(--violet)", "var(--warning)", "#F97316", "#EC4899"];
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
function vlanColor(vlan) {
  const palette = ["var(--accent)", "var(--info)", "var(--violet)", "var(--warning)", "#F97316", "#EC4899"];
  let h = 0;
  for (let i = 0; i < vlan.length; i++) h = (h * 31 + vlan.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

// ---- Tipe media koneksi (copper / fiber / direct attach / storage / mgmt) ----
const MEDIA_TYPES = [
  "Cat5e", "Cat6", "Cat6A", "Cat7", "Cat8",
  "LC MM", "LC SM", "SC SM", "MPO",
  "SFP+ DAC", "QSFP",
  "SAS", "SATA", "FC",
  "Console", "USB",
];
const MEDIA_COLORS = {
  "Cat5e": "#E5A13D", "Cat6": "#2FB5C8", "Cat6A": "#C8569E", "Cat7": "#7C6FF0", "Cat8": "#F97316",
  "LC MM": "#22C55E", "LC SM": "#3B82F6", "SC SM": "#0EA5E9", "MPO": "#A3E635",
  "SFP+ DAC": "#14B8A6", "QSFP": "#06B6D4",
  "SAS": "#EF4444", "SATA": "#F59E0B", "FC": "#8B5CF6",
  "Console": "#6E7681", "USB": "#94A3B8",
};
const MEDIA_SHORT = {
  "Cat5e": "5E", "Cat6": "6", "Cat6A": "6A", "Cat7": "7", "Cat8": "8",
  "LC MM": "LC", "LC SM": "LC·SM", "SC SM": "SC", "MPO": "MPO",
  "SFP+ DAC": "DAC", "QSFP": "QSFP",
  "SAS": "SAS", "SATA": "SATA", "FC": "FC",
  "Console": "CON", "USB": "USB",
};
function mediaColor(media) {
  if (MEDIA_COLORS[media]) return MEDIA_COLORS[media];
  const palette = ["#22C55E", "#3B82F6", "#14B8A6", "#A3E635", "#8B5CF6", "#F97316"];
  let h = 0;
  for (let i = 0; i < media.length; i++) h = (h * 31 + media.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
function mediaShort(media) {
  if (MEDIA_SHORT[media]) return MEDIA_SHORT[media];
  return String(media || "").slice(0, 4).toUpperCase() || "—";
}

function escPM(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Layout port (RJ-45 / SFP+ / QSFP) dari record server — sumber kebenaran
// sama dengan yang dipakai Ringkasan Identitas (lanRj45 / lanSfp / lanQsfp).
// Kalau record tidak diisi (semua 0 / kosong), pakai nilai fallback.
function portLayoutFromServer(srv, fallbackPorts, fallbackSfp, fallbackQsfp) {
  const rj45 = parseInt(srv && srv.lanRj45, 10) || 0;
  const sfp = parseInt(srv && srv.lanSfp, 10) || 0;
  const qsfp = parseInt(srv && srv.lanQsfp, 10) || 0;
  if (rj45 > 0 || sfp > 0 || qsfp > 0) return { ports: rj45, sfp, qsfp };
  return { ports: fallbackPorts, sfp: fallbackSfp, qsfp: fallbackQsfp };
}

// ---- Port Spesial per tipe perangkat (Manajemen, Console, Uplink, WAN, HA) ----
// Port di luar switchport bernomor (1..N) & slot SFP: mis. port manajemen,
// console/serial, WAN/HA khusus. Disimpan sebagai baris koneksi dengan nama
// port string ("MGMT", "CON", "WAN", dst.) sehingga ikut tercatat di tabel
// detail, Cable Registry, dan tab Koneksi Kabel. Uplink fiber/DAC sudah
// diwakili slot SFP; uplink copper tetap port bernomor di grid.
const SPECIAL_PORT_DEFS = {
  switch: [
    { key: "MGMT", label: "Manajemen", media: "Cat6", hint: "Port manajemen switch (biasanya di panel samping)" },
    { key: "CON",  label: "Console",   media: "Console", hint: "Port console / serial — akses CLI out-of-band" },
  ],
  firewall: [
    { key: "MGMT", label: "Manajemen", media: "Cat6", hint: "Port manajemen firewall" },
    { key: "CON",  label: "Console",   media: "Console", hint: "Port console / serial" },
    { key: "WAN",  label: "WAN",       media: "LC SM", hint: "Koneksi WAN / ISP — boleh juga memakai port bernomor" },
    { key: "HA",   label: "HA",        media: "Cat6", hint: "Link high-availability antar firewall" },
  ],
  router: [
    { key: "MGMT", label: "Manajemen", media: "Cat6", hint: "Port manajemen router" },
    { key: "CON",  label: "Console",   media: "Console", hint: "Port console / serial" },
    { key: "WAN",  label: "WAN",       media: "LC SM", hint: "Koneksi WAN / ISP" },
  ],
  server: [
    { key: "MGMT", label: "Manajemen", media: "Cat6", hint: "BMC — iDRAC / iLO / IPMI (bukan port data)" },
  ],
  pdu: [
    { key: "MGMT", label: "Manajemen", media: "Cat6", hint: "Port manajemen PDU" },
  ],
  ups: [
    { key: "MGMT", label: "Manajemen", media: "Cat6", hint: "Port manajemen UPS" },
  ],
  patch: [],
  storage: [],
  "kvm-switch": [],
  "cable-management": [],
  "cooling-fan": [],
  "blanking-panel": [],
  "monitoring-sensor": [],
};

const SPECIAL_PORT_COLORS = {
  MGMT: "#3B82F6", CON: "#F97316", CONSOLE: "#F97316",
  WAN: "#0EA5E9", HA: "#A855F7", UPLINK: "#22C55E",
  AUX: "#94A3B8", PSU: "#8B5CF6", DATA: "#2FB5C8",
};

function specialPortColor(key) {
  const k = String(key || "").toUpperCase();
  if (SPECIAL_PORT_COLORS[k]) return SPECIAL_PORT_COLORS[k];
  const palette = ["#3B82F6", "#F97316", "#22C55E", "#A855F7", "#0EA5E9", "#EC4899"];
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function openPortMap(deviceKey, startInEdit, psuCount, opts) {
  deviceKey = canonKey(deviceKey);
  let data = PORT_DATA[deviceKey];
  const isFallback = !data;
  if (!data) {
    const type = (opts && opts.type) || "server";
    const form = (opts && opts.formFactor) || "";
    const m = String(form).match(/^(\d+)U/);
    const u = m ? parseInt(m[1], 10) : 1;
    let ports = type === "switch" ? 24 : type === "firewall" ? 6 : type === "patch" ? 24 : type === "pdu" ? 1 : 4;
    let sfp = type === "switch" ? 2 : 0;
    let qsfp = 0;
    if (type === "server") {
      try {
        if (typeof getServers === "function") {
          const srv = getServers().find(s => (s.hostname || "").toLowerCase() === String(deviceKey).toLowerCase());
          if (srv) {
            const l = portLayoutFromServer(srv, u * 2, 0, 0);
            ports = l.ports; sfp = l.sfp; qsfp = l.qsfp;
            if (ports < 1) ports = u * 2;
          } else {
            ports = u * 2;
          }
        }
      } catch (err) { /* abaikan */ }
    }
    data = { type, ports, sfp, qsfp, rows: [], specials: JSON.parse(JSON.stringify(SPECIAL_PORT_DEFS[type] || [])) };
  }
  if (!Array.isArray(data.rows)) data.rows = [];
  if (!Array.isArray(data.specials)) data.specials = [];
  if (data.sfp == null) data.sfp = 0;
  if (data.qsfp == null) data.qsfp = 0;
  let portMapSpeed = "";
  if (data.type === "server" && typeof getServers === "function") {
    try {
      const srv = getServers().find(s => (s.hostname || "").toLowerCase() === String(deviceKey).toLowerCase());
      if (srv) {
        const l = portLayoutFromServer(srv, data.ports, data.sfp, data.qsfp);
        data.ports = l.ports; data.sfp = l.sfp; data.qsfp = l.qsfp;
        portMapSpeed = String(srv.speed || "").trim();
      }
    } catch (err) { /* abaikan */ }
  }
  currentPortKey = deviceKey || null;
  lastPortMeta = { type: data.type, ports: data.ports, sfp: data.sfp, qsfp: data.qsfp };
  document.getElementById("portmap-title").textContent = deviceKey + " — Port Map";
  document.getElementById("portmap-sub").textContent = `${data.rows.length} port terpakai dari ${data.ports} port` + (data.sfp ? ` + ${data.sfp} SFP` : "") + (data.qsfp ? ` + ${data.qsfp} QSFP` : "") + (portMapSpeed ? ` · ${portMapSpeed}` : "");

  let visualHtml = "";
  const sfpCells = data.sfp ? Array.from({ length: data.sfp }, (_, i) => {
    const idx = i + 1;
    const sfpRow = data.rows.find(r => r.port === "SFP" + idx);
    return `<div class="portmap-sfp-box ${sfpRow ? "used" : ""}" data-port-edit="SFP${idx}" style="cursor:pointer;" title="${sfpRow ? "Klik untuk edit: SFP" + idx + " → " + sfpRow.dest : "SFP" + idx + " kosong — klik untuk isi data"}">SFP${idx}</div>`;
  }).join("") : "";
  const sfpHtml = sfpCells ? `<div class="portmap-sfp-row">${sfpCells}</div>` : "";
  const qsfpCells = data.qsfp ? Array.from({ length: data.qsfp }, (_, i) => {
    const idx = i + 1;
    const qsfpRow = data.rows.find(r => r.port === "QSFP" + idx);
    return `<div class="portmap-sfp-box ${qsfpRow ? "used" : ""}" data-port-edit="QSFP${idx}" style="cursor:pointer;" title="${qsfpRow ? "Klik untuk edit: QSFP" + idx + " → " + qsfpRow.dest : "QSFP" + idx + " kosong — klik untuk isi data"}">QSFP${idx}</div>`;
  }).join("") : "";
  const qsfpHtml = qsfpCells ? `<div class="portmap-sfp-row">${qsfpCells}</div>` : "";

  // Strip Port Spesial (Manajemen / Console / Uplink / WAN / HA / dsb.) — di atas grid.
  const specials = Array.isArray(data.specials) ? data.specials : [];
  const specialCells = specials.map(s => {
    const row = data.rows.find(r => String(r.port) === String(s.key));
    const col = specialPortColor(s.key);
    const rmBtn = `<button class="portmap-special-x" data-remove-special="${escPM(s.key)}" title="Hapus port spesial ${escPM(s.label)} (${escPM(s.key)})" style="position:absolute;top:0;right:0;width:16px;height:14px;line-height:12px;padding:0;border:none;border-radius:4px;background:rgba(0,0,0,.32);color:#fff;font-size:9px;cursor:pointer;font-family:var(--font-ui);opacity:.9;">&times;</button>`;
    const body = row
      ? `<div class="pnum">${escPM(s.label)}</div><div>${escPM(row.dest)}</div>`
      : `<div class="pnum">${escPM(s.label)}</div>&ndash;`;
    return row
      ? `<div class="portmap-special-box used" data-port-edit="${escPM(s.key)}" style="position:relative;background:${col};border-color:${col};cursor:pointer;" title="Klik untuk edit: ${escPM(s.label)} (${escPM(s.key)}) → ${escPM(row.dest)} · ${escPM(row.vlan)}">${rmBtn}${body}</div>`
      : `<div class="portmap-special-box" data-port-edit="${escPM(s.key)}" style="position:relative;cursor:pointer;" title="${escPM(s.label)} (${escPM(s.key)}) kosong — klik untuk isi koneksi">${rmBtn}${body}</div>`;
  }).join("");
  const addSpecialBtn = `<button class="portmap-special-add" data-add-special style="width:32px;height:32px;border-radius:5px;border:1px dashed var(--border);background:transparent;color:var(--text-muted);font-size:15px;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;" title="Tambah port spesial (mis. Uplink, AUX, Out-of-Band)">+</button>`;
  const specialHtml = `<div class="portmap-special-row"><span class="portmap-special-label">Port Spesial</span><div class="portmap-sfp-row">${specialCells}${addSpecialBtn}</div></div>`;

  const cellHtml = p => {
    let row = data.rows.find(r => String(r.port) === String(p));
    if (!row && data.ports === 1 && data.rows.length) row = data.rows[0];
    if (row) {
      return `<div class="portmap-cell" data-port-edit="${p}" style="background:${vlanColor(row.vlan)};cursor:pointer;" title="Klik untuk edit: Port ${p} [${row.label || '—'}] → ${row.dest} (${row.destPort}) · ${row.media || 'media: —'}"><div class="pnum">${p}</div><div>${row.vlan}</div>${row.media ? `<div class="mmedia">${mediaShort(row.media)}</div>` : ""}</div>`;
    }
    return `<div class="portmap-cell free" data-port-edit="${p}" style="cursor:pointer;" title="Klik untuk isi data: Port ${p} — kosong"><div class="pnum">${p}</div>–</div>`;
  };
  if (data.ports >= 24) {
    const rowRanges = [[1, 12], [13, 24]];
    const gridRows = rowRanges.map(([from, to]) => {
      let cells = "";
      for (let p = from; p <= to; p++) cells += cellHtml(p);
      return `<div class="portmap-grid-row">${cells}</div>`;
    }).join("");
    visualHtml = `<div class="portmap-visual">${gridRows}${sfpHtml}${qsfpHtml}${specialHtml}</div>`;
  } else {
    const perRow = Math.max(2, Math.min(8, data.ports));
    const gridRows = [];
    for (let start = 1; start <= data.ports; start += perRow) {
      let cells = "";
      for (let p = start; p <= Math.min(start + perRow - 1, data.ports); p++) cells += cellHtml(p);
      gridRows.push(`<div class="portmap-grid-row">${cells}</div>`);
    }
    visualHtml = `<div class="portmap-visual">${gridRows}${sfpHtml}${qsfpHtml}${specialHtml}</div>`;
  }

  const specialLegend = specials.map(s => `<span><span class="sw" style="background:${specialPortColor(s.key)}"></span>${escPM(s.label)} (${escPM(s.key)})</span>`).join("");
  const legendVlans = [...new Set(data.rows.map(r => r.vlan))];
  const legendHtml = `<div class="portmap-legend">${specialLegend}${legendVlans.map(v => `<span><span class="sw" style="background:${vlanColor(v)}"></span>${v}</span>`).join("")}<span><span class="sw" style="background:var(--bg-surface-3);border:1px solid var(--border)"></span>Kosong</span></div>`;
  const mediaSet = [...new Set(data.rows.map(r => r.media).filter(Boolean))];
  const mediaLegendHtml = mediaSet.length
    ? `<div class="portmap-legend" style="margin-top:8px;">${mediaSet.map(m => `<span><span class="sw" style="background:${mediaColor(m)}"></span>${escPM(m)}</span>`).join("")}</div>`
    : "";

  const tableRows = data.rows.map(r => `
    <tr data-port-edit="${escPM(r.port)}" style="cursor:pointer;" title="Klik untuk edit port ${r.port}">
      <td class="strong mono">${r.port}</td>
      <td class="mono" style="color:var(--text-muted);">${r.label || "—"}</td>
      <td>${r.media ? `<span class="vlan-tag" style="background:${mediaColor(r.media)}">${escPM(r.media)}</span>` : `<span class="mono" style="color:var(--text-muted);">—</span>`}</td>
      <td><span class="vlan-tag" style="background:${vlanColor(r.vlan)}">${r.vlan}</span></td>
      <td class="mono">${r.destPort}</td>
      <td class="strong">${r.dest}</td>
      <td class="mono">${r.ip}</td>
    </tr>`).join("");
  const tableHtml = data.rows.length
    ? `<table>
        <thead><tr><th>Port</th><th>Label ID</th><th>Media</th><th>VLAN</th><th>Port Tujuan</th><th>Perangkat Tujuan</th><th>IP Address</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>`
    : (isFallback
        ? `<div class="form-hint" style="padding:18px;text-align:center;border:1px dashed var(--border);border-radius:8px;">Belum ada kabel terdaftar untuk <b>${escPM(deviceKey)}</b> — semua port kosong. Klik nomor port untuk mencatat koneksi, atau lewat menu Cable Registry.</div>`
        : "");

  document.getElementById("portmap-body").innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
      <div class="form-hint" style="margin:0;">Klik kotak port atau nomor port di tabel untuk mengisi / mengedit koneksi.</div>
      <button type="button" class="btn ghost" id="portmap-count-btn" style="padding:7px 11px;font-size:12px;flex-shrink:0;" title="Ubah jumlah port RJ-45 / SFP+ / QSFP"><i class="fa-solid fa-sliders"></i> Ubah Jumlah Port</button>
    </div>
    <div id="portmap-count-panel" style="display:none;margin-bottom:12px;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--bg-surface-2);">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:end;flex-wrap:wrap;">
        <div><label class="form-label">RJ-45</label><input class="form-input mono" type="number" id="portmap-count-rj45" min="0" max="72" value="${data.ports}"></div>
        <div><label class="form-label">SFP+</label><input class="form-input mono" type="number" id="portmap-count-sfp" min="0" max="24" value="${data.sfp}"></div>
        <div><label class="form-label">QSFP</label><input class="form-input mono" type="number" id="portmap-count-qsfp" min="0" max="24" value="${data.qsfp}"></div>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn primary" id="portmap-count-save" style="padding:7px 11px;font-size:12px;"><i class="fa-solid fa-check"></i> Simpan</button>
          <button type="button" class="btn ghost" id="portmap-count-cancel" style="padding:7px 11px;font-size:12px;">Batal</button>
        </div>
      </div>
      <div class="form-hint" style="margin:8px 0 0;">Untuk server, jumlah ini ikut menulis lanRj45 / lanSfp / lanQsfp agar sinkron dengan Ringkasan Identitas.</div>
    </div>
    ${legendHtml}
    ${mediaLegendHtml}
    ${visualHtml}
    ${tableHtml}
  `;
  const cntBtn = document.getElementById("portmap-count-btn");
  const cntPanel = document.getElementById("portmap-count-panel");
  if (cntBtn && cntPanel) {
    cntBtn.addEventListener("click", () => { cntPanel.style.display = cntPanel.style.display === "none" ? "" : "none"; });
    document.getElementById("portmap-count-cancel").addEventListener("click", () => { cntPanel.style.display = "none"; });
    document.getElementById("portmap-count-save").addEventListener("click", () => {
      const ports = Math.max(0, parseInt(document.getElementById("portmap-count-rj45").value, 10) || 0);
      const sfp = Math.max(0, parseInt(document.getElementById("portmap-count-sfp").value, 10) || 0);
      const qsfp = Math.max(0, parseInt(document.getElementById("portmap-count-qsfp").value, 10) || 0);
      const wouldHide = data.rows.filter(r => {
        const p = String(r.port);
        if (/^\d+$/.test(p) && parseInt(p, 10) > ports) return true;
        if (p.startsWith("SFP") && parseInt(p.replace("SFP", ""), 10) > sfp) return true;
        if (p.startsWith("QSFP") && parseInt(p.replace("QSFP", ""), 10) > qsfp) return true;
        return false;
      }).length;
      if (wouldHide) {
        alert(`Tidak bisa: ${wouldHide} koneksi aktif akan disembunyikan. Perbesar jumlah port atau hapus koneksinya dulu.`);
        return;
      }
      if (!PORT_DATA[deviceKey]) PORT_DATA[deviceKey] = data;
      data.ports = ports;
      data.sfp = sfp;
      data.qsfp = qsfp;
      if (data.type === "server" && typeof getServers === "function") {
        try {
          const srv = getServers().find(s => (s.hostname || "").toLowerCase() === String(deviceKey).toLowerCase());
          if (srv && typeof updateServer === "function") {
            updateServer(srv.id, { ...srv, lanRj45: String(ports), lanSfp: String(sfp), lanQsfp: String(qsfp) });
          }
        } catch (err) { /* abaikan */ }
      }
      savePortMap(deviceKey);
      openPortMap(deviceKey, false, psuCount, opts);
      if (typeof window.reloadServerList === "function") window.reloadServerList();
      const svo = document.getElementById("srv-view-overlay");
      const svb = document.getElementById("srv-view-body");
      if (svo && svb && svo.classList && svo.classList.contains && svo.classList.contains("open") && typeof buildServerSummaryHTML === "function") {
        try {
          const fresh = getServers().find(s => (s.hostname || "").toLowerCase() === String(deviceKey).toLowerCase());
          if (fresh) svb.innerHTML = buildServerSummaryHTML(fresh);
        } catch (err) { /* abaikan */ }
      }
    });
  }
  document.getElementById("portmap-overlay").classList.add("open");
}

const portmapCloseBtn = document.getElementById("portmap-close");
const portmapOverlayEl = document.getElementById("portmap-overlay");
if (portmapCloseBtn) portmapCloseBtn.addEventListener("click", () => portmapOverlayEl.classList.remove("open"));
if (portmapOverlayEl) portmapOverlayEl.addEventListener("click", e => { if (e.target.id === "portmap-overlay") e.currentTarget.classList.remove("open"); });

const DEFAULT_POWER_DATA = {
  "PDU-A": { ports: 24, rows: [
    { outlet: 1, device: "SRV-APP-04", psu: "PSU-A", watt: 240, label: "CBL-2001" },
    { outlet: 2, device: "SRV-DB-17", psu: "PSU-A", watt: 260, label: "CBL-2002" },
    { outlet: 3, device: "SW-CORE-01", psu: "Single PSU", watt: 150, label: "CBL-2003" },
    { outlet: 4, device: "FW-EDGE-02", psu: "Single PSU", watt: 65, label: "CBL-2004" },
    { outlet: 5, device: "SRV-WEB-02", psu: "PSU-A", watt: 205, label: "CBL-2005" },
    { outlet: 6, device: "SW-ACC-03", psu: "Single PSU", watt: 80, label: "CBL-2006" },
    { outlet: 7, device: "SVR1U", psu: "PSU-A", watt: 145, label: "CBL-2020" },
    { outlet: 8, device: "SRV-BKP-01", psu: "PSU-A", watt: 270, label: "CBL-2021" },
    { outlet: 9, device: "SRV-TWR-01", psu: "Single PSU", watt: 120, label: "CBL-2022" },
  ]},
  "PDU-B": { ports: 24, rows: [
    { outlet: 1, device: "SRV-APP-04", psu: "PSU-B", watt: 240, label: "CBL-2010" },
    { outlet: 2, device: "SRV-DB-17", psu: "PSU-B", watt: 260, label: "CBL-2011" },
    { outlet: 3, device: "SRV-WEB-02", psu: "PSU-B", watt: 205, label: "CBL-2012" },
    { outlet: 4, device: "SVR1U", psu: "PSU-B", watt: 145, label: "CBL-2023" },
    { outlet: 5, device: "SRV-BKP-01", psu: "PSU-B", watt: 270, label: "CBL-2024" },
    { outlet: 6, device: "SRV-TWR-02", psu: "Single PSU", watt: 70, label: "CBL-2025" },
  ]},
};

function psuColor(psu) {
  if (psu === "PSU-A") return "var(--accent)";
  if (psu === "PSU-B") return "var(--info)";
  if (psu === "Single PSU") return "var(--violet)";
  const i = typeof psu === "string" && psu.startsWith("PSU-") ? psu.charCodeAt(4) - 65 : -1;
  const palette = ["var(--warning)", "var(--danger)", "var(--violet)", "#0EA5E9", "#F97316", "#22C55E", "#E11D48", "#14B8A6"];
  if (i >= 2 && i < 2 + palette.length) return palette[i - 2];
  return "var(--violet)";
}

function psuOptionsFor(count) {
  const n = Math.min(10, Math.max(parseInt(count, 10) || 2, 1));
  const opts = [];
  for (let i = 0; i < n; i++) opts.push("PSU-" + String.fromCharCode(65 + i));
  if (n === 1) opts.unshift("Single PSU"); else opts.push("Single PSU");
  return opts;
}

function psuCountOfDevice(deviceKey) {
  if (deviceKey && typeof getServers === "function") {
    const s = getServers().find(x => x.id === deviceKey || x.hostname === deviceKey);
    if (s) return parseInt(s.psuCount, 10) || 2;
  }
  return 2;
}

// ---- Persistensi Port Map & Power Map ke SQLite (via server.js /api/maps) ----
// Data tersimpan per perangkat (deviceKey). DEFAULT_* adalah seed demo yang
// dipakai sebagai fallback; data hasil edit tersimpan ke DB dan menimpa default.
function readLocalMaps(storageKey) {
  try {
    const obj = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

// Upgrade data lama: baris port yang belum punya "media" diisi dari seed
// default (cocokkan per nomor port), fallback "Cat6". Ini agar contoh tipe
// media tetap tampil untuk data yang tersimpan sebelum fitur media ada.
function applyMediaDefaults(kind, runtime, defaults) {
  if (kind !== "port") return;
  Object.keys(runtime).forEach(k => {
    const dev = runtime[k];
    if (!dev || !Array.isArray(dev.rows)) return;
    const seed = defaults[k];
    dev.rows.forEach(row => {
      if (row && !row.media) {
        let media = "Cat6";
        if (seed && Array.isArray(seed.rows)) {
          const s = seed.rows.find(sr => String(sr.port) === String(row.port));
          if (s && s.media) media = s.media;
        }
        row.media = media;
      }
    });
  });
}

// Port Spesial: kalau data perangkat belum punya daftar specials (mis. data lama
// di DB/localStorage), isi dari template default sesuai tipe perangkat.
function applySpecialsDefaults(kind, runtime, defaults) {
  if (kind !== "port") return;
  Object.keys(runtime).forEach(k => {
    const dev = runtime[k];
    if (!dev || Array.isArray(dev.specials)) return;
    const defs = SPECIAL_PORT_DEFS[dev.type] || [];
    dev.specials = JSON.parse(JSON.stringify(defs));
  });
}

// Normalisasi key runtime: semua deviceKey dibuat kanonik (uppercase).
// Dua entri yang hanya beda case (mis. "srv-web-01" vs "SRV-WEB-01")
// dianggap satu perangkat — entri terakhir yang menang.
function normalizeRuntimeKeys(runtime) {
  const out = {};
  Object.keys(runtime).forEach(k => {
    if (!runtime[k]) return;
    out[canonKey(k)] = runtime[k];
  });
  return out;
}

function buildRuntimeMaps(kind, defaults) {
  let runtime = JSON.parse(JSON.stringify(defaults));
  const storageKey = kind === "port" ? PORT_STORAGE_KEY : POWER_STORAGE_KEY;
  const ls = readLocalMaps(storageKey);
  if (typeof apiGetMaps === "function") {
    const db = apiGetMaps(kind);
    if (db) {
      if (!db.length && Object.keys(ls).length && typeof apiSaveMap === "function") {
        Object.keys(ls).forEach(k => apiSaveMap(kind, k, ls[k]));
      }
      db.forEach(e => { runtime[e.deviceKey] = e.data; });
      runtime = normalizeRuntimeKeys(runtime);
      applyMediaDefaults(kind, runtime, defaults);
      applySpecialsDefaults(kind, runtime, defaults);
      return runtime;
    }
  }
  Object.keys(ls).forEach(k => { runtime[k] = ls[k]; });
  runtime = normalizeRuntimeKeys(runtime);
  applyMediaDefaults(kind, runtime, defaults);
  applySpecialsDefaults(kind, runtime, defaults);
  return runtime;
}

function saveMap(kind, deviceKey, data) {
  deviceKey = canonKey(deviceKey);
  if (typeof apiSaveMap === "function" && apiSaveMap(kind, deviceKey, data)) return true;
  try {
    const storageKey = kind === "port" ? PORT_STORAGE_KEY : POWER_STORAGE_KEY;
    const ls = readLocalMaps(storageKey);
    ls[deviceKey] = data;
    localStorage.setItem(storageKey, JSON.stringify(ls));
    return true;
  } catch {
    return false;
  }
}

function savePortMap(deviceKey) {
  if (PORT_DATA[deviceKey]) return saveMap("port", deviceKey, PORT_DATA[deviceKey]);
  return false;
}

function savePowerMap(deviceKey) {
  if (POWER_DATA[deviceKey]) return saveMap("power", deviceKey, POWER_DATA[deviceKey]);
  return false;
}

let PORT_DATA = buildRuntimeMaps("port", DEFAULT_PORT_DATA);
let POWER_DATA = buildRuntimeMaps("power", DEFAULT_POWER_DATA);

let currentPduKey = null;
let currentPortKey = null;
let lastPortMeta = { type: "server", ports: 4, sfp: 0 };

function buildOutletRows(totalPorts) {
  const rows = [];
  for (let start = 1; start <= totalPorts; start += 12) {
    rows.push([start, Math.min(start + 11, totalPorts)]);
  }
  return rows;
}

function openPowerMap(deviceKey, startInEdit, psuCount) {
  deviceKey = canonKey(deviceKey);
  const data = POWER_DATA[deviceKey];
  currentPduKey = deviceKey || null;
  document.getElementById("powermap-title").textContent = deviceKey ? deviceKey + " — Power Map" : "Power Map";
  document.getElementById("powermap-edit-panel").style.display = "none";
  const editBtn = document.getElementById("powermap-edit-btn");
  if (editBtn) editBtn.style.display = data ? "" : "none";
  const pmBtn = document.getElementById("powermap-portmap-btn");
  if (pmBtn) pmBtn.style.display = data ? "" : "none";
  if (!data) {
    // device (bukan PDU): tampilkan outlet PSU yang ada di perangkat tsb
    // dan izinkan edit / tambah / hapus koneksi PSU (data tersimpan di PDU).
    const rows = [];
    if (deviceKey) {
      Object.keys(POWER_DATA).forEach(k => {
        (POWER_DATA[k].rows || []).forEach(r => {
          if (r.device === deviceKey) rows.push({ ...r, pdu: k });
        });
      });
    }
    const totalWatt = rows.reduce((s, r) => s + r.watt, 0);
    document.getElementById("powermap-sub").textContent = rows.length
      ? `${rows.length} PSU terhubung · Total beban ${totalWatt} W`
      : "Belum ada data power untuk perangkat ini.";
    let effPsu = parseInt(psuCount, 10) || 2;
    if (typeof getServers === "function") {
      try {
        const s = getServers().find(x => (x.hostname || "").toLowerCase() === String(deviceKey).toLowerCase());
        if (s) effPsu = parseInt(s.psuCount, 10) || 2;
      } catch (err) { /* abaikan */ }
    }
    const slotCount = Math.min(10, Math.max(effPsu, rows.length));
    const curPsu = Math.min(10, Math.max(effPsu, 1));
    let cells = "";
    for (let i = 1; i <= slotCount; i++) {
      const row = rows[i - 1];
      if (row) {
        cells += `<div class="portmap-cell" data-devpsu-edit="${escPM(row.pdu)}|${row.outlet}" style="background:${psuColor(row.psu)};cursor:pointer;" title="Klik untuk edit: ${row.psu} → ${row.pdu} Outlet ${row.outlet} [${row.label || '—'}] · ${row.watt}W"><div class="pnum">${row.psu}</div><div>${row.pdu} · Out ${row.outlet}</div></div>`;
      } else {
        cells += `<div class="portmap-cell free" title="Slot PSU ${i} — kosong"><div class="pnum">PSU ${i}</div>Kosong</div>`;
      }
    }
    const legendPsus = [...new Set(rows.map(r => r.psu))];
    const legendHtml = `<div class="portmap-legend">${legendPsus.map(p => `<span><span class="sw" style="background:${psuColor(p)}"></span>${p}</span>`).join("")}${slotCount > rows.length ? `<span><span class="sw" style="background:var(--bg-surface-3);border:1px solid var(--border)"></span>Kosong</span>` : ""}</div>`;
    const tableRows = rows.map(r => `
      <tr data-devpsu-edit="${escPM(r.pdu)}|${r.outlet}" style="cursor:pointer;" title="Klik untuk edit koneksi PSU ini">
        <td class="strong mono">${r.psu}</td>
        <td class="strong">${r.pdu}</td>
        <td class="mono">Outlet ${r.outlet}</td>
        <td class="mono" style="color:var(--text-muted);">${r.label || "—"}</td>
        <td class="mono">${r.watt} W</td>
      </tr>`).join("");
    const psuCountOptions = Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
    const countSel = `
      <label class="form-hint" style="margin:0;flex-shrink:0;">Jumlah PSU</label>
      <select id="powermap-devpsu-count" title="Jumlah PSU perangkat" style="padding:7px 10px;font-size:12px;flex-shrink:0;border:1px solid var(--border);border-radius:8px;background:var(--bg-surface-1);color:var(--text);">
        ${psuCountOptions}
      </select>`;
    document.getElementById("powermap-body").innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
        <div class="form-hint" style="margin:0;">${rows.length ? "Klik PSU / baris tabel untuk mengedit, atau tambah PSU baru di bawah." : "Perangkat ini belum terhubung ke PDU — tambahkan PSU untuk mencatat koneksi daya."}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${countSel}
          <button type="button" class="btn primary" id="powermap-add-psu" style="padding:7px 12px;font-size:12px;flex-shrink:0;"><i class="fa-solid fa-plug-circle-plus"></i> Tambah PSU</button>
        </div>
      </div>
      ${legendHtml}
      <div class="portmap-visual"><div class="portmap-grid-row">${cells}</div></div>
      ${rows.length ? `<table>
        <thead><tr><th>PSU</th><th>PDU Sumber</th><th>Outlet</th><th>Label ID</th><th>Beban</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>` : ""}
    `;
    const countEl = document.getElementById("powermap-devpsu-count");
    if (countEl) {
      countEl.value = String(curPsu);
      countEl.addEventListener("change", () => setDevicePsuCount(deviceKey, parseInt(countEl.value, 10) || 2));
    }
    const addBtn = document.getElementById("powermap-add-psu");
    if (addBtn) addBtn.addEventListener("click", () => openDevicePsuEditor(deviceKey, null));
    document.getElementById("powermap-body").querySelectorAll("[data-devpsu-edit]").forEach(el => {
      el.addEventListener("click", () => {
        const [pdu, outlet] = String(el.dataset.devpsuEdit).split("|");
        openDevicePsuEditor(deviceKey, { pdu, outlet: parseInt(outlet, 10) });
      });
    });
    document.getElementById("powermap-overlay").classList.add("open");
    return;
  }
  const totalWatt = data.rows.reduce((s, r) => s + r.watt, 0);
  document.getElementById("powermap-title").textContent = deviceKey + " — Power Map";
  document.getElementById("powermap-sub").textContent = `${data.rows.length} outlet terpakai dari ${data.ports} · Total beban ${totalWatt} W`;

  const rowRanges = buildOutletRows(data.ports);
  const gridRows = rowRanges.map(([from, to]) => {
    let cells = "";
    for (let p = from; p <= to; p++) {
      const row = data.rows.find(r => r.outlet === p);
      if (row) {
        cells += `<div class="portmap-cell" data-outlet-edit="${p}" style="background:${psuColor(row.psu)};cursor:pointer;" title="Klik untuk edit: Outlet ${p} [${row.label || '—'}] → ${row.device} (${row.psu}, ${row.watt}W)"><div class="pnum">${p}</div><div>${row.psu === "Single PSU" ? "SGL" : row.psu.replace("PSU-", "")}</div></div>`;
      } else {
        cells += `<div class="portmap-cell free" data-outlet-edit="${p}" style="cursor:pointer;" title="Klik untuk isi data: Outlet ${p} — kosong"><div class="pnum">${p}</div>–</div>`;
      }
    }
    return `<div class="portmap-grid-row">${cells}</div>`;
  }).join("");
  const visualHtml = `<div class="portmap-visual">${gridRows}</div>`;

  const legendPsus = [...new Set(data.rows.map(r => r.psu))];
  const legendHtml = `<div class="portmap-legend">${legendPsus.map(p => `<span><span class="sw" style="background:${psuColor(p)}"></span>${p}</span>`).join("")}<span><span class="sw" style="background:var(--bg-surface-3);border:1px solid var(--border)"></span>Kosong</span></div>`;

  const tableRows = data.rows.map(r => `
    <tr data-outlet-edit="${r.outlet}" style="cursor:pointer;" title="Klik untuk edit outlet ${r.outlet}">
      <td class="strong mono">${r.outlet}</td>
      <td class="mono" style="color:var(--text-muted);">${r.label || "—"}</td>
      <td class="strong">${r.device}</td>
      <td><span class="vlan-tag" style="background:${psuColor(r.psu)}">${r.psu}</span></td>
      <td class="mono">${r.watt} W</td>
    </tr>`).join("");

  document.getElementById("powermap-body").innerHTML = `
    ${legendHtml}
    <div class="form-hint" style="margin-bottom:12px;">Klik kotak outlet atau nomor outlet di tabel untuk mengisi / mengedit data perangkat.</div>
    ${visualHtml}
    <table>
      <thead><tr><th>Outlet</th><th>Label ID</th><th>Perangkat</th><th>PSU Tujuan</th><th>Beban</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;
  document.getElementById("powermap-overlay").classList.add("open");
  if (startInEdit) {
    openPowerMapEditPanel();
  } else {
    document.getElementById("powermap-edit-panel").style.display = "none";
  }
}

document.addEventListener("click", (e) => {
  if (e.target.closest("#powermap-portmap-btn") && currentPduKey) {
    openPortMap(currentPduKey, false, 0, { type: "pdu" });
  }
});

function setDevicePsuCount(deviceKey, count) {
  const v = Math.min(10, Math.max(parseInt(count, 10) || 2, 1));
  const srv = typeof getServers === "function"
    ? getServers().find(s => s.id === deviceKey || s.hostname === deviceKey)
    : null;
  if (srv && typeof updateServer === "function") {
    updateServer(srv.id, { ...srv, psuCount: String(v) });
  }
  if (typeof readLocalSwitches === "function") {
    const list = readLocalSwitches();
    const sw = list.find(s => s.name === deviceKey);
    if (sw) {
      sw.psuCount = String(v);
      if (typeof saveLocalSwitch === "function") saveLocalSwitch(sw);
      if (typeof window.reloadAssetRow === "function") window.reloadAssetRow(deviceKey);
    }
  }
  if (typeof readLocalAccessories === "function") {
    const list = readLocalAccessories();
    const acc = list.find(x => x.name === deviceKey);
    if (acc) {
      acc.psuCount = String(v);
      if (typeof saveLocalAccessory === "function") saveLocalAccessory(acc);
      if (typeof window.reloadAssetRow === "function") window.reloadAssetRow(deviceKey);
    }
  }
  if (typeof window.reloadServerList === "function") window.reloadServerList();
  if (srv) {
    const svo = document.getElementById("srv-view-overlay");
    const svb = document.getElementById("srv-view-body");
    if (svo && svb && svo.classList && svo.classList.contains && svo.classList.contains("open")) {
      const fresh = typeof getServers === "function" ? getServers().find(s => s.id === srv.id) : null;
      if (fresh && typeof buildServerSummaryHTML === "function") svb.innerHTML = buildServerSummaryHTML(fresh);
    }
  }
  openPowerMap(deviceKey, false, v);
}

    

