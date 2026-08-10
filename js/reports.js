
/* ============================================
   RackView — Reports
   Agregasi data: rack-data / port-data / pdu-data
   Tab: Asset · Kapasitas & Utilisasi · Jaringan · Operasional
   Export CSV per tab aktif.
   ============================================ */

(function () {
  const repSite = document.getElementById("rep-site");
  const repPeriod = document.getElementById("rep-period");
  const exportBtn = document.getElementById("export-btn");
  let activeTab = "asset";

  const site = () => repSite.value;
  const filteredRacks = () => site() === "all" ? RACKS : RACKS.filter(r => r.site === site());
  const filteredPDUs = () => site() === "all" ? PDU_DATA : PDU_DATA.filter(p => p.site === site());

  const fmt = n => (n || 0).toLocaleString("id-ID");
  const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;
  const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rackBadge = s => s === "degraded"
    ? '<span class="badge warning"><span class="bdot"></span>Degraded</span>'
    : s === "maintenance"
      ? '<span class="badge maintenance"><span class="bdot"></span>Maintenance</span>'
      : '<span class="badge online"><span class="bdot"></span>Online</span>';
  const pduBadge = s => s === "online"
    ? '<span class="badge online"><span class="bdot"></span>Online</span>'
    : s === "maintenance"
      ? '<span class="badge maintenance"><span class="bdot"></span>Maintenance</span>'
      : '<span class="badge offline"><span class="bdot"></span>Offline</span>';
  const barHtml = v => {
    const n = parseInt(v, 10) || 0;
    return `<div class="cell-pct"><div class="pct-bar"><div class="pct-fill ${n >= 90 ? "crit" : n >= 78 ? "warn" : ""}" style="width:${Math.min(100, n)}%"></div></div><span class="pct-num">${v}</span></div>`;
  };
  const outletHtml = v => {
    const parts = String(v).split("/");
    const n = parts.length === 2 ? Math.round((parseInt(parts[0], 10) / parseInt(parts[1], 10)) * 100) : 0;
    return `<div class="cell-pct"><div class="pct-bar"><div class="pct-fill ${n >= 90 ? "crit" : n >= 78 ? "warn" : ""}" style="width:${Math.min(100, n)}%"></div></div><span class="pct-num">${v}</span></div>`;
  };
  const statCard = (label, value, sub, icon, tone) => {
    const tones = {
      green: ["var(--accent-dim)", "var(--accent-text)"],
      blue: ["var(--info-dim)", "var(--info)"],
      violet: ["var(--violet-dim)", "var(--violet)"],
      amber: ["var(--warning-dim)", "var(--warning)"],
      red: ["var(--danger-dim)", "var(--danger)"],
      grey: ["var(--bg-surface-3)", "var(--text-muted)"],
    };
    const [bg, fg] = tones[tone] || tones.grey;
    return `<div class="card stat-card"><div class="stat-top"><span class="stat-label">${label}</span><span class="stat-icon" style="background:${bg};color:${fg};">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-delta">${sub}</div></div>`;
  };

  function col(label, key, render) {
    return { label, key, render: render || (v => esc(v)) };
  }
  function tableHtml(cols, rows) {
    const head = `<thead><tr>${cols.map(c => `<th>${c.label}</th>`).join("")}</tr></thead>`;
    const body = rows.map(r => `<tr>${cols.map(c => `<td>${c.render(r[c.key])}</td>`).join("")}</tr>`).join("");
    return head + `<tbody>${body}</tbody>`;
  }
  function tableCsv(cols, rows) {
    const q = v => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [cols.map(c => q(c.label)).join(",")];
    rows.forEach(r => lines.push(cols.map(c => q(r[c.key])).join(",")));
    return lines.join("\n");
  }
  function setTable(id, cols, rows) {
    document.getElementById(id).innerHTML = tableHtml(cols, rows);
  }

  const csvData = {};
  function storeCsv(tab, name, cols, rows) {
    csvData[tab] = csvData[tab] || [];
    csvData[tab].push({ name, cols, rows });
  }

  // ---- Tipe device untuk port utilization ----
  const PORT_TYPE_LABEL = { switch: "Network Switch", firewall: "Firewall", server: "Server", router: "Router" };

  // ================= Asset =================
  function renderAsset() {
    const racks = filteredRacks();
    const sum = k => racks.reduce((a, r) => a + r[k], 0);
    const total = sum("totalDevices");
    const server = sum("server"), sw = sum("sw"), pdu = sum("pdu");

    document.getElementById("asset-stats").innerHTML = [
      statCard("Total Asset", fmt(total), `${fmt(racks.length)} rack dikelola`, '<i class="fa-solid fa-boxes-stacked"></i>', "green"),
      statCard("Server", fmt(server), `${pct(server, total)}% dari total asset`, '<i class="fa-solid fa-server"></i>', "blue"),
      statCard("Network Switch", fmt(sw), `${pct(sw, total)}% dari total asset`, '<i class="fa-solid fa-diagram-project"></i>', "amber"),
      statCard("Rack PDU", fmt(pdu), `${pct(pdu, total)}% dari total asset`, '<i class="fa-solid fa-bolt"></i>', "violet"),
    ].join("");

    const siteRows = RACK_SITES.filter(s => site() === "all" || s.id === site()).map(s => {
      const racksSite = RACKS.filter(r => r.site === s.id);
      const ssum = k => racksSite.reduce((a, r) => a + r[k], 0);
      return {
        id: s.id,
        name: s.name,
        racks: racksSite.length,
        server: ssum("server"),
        sw: ssum("sw"),
        pdu: ssum("pdu"),
        firewall: ssum("firewall"),
        patch: ssum("patch"),
        total: racksSite.reduce((a, r) => a + r.totalDevices, 0),
      };
    });
    const siteCols = [
      col("Site", "id", v => esc(v)),
      col("Lokasi", "name", v => `<div class="strong">${esc(v)}</div>`),
      col("Rack", "racks"),
      col("Server", "server"),
      col("Switch", "sw"),
      col("PDU", "pdu"),
      col("Firewall", "firewall"),
      col("Patch", "patch"),
      col("Total", "total", v => `<span class="mono">${fmt(v)}</span>`),
    ];
    setTable("asset-site-table", siteCols, siteRows);
    storeCsv("asset", "inventaris-per-site", siteCols, siteRows);

    const types = [
      { key: "server", label: "Server", tone: "green" },
      { key: "sw", label: "Network Switch", tone: "blue" },
      { key: "pdu", label: "Rack PDU", tone: "violet" },
      { key: "firewall", label: "Firewall", tone: "amber" },
      { key: "patch", label: "Patch Panel", tone: "grey" },
    ];
    const typeRows = types.map(t => {
      const count = sum(t.key);
      return { type: t.label, count, share: pct(count, total) + "%" };
    });
    const typeCols = [
      col("Tipe", "type", v => `<div class="strong">${esc(v)}</div>`),
      col("Jumlah", "count", v => `<span class="mono">${fmt(v)}</span>`),
      col("Share", "share", barHtml),
    ];
    setTable("asset-type-bars", typeCols, typeRows);
    storeCsv("asset", "distribusi-tipe-asset", typeCols, typeRows);
  }

  // ================= Kapasitas & Utilisasi =================
  function renderCapacity() {
    const racks = filteredRacks();
    const utilList = racks.map(r => r.util);
    const avg = utilList.length ? Math.round(utilList.reduce((a, b) => a + b, 0) / utilList.length) : 0;
    const crit = utilList.filter(u => u >= 90).length;
    const warn = utilList.filter(u => u >= 78 && u < 90).length;

    let usedOut = 0, totalOut = 0;
    const pduUsageRows = filteredPDUs().map(p => {
      const pw = POWER_DATA[p.name];
      const used = pw ? pw.rows.length : p.used;
      const watt = pw ? pw.rows.reduce((a, r) => a + r.watt, 0) : 0;
      usedOut += used; totalOut += p.ports;
      return { name: p.name, site: p.site, rack: p.rack, outlet: used + "/" + p.ports, watt: watt ? fmt(watt) + " W" : "—", status: p.status };
    }).sort((a, b) => {
      const pa = a.outlet.split("/"), pb = b.outlet.split("/");
      return (parseInt(pb[0], 10) / parseInt(pb[1], 10)) - (parseInt(pa[0], 10) / parseInt(pa[1], 10));
    });

    document.getElementById("capacity-stats").innerHTML = [
      statCard("Rata-rata Utilisasi", avg + "%", `${fmt(utilList.length)} rack terhitung`, '<i class="fa-solid fa-gauge-high"></i>', "green"),
      statCard("Rack Kritis (≥90%)", fmt(crit), "Segera tambah kapasitas", '<i class="fa-solid fa-triangle-exclamation"></i>', "red"),
      statCard("Rack Warning (78–89%)", fmt(warn), "Pemantauan disarankan", '<i class="fa-solid fa-circle-exclamation"></i>', "amber"),
      statCard("PDU Outlet Terpakai", `${fmt(usedOut)}<span>/${fmt(totalOut)}</span>`, `${pct(usedOut, totalOut)}% dari seluruh outlet`, '<i class="fa-solid fa-plug-circle-bolt"></i>', "violet"),
    ].join("");

    const topRows = racks.slice().sort((a, b) => b.util - a.util).slice(0, 10).map(r => ({
      rack: r.rackId,
      site: r.site,
      devices: r.totalDevices,
      util: r.util + "%",
      status: r.status,
    }));
    const topCols = [
      col("Rack", "rack", v => `<span class="mono strong">${esc(v)}</span>`),
      col("Site", "site", v => esc(v)),
      col("Perangkat", "devices", v => `<span class="mono">${fmt(v)}</span>`),
      col("Utilisasi U", "util", barHtml),
      col("Status", "status", v => rackBadge(v)),
    ];
    setTable("rack-top-table", topCols, topRows);
    storeCsv("capacity", "top-rack-utilization", topCols, topRows);

    const pduCols = [
      col("PDU", "name", v => `<span class="mono strong">${esc(v)}</span>`),
      col("Site", "site", v => esc(v)),
      col("Rack", "rack", v => esc(v)),
      col("Outlet (terpakai/total)", "outlet", outletHtml),
      col("Beban", "watt", v => esc(v)),
      col("Status", "status", v => pduBadge(v)),
    ];
    setTable("pdu-usage-table", pduCols, pduUsageRows);
    storeCsv("capacity", "pdu-outlet-usage", pduCols, pduUsageRows);

    const portRows = Object.entries(PORT_DATA).map(([device, d]) => ({
      device,
      type: PORT_TYPE_LABEL[d.type] || d.type || "—",
      ports: d.ports,
      sfp: d.sfp,
      used: d.rows.length,
      outlet: d.rows.length + "/" + d.ports,
    }));
    const portCols = [
      col("Perangkat", "device", v => `<span class="mono strong">${esc(v)}</span>`),
      col("Tipe", "type", v => esc(v)),
      col("Total Port", "ports", v => `<span class="mono">${v}</span>`),
      col("SFP", "sfp", v => `<span class="mono">${v}</span>`),
      col("Port Terpakai", "used", v => `<span class="mono">${v}</span>`),
      col("Utilisasi", "outlet", outletHtml),
    ];
    setTable("port-util-table", portCols, portRows);
    storeCsv("capacity", "port-utilization", portCols, portRows);
  }

  // ================= Jaringan =================
  function renderNetwork() {
    const cableRows = [];
    Object.entries(PORT_DATA).forEach(([device, d]) => {
      d.rows.forEach(r => cableRows.push({ label: r.label, type: "data", from: device, to: r.dest }));
    });
    Object.entries(POWER_DATA).forEach(([device, d]) => {
      d.rows.forEach(r => cableRows.push({ label: r.label, type: "power", from: device, to: r.device }));
    });

    const dataCables = cableRows.filter(c => c.type === "data");
    const powerCables = cableRows.filter(c => c.type === "power");
    const devices = [...new Set(cableRows.map(c => c.from))];

    document.getElementById("network-stats").innerHTML = [
      statCard("Total Kabel", fmt(cableRows.length), "Cable registry terkelola", '<i class="fa-solid fa-tags"></i>', "green"),
      statCard("Kabel Data", fmt(dataCables.length), `${pct(dataCables.length, cableRows.length)}% dari total`, '<i class="fa-solid fa-ethernet"></i>', "blue"),
      statCard("Kabel Power", fmt(powerCables.length), `${pct(powerCables.length, cableRows.length)}% dari total`, '<i class="fa-solid fa-plug"></i>', "violet"),
      statCard("Device Terkoneksi", fmt(devices.length), "Unik pada data & power", '<i class="fa-solid fa-diagram-project"></i>', "amber"),
    ].join("");

    const summaryRows = [
      { cat: "Kabel Data (network)", count: dataCables.length, share: pct(dataCables.length, cableRows.length) + "%", labelled: dataCables.filter(c => c.label).length, example: (dataCables[0] && dataCables[0].label) || "—" },
      { cat: "Kabel Power", count: powerCables.length, share: pct(powerCables.length, cableRows.length) + "%", labelled: powerCables.filter(c => c.label).length, example: (powerCables[0] && powerCables[0].label) || "—" },
    ];
    const summaryCols = [
      col("Kategori", "cat", v => `<div class="strong">${esc(v)}</div>`),
      col("Jumlah", "count", v => `<span class="mono">${fmt(v)}</span>`),
      col("Share", "share", barHtml),
      col("Berlabel", "labelled", v => `<span class="mono">${fmt(v)}</span>`),
      col("Contoh Label", "example", v => `<span class="mono">${esc(v)}</span>`),
    ];
    setTable("cable-summary-table", summaryCols, summaryRows);
    storeCsv("network", "ringkasan-kabel", summaryCols, summaryRows);

    const connMap = {};
    cableRows.forEach(c => {
      connMap[c.from] = connMap[c.from] || { dataOut: 0, powerOut: 0, dests: new Set() };
      if (c.type === "data") connMap[c.from].dataOut++;
      else connMap[c.from].powerOut++;
      connMap[c.from].dests.add(c.to);
    });
    const connRows = Object.entries(connMap).map(([device, v]) => ({
      device,
      type: PORT_DATA[device] ? (PORT_TYPE_LABEL[PORT_DATA[device].type] || "—") : "Rack PDU",
      dataOut: v.dataOut,
      powerOut: v.powerOut,
      dests: v.dests.size,
    })).sort((a, b) => (b.dataOut + b.powerOut) - (a.dataOut + a.powerOut));
    const connCols = [
      col("Perangkat", "device", v => `<span class="mono strong">${esc(v)}</span>`),
      col("Tipe", "type", v => esc(v)),
      col("Kabel Data", "dataOut", v => `<span class="mono">${fmt(v)}</span>`),
      col("Kabel Power", "powerOut", v => `<span class="mono">${fmt(v)}</span>`),
      col("Tujuan Unik", "dests", v => `<span class="mono">${fmt(v)}</span>`),
    ];
    setTable("conn-table", connCols, connRows);
    storeCsv("network", "konektivitas-per-device", connCols, connRows);
  }

  // ================= Operasional =================
  const ACTIVITIES = [
    { days: 0, text: 'Asset "SRV-DB-17" ditambahkan ke Rack R2-B03', actor: "Joko S.", tag: "add" },
    { days: 0, text: "Rack R1-A08 mendekati batas power (84%)", actor: "Sistem", tag: "warn" },
    { days: 1, text: "PDU-DC4-E01 terdeteksi offline", actor: "Sistem", tag: "warn" },
    { days: 2, text: "CBL-4011 dipasang FW-EDGE-04 → PDU-R2B-U01", actor: "Dewi L.", tag: "cable" },
    { days: 3, text: "SW-ACC-04 dimasukkan jadwal maintenance", actor: "Andi P.", tag: "maint" },
    { days: 5, text: "Sinkronisasi auto-discovery selesai (DC1, DC2)", actor: "Sistem", tag: "sync" },
    { days: 8, text: "Rack R3-B07 dimasukkan ke DC3 — Surabaya", actor: "Joko S.", tag: "add" },
    { days: 12, text: "Firmware SW-CORE-01 diperbarui ke 17.9.4", actor: "Dewi L.", tag: "fw" },
    { days: 20, text: "Kabel CBL-2016 diganti (SRV-BACKUP-01 PSU-B)", actor: "Andi P.", tag: "cable" },
    { days: 33, text: "Backup konfigurasi seluruh switch berhasil", actor: "Sistem", tag: "sync" },
  ];
  const TAG_META = {
    add: ["Penambahan", "var(--accent-dim)", "var(--accent-text)"],
    warn: ["Peringatan", "var(--warning-dim)", "var(--warning)"],
    cable: ["Kabel", "var(--info-dim)", "var(--info)"],
    maint: ["Maintenance", "var(--violet-dim)", "var(--violet)"],
    sync: ["Sistem", "var(--bg-surface-3)", "var(--text-muted)"],
    fw: ["Firmware", "var(--bg-surface-3)", "var(--text-muted)"],
  };

  function renderOps() {
    const racks = filteredRacks();
    const degraded = racks.filter(r => r.status === "degraded").length;
    const maintenance = racks.filter(r => r.status === "maintenance").length;
    const pdus = filteredPDUs();
    const pduOffline = pdus.filter(p => p.status === "offline").length;
    const pduMaint = pdus.filter(p => p.status === "maintenance").length;

    document.getElementById("ops-stats").innerHTML = [
      statCard("Rack Degraded", fmt(degraded), "Perlu perhatian", '<i class="fa-solid fa-triangle-exclamation"></i>', "amber"),
      statCard("Rack Maintenance", fmt(maintenance), "Jadwal pemeliharaan", '<i class="fa-solid fa-screwdriver-wrench"></i>', "violet"),
      statCard("PDU Offline", fmt(pduOffline), "Tidak menerima telemetri", '<i class="fa-solid fa-bolt"></i>', "red"),
      statCard("PDU Maintenance", fmt(pduMaint), "Sedang diperbaiki", '<i class="fa-solid fa-wrench"></i>', "blue"),
    ].join("");

    const rackRows = racks.filter(r => r.status !== "online").map(r => ({
      rack: r.rackId,
      site: r.site,
      devices: r.totalDevices,
      util: r.util + "%",
      status: r.status,
    }));
    const rackCols = [
      col("Rack", "rack", v => `<span class="mono strong">${esc(v)}</span>`),
      col("Site", "site", v => esc(v)),
      col("Perangkat", "devices", v => `<span class="mono">${fmt(v)}</span>`),
      col("Utilisasi", "util", barHtml),
      col("Status", "status", v => rackBadge(v)),
    ];
    setTable("rack-status-table", rackCols, rackRows);
    storeCsv("ops", "rack-bermasalah", rackCols, rackRows);

    const pduRows = pdus.map(p => {
      const pw = POWER_DATA[p.name];
      const used = pw ? pw.rows.length : p.used;
      return { name: p.name, site: p.site, rack: p.rack, outlet: used + "/" + p.ports, status: p.status };
    }).sort((a, b) => (a.status === "online" ? 1 : 0) - (b.status === "online" ? 1 : 0));
    const pduCols = [
      col("PDU", "name", v => `<span class="mono strong">${esc(v)}</span>`),
      col("Site", "site", v => esc(v)),
      col("Rack", "rack", v => esc(v)),
      col("Outlet", "outlet", outletHtml),
      col("Status", "status", v => pduBadge(v)),
    ];
    setTable("pdu-status-table", pduCols, pduRows);
    storeCsv("ops", "pdu-status", pduCols, pduRows);

    const period = repPeriod.value;
    const actRows = ACTIVITIES.filter(a => period === "all" || a.days <= +period).map(a => {
      const meta = TAG_META[a.tag] || TAG_META.sync;
      return {
        time: a.days === 0 ? "Hari ini" : fmt(a.days) + " hari lalu",
        text: a.text,
        actor: a.actor,
        tagLabel: meta[0],
        tagBg: meta[1],
        tagFg: meta[2],
      };
    });
    const actCols = [
      col("Waktu", "time", v => `<span class="mono" style="font-size:12px;">${esc(v)}</span>`),
      col("Aktivitas", "text", v => `<div class="strong">${esc(v)}</div>`),
      col("Oleh", "actor", v => esc(v)),
      col("Jenis", "tagLabel", v => `<span style="display:inline-block;background:${v === "Penambahan" ? "var(--accent-dim)" : v === "Peringatan" ? "var(--warning-dim)" : v === "Kabel" ? "var(--info-dim)" : v === "Maintenance" ? "var(--violet-dim)" : "var(--bg-surface-3)"};color:${v === "Penambahan" ? "var(--accent-text)" : v === "Peringatan" ? "var(--warning)" : v === "Kabel" ? "var(--info)" : v === "Maintenance" ? "var(--violet)" : "var(--text-muted)"};padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;">${esc(v)}</span>`),
    ];
    setTable("activity-table", actCols, actRows);
    storeCsv("ops", "aktivitas-terbaru", actCols, actRows);
  }

  function renderAll() {
    csvData.asset = []; csvData.capacity = []; csvData.network = []; csvData.ops = [];
    renderAsset();
    renderCapacity();
    renderNetwork();
    renderOps();
  }

  // ---- export CSV tab aktif ----
  function downloadCsv(filename, content) {
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 200);
  }
  function exportActive() {
    const ds = csvData[activeTab] || [];
    if (!ds.length) return;
    const siteLabel = site() === "all" ? "semua-site" : site();
    const period = repPeriod.value === "all" ? "semua" : repPeriod.value + "hari";
    const parts = ds.map(d => "# " + d.name.toUpperCase() + "\n" + tableCsv(d.cols, d.rows));
    downloadCsv(`reports-${activeTab}-${siteLabel}-${period}.csv`, parts.join("\n\n"));
  }

  // ---- events ----
  document.querySelectorAll(".report-tabs .tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".report-tabs .tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".report-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.querySelector(`.report-panel[data-panel="${btn.dataset.tab}"]`).classList.add("active");
      activeTab = btn.dataset.tab;
    });
  });
  repSite.addEventListener("change", renderAll);
  repPeriod.addEventListener("change", () => { renderOps(); });
  exportBtn.addEventListener("click", exportActive);

  renderAll();
})();
