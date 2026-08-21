/* ============================================
   RackView — Capacity Plan
   Proyeksi kebutuhan kapasitas dari data inventori:
   - KPI forecast: free U, power headroom, port headroom
   - Rack exhaustion projection (78% / 90%) dengan growth rate
   - Site capacity score (U + daya + port)
   - PDU outlet & power forecast
   - Rekomendasi ekspansi (rack util terendah di site kritis)
   Sumber: RACKS (rack-data.js), PDU_DATA/POWER_DATA (pdu-data.js),
           PORT_DATA (port-data.js), RACK_SITES.
   ============================================ */

(function () {
  if (typeof authGuard === "function" && !authGuard()) return;

  const RACK_SIZE = 42;

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = n => (n == null || isNaN(n)) ? "—" : Number(n).toLocaleString("id-ID");
  const fmt1 = n => (n == null || isNaN(n)) ? "—" : Number(n).toLocaleString("id-ID", { maximumFractionDigits: 1 });

  const elSite = document.getElementById("cp-site");
  const elGrowth = document.getElementById("cp-growth");
  const elGrowthVal = document.getElementById("cp-growth-val");
  const elSearch = document.getElementById("cp-search");
  const elExport = document.getElementById("cp-export");

  const siteFilter = () => elSite.value;
  const growthRate = () => parseFloat(elGrowth.value) || 0;
  const searchQ = () => (elSearch.value || "").trim().toLowerCase();

  const filteredRacks = () => {
    const s = siteFilter();
    return s === "all" ? RACKS : RACKS.filter(r => r.site === s);
  };
  const filteredPDUs = () => {
    const s = siteFilter();
    return s === "all" ? PDU_DATA : PDU_DATA.filter(p => p.site === s);
  };

  // ---- Utilisasi U terpakai per rack (dari util %) ----
  function usedU(r) { return Math.round((r.util || 0) / 100 * RACK_SIZE); }
  function freeU(r) { return Math.max(0, RACK_SIZE - usedU(r)); }

  // ---- Proyeksi bulan menuju ambang util% dgn growth rate majemuk ----
  // util_now * (1+g)^n = target  =>  n = ln(target/util_now) / ln(1+g)
  function monthsTo(utilNow, target, g) {
    if (utilNow >= target) return 0;
    if (g <= 0) return null; // tidak akan tercapai tanpa pertumbuhan
    return Math.log(target / utilNow) / Math.log(1 + g / 100);
  }

  function monthLabel(n) {
    if (n == null) return '<span class="cp-months ok">∞</span>';
    if (n === 0) return '<span class="cp-months crit">Sekarang</span>';
    if (n < 6) return '<span class="cp-months crit">±' + Math.round(n) + ' bln</span>';
    if (n < 24) return '<span class="cp-months warn">±' + Math.round(n) + ' bln</span>';
    return '<span class="cp-months ok">±' + Math.round(n) + ' bln</span>';
  }

  function scoreBadge(score) {
    if (score >= 90) return '<span class="cp-badge crit">Kritis</span>';
    if (score >= 70) return '<span class="cp-badge warn">Waspada</span>';
    return '<span class="cp-badge good">Sehat</span>';
  }

  // ---- Power: beban watt per site & headroom (dari POWER_DATA) ----
  function powerBySite() {
    const map = {};
    Object.keys(POWER_DATA || {}).forEach(pdu => {
      const pduInfo = PDU_DATA.find(p => p.name === pdu);
      const site = pduInfo ? pduInfo.site : "?";
      const watts = (POWER_DATA[pdu].rows || []).reduce((a, r) => a + (r.watt || 0), 0);
      map[site] = map[site] || 0;
      map[site] += watts;
    });
    return map;
  }

  // ---- Port: used/total per site (dari PORT_DATA) ----
  function portBySite() {
    const map = {};
    Object.keys(PORT_DATA || {}).forEach(dev => {
      const d = PORT_DATA[dev];
      const used = (d.rows || []).length;
      const total = (d.ports || 0) + (d.sfp || 0);
      const site = rackSiteOf(dev);
      map[site] = map[site] || { used: 0, total: 0 };
      map[site].used += used;
      map[site].total += total;
    });
    return map;
  }

  function rackSiteOf(deviceKey) {
    const r = RACKS.find(rk => rk.rackId === (deviceDataRack(deviceKey)));
    return r ? r.site : "";
  }
  function deviceDataRack(deviceKey) {
    // Fallback: cari rack dari RACK_LAYOUTS bila tersedia
    if (typeof RACK_LAYOUTS === "undefined") return "";
    for (const rackId in RACK_LAYOUTS) {
      const lays = RACK_LAYOUTS[rackId];
      if (Array.isArray(lays) && lays.some(l => l.name === deviceKey)) return rackId;
    }
    return "";
  }

  function statCard(label, value, sub, icon, tone) {
    const tones = {
      green: ["var(--accent-dim)", "var(--accent-text)"],
      blue: ["var(--info-dim)", "var(--info)"],
      violet: ["var(--violet-dim)", "var(--violet)"],
      amber: ["var(--warning-dim)", "var(--warning)"],
      red: ["var(--danger-dim)", "var(--danger)"],
      grey: ["var(--bg-surface-3)", "var(--text-muted)"],
    };
    const [bg, fg] = tones[tone] || tones.grey;
    return '<div class="card stat-card"><div class="stat-top"><span class="stat-label">' + label + '</span><span class="stat-icon" style="background:' + bg + ';color:' + fg + ';">' + icon + '</span></div><div class="stat-value">' + value + '</div><div class="stat-delta">' + sub + '</div></div>';
  }

  function tableHtml(cols, rows) {
    if (!rows.length) return '<tr><td colspan="' + cols.length + '" style="color:var(--text-muted);padding:16px;">Tidak ada data.</td></tr>';
    const head = '<thead><tr>' + cols.map(c => "<th>" + c.label + "</th>").join("") + "</tr></thead>";
    const body = rows.map(r => "<tr>" + cols.map(c => "<td>" + (c.render ? c.render(r[c.key], r) : esc(r[c.key])) + "</td>").join("") + "</tr>").join("");
    return head + "<tbody>" + body + "</tbody>";
  }
  function setTable(id, cols, rows) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = tableHtml(cols, rows);
  }

  function render() {
    const g = growthRate();
    const q = searchQ();
    const racks = filteredRacks().filter(r => !q || String(r.rackId + " " + (r.siteName || "")).toLowerCase().indexOf(q) >= 0);
    const pdus = filteredPDUs();
    const sites = RACK_SITES.filter(s => siteFilter() === "all" || s.id === siteFilter());
    const powerMap = powerBySite();
    const portMap = portBySite();

    // ---------- KPI ----------
    const freeUTotal = racks.reduce((a, r) => a + freeU(r), 0);
    const racksTotal = racks.length;
    const uUsed = racks.reduce((a, r) => a + usedU(r), 0);
    const uBudget = racksTotal * RACK_SIZE;

    const pduOutUsed = pdus.reduce((a, p) => a + (p.used || 0), 0);
    const pduOutTotal = pdus.reduce((a, p) => a + (p.ports || 0), 0);
    const powerUsedKw = Object.values(powerMap).reduce((a, b) => a + b, 0) / 1000;

    let portUsed = 0, portTotal = 0;
    Object.keys(portMap).forEach(s => { portUsed += portMap[s].used; portTotal += portMap[s].total; });

    const critRacks = racks.filter(r => r.util >= 90).length;
    const warnRacks = racks.filter(r => r.util >= 78 && r.util < 90).length;

    const firstExhaust = racks
      .map(r => ({ r, m: monthsTo(r.util, 90, g) }))
      .filter(x => x.m !== null && x.m > 0)
      .sort((a, b) => a.m - b.m)[0];

    document.getElementById("cp-kpi").innerHTML = [
      statCard("Free U Tersedia", fmt(freeUTotal) + '<span style="font-size:12px;color:var(--text-muted);"> / ' + fmt(uBudget) + '</span>', pct(uUsed, uBudget) + "% U terpakai dari seluruh rack", '<i class="fa-solid fa-server"></i>', freeUTotal / uBudget > 0.3 ? "green" : "amber"),
      statCard("Rack Kritis (≥90%)", fmt(critRacks), warnRacks ? fmt(warnRacks) + " rack warning (78–89%)" : "tidak ada warning", '<i class="fa-solid fa-triangle-exclamation"></i>', critRacks ? "red" : warnRacks ? "amber" : "green"),
      statCard("Daya Terpakai", fmt1(powerUsedKw) + '<span style="font-size:12px;color:var(--text-muted);"> kW</span>', "Agregat dari PDU power map", '<i class="fa-solid fa-plug-circle-bolt"></i>', powerUsedKw > 20 ? "red" : powerUsedKw > 10 ? "amber" : "violet"),
      statCard("Rack Pertama Penuh", firstExhaust ? (firstExhaust.r.rackId + " · " + Math.round(firstExhaust.m) + " bln") : "—", "Menuju 90% pada growth saat ini", '<i class="fa-solid fa-hourglass-half"></i>', firstExhaust && firstExhaust.m < 12 ? "red" : firstExhaust && firstExhaust.m < 24 ? "amber" : "green"),
    ].join("");

    // ---------- Site Capacity Score ----------
    const siteRows = sites.map(s => {
      const sRacks = racks.filter(r => r.site === s.id);
      const su = sRacks.reduce((a, r) => a + usedU(r), 0);
      const sb = sRacks.length * RACK_SIZE;
      const uPct = sb ? Math.round(su / sb * 100) : 0;
      const p = powerMap[s.id] || 0;
      const ports = portMap[s.id] || { used: 0, total: 0 };
      const portPct = ports.total ? Math.round(ports.used / ports.total * 100) : 0;
      const score = Math.round(uPct * 0.6 + (p > 0 ? Math.min(100, p / 5) * 0.25 : 0) + portPct * 0.15);
      return {
        id: s.id,
        name: s.name,
        racks: sRacks.length,
        freeU: sRacks.reduce((a, r) => a + freeU(r), 0),
        uPct,
        powerKw: fmt1(p / 1000),
        portPct,
        score: Math.min(100, score),
      };
    }).sort((a, b) => b.score - a.score);

    setTable("cp-site-table", [
      { label: "Site", key: "id", render: v => '<span class="mono strong">' + esc(v) + '</span>' },
      { label: "Lokasi", key: "name", render: v => '<div class="strong">' + esc(v) + '</div>' },
      { label: "Rack", key: "racks" },
      { label: "Free U", key: "freeU", render: v => '<span class="mono">' + fmt(v) + '</span>' },
      { label: "Utilisasi U", key: "uPct", render: v => barHtml(v) },
      { label: "Daya (kW)", key: "powerKw", render: v => '<span class="mono">' + esc(v) + '</span>' },
      { label: "Port", key: "portPct", render: v => barHtml(v) },
      { label: "Skor", key: "score", render: v => scoreBadge(v) },
    ], siteRows);

    // ---------- Rack Exhaustion ----------
    const rackRows = racks
      .map(r => {
        const m90 = monthsTo(r.util, 90, g);
        const m78 = monthsTo(r.util, 78, g);
        return {
          rack: r.rackId,
          site: r.site,
          devices: r.totalDevices,
          freeU: freeU(r),
          util: r.util,
          m78,
          m90,
          status: r.status,
        };
      })
      .sort((a, b) => {
        const ma = a.m90 == null ? 9999 : a.m90;
        const mb = b.m90 == null ? 9999 : b.m90;
        return ma - mb;
      });

    setTable("cp-rack-table", [
      { label: "Rack", key: "rack", render: v => '<span class="mono strong">' + esc(v) + '</span>' },
      { label: "Site", key: "site", render: v => esc(v) },
      { label: "Free U", key: "freeU", render: v => '<span class="mono">' + fmt(v) + '</span>' },
      { label: "Utilisasi", key: "util", render: v => barHtml(v) },
      { label: "Ke 78%", key: "m78", render: v => monthLabel(v) },
      { label: "Ke 90%", key: "m90", render: v => monthLabel(v) },
      { label: "Status", key: "status", render: v => rackBadge(v) },
    ], rackRows.slice(0, 50));

    // ---------- PDU Forecast ----------
    const pduRows = pdus.map(p => {
      const used = p.used || 0;
      const total = p.ports || 0;
      const pctNow = total ? Math.round(used / total * 100) : 0;
      const mFull = monthsTo(pctNow, 100, g);
      const pw = POWER_DATA[p.name];
      const watt = pw ? pw.rows.reduce((a, r) => a + (r.watt || 0), 0) : 0;
      return {
        name: p.name,
        site: p.site,
        rack: p.rack,
        used,
        total,
        pctNow,
        mFull,
        watt,
        status: p.status,
      };
    }).sort((a, b) => {
      const ma = a.mFull == null ? 9999 : a.mFull;
      const mb = b.mFull == null ? 9999 : b.mFull;
      return ma - mb;
    });

    setTable("cp-pdu-table", [
      { label: "PDU", key: "name", render: v => '<span class="mono strong">' + esc(v) + '</span>' },
      { label: "Site / Rack", key: "rack", render: (v, r) => esc(r.site + " · " + v) },
      { label: "Outlet", key: "used", render: (v, r) => '<span class="mono">' + v + '/' + r.total + '</span>' },
      { label: "Utilisasi", key: "pctNow", render: v => barHtml(v) },
      { label: "Ke Penuh", key: "mFull", render: v => monthLabel(v) },
      { label: "Beban", key: "watt", render: v => '<span class="mono">' + (v ? fmt(v) + " W" : "—") + '</span>' },
      { label: "Status", key: "status", render: v => pduBadge(v) },
    ], pduRows);

    // ---------- Rekomendasi Ekspansi ----------
    const recRows = [];
    sites.forEach(s => {
      const sRacks = RACKS.filter(r => r.site === s.id);
      const su = sRacks.reduce((a, r) => a + usedU(r), 0);
      const sb = sRacks.length * RACK_SIZE;
      const uPct = sb ? Math.round(su / sb * 100) : 0;
      if (uPct >= 78) {
        const best = sRacks.slice().sort((a, b) => (a.util || 0) - (b.util || 0)).slice(0, 3);
        recRows.push({
          site: s.id,
          reason: "Utilisasi site " + uPct + "% ≥ 78%",
          target: best.map(r => r.rackId + " (" + r.util + "%)").join(", "),
        });
      }
    });
    if (!recRows.length) {
      recRows.push({ site: "—", reason: "Semua site masih sehat (utilisasi < 78%)", target: "Tidak perlu ekspansi saat ini" });
    }

    setTable("cp-rec-table", [
      { label: "Site", key: "site", render: v => '<span class="mono strong">' + esc(v) + '</span>' },
      { label: "Alasan", key: "reason", render: v => esc(v) },
      { label: "Rack Target", key: "target", render: v => esc(v) },
    ], recRows);
  }

  function barHtml(v) {
    const n = parseInt(v, 10) || 0;
    const cls = n >= 90 ? "crit" : n >= 78 ? "warn" : "";
    return '<div class="cell-pct"><div class="pct-bar"><div class="pct-fill ' + cls + '" style="width:' + Math.min(100, n) + '%"></div></div><span class="pct-num">' + n + '%</span></div>';
  }
  function rackBadge(s) {
    if (s === "degraded") return '<span class="badge warning"><span class="bdot"></span>Degraded</span>';
    if (s === "maintenance") return '<span class="badge maintenance"><span class="bdot"></span>Maintenance</span>';
    return '<span class="badge online"><span class="bdot"></span>Online</span>';
  }
  function pduBadge(s) {
    if (s === "online") return '<span class="badge online"><span class="bdot"></span>Online</span>';
    if (s === "maintenance") return '<span class="badge maintenance"><span class="bdot"></span>Maintenance</span>';
    return '<span class="badge offline"><span class="bdot"></span>Offline</span>';
  }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }

  // ---- export CSV ----
  function downloadCsv(filename, content) {
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 200);
  }
  function tableCsv(cols, rows) {
    const q = v => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = [cols.map(c => q(c.label)).join(",")];
    rows.forEach(r => lines.push(cols.map(c => q(c.render ? c.render(r[c.key], r).replace(/<[^>]+>/g, "") : r[c.key])).join(",")));
    return lines.join("\n");
  }
  function collectAll() {
    const g = growthRate();
    const racks = filteredRacks();
    const pdus = filteredPDUs();
    const sites = RACK_SITES.filter(s => siteFilter() === "all" || s.id === siteFilter());
    const powerMap = powerBySite();
    const portMap = portBySite();
    const rackRows = racks.map(r => ({
      rack: r.rackId, site: r.site, freeU: freeU(r), util: r.util + "%",
      ke78: monthLabel(monthsTo(r.util, 78, g)).replace(/<[^>]+>/g, ""),
      ke90: monthLabel(monthsTo(r.util, 90, g)).replace(/<[^>]+>/g, ""),
    }));
    const siteRows = sites.map(s => {
      const sRacks = racks.filter(r => r.site === s.id);
      const su = sRacks.reduce((a, r) => a + usedU(r), 0);
      const sb = sRacks.length * RACK_SIZE;
      return { site: s.id, name: s.name, racks: sRacks.length, freeU: sRacks.reduce((a, r) => a + freeU(r), 0), utilU: sb ? Math.round(su / sb * 100) + "%" : "0%", dayaKW: fmt1((powerMap[s.id] || 0) / 1000) };
    });
    return {
      kpi: [
        { label: "Free U Tersedia", value: freeUTotal(racks) },
        { label: "Rack Kritis (≥90%)", value: racks.filter(r => r.util >= 90).length },
        { label: "Daya Terpakai (kW)", value: fmt1(Object.values(powerMap).reduce((a, b) => a + b, 0) / 1000) },
      ],
      site: siteRows,
      rack: rackRows,
      pdu: pdus.map(p => ({ name: p.name, site: p.site, rack: p.rack, outlet: (p.used || 0) + "/" + (p.ports || 0) })),
    };
  }
  function freeUTotal(racks) { return racks.reduce((a, r) => a + freeU(r), 0); }

  elGrowth.addEventListener("input", () => { elGrowthVal.textContent = elGrowth.value + "% / bln"; render(); });
  elSite.addEventListener("change", render);
  elSearch.addEventListener("input", render);

  if (elExport) elExport.addEventListener("click", () => {
    const d = collectAll();
    const g = growthRate();
    downloadCsv("capacity-plan-" + (siteFilter() === "all" ? "semua-site" : siteFilter()) + "-g" + g + ".csv", [
      "# CAPACITY PLAN",
      "# Growth rate: " + g + "%/bln · Data: " + new Date().toLocaleDateString("id-ID"),
      "",
      "# KPI",
      tableCsv([{ label: "Metrik" }, { label: "Nilai" }], d.kpi.map(k => ({ Metrik: k.label, Nilai: k.value }))),
      "",
      "# SITE",
      tableCsv([{ label: "Site" }, { label: "Nama" }, { label: "Rack" }, { label: "Free U" }, { label: "Util U" }, { label: "Daya kW" }], d.site),
      "",
      "# RACK",
      tableCsv([{ label: "Rack" }, { label: "Site" }, { label: "Free U" }, { label: "Util" }, { label: "Ke 78%" }, { label: "Ke 90%" }], d.rack),
      "",
      "# PDU",
      tableCsv([{ label: "PDU" }, { label: "Site" }, { label: "Rack" }, { label: "Outlet" }], d.pdu),
    ].join("\n"));
  });

  // default growth dari frekuensi maintenance (proxy aktivitas) bila backend aktif
  (function defaultGrowth() {
    try {
      if (typeof apiRequest === "function") {
        const rows = apiRequest("GET", "/maintenance");
        if (Array.isArray(rows) && rows.length) {
          const last30 = rows.filter(r => {
            const d = String(r.scheduled_at || r.created_at || "").slice(0, 10);
            if (!/\d{4}-\d{2}-\d{2}/.test(d)) return false;
            const dt = new Date(d + "T00:00:00");
            return (Date.now() - dt.getTime()) <= 30 * 86400000;
          }).length;
          const suggested = Math.min(10, Math.max(1, Math.round(last30 / 3)));
          elGrowth.value = suggested;
          elGrowthVal.textContent = suggested + "% / bln";
        }
      }
    } catch (e) { /* fallback ke default 2% */ }
  })();

  render();
})();