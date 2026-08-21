/* dashboard-ops.js — KPI Operasional di Dashboard.
   Mengambil data dari mesin OPS (js/ops.js) via OPS.load(kind) dengan
   API-first + fallback localStorage. Section disembunyikan bila OPS
   tidak tersedia (mis. ops.js gagal dimuat). */

(function () {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const SEV_CLASS = { critical: "error", high: "error", medium: "warning", low: "maintenance" };
  const STATUS_LABELS = {
    open: "Open", in_progress: "Dikerjakan", resolved: "Resolved", closed: "Ditutup",
    planned: "Rencana", completed: "Selesai", cancelled: "Dibatalkan",
    scheduled: "Terjadwal", overdue: "Terlambat",
  };
  const STATUS_CLASS = {
    open: "warning", in_progress: "warning", planned: "warning",
    scheduled: "maintenance", overdue: "error",
    resolved: "completed", completed: "completed", closed: "disabled", cancelled: "error",
  };

  function badge(label, cls) {
    return '<span class="badge ' + (cls || "disabled") + '"><span class="bdot"></span>' + esc(label) + '</span>';
  }
  function sevBadge(sev) {
    const label = { critical: "Critical", high: "High", medium: "Medium", low: "Low" }[sev] || sev || "—";
    return badge(label, SEV_CLASS[sev] || "disabled");
  }
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function readDashDate() {
    const from = document.getElementById("ops-dash-from")?.value || "";
    const to = document.getElementById("ops-dash-to")?.value || "";
    return { from, to };
  }
  function parseTs(v) {
    if (!v) return null;
    const m = String(v).match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : null;
  }
  function hoursBetween(a, b) {
    if (!a || !b || b < a) return null;
    return Math.round((b - a) / 3600000 * 10) / 10;
  }
  function effStatus(r) {
    return (r.status === "scheduled" && r.scheduled_at && r.scheduled_at < todayStr()) ? "overdue" : r.status;
  }
  function emptyRow(body, cols, msg) {
    body.innerHTML = '<tr><td colspan="' + cols + '" style="color:var(--text-muted);padding:16px;">' + esc(msg) + '</td></tr>';
  }
  function setStat(id, value, sub) {
    const e = document.getElementById(id);
    if (e) e.textContent = value == null ? "—" : String(value);
    const s = document.getElementById(id + "-sub");
    if (s && sub) s.textContent = sub;
  }

  function renderStats(visits, incidents, maintenance) {
    const { from, to } = readDashDate();
    const fVisits = OPS.filterByDateRange(visits, "tanggal", from, to);
    const fIncidents = OPS.filterByDateRange(incidents, "created_at", from, to);
    const fMaintenance = OPS.filterByDateRange(maintenance, "scheduled_at", from, to);
    const active = fIncidents.filter(r => r.status === "open" || r.status === "in_progress");
    setStat("ops-stat-active-inc", active.length, active.length ? active.length + " insiden belum selesai" : "tidak ada insiden aktif");

    const resolved = fIncidents
      .filter(r => r.status === "resolved" || r.status === "closed")
      .map(r => hoursBetween(parseTs(r.occurred_at || r.created_at), parseTs(r.resolved_at)))
      .filter(v => v != null);
    const mttr = resolved.length ? resolved.reduce((a, b) => a + b, 0) / resolved.length : null;
    setStat("ops-stat-mttr", mttr == null ? "—" : mttr + " jam", resolved.length ? "rata-rata " + resolved.length + " insiden resolved" : "belum ada insiden resolved");

    const overdue = fMaintenance.filter(r => effStatus(r) === "overdue").length;
    setStat("ops-stat-overdue", overdue, overdue ? "segera ditindaklanjuti" : "tidak ada jadwal terlambat");

    const today = todayStr();
    const vtAll = fVisits.filter(r => r.tanggal === today);
    const vtOpen = vtAll.filter(r => r.status !== "completed" && r.status !== "cancelled");
    setStat("ops-stat-visits-today", vtAll.length, vtOpen.length ? vtOpen.length + " belum selesai" : vtAll.length ? "semua kunjungan selesai" : "tidak ada kunjungan hari ini");
  }

  function renderIncidents(incidents) {
    const body = document.getElementById("ops-inc-active-body");
    if (!body) return;
    const { from, to } = readDashDate();
    const rows = OPS.filterByDateRange(incidents, "created_at", from, to)
      .filter(r => r.status === "open" || r.status === "in_progress")
      .sort((a, b) => (parseTs(b.created_at) || 0) - (parseTs(a.created_at) || 0))
      .slice(0, 5);
    if (!rows.length) { emptyRow(body, 6, "Tidak ada insiden aktif."); return; }
    body.innerHTML = rows.map(r => {
      const a = parseTs(r.occurred_at || r.created_at);
      const b = new Date();
      const diffMin = a ? Math.round((b - a) / 60000) : null;
      const dur = diffMin == null ? "—" : (diffMin < 60 ? diffMin + " menit" : Math.floor(diffMin / 60) + " jam" + (diffMin % 60 ? " " + (diffMin % 60) + " menit" : ""));
      return '<tr><td class="mono">' + esc(r.no || r.id) + '</td>' +
        '<td class="strong">' + esc(r.title || "") + (r.asset ? '<div class="mono" style="font-size:11px;color:var(--text-muted);margin-top:2px;">' + esc(r.asset) + '</div>' : "") + '</td>' +
        '<td>' + sevBadge(r.severity) + '</td>' +
        '<td>' + esc(OPS.siteName(r.site)) + '</td>' +
        '<td class="mono">' + esc(dur) + '</td>' +
        '<td>' + badge(STATUS_LABELS[r.status] || r.status, STATUS_CLASS[r.status]) + '</td></tr>';
    }).join("");
  }

  function renderMaintenance(maintenance) {
    const body = document.getElementById("ops-mt-body");
    if (!body) return;
    const { from, to } = readDashDate();
    const TYPE_LABELS = { preventive: "Preventive", corrective: "Corrective", upgrade: "Upgrade" };
    const rows = OPS.filterByDateRange(maintenance, "scheduled_at", from, to)
      .map(r => Object.assign({}, r, { _s: effStatus(r) }))
      .filter(r => r._s === "scheduled" || r._s === "overdue" || r._s === "in_progress")
      .sort((a, b) => String(a.scheduled_at || "").localeCompare(String(b.scheduled_at || "")))
      .slice(0, 5);
    if (!rows.length) { emptyRow(body, 4, "Tidak ada maintenance terjadwal."); return; }
    body.innerHTML = rows.map(r =>
      '<tr><td class="mono">' + esc(r.no || r.id) + '</td>' +
      '<td class="strong">' + esc(r.title || "") + (r.type ? '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">' + esc(TYPE_LABELS[r.type] || r.type) + '</div>' : "") + '</td>' +
      '<td class="mono">' + esc(r.scheduled_at || "—") + '</td>' +
      '<td>' + badge(STATUS_LABELS[r._s] || r._s, STATUS_CLASS[r._s]) + '</td></tr>'
    ).join("");
  }

  function renderVisits(visits) {
    const body = document.getElementById("ops-visits-body");
    if (!body) return;
    const { from, to } = readDashDate();
    const TUJUAN_LABELS = {
      audit: "Audit", troubleshooting: "Troubleshooting", preventive: "Preventive",
      instalasi: "Instalasi", dekomisioning: "Dekomisioning", daily: "Cek Harian",
    };
    const rows = OPS.filterByDateRange(visits, "tanggal", from, to)
      .filter(r => r.status === "planned" || r.status === "in_progress")
      .sort((a, b) => String(a.tanggal || "").localeCompare(String(b.tanggal || "")))
      .slice(0, 5);
    if (!rows.length) { emptyRow(body, 5, "Tidak ada kunjungan terjadwal."); return; }
    body.innerHTML = rows.map(r =>
      '<tr><td class="mono">' + esc(r.no || r.id) + '</td>' +
      '<td class="mono">' + esc(r.tanggal || "—") + '</td>' +
      '<td class="strong">' + esc(TUJUAN_LABELS[r.tujuan] || r.tujuan || "—") + '</td>' +
      '<td>' + esc(OPS.siteName(r.site)) + '</td>' +
      '<td>' + badge(STATUS_LABELS[r.status] || r.status, STATUS_CLASS[r.status]) + '</td></tr>'
    ).join("");
  }

  function renderIncBySite(incidents) {
    const body = document.getElementById("ops-inc-site-body");
    if (!body) return;
    const { from, to } = readDashDate();
    const map = {};
    OPS.filterByDateRange(incidents, "created_at", from, to).forEach(r => {
      const site = r.site || "(tanpa site)";
      const entry = (map[site] = map[site] || { active: 0, resolved: 0, total: 0 });
      entry.total++;
      if (r.status === "open" || r.status === "in_progress") entry.active++;
      if (r.status === "resolved" || r.status === "closed") entry.resolved++;
    });
    const sites = Object.keys(map).sort((a, b) => map[b].total - map[a].total);
    if (!sites.length) { emptyRow(body, 4, "Belum ada data insiden."); return; }
    body.innerHTML = sites.map(s =>
      '<tr><td class="strong">' + esc(OPS.siteName(s)) + '</td><td class="mono">' + map[s].active + '</td><td class="mono">' + map[s].resolved + '</td><td class="mono">' + map[s].total + '</td></tr>'
    ).join("");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      if (typeof OPS === "undefined" || typeof OPS.load !== "function") throw new Error("ops.js tidak dimuat");
      if (typeof OPS.refreshSites === "function") await OPS.refreshSites();
      const visits = (await OPS.load("visits")) || [];
      const incidents = (await OPS.load("incidents")) || [];
      const maintenance = (await OPS.load("maintenance")) || [];
      renderStats(visits, incidents, maintenance);
      renderIncidents(incidents);
      renderMaintenance(maintenance);
      renderVisits(visits);
      renderIncBySite(incidents);
    } catch (e) {
      const sec = document.getElementById("ops-kpi-section");
      if (sec) sec.style.display = "none";
    }
  });
})();
