/* rack-ops.js — Integrasi data operasional (Maintenance & Incident Report)
   dengan halaman Rack Elevation & Sites.
   Menyediakan:
   - RackOps.loadMaintenance() / loadIncidents()  → data via OPS.load (API-first, fallback localStorage)
   - RackOps.activeMaintenance(siteId)            → maintenance aktif (scheduled/in_progress) per site
   - RackOps.rackHistory(rackId)                  → incident + maintenance untuk satu rack
   - RackOps.activeRacks()                        → rackId yang punya maintenance aktif (dari record)
   Membutuhkan js/ops.js (window.OPS). */
(function () {
  const RO = window.RackOps = window.RackOps || {};

  // Status yang dianggap "masih berjalan" — maintenance di luar ini (completed/
  // cancelled/closed) tidak dimunculkan sebagai alert aktif.
  const ACTIVE = ["scheduled", "in_progress"];

  let maintenanceCache = null;
  let incidentsCache = null;

  const canon = s => String(s == null ? "" : s).trim().toUpperCase().replace(/\s+/g, " ");

  RO.loadMaintenance = async function () {
    if (maintenanceCache) return maintenanceCache;
    try {
      const rows = await OPS.load("maintenance");
      maintenanceCache = Array.isArray(rows) ? rows : [];
    } catch (e) { maintenanceCache = []; }
    return maintenanceCache;
  };

  RO.loadIncidents = async function () {
    if (incidentsCache) return incidentsCache;
    try {
      const rows = await OPS.load("incidents");
      incidentsCache = Array.isArray(rows) ? rows : [];
    } catch (e) { incidentsCache = []; }
    return incidentsCache;
  };

  // Reset cache (mis. setelah ada record baru) — dipakai modul OPS bila perlu.
  RO.reset = function () { maintenanceCache = null; incidentsCache = null; };

  // Maintenance aktif untuk sebuah site (site.id → id). Juga cocokkan bila
  // record lama menyimpan nama tampilan (fallback normalize read-time).
  RO.activeMaintenance = async function (siteId) {
    const rows = await RO.loadMaintenance();
    const id = canon(siteId);
    return rows.filter(r => ACTIVE.indexOf(r.status) >= 0 &&
      (canon(r.site) === id || (r.siteName || "").toLowerCase() === String(siteId).toLowerCase()));
  };

  // Semua record (incident + maintenance) yang menyentuh satu rack.
  RO.rackHistory = async function (rackId) {
    const [maint, inc] = await Promise.all([RO.loadMaintenance(), RO.loadIncidents()]);
    const id = canon(rackId);
    const match = r => r && canon(r.rack) === id;
    return {
      maintenance: (maint || []).filter(match),
      incidents: (inc || []).filter(match),
    };
  };

  // Rack yang sedang maintenance aktif berdasarkan RECORD modul Maintenance
  // (bukan hardcode status di RACKS). Dipakai untuk menyorot kartu site.
  RO.activeRacks = async function () {
    const rows = await RO.loadMaintenance();
    const out = {};
    rows.filter(r => ACTIVE.indexOf(r.status) >= 0).forEach(r => {
      if (!r.rack) return;
      const id = canon(r.rack);
      if (!out[id]) out[id] = { count: 0, first: null };
      out[id].count++;
      if (!out[id].first) out[id].first = r;
    });
    return out;
  };
})();